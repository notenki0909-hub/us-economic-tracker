/**
 * FRED各系列ページに掲載されている「Next Release Date」を取得する。
 * BLS・BEA・FRB・Census Bureau等が公表している公式の発表予定日を、FRED自身が
 * メタデータとして保持しているため、新たなデータソース・規約リスクを増やさずに
 * 「次回発表予定日」を表示できる。
 *
 * 市場予想（コンセンサス）は、政府統計機関ではなく民間データベンダーが集計する
 * 商用データのため、無償・登録不要で取得できるソースが存在しない（investing.com は
 * 技術的・規約的に不可、Trading Economics の無償アクセスも廃止済み）。取得できるまでは
 * フロントエンド側で「未定」と表示する。
 */
export async function fetchNextReleaseDate(seriesId) {
  const url = `https://fred.stlouisfed.org/series/${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, { headers: { "User-Agent": "us-economic-tracker" } });
  if (!res.ok) return null;
  const html = await res.text();

  const idx = html.indexOf("Next Release Date:");
  if (idx === -1) return null;
  const chunk = html.slice(idx, idx + 200);
  const m = chunk.match(/Next Release Date:\s*<span[^>]*>([^<]+)</);
  if (!m) return null;

  const d = new Date(m[1].trim()); // 例: "Oct 2, 2026"
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
