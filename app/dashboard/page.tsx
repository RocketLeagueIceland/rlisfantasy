import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { BuyButton } from '@/components/buy-button'
import { SellButton } from '@/components/sell-button'
import { SALARY_CAP } from '@/lib/config'

// -----------------------------
// Server Actions (Fantasy rules)
// -----------------------------
export async function buyAction(prev: any, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'Þú þarft að vera skráður inn.' }
  const userId = (session.user as any).id as string
  const playerId = String(formData.get('playerId') || '')
  const role = String(formData.get('role') || '') as 'STRIKER' | 'MIDFIELD' | 'DEFENSE'
  if (!['STRIKER','MIDFIELD','DEFENSE'].includes(role)) return { ok: false, error: 'Veldu stöðu.' }

  // Markaður opinn?
  const openWeek = await prisma.week.findFirst({ where: { isLocked: false }, orderBy: { number: 'asc' } })
  if (!openWeek) return { ok: false, error: 'Markaður er læstur.' }

  const [team, player] = await Promise.all([
    prisma.team.findUnique({ where: { userId }, include: { members: true } }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ])
  if (!team) return { ok: false, error: 'Þú þarft að stofna lið fyrst.' }
  if (!player) return { ok: false, error: 'Leikmaður fannst ekki.' }
  if (team.members.some(m => m.playerId === player.id)) return { ok: false, error: 'Leikmaður er þegar í liðinu.' }
  if (team.members.length >= 6) return { ok: false, error: 'Liðið er fullt (6 leikmenn).' }

  // 2 per role
  const roleCount = (r: string) => team.members.filter(m => m.role === r).length
  if (role === 'STRIKER' && roleCount('STRIKER') >= 2) return { ok: false, error: 'Búið að fylla STRIKER (2/2).' }
  if (role === 'MIDFIELD' && roleCount('MIDFIELD') >= 2) return { ok: false, error: 'Búið að fylla MIDFIELD (2/2).' }
  if (role === 'DEFENSE' && roleCount('DEFENSE') >= 2) return { ok: false, error: 'Búið að fylla DEFENSE (2/2).' }

  // Salary cap
  if (team.budgetSpent + player.price > SALARY_CAP) return { ok: false, error: 'Fer yfir Salary Cap ($9,000).' }

  await prisma.team.update({
    where: { id: team.id },
    data: {
      budgetSpent: { increment: player.price },
      members: { create: { playerId: player.id, pricePaid: player.price, role, isActive: true, activeOrder: null, benchOrder: null } },
    },
  })

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
  const tp = await prisma.teamPlayer.findUnique({ where: { id: teamPlayerId }, include: { player: true } })
  if (!team || !tp) return { ok: false, error: 'Leikmaður fannst ekki.' }

  await prisma.$transaction([
    prisma.team.update({ where: { id: team.id }, data: { budgetSpent: { decrement: tp.pricePaid } } }),
    prisma.teamPlayer.delete({ where: { id: tp.id } }),
  ])

  revalidatePath('/dashboard')
  return { ok: true }
}

export async function createTeam(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return
  const name = String(formData.get('name') || 'Mitt lið')
  await prisma.team.create({ data: { name, userId: (session.user as any).id, budgetInitial: SALARY_CAP } })
  revalidatePath('/dashboard')
}

