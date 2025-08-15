import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'ADMIN') throw new Error('Forbidden')
  return session
}

function extractBallchasingGroupId(input: string) {
  try {
    const u = new URL(input)
    // Accept: https://ballchasing.com/group/<id> or /api/groups/<id>
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = Math.max(parts.indexOf('group'), parts.indexOf('groups'))
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]
    return input.trim()
  } catch {
    return input.trim()
  }
}

export async function importBallchasing(formData: FormData) {
  'use server'
  await requireAdmin()

  const weekId = String(formData.get('weekId') || '')
  const raw = String(formData.get('group') || '').trim()
  const groupId = extractBallchasingGroupId(raw)
  const token = process.env.BALLCHASING_API_TOKEN
  if (!token) return { ok: false, message: 'Settu BALLCHASING_API_TOKEN í umhverfisbreytur.' }

  // Fetch group stats from Ballchasing
  const res = await fetch(`https://ballchasing.com/api/groups/${groupId}`, {
    headers: { Authorization: token },
    // 60s timeout is fine here
    next: { revalidate: 0 },
  })
  if (!res.ok) return { ok: false, message: `Ballchasing ${res.status}` }
  const data = await res.json() as any

  const players = (data.players || []) as any[]
  if (!players.length) return { ok: false, message: 'Engir leikmenn fundust í hópnum.' }

  // Build lookup by alias and by exact name
  const names = players.map((p) => String(p.name))
  const [byName, aliases] = await Promise.all([
    prisma.player.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }),
    prisma.playerAlias.findMany({ where: { alias: { in: names } }, include: { player: true } }),
  ])

  const nameMap = new Map(byName.map((p) => [p.name.toLowerCase(), p.id]))
  const aliasMap = new Map(aliases.map((a) => [a.alias.toLowerCase(), a.player.id]))

  const matched: { playerId: string; goals: number; assists: number; saves: number; shots: number; score: number; games: number }[] = []
  const unmatched: string[] = []

  for (const p of players) {
    const lower = String(p.name || '').toLowerCase()
    const playerId = nameMap.get(lower) || aliasMap.get(lower)
    if (!playerId) {
      unmatched.push(p.name)
      continue
    }
    const core = p.cumulative?.core || {}
    const demo = p.cumulative?.demo || {}
    matched.push({
      playerId,
      goals: Math.round(core.goals || 0),
      assists: Math.round(core.assists || 0),
      saves: Math.round(core.saves || 0),
      shots: Math.round(core.shots || 0),
      score: Math.round(core.score || 0),
      games: Math.max(1, Math.round(p.cumulative?.games || 1)),
    })
  }

  // Replace existing stats for those players in the selected week
  const ids = matched.map((m) => m.playerId)
  await prisma.$transaction([
    prisma.playerGameStat.deleteMany({ where: { weekId, playerId: { in: ids } } }),
    // Create ONE aggregated row per player (totals). Our scoring is linear, so this preserves totals.
    prisma.playerGameStat.createMany({
      data: matched.map((m) => ({
        playerId: m.playerId,
        weekId,
        goals: m.goals,
        assists: m.assists,
        saves: m.saves,
        shots: m.shots,
        score: m.score,
      })),
      skipDuplicates: true,
    }),
  ])

  revalidatePath('/leaderboard')
  return { ok: true, message: `Hlaðið inn fyrir ${matched.length} leikmenn. Ómappað: ${unmatched.join(', ') || '—'}` }
}

export async function ingestCsv(formData: FormData) {
  'use server'
  await requireAdmin()
  const weekId = String(formData.get('weekId') || '')
  const file = formData.get('file') as File | null
  if (!file) return { ok: false, message: 'Vantar CSV skrá.' }
  const text = await file.text()
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)


  // CSV columns: player,goals,assists,saves,shots,score
  const header = lines.shift() || ''
  const cols = header.split(',').map((c) => c.trim().toLowerCase())
  const required = ['player', 'goals', 'assists', 'saves', 'shots', 'score']
  if (required.some((r) => !cols.includes(r))) return { ok: false, message: 'Hauslína þarf: player,goals,assists,saves,shots,score' }

  const get = (arr: string[], key: string) => arr[cols.indexOf(key)]

  const rows: { player: string; goals: number; assists: number; saves: number; shots: number; score: number }[] = []
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

  await prisma.$transaction([
    prisma.playerGameStat.deleteMany({ where: { weekId, playerId: { in: creates.map((c) => c.playerId) } } }),
    prisma.playerGameStat.createMany({ data: creates, skipDuplicates: true }),
  ])

  revalidatePath('/leaderboard')
  return { ok: true, message: `CSV: ${creates.length} raðir. Ómappað: ${unmatched.join(', ') || '—'}` }
}

export async function addAlias(formData: FormData) {
  'use server'
  await requireAdmin()
  const playerId = String(formData.get('playerId') || '')
  const alias = String(formData.get('alias') || '').trim()
  if (!playerId || !alias) return { ok: false, message: 'Vantar alias.' }
  await prisma.playerAlias.create({ data: { playerId, alias } })
  return { ok: true, message: 'Alias bætt við.' }
}

export default async function IngestPage() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'ADMIN') return <div>Aðgangur bannaður.</div>

  const [weeks, players] = await Promise.all([
    prisma.week.findMany({ orderBy: { number: 'asc' } }),
    prisma.player.findMany({ orderBy: { name: 'asc' } }),
  ])

  const defaultWeek = weeks[weeks.length - 1]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Hlaða inn tölfræði</h1>

      {/* Ballchasing */}
      <section className="rounded-xl border border-neutral-800 p-4 space-y-3">
        <h2 className="font-medium">Ballchasing API</h2>
        <p className="text-sm text-neutral-400">Límdu inn Group slóð eða ID. Við náum í leikmannatölfræði (samtals) og skrifum inn í völdu viku.</p>
        <form action={importBallchasing} className="grid md:grid-cols-[1fr,220px,auto] gap-2 items-end">
          <label className="flex flex-col">
            <span className="text-xs text-neutral-400 mb-1">Group slóð eða ID</span>
            <input name="group" placeholder="https://ballchasing.com/group/xxxxx" className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-neutral-400 mb-1">Vika</span>
            <select name="weekId" defaultValue={defaultWeek?.id} className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
              {weeks.map(w => <option key={w.id} value={w.id}>Vika {w.number}</option>)}
            </select>
          </label>
          <button className="bg-white text-black rounded px-4 py-2">Sækja & vista</button>
        </form>
        <p className="text-xs text-neutral-500">Þú þarft að setja <code>BALLCHASING_API_TOKEN</code> í umhverfisbreytur.</p>
      </section>

      {/* CSV */}
      <section className="rounded-xl border border-neutral-800 p-4 space-y-3">
        <h2 className="font-medium">CSV innlestur</h2>
        <p className="text-sm text-neutral-400">Skrá með haus: <code>player,goals,assists,saves,shots,score</code></p>
        <form action={ingestCsv} className="grid md:grid-cols-[1fr,220px,auto] gap-2 items-end" encType="multipart/form-data">
          <input type="file" name="file" accept=".csv,text/csv" className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" />
          <select name="weekId" defaultValue={defaultWeek?.id} className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
            {weeks.map(w => <option key={w.id} value={w.id}>Vika {w.number}</option>)}
          </select>
          <button className="border border-neutral-700 rounded px-4 py-2">Hlaða inn CSV</button>
        </form>
      </section>

      {/* Aliases */}
      <section className="rounded-xl border border-neutral-800 p-4 space-y-3">
        <h2 className="font-medium">Leikmanna‑alias</h2>
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