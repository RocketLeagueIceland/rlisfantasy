// scripts/recalc-week.ts
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { rebuildWeekScores } from '../lib/fantasy'

async function main() {
  const n = Number(process.argv[2])
  if (!n) {
    console.error('Usage: tsx scripts/recalc-week.ts <weekNumber>')
    process.exit(1)
  }
  await rebuildWeekScores(n)
  console.log(`Rebuilt TeamWeekScore for week ${n}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