// -----------------------------
// Page
// -----------------------------
export default async function Dashboard({ searchParams }: { searchParams: { q?: string; sort?: 'price_desc' | 'price_asc' } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <div>Þú þarft að vera skráður inn.</div>

  const userId = (session.user as any).id
  const q = searchParams?.q?.trim()
  const sort = (searchParams?.sort as 'price_desc' | 'price_asc') || 'price_desc'

  const [team, players, openWeek] = await Promise.all([
    prisma.team.findUnique({ where: { userId }, include: { members: { include: { player: true } } } }),
    prisma.player.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      include: { rlTeam: true },
      orderBy: sort === 'price_asc' ? { price: 'asc' } : { price: 'desc' },
    }),
    prisma.week.findFirst({ where: { isLocked: false }, orderBy: { number: 'asc' } }),
  ])

  if (!team) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Liðið mitt</h1>
        <p>Engin lið — stofnaðu hér.</p>
        <form action={createTeam} className="flex items-center gap-2">
          <input name="name" placeholder="Heiti liðs" className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2" />
          <button className="bg-white text-black rounded px-4 py-2">Stofna lið</button>
        </form>
      </div>
    )
  }

  const owned = new Set(team.members.map(m => m.playerId))
  const budgetLeft = SALARY_CAP - team.budgetSpent
  const locked = !openWeek

  const countByRole = (r: string) => team.members.filter(m => m.role === r).length
  const rolesLeft = {
    STRIKER: Math.max(0, 2 - countByRole('STRIKER')),
    MIDFIELD: Math.max(0, 2 - countByRole('MIDFIELD')),
    DEFENSE: Math.max(0, 2 - countByRole('DEFENSE')),
  }

  const strikers = team.members.filter(m => m.role === 'STRIKER')
  const mids = team.members.filter(m => m.role === 'MIDFIELD')
  const defs = team.members.filter(m => m.role === 'DEFENSE')

  return (
    <div className="space-y-6">
      {/* HEADER — shows team name */}
      <div className="rounded-2xl border border-neutral-800 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-400">Liðið mitt</div>
            <h1 className="text-2xl font-semibold">{team.name}</h1>
            <p className="text-sm text-neutral-400">6 leikmenn: 2× Striker, 2× Midfield, 2× Defense.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs rounded-full border border-neutral-700 px-3 py-1 text-neutral-300">Salary left: ${budgetLeft}</span>
            {locked && <span className="text-xs rounded-full border border-yellow-700/40 bg-yellow-500/10 text-yellow-200 px-3 py-1">Markaður læstur</span>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[520px,1fr] gap-6">
        {/* FIELD */}
        <section className="rounded-2xl border border-neutral-800 p-4">
          <h2 className="font-medium mb-3">Völlur</h2>
          <div className="relative rounded-xl overflow-hidden" style={{ height: 420 }}>
            {/* stripes */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04)_0_8%,rgba(0,0,0,0)_8%_16%)]" />
            <div className="absolute inset-0 border-2 border-green-900/40 rounded-xl" />

            {/* ⬇️ CHANGED: center line is now HORIZONTAL (rotated 90°) */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-px bg-green-900/40" />

            {/* center circle (unchanged) */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-green-900/40 rounded-full"
              style={{ width: 120, height: 120 }}
            />

            <div className="absolute inset-4 grid grid-rows-3">
              <div className="grid grid-cols-2 gap-4 place-items-center">
                {[0, 1].map(i => <FieldSlot key={`S-${i}`} label="STRIKER" item={strikers[i]} />)}
              </div>
              <div className="grid grid-cols-2 gap-4 place-items-center">
                {[0, 1].map(i => <FieldSlot key={`M-${i}`} label="MIDFIELD" item={mids[i]} />)}
              </div>
              <div className="grid grid-cols-2 gap-4 place-items-center">
                {[0, 1].map(i => <FieldSlot key={`D-${i}`} label="DEFENSE" item={defs[i]} />)}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-400">Veldu stöðu þegar þú kaupir á markaðnum. Völlurinn uppfærist sjálfkrafa.</p>
        </section>

        {/* MARKET */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-medium">Markaður</h2>
            <form className="flex flex-wrap items-center gap-2" method="get">
              <input name="q" defaultValue={q || ''} placeholder="Leita að leikmanni…" className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 w-56" />
              <select name="sort" defaultValue={sort} className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
                <option value="price_desc">Dýrast fyrst</option>
                <option value="price_asc">Ódýrast fyrst</option>
              </select>
              <button className="border border-neutral-700 rounded px-3 py-2 text-sm">Sía</button>
            </form>
          </div>

          {locked && (
            <div className="rounded-lg border border-yellow-700/40 bg-yellow-500/10 text-yellow-200 text-sm px-3 py-2">
              Markaður er læstur þessa stundina.
            </div>
          )}

          <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {players.map(p => {
              const cannotAfford = p.price > budgetLeft
              const subtitle = p.rlTeam?.short ? p.rlTeam.short : p.rlTeam?.name
              return (
                <li key={p.id} className="rounded-xl border border-neutral-800 p-4 hover:border-neutral-600 transition">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-neutral-400 truncate">{subtitle ?? '—'}</div>
                    </div>
                    <div className="text-sm text-neutral-300 whitespace-nowrap">${p.price}</div>
                  </div>
                  <BuyButton
                    playerId={p.id}
                    action={buyAction}
                    owned={owned.has(p.id)}
                    disabled={cannotAfford || locked}
                    rolesLeft={rolesLeft}
                  />
                  {cannotAfford && !owned.has(p.id) && <p className="text-xs text-red-400 mt-2">Fer yfir Salary Cap.</p>}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

function FieldSlot({ label, item }: { label: 'STRIKER'|'MIDFIELD'|'DEFENSE'; item: any }) {
  return (
    <div className="w-full max-w-[220px] rounded-lg border border-green-900/40 bg-green-950/30 backdrop-blur-sm px-3 py-2">
      {!item ? (
        <div className="h-10 flex items-center justify-center text-xs text-neutral-400">Laus sæti – {label}</div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{item.player.name}</div>
            <div className="text-[10px] uppercase tracking-wide text-neutral-300">{label}</div>
          </div>
          <SellButton action={sellAction as any} teamPlayerId={item.id} />
        </div>
      )}
    </div>
  )
}
