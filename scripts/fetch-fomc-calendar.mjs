/**
 * FRB公式のFOMC会合カレンダーから、次回会合の最終日（政策決定発表日）を取得する。
 *
 * FEDFUNDS（実効フェデラルファンド金利・月次平均）はFRED上で「H.15 Selected
 * Interest Rates」というほぼ毎営業日更新されるリリースの一部として扱われており、
 * FREDが返す「Next Release Date」メタデータは月次平均値の更新日ともFOMC会合の
 * 日程とも一致しない（単なる次の統計公表日になってしまう）。実際に利用者が
 * 知りたいのは「次はいつ金利が動くかもしれないか＝次回FOMC会合日」のため、
 * FF金利（fed_funds_rate_us）に限り、FRBが公式に公表しているFOMC会合カレンダー
 * ページを直接パースして使う。
 *
 * ページのHTML構造（2026年時点で確認済み）：
 *   <div class="fomc-meeting__month ..."><strong>September</strong></div>
 *   <div class="fomc-meeting__date ...">15-16*</div>
 * のように「月」と「日付範囲」のdivが年ごとのセクション内で交互に出現する。
 * 日付範囲は "27-28"（2日間）・"17-18*"（SEP付き）・"22 (notation vote)"
 * （臨時会合）のような表記があり、いずれも「最後の日」が政策決定の発表日
 * （FOMC声明の公表日）に対応する。
 */
export async function fetchNextFomcDecisionDate() {
  const url = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
  const res = await fetch(url, { headers: { "User-Agent": "us-economic-tracker" } });
  if (!res.ok) return null;
  const html = await res.text();
  return parseNextFomcDecisionDate(html);
}

const MONTH_INDEX = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

/** テスト容易性のためパース処理を分離（fetchと切り離して単体で検証できる） */
export function parseNextFomcDecisionDate(html, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // 年ごとのセクション（"2026 FOMC Meetings" 等）に分割する。
  // split結果は [前置き, "2026", セクション本文, "2025", セクション本文, ...] の並びになる。
  const yearSections = html.split(/(\d{4})\s+FOMC Meetings/);
  const dates = [];

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
      const parts = cleaned.split("-").map((s) => s.trim());
      const lastDay = Number(parts[parts.length - 1]);
      if (!Number.isFinite(lastDay) || lastDay < 1 || lastDay > 31) continue;
      dates.push(new Date(Date.UTC(year, mi, lastDay)));
    }
  }

  const upcoming = dates.filter((d) => d.getTime() >= today.getTime()).sort((a, b) => a - b);
  if (!upcoming.length) return null;
  const d = upcoming[0];
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
