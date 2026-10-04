/**
 * 米国の「経済指標以外」の重要イベント（FOMC・議事要旨・ベージュブック・FRB議長/副議長の講演・
 * ジャクソンホール会議）の日程と、発表済みイベントの結果を、FRB・カンザスシティ連銀の公式
 * ページから取得する。AIによる要約・解釈は行わず、公式文書の記載をそのまま構造化／リンクする。
 *
 * 取得元:
 *  - FOMCカレンダー（会合日程・SEP有無）  federalreserve.gov/monetarypolicy/fomccalendars.htm
 *  - FOMC声明文（政策金利の決定・投票・前回との文言差分）、SEP（経済見通しの中央値）
 *  - FOMC議事要旨（決定日の3週間後。公式のルール）
 *  - ベージュブック一覧（日程と本文リンク）
 *  - FRBの月別イベントカレンダー（講演・議会証言。当月分は静的HTML）＋講演RSS（原稿リンク）
 *  - カンザスシティ連銀のジャクソンホール会議ページ
 */
import { FOMC_CALENDAR_URL, parseFomcMeetings } from "./fetch-fomc-calendar.mjs";
import { fetchText, stripTags, ymd, isoDate, addDays, diffTokens } from "./events-util.mjs";

const BASE = "https://www.federalreserve.gov";
const WINDOW_PAST_DAYS = 400;
const WINDOW_FUTURE_DAYS = 400;
// 講演・証言は「議長・副議長（監督担当を含む）」に限定（理事・連銀総裁は件数が多くノイズになるため）
const SPEAKER_FILTER = /Chair/;

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "3-3/4" → 3.75, "1/4" → 0.25, "4" → 4 */
export function fracToNum(tok) {
  return tok.split("-").reduce((sum, part) => {
    if (part.includes("/")) {
      const [a, b] = part.split("/").map(Number);
      return sum + a / b;
    }
    return sum + Number(part);
  }, 0);
}

/** FOMC声明文HTMLから、投票・政策金利の決定・本文を取り出す */
export function parseStatement(html) {
  const start = html.indexOf('id="article"');
  if (start < 0) return null;
  const end = html.indexOf('id="lastUpdate"');
  const region = html.slice(start, end < 0 ? undefined : end);
  const allParas = [...region.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) =>
      stripTags(m[1])
        .replace(/[‐‑‒]/g, "-") // ノーブレークハイフン（"4‑1/4"）を通常のハイフンに
        .replace(/^For release at .*?\bShare\s+/, "") // 旧レイアウトの見出し部分
    )
    .filter(Boolean)
    .filter((p) => !/^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(p)); // 旧レイアウトの日付行
  const paras = allParas.filter(
    (p) => !/^(For media inquiries|Implementation Note|Voting (for|against)|Last Update)/i.test(p)
  );
  const approvedIdx = paras.findIndex((p) => /approved the following statement/i.test(p));
  const body = approvedIdx >= 0 ? paras.slice(approvedIdx + 1) : paras;
  if (!body.length) return null;

  // 投票結果：新レイアウトは冒頭の「…by a 12 – 0 vote」、旧レイアウトは末尾の氏名リストから数える
  let vote = null;
  const voteMatch = approvedIdx >= 0 ? paras[approvedIdx].match(/(\d+)\s*[–-]\s*(\d+)\s+vote/) : null;
  if (voteMatch) {
    vote = { for: Number(voteMatch[1]), against: Number(voteMatch[2]) };
  } else {
    // 賛成者と反対者は1つの段落に並ぶ（"Voting for … were A; B; and C. Voting against … were D, who preferred …"）
    const votePara = allParas.find((p) => /^Voting for the monetary policy action/i.test(p));
    if (votePara) {
      const [forPart, againstPart = ""] = votePara.split(/Voting against/i);
      const names = forPart
        .replace(/^Voting for the monetary policy action (?:were|was)\s*/i, "")
        .replace(/\.\s*$/, "")
        .split(";")
        .map((x) => x.replace(/^\s*and\s+/i, "").trim())
        .filter(Boolean);
      // 反対者は「A, who preferred …; and B and C, who preferred …」の形（区切りは ; か , で、1節に複数名のこともある）。
      // 「who …」の説明部分を区切り記号に置き換えてから、残った氏名の並びを数える。
      const against = againstPart
        .replace(/^\s*(this action\s+)?(were|was)\s+/i, "")
        .replace(/,?\s+who\b.*?(?=[;,]\s+and\s+[A-Z]|;\s*[A-Z]|$)/g, "|")
        .split("|")
        .map((x) => x.replace(/^[;,\s]*(and\s+)?/i, "").replace(/[.\s]+$/, ""))
        .filter(Boolean)
        .reduce((n, names) => n + names.split(/\s*,\s*(?:and\s+)?|\s+and\s+/i).filter(Boolean).length, 0);
      vote = { for: names.length, against };
    }
  }
  const text = body.join(" ");
  const dec = text.match(
    /decided to (raise|lower|maintain)\b[^.]*?(?:at|to)\s+(\d[\d\-/]*)\s+to\s+(\d[\d\-/]*)\s+percent/
  );
  const actionMap = { raise: "hike", lower: "cut", maintain: "hold" };
  return {
    paragraphs: body,
    text,
    vote,
    action: dec ? actionMap[dec[1]] : null,
    rangeLow: dec ? fracToNum(dec[2]) : null,
    rangeHigh: dec ? fracToNum(dec[3]) : null,
  };
}

