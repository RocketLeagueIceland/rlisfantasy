export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { assertMarketOpen } from '@/lib/utils'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await assertMarketOpen()
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Market locked' }, { status: e?.status ?? 400 })
  }

  const userId = (session.user as any).id as string
  const { playerId } = await req.json()

  const [team, player] = await Promise.all([
    prisma.team.findUnique({ where: { userId }, include: { members: true } }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ])
  if (!team || !player) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (team.members.some(m => m.playerId === player.id)) return NextResponse.json({ error: 'Already owned' }, { status: 400 })
  if (team.members.length >= 6) return NextResponse.json({ error: 'Team full (6 players)' }, { status: 400 })

  const budgetLeft = team.budgetInitial - team.budgetSpent
  if (player.price > budgetLeft) return NextResponse.json({ error: 'Insufficient budget' }, { status: 400 })

  await prisma.team.update({
    where: { id: team.id },
    data: {
      budgetSpent: { increment: player.price },
      members: {
        create: {
          playerId: player.id,
          pricePaid: player.price,
          // If you’re using “positions” elsewhere, you can also set role here.
          isActive: team.members.filter(m => m.isActive).length < 3,
          activeOrder: team.members.filter(m => m.isActive).length < 3 ? (team.members.filter(m => m.isActive).length + 1) : null,
          benchOrder: team.members.filter(m => !m.isActive).length >= 0 && team.members.filter(m => m.isActive).length >= 3 ? (team.members.filter(m => !m.isActive).length + 1) : null,
        },
      },
    },
  })

  return NextResponse.json({ ok: true })
}
