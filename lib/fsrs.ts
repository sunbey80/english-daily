/**
 * 复现引擎 / SRS 调度（§5）——把"复习"藏进"读故事"。
 *
 *   点词(不认识)  → again → stability 降、due_at 拉近（很快在后续章节再现）
 *   读完未点目标词 → good  → stability 升、due_at 推远（隔几天自然再现）
 *   exposures 达阈值且持续未被点 → state=2 已习得，退出复现池
 *
 * 说明：这里是一个**简化的 FSRS 风格**调度，保留 stability/difficulty/due_at
 * 三个核心字段与 again/good 两种评分。生产前建议替换为成熟实现（如 ts-fsrs），
 * 接口（rate / 字段）已对齐，便于平滑替换。
 */

export type Grade = 'again' | 'good';

export interface SrsState {
  state: number; // 0=未接触 1=学习中 2=已习得
  exposures: number;
  stability: number;
  difficulty: number; // 1–10
  due_at: string | null; // ISO 时间
  last_seen_at: string | null;
}

/** exposures 达到此阈值且最近评分为 good 时，判定已习得（§5「7–12 次」）。 */
export const MASTERY_EXPOSURES = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * 根据一次评分更新 SRS 状态。
 * @param prev  当前状态
 * @param grade again（点词不认识）| good（读完未点，隐式正确）
 * @param now   当前时间，默认 Date.now()
 */
export function rate(prev: SrsState, grade: Grade, now: Date = new Date()): SrsState {
  const exposures = prev.exposures + 1;
  let { stability, difficulty } = prev;

  if (grade === 'again') {
    // 难度上调，稳定度回落，很快重现
    difficulty = clamp(difficulty + 1, 1, 10);
    stability = Math.max(0.5, stability * 0.5);
  } else {
    // 难度略降，稳定度按当前难度增长
    difficulty = clamp(difficulty - 0.5, 1, 10);
    const growth = 1 + (1.8 - difficulty * 0.08); // 难度越低增长越快
    stability = stability <= 0 ? 1 : stability * Math.max(1.2, growth);
  }

  // 下次到期：间隔 ≈ stability 天（again 最短约 1 天，保证次日可复现）
  const intervalDays = grade === 'again' ? Math.min(1, stability) : Math.max(1, stability);
  const due = new Date(now.getTime() + intervalDays * DAY_MS);

  // 状态流转
  let state = Math.max(prev.state, 1); // 一旦接触至少进入"学习中"
  if (grade === 'good' && exposures >= MASTERY_EXPOSURES && difficulty <= 5) {
    state = 2; // 已习得，退出复现池
  }

  return {
    state,
    exposures,
    stability,
    difficulty,
    due_at: due.toISOString(),
    last_seen_at: now.toISOString(),
  };
}

/** 新词首次进入学习池的初始状态。 */
export function initState(now: Date = new Date()): SrsState {
  return {
    state: 1,
    exposures: 0,
    stability: 0,
    difficulty: 5,
    due_at: now.toISOString(),
    last_seen_at: null,
  };
}
