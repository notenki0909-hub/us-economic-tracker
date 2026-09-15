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
 * 直近期間の変化幅の平均と、その直前期間の変化幅の平均を比べ、符号（プラス/マイナス）が
 * 反転した「転換点」を検知する。単発のノイズに惑わされないよう、単純な前期比ではなく
 * 直近複数期間の平均同士を比較する。窓の大きさは発表頻度によって変える
 * （日次はノイズが大きいため長め、四半期はデータが少ないため短め）。
 */
const TURNING_POINT_WINDOW = { daily: 10, weekly: 4, monthly: 3, quarterly: 2 };

function computeTurningPoint(points, frequency) {
  const window = TURNING_POINT_WINDOW[frequency] ?? 3;
  if (points.length < window * 2 + 1) return null;
  const diffs = [];
  for (let i = 1; i < points.length; i++) diffs.push(points[i].value - points[i - 1].value);
  if (diffs.length < window * 2) return null;
  const recent = diffs.slice(-window);
  const prior = diffs.slice(-window * 2, -window);
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const recentAvg = avg(recent);
  const priorAvg = avg(prior);
  if (recentAvg === 0 || priorAvg === 0) return null;
  const flipped = Math.sign(recentAvg) !== Math.sign(priorAvg);
  // momentumRatio: 符号が同じ（まだ転換していない）場合の「勢いの残り具合」。
  // 1に近いほど直前期間から変わっていない、0に近いほど転換点（符号の反転）に近づいている。
  const momentumRatio = recentAvg / priorAvg;
  // recentPoints/priorPointsは、recent/prior（diffs）と同じ添字範囲を points 側に対応させたもの
  // （diffs[k] は points[k+1]-points[k] なので、同じ負のインデックス範囲がそのまま対応する）。
  // 「どの期間とどの期間を比べているか」をフロントで具体的な日付として表示するために使う。
  const recentPoints = points.slice(-window);
  const priorPoints = points.slice(-window * 2, -window);
  const recentPeriod = { from: recentPoints[0].t, to: recentPoints.at(-1).t };
  const priorPeriod = { from: priorPoints[0].t, to: priorPoints.at(-1).t };
  return {
    recentAvg,
    priorAvg,
    direction: recentAvg > 0 ? "up" : "down",
    flipped,
    momentumRatio,
    recentPeriod,
    priorPeriod,
  };
}

