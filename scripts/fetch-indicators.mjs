/**
 * FRED（セントルイス連邦準備銀行・利用登録不要）から全指標の時系列を取得し、
 * public/data/indicators.json に書き出す。
 *
 *   node scripts/fetch-indicators.mjs
 *
 * 毎回全期間を取り直すため「蓄積」は不要（速報値の改定にも自動追従）。
 * 変更履歴は git の差分で追える。
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { INDICATORS, CATEGORY_GUIDES } from "./indicators.config.mjs";
import { fetchFredSeries } from "./fetch-fred-series.mjs";
import { fetchNextReleaseDate } from "./fetch-fred-release-date.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/data");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 直近値・前期比・前年比などの派生指標 */
function summarize(points, frequency) {
  if (!points.length) return null;
  const n = points.length;
  const latest = points[n - 1];
  const prev = n >= 2 ? points[n - 2] : null;

  let yearAgo;
  if (frequency === "daily" || frequency === "weekly") {
    // 日次・週次は祝休日でズレるため、365日前以前で最も近い点を探す
    const targetMs = new Date(latest.date).getTime() - 365 * 86400000;
    for (let i = n - 1; i >= 0; i--) {
      if (new Date(points[i].date).getTime() <= targetMs) {
        yearAgo = points[i];
        break;
      }
    }
  } else {
    const lag = frequency === "quarterly" ? 4 : 12;
    yearAgo = n > lag ? points[n - 1 - lag] : null;
  }

  const diff = (a, b) => (a && b ? +(a.value - b.value).toFixed(4) : null);
  const strip = (p) => (p ? { t: p.t, value: p.value } : null);
  return {
    latest: { t: latest.t, value: latest.value, provisional: false },
    changeFromPrev: diff(latest, prev),
    changeFromYearAgo: diff(latest, yearAgo),
    min: strip(points.reduce((m, p) => (p.value < m.value ? p : m))),
    max: strip(points.reduce((m, p) => (p.value > m.value ? p : m))),
    count: n,
    start: points[0].t,
  };
}

/**
 * 過去の変化幅（前期比相当）の分布に対して、直近の変化がどれくらい珍しいかを表すz-score。
 * フロントエンド（main.js の computeSurprise）と同じロジック。ビルド時点のサプライズ判定に使う。
 */
function computeSurpriseZ(points) {
  if (points.length < 10) return null;
  const diffs = [];
  for (let i = 1; i < points.length; i++) diffs.push(points[i].value - points[i - 1].value);
  const latest = diffs.at(-1);
  const history = diffs.slice(0, -1);
  if (history.length < 8) return null;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const sd = Math.sqrt(variance);
  if (!Number.isFinite(sd) || sd === 0) return null;
  return (latest - mean) / sd;
}

/**
 * 全指標を機械的に集計し、「現在の経済状況サマリー」を生成する（ルールベース、AI不使用）。
 * - improving/worsening: betterWhen と前期比の符号だけで判定する単純な集計（因果関係の解説はしない）
 * - statusFindings: 目安ライン（referenceLines）に対して現在どちら側にあるかの機械的な判定
 * - surpriseFindings: 指標自身の過去の変化幅の分布から見て、直近の変化が統計的に珍しいかどうか
 * すべて公開統計の再集計であり、投資助言ではない旨を運用側（フロント）で明記すること。
 */
