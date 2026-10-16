/**
 * 米国東部時間（ET）の日付・時刻を日本時間（JST）に換算する（米国版のカレンダー・発表予定の表示用）。
 *
 * 米国は夏時間（EDT＝UTC−4）が「3月の第2日曜日〜11月の第1日曜日」で、それ以外は標準時（EST＝UTC−5）。
 * 日本時間は ET＋13時間（夏時間）／＋14時間（標準時）。日付の変わり目をまたぐ発表（FOMCの声明 14:00 ET → 日本時間は翌3:00 など）は、
 * 日本の日付として翌日になる。日付だけが分かっている発表（時刻が分からない）は換算しない。
 * 切り替え当日の時刻（午前2時台）は考慮しない（発表の時間帯に該当しないため）。
 */

const pad = (n) => String(n).padStart(2, "0");

/** その年のn番目の日曜日の日（1〜31）。month は1〜12 */
function nthSunday(year, month, n) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=日
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}

/** "YYYY-MM-DD"（米国の日付）が夏時間（EDT）か */
export function isUsDst(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = Date.UTC(y, 2, nthSunday(y, 3, 2)); // 3月第2日曜
  const end = Date.UTC(y, 10, nthSunday(y, 11, 1)); // 11月第1日曜
  const t = Date.UTC(y, m - 1, d);
  return t >= start && t < end;
}

/**
 * 米国の日付＋ET時刻 → 日本時間。
 * @param {string} dateStr "YYYY-MM-DD"（米国の現地の日付）
 * @param {string} hhmm "HH:MM"（ET）
 * @returns {{date: string, time: string, nextDay: boolean, dst: boolean, etDate: string, etTime: string}}
 */
export function etToJst(dateStr, hhmm) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const dst = isUsDst(dateStr);
  const ms = Date.UTC(y, m - 1, d, hh, mm) + (dst ? 13 : 14) * 3600e3;
  const j = new Date(ms);
  const date = `${j.getUTCFullYear()}-${pad(j.getUTCMonth() + 1)}-${pad(j.getUTCDate())}`;
  return { date, time: `${j.getUTCHours()}:${pad(j.getUTCMinutes())}`, nextDay: date !== dateStr, dst, etDate: dateStr, etTime: `${hh}:${pad(mm)}` };
}

/** 「22:30 JST（米国 11/6 8:30 ET）」のような表示用の文字列 */
export function jstLabel(conv) {
  const [, m, d] = conv.etDate.split("-").map(Number);
  return `${conv.time} JST（米国 ${m}/${d} ${conv.etTime} ET）`; // 日付は日本時間側に置いているため「翌日」は付けない
}

/**
 * イベントの時刻の文章（例：「14:00 ET（声明）／14:30 ET（記者会見）」）に含まれる ET 時刻をすべて日本時間に直した
 * 文章を返す。ET時刻が無ければ null。date は米国の日付。
 */
export function convertEventTime(dateStr, text) {
  if (!text) return null;
  // 「14:00 ET（声明）」のように、直後の（…）は説明ラベル。「翌3:00 JST（声明・14:00 ET）」の形にする
  const re = /(\d{1,2}):(\d{2}) ET(?:（([^）]*)）)?/g;
  let first = null;
  const out = text.replace(re, (_, h, mi, label) => {
    const c = etToJst(dateStr, `${h}:${mi}`);
    if (!first) first = c;
    const [, m, d] = dateStr.split("-").map(Number);
    return `${c.time} JST（${label ? label + "・" : ""}米国 ${m}/${d} ${h}:${mi} ET）`; // 日付は日本時間に直して別に表示するため「翌」は付けない
  });
  return first ? { jstDate: first.date, text: out } : null;
}
