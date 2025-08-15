import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { assertMarketOpen } from '@/lib/utils'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await assertMarketOpen() } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Locked' }, { status: e?.status || 423 })
  }

  const { teamPlayerId, role } = await req.json()
  if (!teamPlayerId || !['STRIKER','MIDFIELD','DEFENSE'].includes(role)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const tp = await prisma.teamPlayer.findUnique({ where: { id: teamPlayerId }, include: { team: true } })
  if (!tp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (tp.team.userId !== (session.user as any).id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members = await prisma.teamPlayer.findMany({ where: { teamId: tp.teamId } })
  const nextCounts = (r: string) => members.filter(m => (m.id === tp.id ? role : m.role) === r).length
  if (nextCounts('STRIKER') > 2 || nextCounts('MIDFIELD') > 2 || nextCounts('DEFENSE') > 2) {
    return NextResponse.json({ error: 'Þessi staða yrði yfirfull (2/2).' }, { status: 400 })
  }

  await prisma.teamPlayer.update({ where: { id: tp.id }, data: { role } })
  return NextResponse.json({ ok: true })
}