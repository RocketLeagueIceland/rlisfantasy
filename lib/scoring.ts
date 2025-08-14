import { POINTS, ROLE_BONUS } from './config'
import type { RoleOnField } from './config'

type StatLine = { goals: number; assists: number; saves: number; shots: number; demos: number }

export function rawPoints(s: StatLine) {
  return (
    s.goals * POINTS.goal +
    s.assists * POINTS.assist +
    s.saves * POINTS.save +
    s.shots * POINTS.shot +
    s.demos * POINTS.demo
  )
}

export function withRoleBonus(base: StatLine, role: RoleOnField | null | undefined) {
  if (!role) return rawPoints(base)
  let total = rawPoints(base)
  if (role === 'SHOOTER') total += base.goals * POINTS.goal // +100% of goal points
  if (role === 'CREATOR') total += base.assists * POINTS.assist
  if (role === 'WALL') total += base.saves * POINTS.save
  return total
}