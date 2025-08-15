// app/dashboard/page.tsx
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { BuyButton } from '@/components/buy-button'
import TeamField from '@/components/team-field'
import { SALARY_CAP } from '@/lib/config'
import { assertMarketOpen, assertTransferAvailable, markTransferUsed } from '@/lib/utils'
import { teamLogoPath } from '@/lib/assets'

export const dynamic = 'force-dynamic'

type SP = {
  q?: string | string[]
  sort?: 'price_desc' | 'price_asc' | string | string[]
  team?: string | string[]
}

// -----------------------------
// Server Actions (kaup/sala með vikutakmörkun)
// -----------------------------
export async function buyAction(prev: any, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'Þú þarft að vera skráður inn.' }

  const userId = (session.user as any).id as string
  const playerId = String(formData.get('playerId') || '')
  const role = String(formData.get('role') || '') as 'STRIKER'|'MIDFIELD'|'DEFENSE'
  const replaceTeamPlayerId = String(formData.get('replaceTeamPlayerId') || '')
  if (!['STRIKER','MIDFIELD','DEFENSE'].includes(role)) return { ok: false, error: 'Veldu stöðu.' }

  const [team, player] = await Promise.all([
    prisma.team.findUnique({ where: { userId }, include: { members: true } }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ])
  if (!team || !player) return { ok: false, error: 'Villa – lið eða leikmaður fannst ekki.' }

  // Markaður þarf að vera opinn (tekur tillit til 14:00–17:00 og handlás)
  const transferWeek = await assertMarketOpen()

  const owned = new Set(team.members.map(m => m.playerId))
  if (owned.has(player.id)) return { ok: false, error: 'Leikmaður er þegar í liðinu.' }

  const roleCount = (r: string) => team.members.filter(m => m.role === r).length

  if (team.members.length < 6) {
    // Free build (fyrir 6 leikmenn) – engin vikutakmörkun
    if (role === 'STRIKER' && roleCount('STRIKER') >= 2) return { ok: false, error: 'Búið að fylla STRIKER (2/2).' }
    if (role === 'MIDFIELD' && roleCount('MIDFIELD') >= 2) return { ok: false, error: 'Búið að fylla MIDFIELD (2/2).' }
    if (role === 'DEFENSE' && roleCount('DEFENSE') >= 2) return { ok: false, error: 'Búið að fylla DEFENSE (2/2).' }
    if (team.budgetSpent + player.price > SALARY_CAP) return { ok: false, error: 'Fer yfir Salary Cap ($9,000).' }

    await prisma.team.update({
      where: { id: team.id },
      data: {
        budgetSpent: { increment: player.price },
        members: { create: { playerId: player.id, pricePaid: player.price, role, isActive: true } },
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  // Liðið er fullt → 1 breyting á viku. Krefst "replace".
  await assertTransferAvailable(team.id, team.members.length)
  if (!replaceTeamPlayerId) return { ok: false, error: 'Liðið er fullt. Veldu hvern á að selja í leiðinni.' }

  const out = team.members.find(m => m.id === replaceTeamPlayerId)
  if (!out) return { ok: false, error: 'Valinn leikmaður fannst ekki í liðinu.' }

  const after = {
    STRIKER: roleCount('STRIKER') + (role === 'STRIKER' ? 1 : 0) - (out.role === 'STRIKER' ? 1 : 0),
    MIDFIELD: roleCount('MIDFIELD') + (role === 'MIDFIELD' ? 1 : 0) - (out.role === 'MIDFIELD' ? 1 : 0),
    DEFENSE: roleCount('DEFENSE') + (role === 'DEFENSE' ? 1 : 0) - (out.role === 'DEFENSE' ? 1 : 0),
  }
  if (after.STRIKER > 2 || after.MIDFIELD > 2 || after.DEFENSE > 2) {
    return { ok: false, error: 'Þessi staða er þegar full (2/2).' }
  }

  const newSpent = team.budgetSpent - out.pricePaid + player.price
  if (newSpent > SALARY_CAP) return { ok: false, error: 'Fer yfir Salary Cap eftir skiptin.' }

  await prisma.$transaction(async (tx) => {
    await tx.team.update({
      where: { id: team.id },
      data: {
        budgetSpent: newSpent,
        members: {
          delete: { id: out.id },
          create: { playerId: player.id, pricePaid: player.price, role, isActive: true },
        },
      },
    })
    if (transferWeek) await markTransferUsed(team.id, transferWeek.id, tx)
  })

  revalidatePath('/dashboard')
  return { ok: true }
}

// -----------------------------
// Page
// -----------------------------
export default async function Dashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <div>Þú þarft að vera skráður inn.</div>

  // ✅ await searchParams (Next 15 sync-dynamic-apis)
  const sp = (await searchParams) ?? {}
  const first = (v: unknown) => Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
  const q = (String(first(sp.q)).trim() || undefined) as string | undefined
  const sort = ((): 'price_desc' | 'price_asc' => {
    const s = String(first(sp.sort))
    return s === 'price_asc' ? 'price_asc' : 'price_desc'
  })()
  const requestedTeamId = String(first(sp.team)).trim()

  const myUserId = (session.user as any).id as string

  // 1) Hlaða "team-ið sem við erum að skoða"
  let team = null as Awaited<ReturnType<typeof prisma.team.findUnique>> | null
  if (requestedTeamId) {
    team = await prisma.team.findUnique({
      where: { id: requestedTeamId },
      include: { members: { include: { player: { include: { rlTeam: true } } } } }, // 👉 rlTeam fyrir nafn + logo
    })
  }
  if (!team) {
    team = await prisma.team.findUnique({
      where: { userId: myUserId },
      include: { members: { include: { player: { include: { rlTeam: true } } } } },
    })
  }

  if (!team) {
    // Nýtt lið
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Liðið mitt</h1>
        <p>Engin lið — stofnaðu hér.</p>
        <form
          action={async (fd: FormData) => {
            'use server'
            const s = await getServerSession(authOptions)
            if (!s?.user) return
            const name = String(fd.get('name') || 'Mitt lið')
            await prisma.team.create({ data: { name, userId: (s.user as any).id, budgetInitial: SALARY_CAP } })
            revalidatePath('/dashboard')
          }}
          className="flex items-center gap-2"
        >
          <input name="name" placeholder="Heiti liðs" className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2" />
          <button className="bg-white text-black rounded px-4 py-2">Stofna lið</button>
        </form>
      </div>
    )
  }

  const youAreOwner = team.userId === myUserId

  // 2) Ákvarða hvort markaður er opinn (sýna merkingu & fela markað hjá öðrum)
  let locked = false
  try { await assertMarketOpen() } catch { locked = true }

  // 3) Sækja markað (bara fyrir eiganda)
  const players = youAreOwner
    ? await prisma.player.findMany({
        where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
        include: { rlTeam: true },
        orderBy: sort === 'price_asc' ? { price: 'asc' } : { price: 'desc' },
      })
    : []

  const owned = new Set(team.members.map(m => m.playerId))
  const budgetLeft = SALARY_CAP - team.budgetSpent

  const byRole = (r: string) => team.members.filter(m => m.role === r)
  const strikers = byRole('STRIKER')
  const mids = byRole('MIDFIELD')
  const defs = byRole('DEFENSE')

  const countByRole = (r: string) => team.members.filter(m => m.role === r).length
  const rolesLeft = {
    STRIKER: Math.max(0, 2 - countByRole('STRIKER')),
    MIDFIELD: Math.max(0, 2 - countByRole('MIDFIELD')),
    DEFENSE: Math.max(0, 2 - countByRole('DEFENSE')),
  }

  const mapItems = (arr: any[]) => arr.map(m => ({
    id: m.id,
    name: m.player.name,
    role: m.role,
    teamName: m.player.rlTeam?.name || null,
    teamLogo: teamLogoPath(m.player.rlTeam?.name || undefined),
  }))

  return (
    <div className="space-y-6">
      {/* Haus */}
      <div className="rounded-2xl border border-neutral-800 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-400">Lið</div>
            <h1 className="text-2xl font-semibold">{team.name}</h1>
            <p className="text-xs text-neutral-400 mt-1">
              1 breyting á viku eftir að liðið er orðið fullt. Stöðubreytingar (drag-and-drop) eru leyfðar þegar markaður er opinn.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {youAreOwner ? (
              <span className="text-xs rounded-full border border-neutral-700 px-3 py-1 text-neutral-300">Salary left: ${budgetLeft}</span>
            ) : (
              <span className="text-xs rounded-full border border-neutral-700 px-3 py-1 text-neutral-300">Áhorfandi</span>
            )}
            {locked && (
              <span className="text-xs rounded-full border border-yellow-700/40 bg-yellow-500/10 text-yellow-200 px-3 py-1">Markaður læstur</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[520px,1fr] gap-6">
        {/* Völlur */}
        <section className="rounded-2xl border border-neutral-800 p-4">
          <h2 className="font-medium mb-3">Völlur</h2>
          <TeamField
            strikers={mapItems(strikers)}
            mids={mapItems(mids)}
            defs={mapItems(defs)}
            canEdit={youAreOwner && !locked}
          />
          <p className="mt-3 text-xs text-neutral-400">Drag-and-drop til að breyta stöðu. „Selja“ takki er við hvern leikmann.</p>
        </section>

        {/* Markaður — aðeins sýnilegur eiganda */}
        {youAreOwner && (
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
              {(players as any[]).map((p) => {
                const cannotAfford = p.price > budgetLeft
                const teamName = p.rlTeam?.name || '—'
                const logo = p.rlTeam?.name ? teamLogoPath(p.rlTeam.name) : null
                const teamIsFull = team.members.length >= 6

                return (
                  <li key={p.id} className="rounded-xl border border-neutral-800 p-4 hover:border-neutral-600 transition">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {logo ? (
                            <img src={logo} alt={teamName} className="w-7 h-7 border border-neutral-700 object-cover rounded-none" />
                          ) : (
                            <div className="w-7 h-7 border border-neutral-700 grid place-items-center text-[10px] text-neutral-300 rounded-none">RL</div>
                          )}
                          <span className="truncate">{p.name}</span>
                        </div>
                        <div className="text-xs text-neutral-400 truncate">{teamName}</div>
                      </div>
                      <div className="text-sm text-neutral-300 whitespace-nowrap">${p.price}</div>
                    </div>

                    {/* Kaupa (liðið ekki fullt) */}
                    {!teamIsFull && (
                      <BuyButton
                        playerId={p.id}
                        action={buyAction}
                        owned={owned.has(p.id)}
                        disabled={cannotAfford || locked}
                        rolesLeft={rolesLeft}
                      />
                    )}

                    {/* Kaupa + replace (liðið fullt) — telst 1 vikuskipti */}
                    {teamIsFull && !owned.has(p.id) && !locked && (
                      <form action={buyAction} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="playerId" value={p.id} />
                        <select name="role" className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs">
                          <option value="STRIKER">Striker</option>
                          <option value="MIDFIELD">Midfield</option>
                          <option value="DEFENSE">Defense</option>
                        </select>
                        <select name="replaceTeamPlayerId" className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs">
                          {team.members.map(m => (
                            <option key={m.id} value={m.id}>{m.player.name} ({m.role})</option>
                          ))}
                        </select>
                        <button className="text-xs border border-neutral-700 rounded px-2 py-1">Kaupa</button>
                      </form>
                    )}

                    {cannotAfford && !owned.has(p.id) && (
                      <p className="text-xs text-red-400 mt-2">Fer yfir Salary Cap.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
