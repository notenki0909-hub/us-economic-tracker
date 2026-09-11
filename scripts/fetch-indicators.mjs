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
        marketConsensus: null, // 市場予想（コンセンサス）。無償データ源が無いため常にnull＝「なし」表示
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
