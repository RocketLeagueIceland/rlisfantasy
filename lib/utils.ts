// lib/utils.ts
import { prisma } from './prisma'

/**
 * Returns the "active" fantasy week that transfers should count against.
 * We pick the next upcoming week (unlockedAt > now), earliest by firstBroadcastAt.
 */
export async function getActiveTransferWeek() {
  const now = new Date()
  const w = await prisma.week.findFirst({
    where: { unlockedAt: { gt: now } },
    orderBy: { firstBroadcastAt: 'asc' },
  })
  return w || null
}

/** True if we are currently inside the broadcast lock window for the active week. */
export function isWithinLockWindow(week: { firstBroadcastAt: Date; unlockedAt: Date }) {
  const now = new Date()
  return now >= week.firstBroadcastAt && now < week.unlockedAt
}

/** Throws if market is locked (manual lock or within broadcast window). */
export async function assertMarketOpen() {
  const week = await getActiveTransferWeek()
  if (!week) return null // season not scheduled → treat as open
  if (week.isLocked || isWithinLockWindow(week)) {
    const err: any = new Error('Markaður er læstur.')
    err.status = 423
    throw err
  }
  return week
}

/** Enforce 1 transfer per week once team is full (6). */
export async function assertTransferAvailable(teamId: string, currentSize: number) {
  // Free build phase: before you reach 6 players → unlimited changes
  if (currentSize < 6) return { week: await assertMarketOpen(), alreadyUsed: false }

  const week = await assertMarketOpen()
  if (!week) return { week: null, alreadyUsed: false }

  const used = await prisma.transferLog.findUnique({
    where: { teamId_weekId: { teamId, weekId: week.id } },
    select: { id: true },
  })
  if (used) {
    const err: any = new Error('Þú hefur þegar gert skipti þessa viku.')
    err.status = 429
    throw err
  }
  return { week, alreadyUsed: false }
}

/** Mark the weekly transfer as used (call inside same transaction as the change). */
export async function markTransferUsed(teamId: string, weekId: string, tx = prisma) {
  await tx.transferLog.upsert({
    where: { teamId_weekId: { teamId, weekId } },
    create: { teamId, weekId },
    update: {},
  })
}