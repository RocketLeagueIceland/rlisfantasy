import { POINTS, POSITION_BONUS_MULTIPLIER, type RoleOnField } from './config'

type StatLine = { goals: number; assists: number; saves: number; shots: number; score?: number }

export function rawPoints(s: StatLine) {
  return (
    (s.goals ?? 0) * POINTS.goal +
    (s.assists ?? 0) * POINTS.assist +
    (s.saves ?? 0) * POINTS.save +
    (s.shots ?? 0) * POINTS.shot +
    (s.score ?? 0) * POINTS.score
  )
}

export function withPositionBonus(base: StatLine, role: RoleOnField | null | undefined) {
  const basePts = rawPoints(base)
  if (!role || POSITION_BONUS_MULTIPLIER === 1) return basePts
  const mult = POSITION_BONUS_MULTIPLIER - 1
  if (role === 'STRIKER') return basePts + mult * (base.goals ?? 0) * POINTS.goal
  if (role === 'MIDFIELD') return basePts + mult * (base.assists ?? 0) * POINTS.assist
  if (role === 'DEFENSE') return basePts + mult * (base.saves ?? 0) * POINTS.save
  return basePts
}
