import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { SALARY_CAP } from '@/lib/config'
import TeamField from '@/components/team-field'
import { BuyButton } from '@/components/buy-button'

// -----------------------------
// Helpers
// -----------------------------
function slugify(input?: string | null) {
  if (!input) return null
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function logoForTeamName(name?: string | null) {
  const slug = slugify(name)
  return slug ? `/teams/${slug}.png` : null
}

// -----------------------------
// Server Actions (Market)
// -----------------------------
export async function createTeam(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return
  const name = String(formData.get('name') || 'Mitt lið')
  await prisma.team.create({
    data: { name, userId: (session.user as any).id, budgetInitial: SALARY_CAP },
  })
  revalidatePath('/dashboard')
}

export async function buyAction(...args: any[]) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'Þú þarft að vera skráður inn.' }

  // Support both call styles (form action vs useFormState)
  const formData: FormData | null =
    args[0] instanceof FormData ? args[0] : (args[1] instanceof FormData ? args[1] : null)
  if (!formData) return { ok: false, error: 'Ógild beiðni (vantar form gögn).' }

  const userId = (session.user as any).id as string
  const playerId = String(formData.get('playerId') || '')
  const role = String(formData.get('role') || '') as 'STRIKER'|'MIDFIELD'|'DEFENSE'
  if (!playerId) return { ok: false, error: 'Vantar leikmann.' }
  if (!['STRIKER','MIDFIELD','DEFENSE'].includes(role)) return { ok: false, error: 'Veldu stöðu.' }

  // Market open? (manual open week = any week where isLocked=false)
  const openWeek = await prisma.week.findFirst({ where: { isLocked: false }, orderBy: { number: 'asc' } })
  if (!openWeek) return { ok: false, error: 'Markaður er læstur.' }

  const [team, player] = await Promise.all([
    prisma.team.findUnique({ where: { userId }, include: { members: true } }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ])
  if (!team) return { ok: false, error: 'Þú þarft að stofna lið fyrst.' }
  if (!player) return { ok: false, error: 'Leikmaður fannst ekki.' }

  // Team full
  if (team.members.length >= 6) {
    return { ok: false, error: 'Liðið þitt er fullt (6 leikmenn). Seldu leikmann áður en þú bætir við nýjum.' }
  }

  // One player only once
  if (team.members.some(m => m.playerId === player.id)) {
    return { ok: false, error: 'Leikmaður er þegar í liðinu.' }
  }

  // 2 per role
  const roleCount = (r: string) => team.members.filter(m => m.role === r).length
  if (role === 'STRIKER' && roleCount('STRIKER') >= 2) return { ok: false, error: 'Búið að fylla STRIKER (2/2).' }
  if (role === 'MIDFIELD' && roleCount('MIDFIELD') >= 2) return { ok: false, error: 'Búið að fylla MIDFIELD (2/2).' }
  if (role === 'DEFENSE' && roleCount('DEFENSE') >= 2) return { ok: false, error: 'Búið að fylla DEFENSE (2/2).' }

  // Salary cap
  if (team.budgetSpent + player.price > team.budgetInitial) {
    return { ok: false, error: 'Fer yfir Salary Cap.' }
  }

  await prisma.team.update({
    where: { id: team.id },
    data: {
      budgetSpent: { increment: player.price },
      members: {
        create: {
          playerId: player.id,
          pricePaid: player.price,
          role,
          isActive: true,
          activeOrder: null,
          benchOrder: null,
        },
      },
    },
  })

  revalidatePath('/dashboard')
  return { ok: true }
}

