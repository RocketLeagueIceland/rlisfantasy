export const dynamic = 'force-dynamic';
export const revalidate = 0;

// app/api/market/sell/route.ts
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { assertMarketOpen, assertTransferAvailable, markTransferUsed } from '@/lib/utils'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Market must be open; also gives us the active week (for transfer logging)
  let week: { id: string } | null = null
  try {
    week = await assertMarketOpen()
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Market locked' }, { status: e?.status ?? 400 })
  }

  const userId = (session.user as any).id as string
  const { teamPlayerId } = await req.json()

  const team = await prisma.team.findUnique({ where: { userId } })
  const tp = await prisma.teamPlayer.findUnique({ where: { id: teamPlayerId }, include: { player: true } })
  if (!team || !tp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (tp.teamId !== team.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const count = await prisma.teamPlayer.count({ where: { teamId: team.id } })

  // If team is NOT locked in → unlimited sells (no weekly transfer consumed)
  if (!team.isLockedIn) {
    await prisma.$transaction([
      prisma.team.update({ where: { id: team.id }, data: { budgetSpent: { decrement: tp.pricePaid } } }),
      prisma.teamPlayer.delete({ where: { id: tp.id } }),
    ])
    return NextResponse.json({ ok: true })
  }

  // Team IS locked in:
  // If currently full (6) then this SELL consumes the weekly transfer
  if (count >= 6) {
    try {
      await assertTransferAvailable(team.id, count)
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'No transfer left this week' }, { status: e?.status || 429 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.team.update({ where: { id: team.id }, data: { budgetSpent: { decrement: tp.pricePaid } } })
      await tx.teamPlayer.delete({ where: { id: tp.id } })
      if (week) await markTransferUsed(team.id, week.id, tx)
    })

    return NextResponse.json({ ok: true })
  }

  // Locked-in but not full → allow selling without consuming the transfer
  await prisma.$transaction([
    prisma.team.update({ where: { id: team.id }, data: { budgetSpent: { decrement: tp.pricePaid } } }),
    prisma.teamPlayer.delete({ where: { id: tp.id } }),
  ])

  return NextResponse.json({ ok: true })
}
