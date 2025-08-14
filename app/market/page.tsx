import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { BuyButton } from '@/components/buy-button'
import { SellButton } from '@/components/sell-button'

// Server Actions
export async function buyAction(prev: any, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'Þú þarft að vera skráður inn.' }
  const userId = (session.user as any).id as string
  const playerId = String(formData.get('playerId') || '')

  const openWeek = await prisma.week.findFirst({ where: { isLocked: false }, orderBy: { number: 'asc' } })
  if (!openWeek) return { ok: false, error: 'Markaður er læstur.' }

  const [team, player] = await Promise.all([
    prisma.team.findUnique({ where: { userId }, include: { members: true } }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ])
  if (!team) return { ok: false, error: 'Þú þarft að stofna lið fyrst.' }
  if (!player) return { ok: false, error: 'Leikmaður fannst ekki.' }
  if (team.members.length >= 6) return { ok: false, error: 'Liðið er fullt (6 leikmenn).' }
  if (team.members.some(m => m.playerId === player.id)) return { ok: false, error: 'Leikmaður er þegar í liðinu.' }

  const budgetLeft = team.budgetInitial - team.budgetSpent
  if (player.price > budgetLeft) return { ok: false, error: 'Ekki nægur sjóður.' }

  await prisma.team.update({
    where: { id: team.id },
    data: {
      budgetSpent: { increment: player.price },
      members: {
        create: {
          playerId: player.id,
          pricePaid: player.price,
          isActive: team.members.filter(m => m.isActive).length < 3,
          activeOrder:
            team.members.filter(m => m.isActive).length < 3
              ? team.members.filter(m => m.isActive).length + 1
              : null,
          benchOrder:
            team.members.filter(m => !m.isActive).length >= 0 &&
            team.members.filter(m => m.isActive).length >= 3
              ? team.members.filter(m => !m.isActive).length + 1
              : null,
        },
      },
    },
  })

  revalidatePath('/market')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function sellAction(prev: any, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'Þú þarft að vera skráður inn.' }
  const userId = (session.user as any).id as string
  const teamPlayerId = String(formData.get('teamPlayerId') || '')

  const openWeek = await prisma.week.findFirst({ where: { isLocked: false }, orderBy: { number: 'asc' } })
  if (!openWeek) return { ok: false, error: 'Markaður er læstur.' }

  const team = await prisma.team.findUnique({ where: { userId } })
  const tp = await prisma.teamPlayer.findUnique({
    where: { id: teamPlayerId },
    include: { player: true },
  })
  if (!team || !tp) return { ok: false, error: 'Leikmaður fannst ekki.' }

  await prisma.$transaction([
    prisma.team.update({
      where: { id: team.id },
      data: { budgetSpent: { decrement: tp.pricePaid } },
    }),
    prisma.teamPlayer.delete({ where: { id: tp.id } }),
  ])

  revalidatePath('/market')
  revalidatePath('/dashboard')
  return { ok: true }
}

export default async function MarketAndTeam() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <div>Þú þarft að vera skráður inn.</div>

  const userId = (session.user as any).id
  const [team, players, openWeek] = await Promise.all([
    prisma.team.findUnique({
      where: { userId },
      include: { members: { include: { player: true } } },
    }),
    prisma.player.findMany({ orderBy: { price: 'desc' } }),
    prisma.week.findFirst({ where: { isLocked: false }, orderBy: { number: 'asc' } }),
  ])

  if (!team) {
    return (
      <div>
        Þú þarft að stofna lið fyrst á{' '}
        <a href="/dashboard" className="underline">
          Liðið mitt
        </a>
        .
      </div>
    )
  }

  const owned = new Set(team.members.map(m => m.playerId))
  const budgetLeft = team.budgetInitial - team.budgetSpent
  const locked = !openWeek

  return (
    <div className="grid lg:grid-cols-[360px,1fr] gap-6">
      {/* Sidebar: Team */}
      <aside className="lg:sticky lg:top-6 h-fit rounded-2xl border border-neutral-800 p-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Liðið mitt</h2>
          <span className="text-sm text-neutral-400">Sjóður: {budgetLeft} cr</span>
        </div>
        <div>
          <h3 className="text-sm text-neutral-300 mb-2">Virkir (1–3)</h3>
          <ul className="space-y-2">
            {team.members
              .filter(m => m.isActive)
              .sort((a, b) => a.activeOrder! - b.activeOrder!)
              .map(m => (
                <li key={m.id} className="flex items-center justify-between">
                  <div className="truncate">
                    <span className="text-neutral-400 mr-1">{m.activeOrder}.</span>
                    {m.player.name}
                  </div>
                  <SellButton action={sellAction} teamPlayerId={m.id} />
                </li>
              ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm text-neutral-300 mt-4 mb-2">Varamenn (1–3)</h3>
          <ul className="space-y-2">
            {team.members
              .filter(m => !m.isActive)
              .sort((a, b) => a.benchOrder! - b.benchOrder!)
              .map(m => (
                <li key={m.id} className="flex items-center justify-between">
                  <div className="truncate">
                    <span className="text-neutral-400 mr-1">{m.benchOrder}.</span>
                    {m.player.name}
                  </div>
                  <SellButton action={sellAction} teamPlayerId={m.id} />
                </li>
              ))}
          </ul>
        </div>
      </aside>

      {/* Market */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Markaður</h1>
          <div className="text-sm text-neutral-400">Eftir: {budgetLeft} cr</div>
        </div>

        {locked && (
          <div className="mb-4 rounded-lg border border-yellow-700/40 bg-yellow-500/10 text-yellow-200 text-sm px-3 py-2">
            Markaður er læstur þessa stundina.
          </div>
        )}

        <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {players.map(p => {
            const cannotAfford = p.price > budgetLeft
            return (
              <li key={p.id} className="border border-neutral-800 rounded-xl p-4">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-sm text-neutral-400">Verð: {p.price} cr</div>
                <BuyButton
                  playerId={p.id}
                  action={buyAction}
                  owned={owned.has(p.id)}
                  disabled={cannotAfford || locked}
                />
                {cannotAfford && !owned.has(p.id) && (
                  <p className="text-xs text-red-400 mt-2">Ekki nægur sjóður.</p>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
