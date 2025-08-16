import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import BallFormClient from './ball-form.client'
import { rebuildWeekScores } from '@/lib/fantasy'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'ADMIN') throw new Error('Forbidden')
}

// --- helpers ---
function extractBallchasingGroupId(input: string) {
  try {
    const u = new URL(input)
    const parts = u.pathname.split('/').filter(Boolean)
    const i = Math.max(parts.indexOf('group'), parts.indexOf('groups'))
    if (i >= 0 && parts[i + 1]) return parts[i + 1]
    return input.trim()
  } catch {
    return input.trim()
  }
}

type ActionResult = { ok: boolean; message?: string }

// --- Server action: Ballchasing import (averages) ---
export async function importBallchasing(formData: FormData): Promise<ActionResult> {
  'use server'
  await requireAdmin()

  const weekId = String(formData.get('weekId') || '')
  const raw = String(formData.get('group') || '').trim()
  const groupId = extractBallchasingGroupId(raw)

  const token = process.env.BALLCHASING_API_TOKEN
  if (!token) return { ok: false, message: 'Settu BALLCHASING_API_TOKEN í umhverfisbreytur.' }

  // 1) Fetch group
  const res = await fetch(`https://ballchasing.com/api/groups/${groupId}`, {
    headers: { Authorization: token },
    next: { revalidate: 0 },
  })
  if (!res.ok) return { ok: false, message: `Ballchasing ${res.status}` }
  const data = (await res.json()) as any

  const players = (data.players || []) as any[]
  if (!players.length) return { ok: false, message: 'Engir leikmenn fundust í hópnum.' }

  // 2) Map names/aliases → playerId
  const names = players.map((p) => String(p.name))
  const [byName, aliases] = await Promise.all([
    prisma.player.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }),
    prisma.playerAlias.findMany({ where: { alias: { in: names } }, include: { player: true } }),
  ])
  const nameMap = new Map(byName.map((p) => [p.name.toLowerCase(), p.id]))
  const aliasMap = new Map(aliases.map((a) => [a.alias.toLowerCase(), a.player.id]))

  // 3) Build per-game averages
  const round2 = (x: number) => Math.round(x * 100) / 100
  const rows: {
    playerId: string
    weekId: string
    goals: number
    assists: number
    saves: number
    shots: number
    score: number
    games: number
  }[] = []
  const unmatched: string[] = []

  for (const p of players) {
    const key = String(p.name || '').toLowerCase()
    const playerId = nameMap.get(key) || aliasMap.get(key)
    if (!playerId) { unmatched.push(p.name); continue }

    const core = p.cumulative?.core || {}
    const games = Math.max(1, Number(p.cumulative?.games || 1))

    rows.push({
      playerId,
      weekId,
      goals:  round2((Number(core.goals)  || 0) / games),
      assists:round2((Number(core.assists)|| 0) / games),
      saves:  round2((Number(core.saves)  || 0) / games),
      shots:  round2((Number(core.shots)  || 0) / games),
      score:  round2((Number(core.score)  || 0) / games),
      games,
    })
  }

  // 4) Overwrite existing stats for this week (those players)
  const ids = rows.map(r => r.playerId)
  await prisma.$transaction(async (tx) => {
    if (ids.length) {
      await tx.playerGameStat.deleteMany({ where: { weekId, playerId: { in: ids } } })
    }
    if (rows.length) {
      await tx.playerGameStat.createMany({ data: rows })
    }
  })

  // 5) Recompute week scores and revalidate
  const wk = await prisma.week.findUnique({ where: { id: weekId }, select: { number: true } })
  if (wk?.number != null) {
    await rebuildWeekScores(wk.number)
  }
  revalidatePath('/leaderboard')
  revalidatePath('/dashboard')

  return { ok: true, message: `Vistað með meðaltölum fyrir ${rows.length} leikmenn. Ómappað: ${unmatched.join(', ') || '—'}` }
}

