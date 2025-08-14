import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id as string
  const { teamPlayerId } = await req.json()

  const team = await prisma.team.findUnique({ where: { userId } })
  const tp = await prisma.teamPlayer.findUnique({ where: { id: teamPlayerId }, include: { player: true } })
  if (!team || !tp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Allow 1 transfer per week – here we only enforce market lock; weekly transfer count can be tracked in another table if needed.
  const week = await prisma.week.findFirst({ where: { isLocked: false }, orderBy: { number: 'asc' } })
  if (!week) return NextResponse.json({ error: 'Market locked' }, { status: 400 })

  await prisma.$transaction([
    prisma.team.update({ where: { id: team.id }, data: { budgetSpent: { decrement: tp.pricePaid } } }),
    prisma.teamPlayer.delete({ where: { id: tp.id } }),
  ])

  return NextResponse.json({ ok: true })
}