// -----------------------------
// Page
// -----------------------------
export default async function Dashboard({
  searchParams,
}: {
  // Next 15: searchParams is async
  searchParams: Promise<{ q?: string; sort?: 'price_desc' | 'price_asc'; team?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <div>Þú þarft að vera skráður inn.</div>

  const sp = await searchParams
  const q = sp?.q?.trim() || ''
  const sort = (sp?.sort as 'price_desc' | 'price_asc') || 'price_desc'
  const requestedTeamId = (sp?.team || '').trim()

  const myUserId = (session.user as any).id as string

  // 1) Load the team we are VIEWING (own team by default, or explicit ?team=)
  let team = null as Awaited<ReturnType<typeof prisma.team.findUnique>> | null
  if (requestedTeamId) {
    team = await prisma.team.findUnique({
      where: { id: requestedTeamId },
      include: { members: { include: { player: { include: { rlTeam: true } } } } },
    })
  } else {
    team = await prisma.team.findUnique({
      where: { userId: myUserId },
      include: { members: { include: { player: { include: { rlTeam: true } } } } },
    })
  }

  // 2) Market data only if we're viewing our own team
  const viewingOwn = !!team && team.userId === myUserId
  const [players, openWeek] = await Promise.all([
    viewingOwn
      ? prisma.player.findMany({
          where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
          include: { rlTeam: true },
          orderBy: sort === 'price_asc' ? { price: 'asc' } : { price: 'desc' },
        })
      : Promise.resolve([] as any[]),
    prisma.week.findFirst({ where: { isLocked: false }, orderBy: { number: 'asc' } }),
  ])

  // If user has no team AND not explicitly viewing someone else → show create form
  if (!team && !requestedTeamId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Liðið mitt</h1>
        <p>Engin lið — stofnaðu hér.</p>
        <form action={createTeam} className="flex items-center gap-2">
          <input name="name" placeholder="Heiti liðs" className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2" />
          <button className="bg-white text-black rounded px-4 py-2 cursor-pointer">Stofna lið</button>
        </form>
      </div>
    )
  }

  if (!team) {
    // Bad team id in URL
    return <div>Lið fannst ekki.</div>
  }

  const owned = new Set(team.members.map(m => m.playerId))
  const budgetLeft = team.budgetInitial - team.budgetSpent
  const locked = !openWeek
  const isTeamFull = team.members.length >= 6

  const countByRole = (r: string) => team.members.filter(m => m.role === r).length
  const rolesLeft = viewingOwn
    ? {
        STRIKER: Math.max(0, 2 - countByRole('STRIKER')),
        MIDFIELD: Math.max(0, 2 - countByRole('MIDFIELD')),
        DEFENSE: Math.max(0, 2 - countByRole('DEFENSE')),
      }
    : { STRIKER: 0, MIDFIELD: 0, DEFENSE: 0 }

  // Prepare items for TeamField
  const byRole = (r: 'STRIKER'|'MIDFIELD'|'DEFENSE') =>
    team.members
      .filter(m => m.role === r)
      .map(m => ({
        id: m.id,
        name: m.player.name,
        role: r,
        teamName: m.player.rlTeam?.name || null,
        teamLogo: logoForTeamName(m.player.rlTeam?.name),
      }))

  const strikers = byRole('STRIKER')
  const mids     = byRole('MIDFIELD')
  const defs     = byRole('DEFENSE')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-neutral-800 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">
              {viewingOwn ? <>Liðið mitt — <span className="text-neutral-200">{team.name}</span></> : <>{team.name}</>}
            </h1>
            <p className="text-sm text-neutral-400 truncate">
              6 leikmenn: 2× Striker · 2× Midfield · 2× Defense.
              {!viewingOwn && <span className="ml-2 text-neutral-500">(skoðunaraðgerð — ekki hægt að breyta)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {viewingOwn && (
              <span className="text-xs rounded-full border border-neutral-700 px-3 py-1 text-neutral-300">
                Salary left: ${budgetLeft}
              </span>
            )}
            {!openWeek && (
              <span className="text-xs rounded-full border border-yellow-700/40 bg-yellow-500/10 text-yellow-200 px-3 py-1">
                Markaður læstur
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[520px,1fr] gap-6">
        {/* FIELD (DnD) */}
        <section className="rounded-2xl border border-neutral-800 p-4">
          <h2 className="font-medium mb-3">Völlur</h2>
          <TeamField
            strikers={strikers as any}
            mids={mids as any}
            defs={defs as any}
            canEdit={viewingOwn && !!openWeek}
          />
          <p className="mt-3 text-xs text-neutral-400">
            Dragðu og slepptu til að skipta um stöður þegar markaðurinn er opinn.
          </p>
          <p className="mt-3 text-xs text-neutral-400">
            📱 Á síma: Ýttu á sætin til að færa eða skipta.
          </p>
        </section>

        {/* MARKET (only if viewing own team) */}
        {viewingOwn && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-medium">Markaður</h2>
              <form className="flex flex-wrap items-center gap-2" method="get">
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Leita að leikmanni…"
                  className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 w-56"
                />
                <select
                  name="sort"
                  defaultValue={sort}
                  className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2"
                >
                  <option value="price_desc">Dýrast fyrst</option>
                  <option value="price_asc">Ódýrast fyrst</option>
                </select>
                <button className="border border-neutral-700 rounded px-3 py-2 text-sm cursor-pointer">Sía</button>
              </form>
            </div>

            {!openWeek && (
              <div className="rounded-lg border border-yellow-700/40 bg-yellow-500/10 text-yellow-200 text-sm px-3 py-2">
                Markaður er læstur þessa stundina.
              </div>
            )}

            {isTeamFull && (
              <div className="rounded-lg border border-neutral-700 text-neutral-200 text-sm px-3 py-2">
                Liðið þitt er fullt (6 leikmenn). Seldu leikmann áður en þú bætir við nýjum.
              </div>
            )}

            <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {players.map(p => {
                const cannotAfford = p.price > budgetLeft
                const subtitle = p.rlTeam?.name || '—'
                const hideBuy = isTeamFull || owned.has(p.id) || !openWeek
                return (
                  <li key={p.id} className="rounded-xl border border-neutral-800 p-4 hover:border-neutral-600 transition">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0 flex items-cen  ter gap-3">
                        {/* TEAM LOGO (square) */}
                        {(() => {
                          const teamName = p.rlTeam?.name || null
                          const logo = logoForTeamName(teamName)
                          return logo ? (
                            <img
                              src={logo}
                              alt={teamName || 'Lið'}
                              className="w-8 h-8 border border-neutral-700 object-cover rounded-none"
                            />
                          ) : (
                            <div className="w-8 h-8 border border-neutral-700 grid place-items-center text-[10px] text-neutral-300 rounded-none">
                              RL
                            </div>
                          )
                        })()}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-neutral-400 truncate">{p.rlTeam?.name ?? '—'}</div>
                        </div>
                      </div>
                      <div className="text-sm text-neutral-300 whitespace-nowrap">${p.price}</div>
                    </div>

                    {/* Owned badge or Buy logic */}
                    {owned.has(p.id) ? (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-neutral-300">
                        <span className="rounded-full border border-neutral-700 px-2 py-0.5">Í liðinu</span>
                      </div>
                    ) : (
                      <>
                        {!hideBuy && (
                          <BuyButton
                            playerId={p.id}
                            action={buyAction}
                            owned={false}
                            disabled={cannotAfford}
                            rolesLeft={rolesLeft}
                          />
                        )}
                        {!hideBuy && cannotAfford && (
                          <p className="text-xs text-red-400 mt-2">Fer yfir Salary Cap.</p>
                        )}
                        {isTeamFull && !owned.has(p.id) && (
                          <p className="text-xs text-gray-400 mt-2">
                            Liðið er fullt — seldu leikmann áður en þú bætir við.
                          </p>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Viewing someone else? Give a hint */}
      {!viewingOwn && (
        <div className="text-sm text-neutral-400">
          Þú ert að skoða liðið <span className="text-neutral-200 font-medium">{team.name}</span>. Til að
          breyta þínu liði skaltu fara á <a href="/dashboard" className="underline">/dashboard</a> án
          <code className="mx-1">?team=</code> stiku.
        </div>
      )}
    </div>
  )
}
