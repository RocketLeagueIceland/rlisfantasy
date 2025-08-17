import { prisma } from './prisma'
import { computeWeekPointsFanRL } from './substitutions'
import type { RoleOnField } from './config'

/**
 * Rebuild TeamWeekScore for a given week number.
 * - Reads PlayerGameStat for that week
 * - Builds each team’s lineup from Team.members (uses stored role)
 * - Computes total + breakdown and upserts TeamWeekScore
 */
export async function rebuildWeekScores(weekNumber: number) {
  const week = await prisma.week.findUnique({ where: { number: weekNumber } })
  if (!week) throw new Error('Week not found')

  // Gather all stat lines for the week
  const players = await prisma.player.findMany({
    include: {
      stats: {
        where: { weekId: week.id },
        orderBy: { id: 'asc' },
      },
    },
  })

  const statLinesByPlayerId: Record<string, any[]> = {}
  for (const p of players) {
    statLinesByPlayerId[p.id] = p.stats.map((s) => ({
      goals: Number(s.goals ?? 0),
      assists: Number(s.assists ?? 0),
      saves: Number(s.saves ?? 0),
      shots: Number(s.shots ?? 0),
      score: Number((s as any).score ?? 0),
    }))
  }

  // Compute per team
  const teams = await prisma.team.findMany({
    include: { members: true },
  })

  for (const team of teams) {
    const lineup = team.members.map((m) => ({
      playerId: m.playerId,
      role: ((m.role as RoleOnField) || 'MIDFIELD') as RoleOnField,
    }))

    const { total, breakdown } = computeWeekPointsFanRL({ statLinesByPlayerId }, lineup)

    await prisma.teamWeekScore.upsert({
      where: { teamId_weekId: { teamId: team.id, weekId: week.id } },
      create: {
        teamId: team.id,
        weekId: week.id,
        points: Math.round(total),
        breakdown: JSON.stringify(breakdown),
      },
      update: {
        points: Math.round(total),
        breakdown: JSON.stringify(breakdown),
      },
    })
  }
}
