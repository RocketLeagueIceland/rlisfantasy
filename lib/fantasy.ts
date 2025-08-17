import { prisma } from './prisma'
import { computeWeekPointsFantasy } from './substitutions'
import type { RoleOnField } from './config'

export async function rebuildWeekScores(weekNumber: number) {
  const week = await prisma.week.findUnique({ where: { number: weekNumber } })
  if (!week) throw new Error('Week not found')

  const players = await prisma.player.findMany({
    include: { stats: { where: { weekId: week.id }, orderBy: { id: 'asc' } } },
  })

  const statLinesByPlayerId: Record<string, any[]> = {}
  for (const p of players) {
    statLinesByPlayerId[p.id] = p.stats.map(s => ({
      goals: s.goals, assists: s.assists, saves: s.saves, shots: s.shots, score: (s as any).score ?? 0,
    }))
  }

  // 👇 Aðeins lið sem eru staðfest fyrir byrjun útsendingar
  const teams = await prisma.team.findMany({
    where: {
      isLockedIn: true,
      lockedInAt: { lte: week.firstBroadcastAt },
    },
    include: { members: { include: { player: true } } },
  })

  for (const team of teams) {
    const lineup = team.members.map(m => ({ playerId: m.playerId, role: (m.role as any) || 'MIDFIELD' }))
    const { total, breakdown } = computeWeekPointsFanRL({ statLinesByPlayerId }, lineup)

    await prisma.teamWeekScore.upsert({
      where: { teamId_weekId: { teamId: team.id, weekId: week.id } },
      create: { teamId: team.id, weekId: week.id, points: Math.round(total), breakdown: JSON.stringify(breakdown) },
      update: { points: Math.round(total), breakdown: JSON.stringify(breakdown) },
    })
  }
}
