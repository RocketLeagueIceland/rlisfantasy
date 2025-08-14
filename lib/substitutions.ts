import type { RoleOnField } from './config'
import { withRoleBonus } from './scoring'

export type GamePoints = { playerId: string; points: number }

export type WeekContext = {
  // how many games each RL team played that week (from TeamWeek)
  teamGamesByPlayerId: Record<string, number>
  // Stat lines for each (player, game) they actually played
  statLinesByPlayerId: Record<string, { goals: number; assists: number; saves: number; shots: number; demos: number }[]> // ordered by game time
}

export type ActiveSlot = {
  playerId: string
  role: RoleOnField
}

export type BenchSlot = { playerId: string }

export function computeWeekPoints(
  ctx: WeekContext,
  activeOrdered: ActiveSlot[], // length: 3, strength order 1..3
  benchOrdered: BenchSlot[],   // length: 3, strength order 1..3
) {
  // Clone bench game queues (FIFO per bench player)
  const benchQueues = benchOrdered.map((b) => ({
    playerId: b.playerId,
    games: [...(ctx.statLinesByPlayerId[b.playerId] || [])],
  }))

  const breakdown: { active: any[]; benchUsage: any[] } = { active: [], benchUsage: [] }
  let total = 0

  // For each active in strength order 1..3
  for (const active of activeOrdered) {
    const teamGames = ctx.teamGamesByPlayerId[active.playerId] || 0
    const activeGames = (ctx.statLinesByPlayerId[active.playerId] || [])
    const playedCount = activeGames.length
    const missing = Math.max(0, teamGames - playedCount)

    // Points for games the active actually played
    for (const stats of activeGames) {
      const p = withRoleBonus(stats, active.role)
      total += p
    }
    breakdown.active.push({ playerId: active.playerId, role: active.role, played: playedCount })

    // If missing, fill using bench 1 -> 2 -> 3; each bench game consumed once globally
    let toFill = missing
    let benchIdx = 0
    while (toFill > 0 && benchIdx < benchQueues.length) {
      const q = benchQueues[benchIdx]
      if (q.games.length === 0) { benchIdx++; continue }
      const stats = q.games.shift()! // consume earliest game
      const p = withRoleBonus(stats, active.role) // bench inherits role
      total += p
      breakdown.benchUsage.push({ fromBench: q.playerId, forActive: active.playerId, role: active.role, stats })
      toFill--
    }
  }

  return { total, breakdown }
}