const SEP_NAMES_JA = {
  "Change in real GDP": "実質GDP成長率",
  "Unemployment rate": "失業率",
  "PCE inflation": "PCE物価上昇率",
  "Core PCE inflation": "コアPCE物価上昇率",
  "Federal funds rate": "政策金利（年末の中央値）",
};

/** SEP（経済見通し）ページの Table 1 から、各変数の中央値（今回と前回）を取り出す */
export function parseSep(html) {
  const tStart = html.indexOf("<table", html.indexOf("Table 1."));
  if (tStart < 0) return null;
  const tEnd = html.indexOf("</table>", tStart);
  const table = html.slice(tStart, tEnd);

  const theadEnd = table.indexOf("</thead>");
  const years = [...table.slice(0, theadEnd).matchAll(/<th[^>]*>\s*(\d{4}|Longer run)\s*<\/th>/g)]
    .slice(0, 5)
    .map((m) => (m[1] === "Longer run" ? "長期" : m[1]));
  if (years.length < 5) return null;

  const rows = [];
  for (const tr of table.slice(theadEnd).matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const stub = tr[1].match(/<th[^>]*class="stub[^"]*"[^>]*>([\s\S]*?)<\/th>/);
    if (!stub) continue;
    const name = stripTags(stub[1].replace(/<sup>[\s\S]*?<\/sup>/g, "")); // 脚注番号（<sup>4</sup>等）を除く
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].slice(0, 5).map((m) => stripTags(m[1]));
    if (cells.length < 5) continue;
    if (/projection/i.test(name)) {
      const last = rows.at(-1);
      if (last && !last.prev) last.prev = cells;
    } else {
      rows.push({ name: SEP_NAMES_JA[name] ?? name, median: cells, prev: null });
    }
  }
  return rows.length ? { years, rows } : null;
}

/** 月別イベントカレンダーページを、セクション見出しごとの行配列にパースする */
export function parseMonthPage(html) {
  const parts = html.split(/<h4 class="col-md-12">([^<]*)<\/h4>/);
  const sections = [];
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i].trim();
    const rows = [];
    for (const chunk of parts[i + 1].split('<div class="panel-body">').slice(1)) {
      const time = chunk.match(/<div class="col-xs-2">\s*<p>([^<]*)<\/p>/)?.[1]?.trim() ?? "";
      const main = chunk.match(/<div class="col-xs-7">([\s\S]*?)<\/div>\s*<div class="col-xs-3">/)?.[1] ?? "";
      const day = chunk.match(/<div class="col-xs-3">\s*<p>\s*(\d+)/)?.[1];
      if (!main || !day) continue;
      const ps = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => ({
        raw: m[0],
        text: stripTags(m[1]),
      }));
      const title = ps[0]?.text ?? "";
      const topic = main.match(/<em>([\s\S]*?)<\/em>/)?.[1];
      const venue = ps.filter((p) => p.text && !/watchLive|calendar__title/.test(p.raw)).slice(1).map((p) => p.text).join(" ");
      rows.push({ time, title, topic: topic ? stripTags(topic) : "", venue, day: Number(day) });
    }
    sections.push({ name, rows });
  }
  return sections;
}

/** "10:45 a.m." → "10:45 ET"。解釈できない表記はそのまま返す */
function timeEt(raw) {
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);
  if (!m) return raw ? `${raw} ET` : "";
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === "p") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"} ET`;
}

function speakerJa(person) {
  if (/Vice Chair for Supervision/.test(person)) return "副議長（監督）";
  if (/Vice Chair/.test(person)) return "副議長";
  return "議長";
}

function lastName(person) {
  const words = person.replace(/\b(Jr|Sr|II|III|IV)\.?$/i, "").trim().split(/\s+/);
  return words.at(-1);
}

const KIND_JA = { Speech: "講演", Testimony: "議会証言", Discussion: "対談", Remarks: "発言" };

/** 講演RSS（直近のみ保持）を { surname, date, title, url } の配列にする */
export function parseSpeechFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => {
      const t = m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
      const url = m[1].match(/<link><!\[CDATA\[([^\]]+)\]\]><\/link>/)?.[1];
      const pub = m[1].match(/<pubDate><!\[CDATA\[([^\]]+)\]\]><\/pubDate>/)?.[1];
      const d = pub ? new Date(pub) : null;
      const comma = t.indexOf(",");
      if (!url || !d || Number.isNaN(d.getTime()) || comma < 0) return null;
      return {
        surname: t.slice(0, comma).trim().toLowerCase(),
        title: stripTags(t.slice(comma + 1)),
        date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
        url,
      };
    })
    .filter(Boolean);
}

/** ベージュブック一覧ページから { date, htmlUrl, pdfUrl } を取り出す */
export function parseBeigeBookList(html, fallbackYear) {
  const out = [];
  let year = fallbackYear;
  const re = /<th[^>]*id="year"[^>]*>\s*(\d{4})\s*<\/th>|<td>\s*([A-Za-z]+)\s+(\d{1,2})\s*:?([\s\S]*?)<\/td>/g;
  for (const m of html.matchAll(re)) {
    if (m[1]) {
      year = Number(m[1]);
      continue;
    }
    const mi = MONTH_NAMES.indexOf(m[2].toLowerCase());
    if (mi < 0) continue;
    const hrefs = [...m[4].matchAll(/href="([^"]+)"/g)].map((x) => new URL(x[1], BASE).href);
    out.push({
      date: new Date(Date.UTC(year, mi, Number(m[3]))),
      htmlUrl: hrefs.find((u) => /beigebook\d+-summary\.htm/.test(u)) ?? null,
      pdfUrl: hrefs.find((u) => /\.pdf$/i.test(u)) ?? null,
    });
  }
  return out;
}

/** 前回→今回の声明文の文言差分（単語単位） */
function statementDiff(prevText, curText) {
  return diffTokens(prevText.split(/\s+/), curText.split(/\s+/));
}

function mergeLinks(oldLinks = [], newLinks = []) {
  const map = new Map();
  for (const l of [...oldLinks, ...newLinks]) map.set(l.url, l);
  return [...map.values()];
}

/**
 * FRB関連イベントをすべて組み立てる。
 * existing: 既存のevents.jsonのevents（発表済みの結果を再取得しないために使う）
 * 戻り値: { events, failedSrc: Set<string> }  ※取得に失敗した取得元は呼び出し側が既存分を維持する
 */
