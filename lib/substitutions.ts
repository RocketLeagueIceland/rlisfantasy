import type { RoleOnField } from './config'
import { withPositionBonus } from './scoring'

export type WeekContext = {
  statLinesByPlayerId: Record<string, { goals: number; assists: number; saves: number; shots: number; score?: number }[]>
}

export type Slot = { playerId: string; role: RoleOnField }

// 6 leikmenn: 2x STRIKER, 2x MIDFIELD, 2x DEFENSE
export function computeWeekPointsFantasy(ctx: WeekContext, lineup: Slot[]) {
  let total = 0
  const breakdown: any[] = []

  for (const s of lineup) {
    const games = ctx.statLinesByPlayerId[s.playerId] || []
    for (const g of games) {
      const pts = withPositionBonus(g, s.role)
      total += pts
      breakdown.push({ playerId: s.playerId, role: s.role, stats: g, points: pts })
    }
  }
  return { total, breakdown }
}
