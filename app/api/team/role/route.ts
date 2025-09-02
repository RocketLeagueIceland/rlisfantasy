export const dynamic = 'force-dynamic';
export const revalidate = 0;

// app/api/team/role/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertMarketOpen } from '@/lib/utils'

type Role = 'STRIKER' | 'MIDFIELD' | 'DEFENSE'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only allow while market is open
  try {
    await assertMarketOpen()
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Market locked' }, { status: e?.status ?? 400 })
  }

  const userId = (session.user as any).id as string
  const { teamPlayerId, role, swapWithId } = await req.json() as {
    teamPlayerId: string
    role: Role
    swapWithId?: string
  }

  if (!teamPlayerId || !role || !['STRIKER','MIDFIELD','DEFENSE'].includes(role)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  // Load the caller's team & members to verify ownership
  const team = await prisma.team.findUnique({
    where: { userId },
    include: { members: true },
  })
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const me = team.members.find(m => m.id === teamPlayerId)
  if (!me) return NextResponse.json({ error: 'Player not in your team' }, { status: 403 })

  // ---------- SWAP (dragging onto an occupied slot) ----------
  if (swapWithId) {
    const other = team.members.find(m => m.id === swapWithId)
    if (!other) return NextResponse.json({ error: 'Target not in your team' }, { status: 404 })

    // ✅ Correct swap: me gets other's role; other gets *my original* role
    await prisma.$transaction(async (tx) => {
      // Re-read roles inside the transaction to avoid stale values
      const fresh = await tx.teamPlayer.findMany({
        where: { id: { in: [me.id, other.id] } },
        select: { id: true, role: true },
      })
      const meFresh = fresh.find(f => f.id === me.id)!
      const otherFresh = fresh.find(f => f.id === other.id)!

      await tx.teamPlayer.update({ where: { id: me.id }, data: { role: (otherFresh.role as Role) } })
      await tx.teamPlayer.update({ where: { id: other.id }, data: { role: (meFresh.role as Role) } })
    })

    return NextResponse.json({ ok: true })
  }

  // ---------- MOVE (dragging into an empty slot) ----------
  // Enforce capacity (max 2) for the target role (excluding this player)
  const targetCount = team.members.filter(m => m.role === role && m.id !== me.id).length
  if (targetCount >= 2) {
    return NextResponse.json({ error: 'Staða er þegar full (2/2).' }, { status: 400 })
  }

  await prisma.teamPlayer.update({ where: { id: me.id }, data: { role } })
  return NextResponse.json({ ok: true })
}
