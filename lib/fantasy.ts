import { prisma } from './prisma'
import { computeWeekPoints } from './substitutions'
import type { RoleOnField } from './config'

export async function rebuildWeekScores(weekNumber: number) {
  const week = await prisma.week.findUnique({ where: { number: weekNumber } })
  if (!week) throw new Error('Week not found')

  const players = await prisma.player.findMany({ include: { stats: { where: { weekId: week.id }, orderBy: { id: 'asc' } } } })
  const teamWeeks = await prisma.teamWeek.findMany({ where: { weekId: week.id }, include: { rlTeam: { include: { players: true } } } })

  // Map playerId -> games the RL team played
  const teamGamesByPlayerId: Record<string, number> = {}
  for (const tw of teamWeeks) {
    for (const p of tw.rlTeam.players) teamGamesByPlayerId[p.id] = tw.games
  }

  // Map playerId -> their stat lines (ordered)
  const statLinesByPlayerId: Record<string, any[]> = {}
  for (const p of players) statLinesByPlayerId[p.id] = p.stats.map(s => ({ goals: s.goals, assists: s.assists, saves: s.saves, shots: s.shots, demos: s.demos }))

  const teams = await prisma.team.findMany({ include: { members: { include: { player: true } } } })

  for (const team of teams) {
    const actives = team.members
      .filter(m => m.isActive)
      .sort((a,b) => (a.activeOrder!-b.activeOrder!))
      .map(m => ({ playerId: m.playerId, role: m.role as RoleOnField }))

    const bench   = team.members
      .filter(m => !m.isActive)
      .sort((a,b) => (a.benchOrder!-b.benchOrder!))
      .map(m => ({ playerId: m.playerId }))

    const { total, breakdown } = computeWeekPoints({ teamGamesByPlayerId, statLinesByPlayerId }, actives, bench)

    await prisma.teamWeekScore.upsert({
      where: { teamId_weekId: { teamId: team.id, weekId: week.id } },
      create: { teamId: team.id, weekId: week.id, points: Math.round(total), breakdown: JSON.stringify(breakdown) },
      update: { points: Math.round(total), breakdown: JSON.stringify(breakdown) },
    })
  }
}