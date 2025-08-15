// lib/utils.ts
import { prisma } from '@/lib/prisma'

export async function isMarketLockedNow(): Promise<boolean> {
  const now = new Date()
  const week = await prisma.week.findFirst({
    where: {
      OR: [
        { AND: [{ firstBroadcastAt: { lte: now } }, { unlockedAt: { gt: now } }] }, // inside 14–17 window
        { isLocked: true }, // manual override
      ],
    },
    orderBy: { number: 'desc' },
  })
  return !!week
}

export async function assertMarketOpen() {
  if (await isMarketLockedNow()) {
    const err: any = new Error('Market locked (14:00–17:00) or manually locked')
    err.status = 400
    throw err
  }
}