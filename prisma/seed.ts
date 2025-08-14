import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Icelandic Esports League – Season 10 (League Play) teams & rosters
// Source: Liquipedia
const IESL_S10 = [
  { team: { name: 'Þór', short: 'THOR' }, players: ['steb', 'Bjarni', 'EmilVald'] },
  { team: { name: 'DUSTY', short: 'DUSTY' }, players: ['Vaddimah', 'Ousic', 'Cryypto'] },
  { team: { name: 'Stjarnan', short: 'STJ' }, players: ['Dagsi', 'Day', 'Porsas'] },
  { team: { name: '354 Esports', short: 'E354' }, players: ['pez', 'Dan !', 'regser'] },
  { team: { name: 'OMON', short: 'OMON' }, players: ['Bizzy', 'Ómó', 'Vano'] },
  { team: { name: 'TBD (IESL S10)', short: 'TBD-S10' }, players: ['Tóni.', 'danslan', 'maca'] },
] as const

async function upsertIeslS10() {
  for (const entry of IESL_S10) {
    // Prefer matching by short; fallback to name
    let team = await prisma.rLTeam.findFirst({ where: { short: entry.team.short } })
    if (!team) team = await prisma.rLTeam.findFirst({ where: { name: entry.team.name } })

    if (team) {
      team = await prisma.rLTeam.update({
        where: { id: team.id },
        data: { name: entry.team.name, short: entry.team.short },
      })
    } else {
      team = await prisma.rLTeam.create({ data: { name: entry.team.name, short: entry.team.short } })
    }

    for (const pname of entry.players) {
      const existing = await prisma.player.findFirst({ where: { name: pname } })
      if (existing) {
        await prisma.player.update({ where: { id: existing.id }, data: { rlTeamId: team.id } })
      } else {
        await prisma.player.create({ data: { name: pname, rlTeamId: team.id, price: 20 } })
      }
    }
  }
}

async function main() {
  await upsertIeslS10()
  console.log('Seeded IESL Season 10 teams & players')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })