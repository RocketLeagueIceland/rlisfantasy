// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ---- Optional RL teams/players ----
// Fill these or leave empty to skip seeding RL data.
// Upsert-by-name so re-running will not duplicate.
const RL_TEAMS: { name: string; short?: string | null }[] = [
  // { name: 'Team Alpha', short: 'ALP' },
]
const PLAYERS: { name: string; team?: string | null; price?: number | null }[] = [
  // { name: 'Player One', team: 'Team Alpha', price: 1200 },
]

// ---- Date helpers ----
function parseYMD(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
}
function nextSunday(from = new Date()) {
  const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const dow = base.getUTCDay() // 0=Sun … 6=Sat
  const add = (7 - dow) % 7
  base.setUTCDate(base.getUTCDate() + add)
  return base
}
function atTimeUTC(base: Date, hour: number, minute = 0) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, minute, 0))
}

// ---- DB helpers ----
async function ensureRLTeam(name: string, short?: string | null) {
  const existing = await prisma.rLTeam.findFirst({ where: { name } })
  if (existing) {
    if (short && existing.short !== short) {
      return prisma.rLTeam.update({ where: { id: existing.id }, data: { short } })
    }
    return existing
  }
  return prisma.rLTeam.create({ data: { name, short: short ?? null } })
}

async function ensurePlayer(name: string, teamName?: string | null, price?: number | null) {
  const existing = await prisma.player.findFirst({ where: { name } })
  let rlTeamId: string | undefined
  if (teamName) {
    const team = await ensureRLTeam(teamName)
    rlTeamId = team.id
  }
  if (existing) {
    return prisma.player.update({
      where: { id: existing.id },
      data: {
        rlTeamId: rlTeamId ?? existing.rlTeamId,
        price: typeof price === 'number' ? price : existing.price,
      },
    })
  }
  return prisma.player.create({
    data: {
      name,
      rlTeamId: rlTeamId ?? null,
      price: typeof price === 'number' ? price : 10,
    },
  })
}

async function seedWeeks() {
  const envDate = process.env.FANTASY_WEEK1_DATE // YYYY-MM-DD (Sunday)
  const week1Date = envDate ? parseYMD(envDate) : nextSunday(new Date())

  const payload = Array.from({ length: 10 }, (_, i) => {
    const day = new Date(week1Date)
    day.setUTCDate(day.getUTCDate() + i * 7) // every next Sunday
    const firstBroadcastAt = atTimeUTC(day, 14, 0) // 14:00
    const unlockedAt       = atTimeUTC(day, 17, 0) // 17:00
    return {
      number: i + 1,
      startDate: firstBroadcastAt, // fine to equal firstBroadcastAt
      firstBroadcastAt,
      unlockedAt,
      isLocked: false,
    }
  })

  for (const w of payload) {
    await prisma.week.upsert({
      where: { number: w.number },
      update: {
        startDate: w.startDate,
        firstBroadcastAt: w.firstBroadcastAt,
        unlockedAt: w.unlockedAt,
        isLocked: w.isLocked,
      },
      create: {
        number: w.number,
        startDate: w.startDate,
        firstBroadcastAt: w.firstBroadcastAt,
        unlockedAt: w.unlockedAt,
        isLocked: w.isLocked,
      },
    })
  }
  console.log(`✅ Seeded/updated ${payload.length} weeks (Sundays 14:00→17:00).`)
}

async function seedRL() {
  for (const t of RL_TEAMS) await ensureRLTeam(t.name, t.short ?? null)
  for (const p of PLAYERS) await ensurePlayer(p.name, p.team ?? null, p.price ?? null)
  if (RL_TEAMS.length || PLAYERS.length) {
    console.log(`✅ Seeded/updated ${RL_TEAMS.length} RL teams and ${PLAYERS.length} players.`)
  } else {
    console.log('ℹ️ RL data arrays empty — skipping RL seeding.')
  }
}

async function main() {
  await seedWeeks()
  await seedRL()
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