export async function buildFedEvents(existing, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const winStart = addDays(today, -WINDOW_PAST_DAYS);
  const winEnd = addDays(today, WINDOW_FUTURE_DAYS);
  const oldById = new Map(existing.map((e) => [e.id, e]));
  const events = [];
  const failedSrc = new Set();

  /* ---------- FOMC会合・議事要旨 ---------- */
  const cal = await fetchText(FOMC_CALENDAR_URL);
  if (!cal.ok) {
    failedSrc.add("fomc");
  } else {
    const meetings = parseFomcMeetings(cal.text)
      .filter((m) => !m.notation)
      .sort((a, b) => a.end - b.end);

    for (let i = 0; i < meetings.length; i++) {
      const m = meetings[i];
      if (m.end < winStart || m.end > winEnd) continue;
      const code = ymd(m.end);
      const id = `fomc-${code}`;
      const stmtUrl = `${BASE}/newsevents/pressreleases/monetary${code}a.htm`;
      const ev = {
        id,
        src: "fomc",
        type: "fomc",
        date: isoDate(m.end),
        title: "FOMC（政策金利の決定）",
        short: "FOMC",
        subtitle: `${m.start.getUTCMonth() + 1}/${m.start.getUTCDate()}–${m.end.getUTCMonth() + 1}/${m.end.getUTCDate()}の2日間会合${m.sep ? "・経済見通し（SEP）公表あり" : ""}`,
        time: "14:00 ET（声明）／14:30 ET（記者会見）",
        status: "scheduled",
        links: [],
      };
      const old = oldById.get(id);

      if (old?.status === "done" && old.result) {
        events.push({ ...old, subtitle: ev.subtitle, short: ev.short });
      } else if (m.end <= today) {
        const st = await fetchText(stmtUrl);
        const parsed = st.ok ? parseStatement(st.text) : null;
        if (parsed) {
          ev.status = "done";
          ev.links.push({ label: "声明文（公式）", url: stmtUrl });
          ev.links.push({ label: "記者会見（公式）", url: `${BASE}/monetarypolicy/fomcpresconf${code}.htm` });
          ev.result = {
            action: parsed.action,
            rangeLow: parsed.rangeLow,
            rangeHigh: parsed.rangeHigh,
            vote: parsed.vote,
            lead: parsed.paragraphs[0],
          };
          // 前回会合の声明文との差分
          const prev = meetings[i - 1];
          if (prev) {
            const prevSt = await fetchText(`${BASE}/newsevents/pressreleases/monetary${ymd(prev.end)}a.htm`);
            const prevParsed = prevSt.ok ? parseStatement(prevSt.text) : null;
            if (prevParsed) {
              ev.result.prevRangeLow = prevParsed.rangeLow;
              ev.result.prevRangeHigh = prevParsed.rangeHigh;
              ev.diff = { prevDate: isoDate(prev.end), segments: statementDiff(prevParsed.text, parsed.text) };
            }
          }
          if (m.sep) {
            const projUrl = `${BASE}/monetarypolicy/fomcprojtabl${code}.htm`;
            const pj = await fetchText(projUrl);
            const sep = pj.ok ? parseSep(pj.text) : null;
            if (sep) {
              ev.sep = sep;
              ev.links.push({ label: "経済見通し（SEP・公式）", url: projUrl });
            }
          }
        }
      }
      if (!events.some((e) => e.id === id)) events.push(ev);

      // 議事要旨（決定日の3週間後）
      const minDate = addDays(m.end, 21);
      const minId = `fomc-minutes-${code}`;
      const minUrl = `${BASE}/monetarypolicy/fomcminutes${code}.htm`;
      const oldMin = oldById.get(minId);
      const minEv = {
        id: minId,
        src: "fomc",
        type: "minutes",
        date: isoDate(minDate),
        title: "FOMC議事要旨",
        short: "FOMC議事要旨",
        subtitle: `${m.start.getUTCMonth() + 1}/${m.start.getUTCDate()}–${m.end.getUTCMonth() + 1}/${m.end.getUTCDate()}会合分（決定日の3週間後に公表）`,
        time: "14:00 ET",
        status: "scheduled",
        links: [],
      };
      if (oldMin?.status === "done") {
        events.push({ ...oldMin, subtitle: minEv.subtitle, short: minEv.short });
      } else {
        if (minDate <= today) {
          const r = await fetchText(minUrl);
          if (r.ok) {
            minEv.status = "done";
            minEv.links.push({ label: "議事要旨（公式）", url: minUrl });
          }
        }
        events.push(minEv);
      }
    }
  }

  /* ---------- ベージュブック ---------- */
  const bb = await fetchText(`${BASE}/monetarypolicy/publications/beige-book-default.htm`);
  if (!bb.ok) {
    failedSrc.add("beige");
  } else {
    for (const b of parseBeigeBookList(bb.text, today.getUTCFullYear())) {
      if (b.date < winStart || b.date > winEnd) continue;
      const links = [];
      if (b.htmlUrl) links.push({ label: "要約（公式）", url: b.htmlUrl });
      if (b.pdfUrl) links.push({ label: "全文PDF（公式）", url: b.pdfUrl });
      events.push({
        id: `beige-${ymd(b.date)}`,
        src: "beige",
        type: "beige",
        date: isoDate(b.date),
        title: "ベージュブック（地区連銀経済報告）",
        short: "ベージュブック",
        subtitle: "各地区連銀の景況感をまとめた報告。FOMCの約2週間前に公表",
        time: "14:00 ET",
        status: links.length ? "done" : "scheduled",
        links,
      });
    }
  }

  /* ---------- FRB議長・副議長の講演／議会証言 ---------- */
  const feed = await fetchText(`${BASE}/feeds/speeches_and_testimony.xml`);
  const speeches = feed.ok ? parseSpeechFeed(feed.text) : [];
  let pageFailed = false;
  for (let k = -1; k <= 3; k++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + k, 1));
    const y = d.getUTCFullYear();
    const mi = d.getUTCMonth();
    let page = await fetchText(`${BASE}/newsevents/${y}-${MONTH_NAMES[mi]}.htm`);
    if (!page.ok) page = await fetchText(`${BASE}/newsevents/${y}-${String(mi + 1).padStart(2, "0")}.htm`);
    if (!page.ok) {
      if (k <= 1) pageFailed = true; // 当月・前月・翌月が取れない場合のみ失敗扱い（先の月は未作成のことがある）
      continue;
    }
    const sec = parseMonthPage(page.text).find((s) => /^Speeches/i.test(s.name));
    for (const row of sec?.rows ?? []) {
      const kindMatch = row.title.match(/^(Speech|Testimony|Discussion|Remarks)\b/i);
      if (!kindMatch || !SPEAKER_FILTER.test(row.title)) continue;
      const person = row.title.replace(/^[A-Za-z]+\s*-\s*/, "").trim();
      const date = new Date(Date.UTC(y, mi, row.day));
      const surname = lastName(person);
      const kind = KIND_JA[kindMatch[1][0].toUpperCase() + kindMatch[1].slice(1).toLowerCase()] ?? "発言";
      const id = `speech-${ymd(date)}-${surname.toLowerCase()}`;
      const ev = {
        id,
        src: "fedpage",
        type: kindMatch[1].toLowerCase() === "testimony" ? "testimony" : "speech",
        date: isoDate(date),
        title: `${speakerJa(person)} ${surname} ${kind}`,
        short: `${speakerJa(person)} ${surname}`,
        subtitle: [row.topic, row.venue].filter(Boolean).join(" ／ "),
        time: timeEt(row.time),
        status: date < today ? "done" : "scheduled",
        links: [],
      };
      const hit = speeches.find(
        (s) => s.surname === surname.toLowerCase() && Math.abs(s.date - date) <= 86400000
      );
      if (hit) {
        ev.status = "done";
        ev.links.push({ label: "講演原稿（公式）", url: hit.url });
        ev.result = { headline: hit.title };
      }
      events.push(ev);
    }
  }
  if (pageFailed) failedSrc.add("fedpage");

  /* ---------- ジャクソンホール会議 ---------- */
  for (const y of [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
    const id = `jackson-${y}`;
    const old = oldById.get(id);
    const pageUrl = `https://www.kansascityfed.org/research/jackson-hole-economic-symposium/${y}/`;
    if (old && old.endDate && new Date(old.endDate) < today) {
      events.push(old);
      continue;
    }
    const r = await fetchText(pageUrl);
    if (!r.ok) continue; // 未発表の年は404（正常）
    const dates = [...stripTags(r.text).matchAll(/(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/g)]
      .map((m) => {
        const mi = MONTH_NAMES.indexOf(m[1].toLowerCase());
        return mi < 0 || Number(m[3]) !== y ? null : new Date(Date.UTC(y, mi, Number(m[2])));
      })
      .filter(Boolean)
      .sort((a, b) => a - b);
    if (!dates.length) continue;
    const start = dates[0];
    const end = dates.at(-1);
    events.push({
      id,
      src: "jackson",
      type: "jackson",
      date: isoDate(start),
      endDate: isoDate(end),
      title: "ジャクソンホール会議",
      short: "ジャクソンホール",
      subtitle: "カンザスシティ連銀主催の経済政策シンポジウム。FRB議長の講演が金融政策の方向性を示す場として注目される",
      time: "",
      status: end < today ? "done" : "scheduled",
      links: [{ label: "プログラム・講演（カンザスシティ連銀）", url: pageUrl }],
    });
  }

  // 既存の結果・リンクを引き継ぐ（RSSの掲載期間を過ぎた講演原稿リンク等を失わないため）
  const merged = events.map((e) => {
    const old = oldById.get(e.id);
    if (!old) return e;
    return {
      ...e,
      status: old.status === "done" ? "done" : e.status,
      links: mergeLinks(old.links, e.links),
      result: e.result ?? old.result,
      diff: e.diff ?? old.diff,
      sep: e.sep ?? old.sep,
    };
  });
  return { events: merged, failedSrc };
}
