/**
 * FRED（セントルイス連邦準備銀行）のCSV配信から時系列を取得する。
 * 利用登録不要・APIキー不要で `fredgraph.csv?id=<SERIES_ID>` から直接取得できる。
 *
 * FRED の `units=` パラメータはこの軽量エンドポイントでは機能しないため、
 * 前年同月比・前月差などは取得後にこちら側で計算する（transform オプション）。
 */
const DEFAULT_SINCE = "1990-01-01"; // 月次・四半期系列の下限（データ量・表示性能の兼ね合い）

async function fetchRaw(seriesId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, { headers: { "User-Agent": "us-economic-tracker" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, raw] = lines[i].split(",");
    if (!date) continue;
    const trimmed = (raw ?? "").trim();
    if (trimmed === "" || trimmed === ".") continue; // 欠測値
    const value = Number(trimmed);
    if (!Number.isFinite(value)) continue;
    points.push({ date, value });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/** 日付ベースで「およそ n 日前」に最も近い点を探す（欠測・不定期な系列にも対応） */
function findClosestOnOrBefore(points, fromIdx, targetMs) {
  for (let i = fromIdx; i >= 0; i--) {
    if (new Date(points[i].date).getTime() <= targetMs) return points[i];
  }
  return null;
}

/**
 * @param {string} seriesId
 * @param {"level"|"yoy"|"mom_diff"} transform
 *   level    : そのまま
 *   yoy      : 365日前に最も近い点との前年同月比(%)
 *   mom_diff : 1つ前の点との差分（水準の変化量。例：雇用者数の増減）
 * @param {string} [since] 収録下限日（省略時 DEFAULT_SINCE）。日次・週次系列はデータ量が
 *   非常に多くなるため、個別に短い期間を指定することを想定。
 */
export async function fetchFredSeries(seriesId, transform = "level", since = DEFAULT_SINCE) {
  const raw = await fetchRaw(seriesId);
  if (!raw.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  if (transform === "level") {
    return raw.map((p) => ({ t: p.date, date: p.date, value: p.value })).filter((p) => p.date >= since);
  }

  const out = [];
  for (let i = 0; i < raw.length; i++) {
    if (transform === "mom_diff") {
      if (i === 0) continue;
      out.push({ t: raw[i].date, date: raw[i].date, value: raw[i].value - raw[i - 1].value });
    } else if (transform === "yoy") {
      const targetMs = new Date(raw[i].date).getTime() - 365 * 86400000;
      const prior = findClosestOnOrBefore(raw, i - 1, targetMs);
      if (!prior || prior.value === 0) continue;
      const pct = ((raw[i].value - prior.value) / Math.abs(prior.value)) * 100;
      out.push({ t: raw[i].date, date: raw[i].date, value: Math.round(pct * 100) / 100 });
    }
  }
  return out.filter((p) => p.date >= since);
}
