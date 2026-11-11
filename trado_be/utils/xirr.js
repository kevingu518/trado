/**
 * XIRR — 資金加權年化報酬（MWR, money-weighted return）
 *
 * 解 NPV(r) = Σ amount_i / (1 + r)^(years_i) = 0，其中 years 用 365 天為單位。
 * 現金流以「投資人」角度記號：投入資金為負、收回為正（期末淨值視為全部收回）。
 *
 * 與 TWR 的差別：
 *   TWR 把每天報酬串起來，投入多少錢不影響結果 —— 衡量「進出方法」好壞。
 *   XIRR 對「大筆、長時間」的資金給更高權重 —— 衡量「這筆錢實際賺多少」。
 *   兩者落差大，通常代表加碼時機（資金進場的時點）在拉抬或拖累結果。
 */

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const dayValue = (iso) => new Date(`${iso}T00:00:00Z`).getTime();

const npvAt = (points, rate) =>
  points.reduce((sum, p) => sum + p.amount / (1 + rate) ** p.years, 0);

const slopeAt = (points, rate) =>
  points.reduce((sum, p) => sum - (p.years * p.amount) / (1 + rate) ** (p.years + 1), 0);

/**
 * @param {Array<{date: string, amount: number}>} flows date = YYYY-MM-DD
 * @returns {number|null} 年化報酬（比例，非百分比）；現金流同號或無解時回 null
 */
export const xirr = (flows) => {
  if (!Array.isArray(flows)) return null;

  const sorted = flows
    .filter((f) => f && Number.isFinite(f.amount) && f.amount !== 0 && f.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (sorted.length < 2) return null;

  // 全部同號代表沒有「先投入後收回」的結構，方程式無解，不要硬湊一個數字
  const hasOutflow = sorted.some((f) => f.amount < 0);
  const hasInflow = sorted.some((f) => f.amount > 0);
  if (!hasOutflow || !hasInflow) return null;

  const t0 = dayValue(sorted[0].date);
  const points = sorted.map((f) => ({
    amount: f.amount,
    years: (dayValue(f.date) - t0) / YEAR_MS,
  }));

  // 1. 牛頓法：一般情況 5~10 次迭代就收斂
  let rate = 0.1;
  for (let i = 0; i < 100; i += 1) {
    const npv = npvAt(points, rate);
    const slope = slopeAt(points, rate);
    if (!Number.isFinite(npv) || !Number.isFinite(slope) || slope === 0) break;
    const next = rate - npv / slope;
    if (!Number.isFinite(next) || next <= -1) break; // 跑到 r ≤ −100% 代表發散
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }

  // 2. 二分法：牛頓法失敗時保證收斂（前提是變號存在）
  let lo = -0.9999;
  let hi = 1;
  let fLo = npvAt(points, lo);
  let fHi = npvAt(points, hi);
  while (Math.sign(fLo) === Math.sign(fHi) && hi < 1000) {
    hi *= 2;
    fHi = npvAt(points, hi);
  }
  if (Math.sign(fLo) === Math.sign(fHi)) return null;

  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(points, mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
};