function buildEconSummary(indicators) {
  let improving = 0;
  let worsening = 0;
  let neutralCount = 0;
  const improvingList = [];
  const worseningList = [];
  const neutralList = [];
  const statusFindings = [];
  const surpriseFindings = [];

  for (const ind of indicators) {
    const s = ind.summary;
    if (!s) continue;

    const nameEntry = { id: ind.id, name: ind.name, category: ind.category };
    if (ind.betterWhen !== "neutral" && s.changeFromPrev != null && s.changeFromPrev !== 0) {
      const good = s.changeFromPrev > 0 === (ind.betterWhen === "up");
      if (good) {
        improving++;
        improvingList.push(nameEntry);
      } else {
        worsening++;
        worseningList.push(nameEntry);
      }
    } else {
      neutralCount++;
      neutralList.push(nameEntry);
    }

    if (ind.betterWhen !== "neutral") {
      for (const line of ind.referenceLines || []) {
        if (line.kind !== "neutral" && line.kind !== "target") continue;
        const above = s.latest.value >= line.value;
        const concerning = ind.betterWhen === "up" ? !above : above;
        if (!concerning) continue;
        // detail: 「指標名：」に続けて読める断片。text: 単独でも読める完全な文。
        statusFindings.push({
          id: ind.id,
          name: ind.name,
          category: ind.category,
          detail: `目安「${line.label}」を${above ? "上回っており" : "下回っており"}、注意が必要な水準です。`,
          text: `${ind.name}は現在、目安「${line.label}」を${above ? "上回って" : "下回って"}おり、注意が必要な水準です。`,
        });
      }
    }

    const z = computeSurpriseZ(ind.points ?? []);
    if (z != null && Number.isFinite(z) && Math.abs(z) >= 1.5) {
      const level = Math.abs(z) >= 2.5 ? "high" : "mid";
      const levelWord = level === "high" ? "非常に大きな" : "やや大きな";
      surpriseFindings.push({
        id: ind.id,
        name: ind.name,
        category: ind.category,
        z: +z.toFixed(1),
        level,
        detail: `${levelWord}変化が見られました（過去の変動幅と比べて統計的に珍しい動き、z=${z.toFixed(1)}）。`,
        text: `${ind.name}で${levelWord}変化が見られました（過去の変動幅と比べて統計的に珍しい動き、z=${z.toFixed(1)}）。`,
      });
    }
  }

  surpriseFindings.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

  const total = improving + worsening + neutralCount;
  const headline = `${total}指標中、改善傾向が${improving}件、悪化傾向が${worsening}件、横ばい・中立が${neutralCount}件です。`;

  return {
    generatedAt: new Date().toISOString(),
    stats: { total, improving, worsening, neutral: neutralCount, surpriseCount: surpriseFindings.length },
    headline,
    improvingList,
    worseningList,
    neutralList,
    statusFindings: statusFindings.slice(0, 8),
    surpriseFindings: surpriseFindings.slice(0, 6),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const out = [];
  const failures = [];

  for (const ind of INDICATORS) {
    process.stdout.write(`- ${ind.id} ... `);
    try {
      const points = await fetchFredSeries(ind.api.seriesId, ind.api.transform, ind.api.since);

      let nextRelease = null;
      try {
        nextRelease = await fetchNextReleaseDate(ind.api.seriesId);
      } catch {
        // 次回発表予定日の取得に失敗しても、本体データの取得は継続する（フロントは「未定」表示）
      }

      out.push({
        id: ind.id,
        name: ind.name,
        shortName: ind.shortName,
        category: ind.category,
        unit: ind.unit,
        unitLabel: ind.unitLabel,
        frequency: ind.frequency,
        seasonalAdjustment: ind.seasonalAdjustment,
        betterWhen: ind.betterWhen,
        importance: ind.importance,
        description: ind.description,
        judgment: ind.judgment,
        referenceLines: ind.referenceLines ?? [],
        movingAverage: ind.movingAverage ?? null,
        releaseSchedule: ind.releaseSchedule,
        nextRelease, // "YYYY-MM-DD" または null（未定）。FREDのNext Release Dateから取得
        // 市場予想（コンセンサス）は掲載しない：政府統計機関ではなく民間データベンダーの商用データで、
        // 無償・登録不要で配信するソースが構造的に存在しないため（README参照）。
        source: {
          provider: "FRED（セントルイス連邦準備銀行）",
          statName: ind.api.statName,
          sourceUrl: `https://fred.stlouisfed.org/series/${ind.api.seriesId}`,
        },
        summary: summarize(points, ind.frequency),
        points: points.map((p) => ({ t: p.t, value: p.value })),
      });
      console.log(`OK (${points.length}点, 最新 ${points.at(-1).t}=${points.at(-1).value})`);
    } catch (err) {
      console.log(`失敗: ${err.message}`);
      failures.push({ id: ind.id, error: err.message });
    }
    await sleep(300);
  }

  if (!out.length) {
    console.error("\n全指標の取得に失敗しました。既存の JSON は変更しません。");
    process.exit(1);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "FRED（セントルイス連邦準備銀行） https://fred.stlouisfed.org/",
    note: "各系列は毎回全期間を再取得しています（速報値の改定を反映）。",
    indicatorCount: out.length,
    failures,
    categoryGuides: CATEGORY_GUIDES,
    econSummary: buildEconSummary(out),
    indicators: out,
  };

  const file = resolve(OUT_DIR, "indicators.json");
  await writeFile(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`\n書き出し: ${file}`);
  console.log(`成功 ${out.length} / ${INDICATORS.length} 指標`);
  if (failures.length) {
    console.log(`失敗: ${failures.map((f) => f.id).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
