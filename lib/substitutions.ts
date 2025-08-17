// lib/substitutions.ts
import type { RoleOnField } from './config'
import { breakdownPoints } from './scoring'

export type WeekContext = {
  statLinesByPlayerId: Record<string, { goals: number; assists: number; saves: number; shots: number; score?: number }[]>
}

export type Slot = { playerId: string; role: RoleOnField }

export function computeWeekPointsFanRL(
  ctx: WeekContext,
  lineup: Slot[],
) {
  let total = 0
  const breakdown: Array<{
    playerId: string
    role: RoleOnField
    stats: { goals: number; assists: number; saves: number; shots: number; score?: number }
    points: number
    details: { goalsPts: number; assistsPts: number; savesPts: number; shotsPts: number; scorePts: number; bonusPts: number }
  }> = []

  for (const s of lineup) {
    const games = ctx.statLinesByPlayerId[s.playerId] || []
    for (const g of games) {
      const det = breakdownPoints(g, s.role)
      total += det.total
      breakdown.push({
        playerId: s.playerId,
        role: s.role,
        stats: g,
        points: det.total,
        details: {
          goalsPts: det.goalsPts,
          assistsPts: det.assistsPts,
          savesPts: det.savesPts,
          shotsPts: det.shotsPts,
          scorePts: det.scorePts,
          bonusPts: det.bonusPts,
        },
      })
    }
  }

  return { total, breakdown }
}
