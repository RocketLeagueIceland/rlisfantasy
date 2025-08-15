// lib/fantasy.ts
import { prisma } from './prisma'
import { withPositionBonus } from './scoring'
import type { RoleOnField } from './config'

export async function rebuildWeekScores(weekNumber: number) {
  const week = await prisma.week.findUnique({ where: { number: weekNumber } })
  if (!week) throw new Error('Week not found')

  // One average row per player per week
  const players = await prisma.player.findMany({
    include: {
      stats: { where: { weekId: week.id } }, // should be 0..1 rows after @@unique
    },
  })

  // Map playerId -> average stat line (or zeros if missing)
  const averagesByPlayerId: Record<string, { goals: number; assists: number; saves: number; shots: number; score?: number }> = {}
  for (const p of players) {
    const s = p.stats[0]
    averagesByPlayerId[p.id] = s
      ? { goals: s.goals, assists: s.assists, saves: s.saves, shots: s.shots, score: s.score ?? 0 }
      : { goals: 0, assists: 0, saves: 0, shots: 0, score: 0 }
  }

  const teams = await prisma.team.findMany({ include: { members: true } })

  for (const team of teams) {
    let total = 0
    const breakdown: any[] = []

    for (const m of team.members) {
      const avg = averagesByPlayerId[m.playerId] || { goals: 0, assists: 0, saves: 0, shots: 0, score: 0 }
      // Apply position bonus ONCE to the series average
      const pts = withPositionBonus(avg, (m.role as RoleOnField) || null)
      total += pts
      breakdown.push({ playerId: m.playerId, role: m.role, avg, points: pts })
    }

    await prisma.teamWeekScore.upsert({
      where: { teamId_weekId: { teamId: team.id, weekId: week.id } },
      create: { teamId: team.id, weekId: week.id, points: Math.round(total), breakdown: JSON.stringify(breakdown) },
      update: { points: Math.round(total), breakdown: JSON.stringify(breakdown) },
    })
  }
}