// --- Server action: CSV ingest (kept simple, no client pending) ---
export async function ingestCsv(formData: FormData): Promise<ActionResult> {
  'use server'
  await requireAdmin()
  const weekId = String(formData.get('weekId') || '')
  const file = formData.get('file') as File | null
  if (!file) return { ok: false, message: 'Vantar CSV skrá.' }

  const text = await file.text()
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  const header = lines.shift() || ''
  const cols = header.split(',').map((c) => c.trim().toLowerCase())
  const required = ['player', 'goals', 'assists', 'saves', 'shots', 'score']
  if (required.some((r) => !cols.includes(r))) {
    return { ok: false, message: 'Hauslína þarf: player,goals,assists,saves,shots,score' }
  }
  const get = (arr: string[], key: string) => arr[cols.indexOf(key)]

  const rows = [] as { player: string; goals: number; assists: number; saves: number; shots: number; score: number }[]
  for (const l of lines) {
    const arr = l.split(',')
    if (arr.length < cols.length) continue
    rows.push({
      player: get(arr, 'player'),
      goals: Number(get(arr, 'goals') || 0),
      assists: Number(get(arr, 'assists') || 0),
      saves: Number(get(arr, 'saves') || 0),
      shots: Number(get(arr, 'shots') || 0),
      score: Number(get(arr, 'score') || 0),
    })
  }

  const names = rows.map((r) => r.player)
  const [byName, aliases] = await Promise.all([
    prisma.player.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }),
    prisma.playerAlias.findMany({ where: { alias: { in: names } }, include: { player: true } }),
  ])
  const nameMap = new Map(byName.map((p) => [p.name.toLowerCase(), p.id]))
  const aliasMap = new Map(aliases.map((a) => [a.alias.toLowerCase(), a.player.id]))

  const creates = [] as any[]
  const unmatched = [] as string[]
  for (const r of rows) {
    const id = nameMap.get(r.player.toLowerCase()) || aliasMap.get(r.player.toLowerCase())
    if (!id) { unmatched.push(r.player); continue }
    creates.push({ playerId: id, weekId, goals: r.goals, assists: r.assists, saves: r.saves, shots: r.shots, score: r.score })
  }

  await prisma.$transaction(async (tx) => {
    if (creates.length) {
      await tx.playerGameStat.deleteMany({ where: { weekId, playerId: { in: creates.map((c) => c.playerId) } } })
      await tx.playerGameStat.createMany({ data: creates })
    }
  })

  const wk = await prisma.week.findUnique({ where: { id: weekId }, select: { number: true } })
  if (wk?.number != null) await rebuildWeekScores(wk.number)
  revalidatePath('/leaderboard')
  revalidatePath('/dashboard')

  return { ok: true, message: `CSV: ${creates.length} raðir. Ómappað: ${unmatched.join(', ') || '—'}` }
}

// --- Server action: add alias ---
export async function addAlias(formData: FormData): Promise<ActionResult> {
  'use server'
  await requireAdmin()
  const playerId = String(formData.get('playerId') || '')
  const alias = String(formData.get('alias') || '').trim()
  if (!playerId || !alias) return { ok: false, message: 'Vantar alias.' }
  await prisma.playerAlias.create({ data: { playerId, alias } })
  return { ok: true, message: 'Alias bætt við.' }
}

// --- Page ---
export default async function IngestPage() {
  await requireAdmin()

  const [weeks, players] = await Promise.all([
    prisma.week.findMany({ orderBy: { number: 'asc' } }),
    prisma.player.findMany({ orderBy: { name: 'asc' } }),
  ])

  const defaultWeek = weeks[weeks.length - 1]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Hlaða inn tölfræði</h1>

      {/* Ballchasing with inline loading & feedback */}
      <section className="rounded-xl border border-neutral-800 p-4 space-y-3">
        <h2 className="font-medium">Ballchasing API</h2>
        <p className="text-sm text-neutral-400">
          Límdu inn Group slóð eða ID. Við náum í leikmannatölfræði (MEÐALTÖL per leik) og skrifum inn í völdu viku.
        </p>

        <BallFormClient
          action={importBallchasing}
          weeks={weeks.map(w => ({ id: w.id, number: w.number }))}
          defaultWeekId={defaultWeek?.id}
        />

        <p className="text-xs text-neutral-500">
          Þú þarft að setja <code>BALLCHASING_API_TOKEN</code> í umhverfisbreytur.
        </p>
      </section>

      {/* CSV (simple submit; no spinner needed here, but we can add similarly if you want) */}
      <section className="rounded-xl border border-neutral-800 p-4 space-y-3">
        <h2 className="font-medium">CSV innlestur</h2>
        <p className="text-sm text-neutral-400">Skrá með haus: <code>player,goals,assists,saves,shots,score</code></p>
        <form action={ingestCsv} className="grid md:grid-cols-[1fr,220px,auto] gap-2 items-end">
          <input type="file" name="file" accept=".csv,text/csv" className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" />
          <select name="weekId" defaultValue={defaultWeek?.id} className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
            {weeks.map(w => <option key={w.id} value={w.id}>Vika {w.number}</option>)}
          </select>
          <button className="border border-neutral-700 rounded px-4 py-2">Hlaða inn CSV</button>
        </form>

      </section>

      {/* Aliases */}
      <section className="rounded-xl border border-neutral-800 p-4 space-y-3">
        <h2 className="font-medium">Leikmanna-alias</h2>
        <p className="text-sm text-neutral-400">Ef nafnið í Ballchasing passar ekki við leikmann hér, bættu við alias.</p>
        <form action={addAlias} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            <span className="text-xs text-neutral-400 mb-1">Alias (eins og í Ballchasing)</span>
            <input name="alias" className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="t.d. Lightning_RL" />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-neutral-400 mb-1">Leikmaður</span>
            <select name="playerId" className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button className="border border-neutral-700 rounded px-4 py-2">Vista alias</button>
        </form>
      </section>
    </div>
  )
}
