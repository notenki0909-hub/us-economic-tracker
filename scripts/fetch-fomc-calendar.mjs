/**
 * FRB公式のFOMC会合カレンダーから、会合日程を取得する。
 *
 * FEDFUNDS（実効フェデラルファンド金利・月次平均）はFRED上で「H.15 Selected
 * Interest Rates」というほぼ毎営業日更新されるリリースの一部として扱われており、
 * FREDが返す「Next Release Date」メタデータは月次平均値の更新日ともFOMC会合の
 * 日程とも一致しない（単なる次の統計公表日になってしまう）。実際に利用者が
 * 知りたいのは「次はいつ金利が動くかもしれないか＝次回FOMC会合日」のため、
 * FF金利（fed_funds_rate_us）に限り、FRBが公式に公表しているFOMC会合カレンダー
 * ページを直接パースして使う。イベントカレンダー（fetch-fed-events.mjs）も同じ
 * パース結果を使う。
 *
 * ページのHTML構造（2026年時点で確認済み）：
 *   <div class="fomc-meeting__month ..."><strong>September</strong></div>
 *   <div class="fomc-meeting__date ...">15-16*</div>
 * のように「月」と「日付範囲」のdivが年ごとのセクション内で交互に出現する。
 * 日付範囲は "27-28"（2日間）・"17-18*"（SEP付き）・"22 (notation vote)"
 * （臨時会合）のような表記があり、いずれも「最後の日」が政策決定の発表日
 * （FOMC声明の公表日）に対応する。
 */
export const FOMC_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";

export async function fetchNextFomcDecisionDate() {
  const res = await fetch(FOMC_CALENDAR_URL, { headers: { "User-Agent": "us-economic-tracker" } });
  if (!res.ok) return null;
  const html = await res.text();
  return parseNextFomcDecisionDate(html);
}

const MONTH_INDEX = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

/**
 * カレンダーページから全会合を抽出する。
 * 戻り値: [{ start: Date, end: Date, sep: boolean, notation: boolean }]（UTC 0時）
 *   end ＝ 政策決定（声明）の発表日 / sep ＝ 経済見通し（SEP）付きの会合（日付に「*」）
 */
export function parseFomcMeetings(html) {
  // 年ごとのセクション（"2026 FOMC Meetings" 等）に分割する。
  // split結果は [前置き, "2026", セクション本文, "2025", セクション本文, ...] の並びになる。
  const yearSections = html.split(/(\d{4})\s+FOMC Meetings/);
  const meetings = [];

  for (let i = 1; i < yearSections.length; i += 2) {
    const year = Number(yearSections[i]);
    const body = yearSections[i + 1] ?? "";
    const monthRe = /fomc-meeting__month[^>]*><strong>([A-Za-z]+)<\/strong>/g;
    const dateRe = /fomc-meeting__date[^>]*>([^<]+)</g;
    // 月divと日付divはドキュメント順に1対1で交互出現するため、出現順に対応させる
    const months = [...body.matchAll(monthRe)].map((m) => m[1]);
    const dayRanges = [...body.matchAll(dateRe)].map((m) => m[1].trim());

    for (let j = 0; j < Math.min(months.length, dayRanges.length); j++) {
      const mi = MONTH_INDEX[months[j]];
      if (mi == null) continue;
      // "27-28" → "27-28" / "17-18*" → "17-18" / "22 (notation vote)" → "22"
      const cleaned = dayRanges[j].replace(/\*/g, "").replace(/\(.*\)/g, "").trim();
      const parts = cleaned.split("-").map((x) => Number(x.trim()));
      const firstDay = parts[0];
      const lastDay = parts[parts.length - 1];
      if (![firstDay, lastDay].every((n) => Number.isFinite(n) && n >= 1 && n <= 31)) continue;
      // 月をまたぐ会合（例 "31-1"）は開始日を前月にする
      meetings.push({
        start: new Date(Date.UTC(year, firstDay > lastDay ? mi - 1 : mi, firstDay)),
        end: new Date(Date.UTC(year, mi, lastDay)),
        sep: dayRanges[j].includes("*"),
        notation: /notation/i.test(dayRanges[j]),
      });
    }
  }
  return meetings;
}

/** テスト容易性のためパース処理を分離（fetchと切り離して単体で検証できる） */
export function parseNextFomcDecisionDate(html, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const upcoming = parseFomcMeetings(html)
    .map((m) => m.end)
    .filter((d) => d.getTime() >= today.getTime())
    .sort((a, b) => a - b);
  if (!upcoming.length) return null;
  const d = upcoming[0];
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
