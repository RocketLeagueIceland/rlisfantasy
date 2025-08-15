// app/api/market/sell/route.ts
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { assertMarketOpen, assertTransferAvailable, markTransferUsed } from '@/lib/utils'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Markaður þarf að vera opinn
  let week: any = null
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

  // Ef liðið er fullt → þetta er vikuskipti
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

  // Annars (liðið ekki fullt enn) má selja án viku-takmörkunar
  await prisma.$transaction([
    prisma.team.update({ where: { id: team.id }, data: { budgetSpent: { decrement: tp.pricePaid } } }),
    prisma.teamPlayer.delete({ where: { id: tp.id } }),
  ])

  return NextResponse.json({ ok: true })
}
