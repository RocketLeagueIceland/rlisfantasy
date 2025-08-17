// lib/scoring.ts
import { POINTS, POSITION_BONUS_MULTIPLIER, type RoleOnField } from './config'

export type StatLine = {
  goals: number
  assists: number
  saves: number
  shots: number
  score?: number
}

export function rawPoints(s: StatLine) {
  return (
    (s.goals ?? 0)   * POINTS.goal  +
    (s.assists ?? 0) * POINTS.assist+
    (s.saves ?? 0)   * POINTS.save  +
    (s.shots ?? 0)   * POINTS.shot  +
    (s.score ?? 0)   * POINTS.score
  )
}

/**
 * Skilar sundurliðun á stigum per stat + stöðubónus og heild.
 */
export function breakdownPoints(s: StatLine, role: RoleOnField | null | undefined) {
  const g  = (s.goals   ?? 0) * POINTS.goal
  const a  = (s.assists ?? 0) * POINTS.assist
  const sv = (s.saves   ?? 0) * POINTS.save
  const sh = (s.shots   ?? 0) * POINTS.shot
  const sc = (s.score   ?? 0) * POINTS.score

  let bonus = 0
  if (role && POSITION_BONUS_MULTIPLIER !== 1) {
    const multDelta = POSITION_BONUS_MULTIPLIER - 1
    if (role === 'STRIKER')  bonus = multDelta * (s.goals   ?? 0) * POINTS.goal
    if (role === 'MIDFIELD') bonus = multDelta * (s.assists ?? 0) * POINTS.assist
    if (role === 'DEFENSE')  bonus = multDelta * (s.saves   ?? 0) * POINTS.save
  }

  const total = g + a + sv + sh + sc + bonus
  return { goalsPts: g, assistsPts: a, savesPts: sv, shotsPts: sh, scorePts: sc, bonusPts: bonus, total }
}

/** Haldið til samræmis ef eitthvað kallar í þetta */
export function withPositionBonus(base: StatLine, role: RoleOnField | null | undefined) {
  return breakdownPoints(base, role).total
}
