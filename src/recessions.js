/**
 * NBER（全米経済研究所）Business Cycle Dating Committee が認定する景気後退期。
 * 出典: https://www.nber.org/research/data/us-business-cycle-expansions-and-contractions
 * （2026-09-11 に一次情報を確認。以降に新しい景気循環が確定した場合は要更新）
 *
 * NBERの定義：後退期は「山（peak）の翌月」〜「谷（trough）の月」。
 */
export const RECESSIONS = [
  { start: "1990-08", end: "1991-03", label: "1990年代初頭の景気後退" },
  { start: "2001-04", end: "2001-11", label: "ITバブル崩壊" },
  { start: "2008-01", end: "2009-06", label: "世界金融危機（リーマン・ショック）" },
  { start: "2020-03", end: "2020-04", label: "コロナショック" },
];
