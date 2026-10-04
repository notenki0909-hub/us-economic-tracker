/**
 * 指標ごとの「一定期間の変化幅」チェック（config の changeWatch を持つ指標のみ）。
 *
 * 信用スプレッドのように「この線を超えたら警戒」という確立した水準の目安がなく、水準そのものより
 * 短期間にどれだけ急に動いたか（変化幅）が重要な指標向け。次の2つを出す。
 *  - 警戒の目安：windowDays日間の変化が warnDelta 以上の拡大（過去の分布の上位数%にあたる値をconfigで指定）
 *  - z値：その期間の変化が、過去の同じ長さの変化の分布（全履歴）に対してどれだけ珍しいか。
 *    既存の「統計的に珍しい変化（z）」と同じく、(直近の変化 − 過去の平均) ÷ 過去の標準偏差
 * 表示用の points は2016年以降だが、分布は長期の履歴で計算する（直近10年だけではコロナ禍などの
 * 極端な時期に偏るため）。
 */

/**
 * @param {{date: string, value: number}[]} hist 日付昇順の全履歴
 * @param {{windowDays: number, warnDelta: number}} cfg
 */
export function computeChangeWatchFromHistory(hist, cfg) {
  if (hist.length < 100) return null;
  const dayMs = 86400000;
  const times = hist.map((p) => new Date(p.date).getTime());
  const priorIdx = (i) => {
    const target = times[i] - cfg.windowDays * dayMs;
    for (let j = i - 1; j >= 0; j--) if (times[j] <= target) return j;
    return -1;
  };
  const changes = [];
  for (let i = 0; i < hist.length; i++) {
    const j = priorIdx(i);
    if (j >= 0) changes.push(hist[i].value - hist[j].value);
  }
  if (changes.length < 100) return null;

  const latestChange = changes.at(-1);
  const base = changes.slice(0, -1);
  const mean = base.reduce((a, b) => a + b, 0) / base.length;
  const sd = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / base.length);
  if (!Number.isFinite(sd) || sd === 0) return null;
  const z = (latestChange - mean) / sd;
  const topPct = (100 * base.filter((c) => c >= latestChange).length) / base.length; // 「上位○%」

  const latest = hist.at(-1);
  const from = hist[priorIdx(hist.length - 1)];
  const level = latestChange >= cfg.warnDelta ? "alert" : z >= 1.5 ? "watch" : "normal";
  return {
    windowDays: cfg.windowDays,
    warnDelta: cfg.warnDelta,
    from: { t: from.date, value: from.value },
    to: { t: latest.date, value: latest.value },
    change: +latestChange.toFixed(2),
    z: +z.toFixed(1),
    topPct: +topPct.toFixed(1),
    level,
    historyStart: hist[0].date,
    historyCount: base.length,
  };
}