/** {from, to} の期間を人が読める文字列にする（同じ時点なら1つだけ表示） */
function periodLabel(period) {
  if (!period) return "";
  return period.from === period.to ? period.from : `${period.from}〜${period.to}`;
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
 * 「景気回復シグナル」の機械判定に使う4指標（米国版限定）。新規失業保険申請件数・JOLTS求人件数・
 * 長短金利差・S&P500は、いずれも景気回復局面で先行して改善するとされる代表的な指標の組み合わせ
 * （Web調査に基づく）。日本版にはこれらに相当する指標が存在しないため、該当指標が4つとも揃わない
 * 場合は自動的に null になる（日本版のコードを分岐させる必要がない設計）。
 */
const RECOVERY_SIGNAL_IDS = ["jobless_claims_us", "job_openings_us", "yield_curve_spread_us", "sp500_us"];

/**
 * 「景気後退警戒コンボ」の機械判定に使う4指標（米国版限定）。景気回復シグナルと対称になるよう、
 * サーム・ルール発動・逆イールド・VIX高水準・新規失業保険申請件数の警戒水準超えという、
 * いずれも有名な後退警戒シグナルの組み合わせを採用。閾値N（何件以上で「重なっている」とするか）は
 * 景気回復シグナルと同じ基準（4件中3件以上）を使う。片方だけ発動しやすい基準にすると恣意的な
 * 非対称になるため、意図的に揃えている。
 */
const RECESSION_SIGNAL_IDS = ["sahm_rule_us", "yield_curve_spread_us", "vix_us", "jobless_claims_us"];
const COMBO_ACTIVE_THRESHOLD = 3; // 4指標中3件以上で「シグナルが重なっている」と判定（回復・後退で共通）
const MOMENTUM_RATIO_THRESHOLD = 0.6; // 勢い（momentumRatio）がこれ未満まで弱まったら「気配あり」

/**
 * 全指標を機械的に集計し、「現在の経済状況サマリー」を生成する（ルールベース、AI不使用）。
 * - improving/worsening: betterWhen と前期比の符号だけで判定する単純な集計（因果関係の解説はしない）
 * - statusFindings: 目安ライン（referenceLines）に対して現在どちら側にあるかの機械的な判定
 * - surpriseFindings: 指標自身の過去の変化幅の分布から見て、直近の変化が統計的に珍しいかどうか
 * - turningSignalFindings: 直近の変化の向きが直前の期間から反転した（flipped）、またはまだ反転して
 *   いないが勢いが弱まっている（気配）指標を1つに統合したもの。改善→悪化／悪化→改善のどちらも
 *   対等に扱い、どちらを優先すべきかという価値判断はしない。0〜100%の近さ（proximity。反転済みは
 *   100）をフロントでバー表示する
 * - recoverySignal: RECOVERY_SIGNAL_IDSのうち一定数が同時に改善方向にあるかの機械判定（米国版限定）
 * - recessionSignal: RECESSION_SIGNAL_IDSのうち一定数が同時に目安ライン超え（警戒水準）にあるかの
 *   機械判定（米国版限定）。isConcerningはstatusFindingsと全く同じ判定を再利用している
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
  const turningSignalFindings = [];
  const byId = new Map();

  for (const ind of indicators) {
    const s = ind.summary;
    if (!s) continue;

    // 改善/悪化の内訳は「直近1期間 vs その前の1期間」の単純比較なので、比較している具体的な
    // 期間をチップのツールチップで表示できるよう、対象2点の日付を持たせる。
    const latestT = ind.points?.at(-1)?.t ?? null;
    const prevT = ind.points?.length >= 2 ? ind.points.at(-2).t : null;
    const nameEntry = {
      id: ind.id,
      name: ind.name,
      category: ind.category,
      period: prevT && latestT ? { from: prevT, to: latestT } : null,
    };
    let isImproving = null;
    if (ind.betterWhen !== "neutral" && s.changeFromPrev != null && s.changeFromPrev !== 0) {
      const good = s.changeFromPrev > 0 === (ind.betterWhen === "up");
      isImproving = good;
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
    const idEntry = { name: ind.name, isImproving, isConcerning: false, trendFavorable: null };
    byId.set(ind.id, idEntry);

    if (ind.betterWhen !== "neutral") {
      for (const line of ind.referenceLines || []) {
        if (line.kind !== "neutral" && line.kind !== "target") continue;
        const above = s.latest.value >= line.value;
        const concerning = ind.betterWhen === "up" ? !above : above;
        if (!concerning) continue;
        idEntry.isConcerning = true;
        // detail: 「指標名：」に続けて読める断片。text: 単独でも読める完全な文。
        statusFindings.push({
          id: ind.id,
          name: ind.name,
          category: ind.category,
          detail: `目安「${line.label}」を${above ? "上回っており" : "下回っており"}、注意が必要な水準です。`,
          text: `${ind.name}は現在、目安「${line.label}」を${above ? "上回って" : "下回って"}おり、注意が必要な水準です。`,
        });
      }

      // 転換点（符号反転）と転換の気配（勢いの鈍化）は、どちらもcomputeTurningPointの同じ
      // momentumRatioに基づく連続した1つの指標のため、1つの「転換シグナル」として統合する
      // （リストとバーに分けて2ブロック表示していたものを1ブロックに集約）。
      const tp = computeTurningPoint(ind.points ?? [], ind.frequency);
      if (tp) {
        idEntry.trendFavorable = tp.direction === "up" === (ind.betterWhen === "up");
      }
      if (tp?.flipped) {
        const favorable = idEntry.trendFavorable;
        const word = favorable ? "改善" : "悪化";
        const recentLabel = periodLabel(tp.recentPeriod);
        const priorLabel = periodLabel(tp.priorPeriod);
        turningSignalFindings.push({
          id: ind.id,
          name: ind.name,
          category: ind.category,
          favorable,
          flipped: true,
          proximity: 100,
          period: { recent: tp.recentPeriod, prior: tp.priorPeriod },
          detail: `直近（${recentLabel}）の傾向が、その前（${priorLabel}）から${word}方向に転じました（転換点を通過）。`,
          text: `${ind.name}は、直近（${recentLabel}）の傾向が、その前（${priorLabel}）から${word}方向に転じました（転換点を通過）。`,
        });
      } else if (tp && tp.momentumRatio < MOMENTUM_RATIO_THRESHOLD) {
        // まだ転換点は通過していないが、勢いが弱まっている＝転換の「気配」。
        // proximity: 0〜100（100に近いほど転換点に近い）。フロントでバー表示に使う。
        const proximity = Math.round((1 - tp.momentumRatio) * 100);
        const favorable = idEntry.trendFavorable;
        const trendWord = favorable ? "改善" : "悪化";
        const cautionWord = favorable
          ? "改善の勢いが鈍化しており、今後の反転に注意が必要です"
          : "悪化の勢いが鈍化しており、改善に転じる兆しの可能性があります";
        const recentLabel = periodLabel(tp.recentPeriod);
        const priorLabel = periodLabel(tp.priorPeriod);
        turningSignalFindings.push({
          id: ind.id,
          name: ind.name,
          category: ind.category,
          favorable,
          flipped: false,
          proximity,
          period: { recent: tp.recentPeriod, prior: tp.priorPeriod },
          detail: `直近（${recentLabel}）は${trendWord}方向ですが、その前（${priorLabel}）と比べて勢いが${Math.round(tp.momentumRatio * 100)}%まで弱まっています。${cautionWord}。`,
          text: `${ind.name}は直近（${recentLabel}）${trendWord}方向ですが、その前（${priorLabel}）と比べて勢いが${Math.round(tp.momentumRatio * 100)}%まで弱まっています。${cautionWord}。`,
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
  turningSignalFindings.sort((a, b) => b.proximity - a.proximity);

  // 「直近の傾向（継続中）」：転換シグナルに載っている指標（転換済み・気配あり）を除いた残りを、
  // 複数期間平均の傾向（trendFavorable）で改善継続／悪化継続／横ばい・中立に分類する。
  // 改善/悪化の内訳（単純な前期比較）と対になる、複数期間ベースの内訳。
  const turningIds = new Set(turningSignalFindings.map((f) => f.id));
  const continuingImprovingList = [];
  const continuingWorseningList = [];
  const continuingNeutralList = [];
  for (const ind of indicators) {
    if (!ind.summary || turningIds.has(ind.id)) continue;
    const nameEntry = { id: ind.id, name: ind.name, category: ind.category };
    const entry = byId.get(ind.id);
    if (ind.betterWhen === "neutral" || entry?.trendFavorable == null) {
      continuingNeutralList.push(nameEntry);
    } else if (entry.trendFavorable) {
      continuingImprovingList.push(nameEntry);
    } else {
      continuingWorseningList.push(nameEntry);
    }
  }

  const total = improving + worsening + neutralCount;
  const headline = `${total}指標中、改善傾向が${improving}件、悪化傾向が${worsening}件、横ばい・中立が${neutralCount}件です。`;

  let recoverySignal = null;
  const recoveryEntries = RECOVERY_SIGNAL_IDS.map((id) => byId.get(id)).filter(Boolean);
  if (recoveryEntries.length === RECOVERY_SIGNAL_IDS.length) {
    const improvingCount = recoveryEntries.filter((e) => e.isImproving === true).length;
    const active = improvingCount >= COMBO_ACTIVE_THRESHOLD;
    const recoveryNames = recoveryEntries.map((e) => e.name).join("・");
    recoverySignal = {
      active,
      count: improvingCount,
      total: RECOVERY_SIGNAL_IDS.length,
      // items: 4指標それぞれの現在の寄与状況（サマリー上でチップとして常に表示し、
      // 「4指標とは何か」が非発動時にも分かるようにする）
      items: RECOVERY_SIGNAL_IDS.map((id, i) => ({
        id,
        name: recoveryEntries[i].name,
        contributing: recoveryEntries[i].isImproving === true,
      })),
      text: active
        ? `景気回復に関連するとされる4指標（${recoveryNames}）のうち` +
          `${improvingCount}件が同時に改善方向にあり、景気回復を示唆するシグナルが重なっています。`
        : `景気回復に関連するとされる4指標（${recoveryNames}）のうち、` +
          `同時に改善方向にあるのは${improvingCount}件にとどまり、明確な回復シグナルの重なりは見られません。`,
    };
  }

  let recessionSignal = null;
  const recessionEntries = RECESSION_SIGNAL_IDS.map((id) => byId.get(id)).filter(Boolean);
  if (recessionEntries.length === RECESSION_SIGNAL_IDS.length) {
    const concerningCount = recessionEntries.filter((e) => e.isConcerning).length;
    const active = concerningCount >= COMBO_ACTIVE_THRESHOLD;
    const recessionNames = recessionEntries.map((e) => e.name).join("・");
    recessionSignal = {
      active,
      count: concerningCount,
      total: RECESSION_SIGNAL_IDS.length,
      items: RECESSION_SIGNAL_IDS.map((id, i) => ({
        id,
        name: recessionEntries[i].name,
        contributing: recessionEntries[i].isConcerning,
      })),
      text: active
        ? `景気後退の警戒シグナルとされる4指標（${recessionNames}）のうち` +
          `${concerningCount}件が同時に警戒水準にあり、後退リスクを示すシグナルが重なっています。`
        : `景気後退の警戒シグナルとされる4指標（${recessionNames}）のうち、` +
          `同時に警戒水準にあるのは${concerningCount}件にとどまり、明確な後退警戒シグナルの重なりは見られません。`,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    stats: { total, improving, worsening, neutral: neutralCount, surpriseCount: surpriseFindings.length },
    headline,
    improvingList,
    worseningList,
    neutralList,
    continuingImprovingList,
    continuingWorseningList,
    continuingNeutralList,
    statusFindings: statusFindings.slice(0, 8),
    surpriseFindings: surpriseFindings.slice(0, 6),
    turningSignalFindings: turningSignalFindings.slice(0, 10),
    recoverySignal,
    recessionSignal,
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
