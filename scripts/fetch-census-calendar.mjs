/**
 * 米国勢調査局（Census Bureau）公式の経済指標発表カレンダー（一覧表示）から、
 * 指定した指標名（部分一致）の次回発表日を取得する。
 *
 * 一部のFRED系列は、FREDのNext Release Dateメタデータが実際の発表元とは別の
 * 「リリースファミリー」に紐づいてしまっており、誤った日付を返すことがある
 * （例：耐久財受注 DGORDER は本来「Advance Report on Durable Goods」（月末付近に
 * 速報値を公表）のデータだが、FREDのメタデータは「M3 Full Report」（翌月2日頃、
 * 確定値の公表）の日付を返してしまう）。このような指標だけ、Census公式カレンダー
 * を直接パースして正しい日付を使う。
 *
 * ページのHTML構造（2026年時点で確認済み）：
 *   <tr>
 *     <td><a href="...">Advance Report on Durable Goods--Manufacturers' ...</a></td>
 *     <td sorttable_customkey="202609250830">September 25, 2026</td>
 *     ...
 *   </tr>
 * のように、各行に発表日がYYYYMMDDHHmm形式のソートキーとして埋め込まれている。
 */
export async function fetchNextCensusReleaseDate(indicatorNameIncludes) {
  const url = "https://www.census.gov/economic-indicators/calendar-listview.html";
  const res = await fetch(url, { headers: { "User-Agent": "us-economic-tracker" } });
  if (!res.ok) return null;
  const html = await res.text();
  return parseNextCensusReleaseDate(html, indicatorNameIncludes);
}

/** テスト容易性のためパース処理を分離（fetchと切り離して単体で検証できる） */
export function parseNextCensusReleaseDate(html, indicatorNameIncludes, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  const dates = [];
  for (const rowMatch of html.matchAll(rowRe)) {
    const row = rowMatch[1];
    if (!row.includes(indicatorNameIncludes)) continue;
    const keyMatch = row.match(/sorttable_customkey="(\d{12})"/);
    if (!keyMatch) continue;
    const key = keyMatch[1]; // "YYYYMMDDHHmm"
    const yyyy = Number(key.slice(0, 4));
    const mm = Number(key.slice(4, 6)) - 1;
    const dd = Number(key.slice(6, 8));
    const d = new Date(Date.UTC(yyyy, mm, dd));
    if (Number.isNaN(d.getTime())) continue;
    dates.push(d);
  }

  const upcoming = dates.filter((d) => d.getTime() >= today.getTime()).sort((a, b) => a - b);
  if (!upcoming.length) return null;
  const d = upcoming[0];
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
