import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { SALARY_CAP, POINTS, POSITION_BONUS_MULTIPLIER } from '@/lib/config'
import TeamField from '@/components/team-field'
import { BuyButton } from '@/components/buy-button'
import { redirect } from 'next/navigation'

// -----------------------------
// Helpers
// -----------------------------
function slugify(input?: string | null) {
  if (!input) return null
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
function logoForTeamName(name?: string | null) {
  const slug = slugify(name)
  return slug ? `/teams/${slug}.png` : null
}
function countRole(members: { role: string | null }[], r: string) {
  return members.filter((m) => m.role === r).length
}
async function getOpenWeek() {
  return prisma.week.findFirst({ where: { isLocked: false }, orderBy: { number: 'asc' } })
}

// points per stat including position bonus (matches computeWeekPointsFanRL)
function statPointsWithBonus(stats: any, role: 'STRIKER'|'MIDFIELD'|'DEFENSE'|null|undefined) {
  const mult = POSITION_BONUS_MULTIPLIER ?? 1
  const goals  = Number(stats?.goals  || 0)
  const assists= Number(stats?.assists|| 0)
  const saves  = Number(stats?.saves  || 0)
  const shots  = Number(stats?.shots  || 0)
  const score  = Number(stats?.score  || 0)

  const goalPts   = goals   * POINTS.goal   * (role === 'STRIKER' ? mult : 1)
  const assistPts = assists * POINTS.assist * (role === 'MIDFIELD' ? mult : 1)
  const savePts   = saves   * POINTS.save   * (role === 'DEFENSE' ? mult : 1)
  const shotPts   = shots   * POINTS.shot
  const scorePts  = score   * POINTS.score

  const total = goalPts + assistPts + savePts + shotPts + scorePts
  return { goalPts, assistPts, savePts, shotPts, scorePts, total }
}

// -----------------------------
// Server Actions
// -----------------------------
export async function createTeam(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return
  const name = String(formData.get('name') || 'Mitt lið')
  await prisma.team.create({
    data: { name, userId: (session.user as any).id, budgetInitial: SALARY_CAP },
  })
  // Show the new team immediately
  redirect('/dashboard')
}

/** Lock/confirm initial team (pre-season unlimited → post-lock weekly 1 transfer) */
export async function lockTeamAction() {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'Þarft að skrá þig inn.' }
  const userId = (session.user as any).id as string

  const team = await prisma.team.findUnique({ where: { userId }, include: { members: true } })
  if (!team) return { ok: false, error: 'Engin lið.' }
  if (team.isLockedIn) return { ok: false, error: 'Lið er þegar staðfest.' }
  if (team.members.length !== 6) return { ok: false, error: 'Lið þarf að vera 6 leikmenn.' }

  const s = countRole(team.members, 'STRIKER')
  const m = countRole(team.members, 'MIDFIELD')
  const d = countRole(team.members, 'DEFENSE')
  if (s !== 2 || m !== 2 || d !== 2) {
    return { ok: false, error: 'Þarf 2×Striker, 2×Midfield, 2×Defense.' }
  }

  await prisma.team.update({
    where: { id: team.id },
    data: { isLockedIn: true, lockedInAt: new Date() },
  })
  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * BUY with pre/post lock rules:
 * - Before lock: unlimited (respect cap + 2/role + max 6).
 * - After lock: exactly ONE weekly transfer (replace = sell+buy in one go).
 *   If team is full, must provide replaceTeamPlayerId.
 */
export async function buyAction(...args: any[]) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'Þú þarft að vera skráður inn.' }

  // Support both call styles (form action vs useActionState/useFormState)
  const formData: FormData | null =
    args[0] instanceof FormData ? args[0] : (args[1] instanceof FormData ? args[1] : null)
  if (!formData) return { ok: false, error: 'Ógild beiðni (vantar form gögn).' }

  const userId = (session.user as any).id as string
  const playerId = String(formData.get('playerId') || '')
  const role = String(formData.get('role') || '') as 'STRIKER' | 'MIDFIELD' | 'DEFENSE'
  const replaceTeamPlayerId = String(formData.get('replaceTeamPlayerId') || '')

  if (!playerId) return { ok: false, error: 'Vantar leikmann.' }
  if (!['STRIKER', 'MIDFIELD', 'DEFENSE'].includes(role)) return { ok: false, error: 'Veldu stöðu.' }

  // Fetch team + player (do NOT require openWeek yet; pre-lock is unlimited)
  const [team, player] = await Promise.all([
    prisma.team.findUnique({ where: { userId }, include: { members: true } }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ])
  if (!team) return { ok: false, error: 'Þú þarft að stofna lið fyrst.' }
  if (!player) return { ok: false, error: 'Leikmaður fannst ekki.' }
  if (team.members.some((m) => m.playerId === player.id)) {
    return { ok: false, error: 'Leikmaður er þegar í liðinu.' }
  }

  const teamFull = team.members.length >= 6

  // -----------------------------
  // PRE-LOCK: unlimited changes (respect 2/role, cap, size)
  // -----------------------------
  if (!team.isLockedIn) {
    if (teamFull) {
      return { ok: false, error: 'Liðið er fullt (6). Seldu fyrst eða staðfestu liðið og notaðu „replace“.' }
    }

    const left = {
      STRIKER: Math.max(0, 2 - countRole(team.members, 'STRIKER')),
      MIDFIELD: Math.max(0, 2 - countRole(team.members, 'MIDFIELD')),
      DEFENSE: Math.max(0, 2 - countRole(team.members, 'DEFENSE')),
    }
    if (left[role] <= 0) return { ok: false, error: `Búið að fylla ${role} (2/2).` }

    if (team.budgetSpent + player.price > team.budgetInitial) {
      return { ok: false, error: 'Fer yfir Salary Cap.' }
    }

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

  // -----------------------------
  // POST-LOCK: exactly ONE weekly transfer
  // -----------------------------
  const openWeek = await getOpenWeek()
  if (!openWeek) return { ok: false, error: 'Markaður er læstur.' }

  // Already used transfer this week?
  const existingLog = await prisma.transferLog.findUnique({
    where: { teamId_weekId: { teamId: team.id, weekId: openWeek.id } },
  })
  if (existingLog) return { ok: false, error: 'Þú hefur þegar notað vikuskiptin.' }

  const counts = {
    STRIKER: countRole(team.members, 'STRIKER'),
    MIDFIELD: countRole(team.members, 'MIDFIELD'),
    DEFENSE: countRole(team.members, 'DEFENSE'),
  }

  // Team NOT full → allow adding one (still respect 2/role & cap), and log transfer
  if (!teamFull) {
    if (counts[role] >= 2) return { ok: false, error: `Búið að fylla ${role} (2/2).` }
    if (team.budgetSpent + player.price > team.budgetInitial) return { ok: false, error: 'Fer yfir Salary Cap.' }

    await prisma.$transaction([
      prisma.team.update({
        where: { id: team.id },
        data: {
          budgetSpent: { increment: player.price },
          members: { create: { playerId: player.id, pricePaid: player.price, role, isActive: true } },
        },
      }),
      prisma.transferLog.create({ data: { teamId: team.id, weekId: openWeek.id } }),
    ])
    revalidatePath('/dashboard')
    return { ok: true }
  }

  // Team FULL → require replace flow
  if (!replaceTeamPlayerId) {
    return { ok: false, error: 'Liðið er fullt. Veldu leikmann til að skipta út (replace).' }
  }

  const toReplace = await prisma.teamPlayer.findUnique({ where: { id: replaceTeamPlayerId } })
  if (!toReplace || toReplace.teamId !== team.id) return { ok: false, error: 'Ógildur replace-leikmaður.' }

  // Check 2/2/2 after replacement
  const after = { ...counts }
  const oldRole = (toReplace.role || 'MIDFIELD') as 'STRIKER' | 'MIDFIELD' | 'DEFENSE'
  after[oldRole] = Math.max(0, after[oldRole] - 1)
  after[role] = (after[role] ?? 0) + 1
  if (after.STRIKER !== 2 || after.MIDFIELD !== 2 || after.DEFENSE !== 2) {
    return { ok: false, error: 'Stöður yrðu ekki 2/2/2 eftir skipti.' }
  }

  // Salary after swap
  const newSpent = team.budgetSpent - toReplace.pricePaid + player.price
  if (newSpent > team.budgetInitial) return { ok: false, error: 'Fer yfir Salary Cap eftir skipti.' }

  await prisma.$transaction([
    prisma.team.update({ where: { id: team.id }, data: { budgetSpent: { decrement: toReplace.pricePaid } } }),
    prisma.teamPlayer.delete({ where: { id: toReplace.id } }),
    prisma.team.update({
      where: { id: team.id },
      data: {
        budgetSpent: { increment: player.price },
        members: { create: { playerId: player.id, pricePaid: player.price, role, isActive: true } },
      },
    }),
    prisma.transferLog.create({ data: { teamId: team.id, weekId: openWeek.id } }),
  ])

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
  let team =
    requestedTeamId
      ? await prisma.team.findUnique({
          where: { id: requestedTeamId },
          include: { members: { include: { player: { include: { rlTeam: true } } } } },
        })
      : await prisma.team.findUnique({
          where: { userId: myUserId },
          include: { members: { include: { player: { include: { rlTeam: true } } } } },
        })

  // If user has no team AND not explicitly viewing someone else → show create form
  if (!team && !requestedTeamId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Liðið mitt</h1>
        <p>Engin lið — stofnaðu hér.</p>
        <form action={createTeam} className="flex items-center gap-2">
          <input
            name="name"
            placeholder="Heiti liðs"
            className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2"
          />
          <button className="bg-white text-black rounded px-4 py-2 cursor-pointer">Stofna lið</button>
        </form>
      </div>
    )
  }
  if (!team) return <div>Lið fannst ekki.</div>

  const viewingOwn = !!team && team.userId === myUserId
  const openWeek = await getOpenWeek()
  const lockedMarket = !openWeek

  // If viewing own, load market list; otherwise, skip
  const players = viewingOwn
    ? await prisma.player.findMany({
        where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
        include: { rlTeam: true },
        orderBy: sort === 'price_asc' ? { price: 'asc' } : { price: 'desc' },
      })
    : ([] as any[])

  // Weekly transfer used?
  const usedThisWeek =
    viewingOwn && openWeek
      ? !!(await prisma.transferLog.findUnique({
          where: { teamId_weekId: { teamId: team.id, weekId: openWeek.id } },
        }))
      : false

  const owned = new Set(team.members.map((m) => m.playerId))
  const budgetLeft = team.budgetInitial - team.budgetSpent
  const isTeamFull = team.members.length >= 6

  const rolesLeft = viewingOwn
    ? {
        STRIKER: Math.max(0, 2 - countRole(team.members, 'STRIKER')),
        MIDFIELD: Math.max(0, 2 - countRole(team.members, 'MIDFIELD')),
        DEFENSE: Math.max(0, 2 - countRole(team.members, 'DEFENSE')),
      }
    : { STRIKER: 0, MIDFIELD: 0, DEFENSE: 0 }

  const byRole = (r: 'STRIKER' | 'MIDFIELD' | 'DEFENSE') =>
    team.members
      .filter((m) => m.role === r)
      .map((m) => ({
        id: m.id,
        name: m.player.name,
        role: r,
        teamName: m.player.rlTeam?.name || null,
        teamLogo: logoForTeamName(m.player.rlTeam?.name),
      }))

  const strikers = byRole('STRIKER')
  const mids = byRole('MIDFIELD')
  const defs = byRole('DEFENSE')

  const canLockNow =
    viewingOwn &&
    !team.isLockedIn &&
    team.members.length === 6 &&
    countRole(team.members, 'STRIKER') === 2 &&
    countRole(team.members, 'MIDFIELD') === 2 &&
    countRole(team.members, 'DEFENSE') === 2

  const replaceOptions = team.members.map((m) => ({
    id: m.id,
    label: `${m.player.name} · ${m.role}`,
  }))

  // -----------------------------
  // Per-week breakdown (TeamWeekScore)
  // -----------------------------
  const weekScoresRaw = await prisma.teamWeekScore.findMany({
    where: { teamId: team.id },
    include: { week: true },
  })
  const weekScores = [...weekScoresRaw].sort((a, b) => b.week.number - a.week.number)

  const allIds = new Set<string>()
  for (const ws of weekScores) {
    try {
      const arr = JSON.parse(ws.breakdown || '[]') as any[]
      for (const e of arr) if (e?.playerId) allIds.add(String(e.playerId))
    } catch {}
  }
  const idList = Array.from(allIds)
  const playersForMap = idList.length
    ? await prisma.player.findMany({ where: { id: { in: idList } }, include: { rlTeam: true } })
    : []
  const playerMap = new Map(playersForMap.map(p => [p.id, p]))

  function aggregateWeek(ws: any) {
    let total = 0
    type Row = {
      playerId: string
      role: string | null
      goals: number; assists: number; saves: number; shots: number; score: number
      gPts: number; aPts: number; sPts: number; shPts: number; scPts: number
      points: number
    }
    const perPlayer = new Map<string, Row>()
    let arr: any[] = []
    try { arr = JSON.parse(ws.breakdown || '[]') } catch { arr = [] }

    for (const e of arr) {
      const pid = String(e.playerId)
      const role = (e.role || null) as 'STRIKER'|'MIDFIELD'|'DEFENSE'|null
      const stats = e.stats || {}
      const { goalPts, assistPts, savePts, shotPts, scorePts, total: rowTotal } = statPointsWithBonus(stats, role)

      total += rowTotal

      if (!perPlayer.has(pid)) {
        perPlayer.set(pid, {
          playerId: pid, role,
          goals: Number(stats.goals || 0),
          assists: Number(stats.assists || 0),
          saves: Number(stats.saves || 0),
          shots: Number(stats.shots || 0),
          score: Number(stats.score || 0),
          gPts: goalPts, aPts: assistPts, sPts: savePts, shPts: shotPts, scPts: scorePts,
          points: rowTotal,
        })
      } else {
        const r = perPlayer.get(pid)!
        r.goals += Number(stats.goals || 0)
        r.assists += Number(stats.assists || 0)
        r.saves += Number(stats.saves || 0)
        r.shots += Number(stats.shots || 0)
        r.score += Number(stats.score || 0)
        r.gPts += goalPts
        r.aPts += assistPts
        r.sPts += savePts
        r.shPts += shotPts
        r.scPts += scorePts
        r.points += rowTotal
      }
    }
    const rows = Array.from(perPlayer.values()).sort((a,b) => b.points - a.points)
    return { total, rows }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-neutral-800 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">
              {viewingOwn ? (
                <>Liðið mitt — <span className="text-neutral-200">{team.name}</span></>
              ) : (
                <>{team.name}</>
              )}
            </h1>
            <p className="text-sm text-neutral-400 truncate">
              6 leikmenn: 2× Striker · 2× Midfield · 2× Defense.
              {!viewingOwn && <span className="ml-2 text-neutral-500">(skoðunaraðgerð — ekki hægt að breyta)</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewingOwn && (
              <span className="text-xs rounded-full border border-neutral-700 px-3 py-1 text-neutral-300">
                Salary left: ${budgetLeft}
              </span>
            )}
            {lockedMarket && (
              <span className="text-xs rounded-full border border-yellow-700/40 bg-yellow-500/10 text-yellow-200 px-3 py-1">
                Markaður læstur
              </span>
            )}
            {viewingOwn && team.isLockedIn ? (
              <>
                <span className="text-xs rounded-full border border-blue-700/40 bg-blue-500/10 text-blue-200 px-3 py-1">
                  Lið staðfest
                </span>
                {openWeek && usedThisWeek && (
                  <span className="text-xs rounded-full border border-neutral-700 px-3 py-1 text-neutral-300">
                    Vikuskipti notuð
                  </span>
                )}
              </>
            ) : viewingOwn ? (
              <>
                <span className="text-xs rounded-full border border-emerald-700/40 bg-emerald-500/10 text-emerald-200 px-3 py-1">
                  Ótakmörkuð skipti þar til staðfest
                </span>
                <form action={lockTeamAction}>
                  <button
                    disabled={!canLockNow}
                    className="text-xs rounded px-3 py-1 bg-white text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    title={!canLockNow ? 'Þarft 6 leikmenn og 2/2/2 stöður' : 'Staðfesta lið'}
                  >
                    Staðfesta lið
                  </button>
                </form>
              </>
            ) : null}
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
            canEdit={viewingOwn && (!team.isLockedIn || !!openWeek)}
          />
          <p className="mt-3 text-xs text-neutral-400">
            Dragðu & slepptu (eða pikkaðu 2 sæti á síma) til að færa stöður þegar markaður er opinn.
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
                <select name="sort" defaultValue={sort} className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
                  <option value="price_desc">Dýrast fyrst</option>
                  <option value="price_asc">Ódýrast fyrst</option>
                </select>
                <button className="border border-neutral-700 rounded px-3 py-2 text-sm cursor-pointer">Sía</button>
              </form>
            </div>

            {lockedMarket && (
              <div className="rounded-lg border border-yellow-700/40 bg-yellow-500/10 text-yellow-200 text-sm px-3 py-2">
                Markaður er læstur þessa stundina.
              </div>
            )}

            {/* If team full and NOT locked-in, suggest sell first */}
            {isTeamFull && !team.isLockedIn && (
              <div className="rounded-lg border border-neutral-700 text-neutral-200 text-sm px-3 py-2">
                Liðið þitt er fullt (6 leikmenn). Seldu leikmann áður en þú bætir við — eða staðfestu liðið og notaðu “replace” eftir það.
              </div>
            )}

            <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {players.map((p) => {
                const cannotAfford = p.price > budgetLeft
                const hideBuy =
                  owned.has(p.id) ||
                  (team.isLockedIn ? lockedMarket : false) || // only hide on closed market AFTER lock-in
                  (!team.isLockedIn && isTeamFull)
                const teamName = p.rlTeam?.name || null
                const logo = logoForTeamName(teamName)
                return (
                  <li key={p.id} className="rounded-xl border border-neutral-800 p-4 hover:border-neutral-600 transition">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-3">
                        {logo ? (
                          <img
                            src={logo}
                            alt={teamName || 'Lið'}
                            className="w-8 h-8 border border-neutral-700 object-cover rounded-none"
                          />
                        ) : (
                          <div className="w-8 h-8 border border-neutral-700 grid place-items-center text-[10px] text-neutral-300 rounded-none">
                            RL
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-neutral-400 truncate">{teamName ?? '—'}</div>
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
                            disabled={!team.isLockedIn && cannotAfford}
                            rolesLeft={rolesLeft}
                            locked={!!team.isLockedIn}
                            teamFull={isTeamFull}
                            replaceOptions={isTeamFull && team.isLockedIn ? replaceOptions : []}
                          />
                        )}
                        {!hideBuy && !team.isLockedIn && cannotAfford && (
                          <p className="text-xs text-red-400 mt-2">Fer yfir Salary Cap.</p>
                        )}
                        {/* If full and locked-in, BuyButton shows replace select so no extra message needed */}
                        {isTeamFull && team.isLockedIn && !owned.has(p.id) && (
                          <p className="text-xs text-neutral-400 mt-2">Liðið er fullt — notaðu „Skipta (kaupa)“ hér að ofan.</p>
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

            {/* ----------------------------- */}
      {/* Breakdown per week            */}
      {/* ----------------------------- */}
      <section className="space-y-3">
        <h2 className="text-xl font-medium">Niðurbrot eftir vikum</h2>

        {weekScores.length === 0 && (
          <div className="rounded-xl border border-neutral-800 p-4 text-sm text-neutral-400">
            Engin stig til að sýna ennþá. Þegar tölfræði hefur verið hlaðið inn og stig reiknuð birtast vikur hér.
          </div>
        )}

        {weekScores.map(ws => {
          const { total, rows } = aggregateWeek(ws)
          return (
            <details key={ws.id} className="rounded-xl border border-neutral-800">
              <summary className="list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-300">
                    Vika {ws.week.number}
                  </span>
                  <span className="text-neutral-400 text-sm">
                    {new Date(ws.week.startDate).toLocaleDateString('is-IS')}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-neutral-400 mr-2">Samtals</span>
                  <span className="font-medium">{Math.round(total)} stig</span>
                </div>
              </summary>

              <div className="px-4 pb-4">
                <div className="overflow-x-auto rounded-lg border border-neutral-900">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-950/60">
                      <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-300">
                        <th>Leikmaður</th>
                        <th className="hidden sm:table-cell">Hlutverk</th>
                        <th className="hidden md:table-cell">Mörk</th>
                        <th className="hidden md:table-cell">Stoð</th>
                        <th className="hidden md:table-cell">Varslur</th>
                        <th className="hidden lg:table-cell">Skot</th>
                        <th className="hidden lg:table-cell">Score</th>
                        <th className="text-right">Samtals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const p = playerMap.get(r.playerId)
                        const teamName = p?.rlTeam?.name || null
                        const logo = logoForTeamName(teamName)
                        return (
                          <tr key={r.playerId} className="border-t border-neutral-900 align-middle">
                            <td className="[&>div]:py-2 px-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {logo ? (
                                  <img
                                    src={logo}
                                    alt={teamName || 'Lið'}
                                    className="w-6 h-6 border border-neutral-700 object-cover rounded-none"
                                  />
                                ) : (
                                  <div className="w-6 h-6 border border-neutral-700 grid place-items-center text-[9px] text-neutral-300 rounded-none">RL</div>
                                )}
                                <div className="min-w-0">
                                  <div className="truncate">{p?.name ?? '—'}</div>
                                  <div className="text-[10px] text-neutral-400 truncate">{teamName ?? '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-3">
                              <span className="text-[11px] uppercase tracking-wide text-neutral-300">{r.role || '—'}</span>
                            </td>

                            {/* Stats with points in parentheses */}
                            <td className="hidden md:table-cell px-3">
                              {r.goals}{' '}
                              <span className="text-neutral-400">({Math.round(r.gPts)})</span>
                            </td>
                            <td className="hidden md:table-cell px-3">
                              {r.assists}{' '}
                              <span className="text-neutral-400">({Math.round(r.aPts)})</span>
                            </td>
                            <td className="hidden md:table-cell px-3">
                              {r.saves}{' '}
                              <span className="text-neutral-400">({Math.round(r.sPts)})</span>
                            </td>
                            <td className="hidden lg:table-cell px-3">
                              {r.shots}{' '}
                              <span className="text-neutral-400">({Math.round(r.shPts)})</span>
                            </td>
                            <td className="hidden lg:table-cell px-3">
                              {r.score}{' '}
                              <span className="text-neutral-400">({Math.round(r.scPts)})</span>
                            </td>

                            <td className="px-3 text-right font-medium">{Math.round(r.points)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="mt-2 text-xs text-neutral-500">
                  Stigin í svigum við hvern dálk eru reiknuð út frá stigagjöf og innihalda stöðubónus (t.d. Striker → Mörk).
                </p>
              </div>
            </details>
          )
        })}
      </section>
    </div>
  )
}
