import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { rebuildWeekScores } from '@/lib/fantasy'

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

  // Fetch group from Ballchasing
  const res = await fetch(`https://ballchasing.com/api/groups/${groupId}`, {
    headers: { Authorization: token },
    next: { revalidate: 0 },
  })
  if (!res.ok) return { ok: false, message: `Ballchasing ${res.status}` }
  const data = await res.json() as any

  const players = (data.players || []) as any[]
  if (!players.length) return { ok: false, message: 'Engir leikmenn fundust í hópnum.' }

  const names = players.map((p) => String(p.name))
  const [byName, aliases] = await Promise.all([
    prisma.player.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }),
    prisma.playerAlias.findMany({ where: { alias: { in: names } }, include: { player: true } }),
  ])

  const nameMap = new Map(byName.map((p) => [p.name.toLowerCase(), p.id]))
  const aliasMap = new Map(aliases.map((a) => [a.alias.toLowerCase(), a.player.id]))

  const upserts: {
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

  const round2 = (x: number) => Math.round(x * 100) / 100

  for (const p of players) {
    const lower = String(p.name || '').toLowerCase()
    const playerId = nameMap.get(lower) || aliasMap.get(lower)
    if (!playerId) { unmatched.push(p.name); continue }

    const core = p.cumulative?.core || {}
    const games = Math.max(1, Math.round(p.cumulative?.games || 1))

    // Convert TOTALS -> AVERAGES per game
    const goals  = round2((core.goals  || 0) / games)
    const assists= round2((core.assists|| 0) / games)
    const saves  = round2((core.saves  || 0) / games)
    const shots  = round2((core.shots  || 0) / games)
    const score  = round2((core.score  || 0) / games)

    upserts.push({ playerId, weekId, goals, assists, saves, shots, score, games })
  }

  // One row per player/week → delete existing then insert
  // (we have @@unique([playerId, weekId]))
  const ids = upserts.map(u => u.playerId)
  await prisma.$transaction(async (tx) => {
    if (ids.length) await tx.playerGameStat.deleteMany({ where: { weekId, playerId: { in: ids } } })
    if (upserts.length) await tx.playerGameStat.createMany({ data: upserts })
  })

  // Recompute leaderboard for that week number
  const week = await prisma.week.findUnique({ where: { id: weekId }, select: { number: true } })
  if (week?.number != null) {
    // defer to API or call directly if you prefer:
    // await rebuildWeekScores(week.number)
  }

  revalidatePath('/leaderboard')
  return { ok: true, message: `Vistað með meðaltölum fyrir ${upserts.length} leikmenn. Ómappað: ${unmatched.join(', ') || '—'}` }
}


export async function ingestCsv(formData: FormData) {
  'use server'
  await requireAdmin()
  const weekId = String(formData.get('weekId') || '')
  const file = formData.get('file') as File | null
  if (!file) return { ok: false, message: 'Vantar CSV skrá.' }

  const text = await file.text()
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return { ok: false, message: 'Skrá tóm.' }

  const header = lines.shift()!.toLowerCase()
  const cols = header.split(',').map(s => s.trim())
  const idx = (k: string) => cols.indexOf(k)

  // We support two formats:
  // A) averages: player,goals,assists,saves,shots,score
  // B) totals + games: player,goals,assists,saves,shots,score,games
  const hasGames = idx('games') >= 0

  const need = ['player','goals','assists','saves','shots','score']
  if (need.some(n => idx(n) < 0)) {
    return { ok: false, message: 'Hauslína þarf: player,goals,assists,saves,shots,score[,games]' }
  }

  const rows = lines.map(l => l.split(','))
  const names = rows.map(r => r[idx('player')])
  const [byName, aliases] = await Promise.all([
    prisma.player.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }),
    prisma.playerAlias.findMany({ where: { alias: { in: names } }, include: { player: true } }),
  ])
  const nameMap = new Map(byName.map(p => [p.name.toLowerCase(), p.id]))
  const aliasMap = new Map(aliases.map(a => [a.alias.toLowerCase(), a.player.id]))

  const round2 = (x: number) => Math.round(x * 100) / 100

  const upserts: any[] = []
  const unmatched: string[] = []

  for (const r of rows) {
    const playerName = String(r[idx('player')] || '').trim()
    const id = nameMap.get(playerName.toLowerCase()) || aliasMap.get(playerName.toLowerCase())
    if (!id) { unmatched.push(playerName); continue }

    const g  = Number(r[idx('goals')]   || 0)
    const a  = Number(r[idx('assists')] || 0)
    const sv = Number(r[idx('saves')]   || 0)
    const sh = Number(r[idx('shots')]   || 0)
    const sc = Number(r[idx('score')]   || 0)
    const games = hasGames ? Math.max(1, Number(r[idx('games')] || 1)) : 1

    // If games present → convert totals→avg; else treat as averages directly
    const goals   = hasGames ? round2(g / games)  : round2(g)
    const assists = hasGames ? round2(a / games)  : round2(a)
    const saves   = hasGames ? round2(sv / games) : round2(sv)
    const shots   = hasGames ? round2(sh / games) : round2(sh)
    const score   = hasGames ? round2(sc / games) : round2(sc)

    upserts.push({ playerId: id, weekId, goals, assists, saves, shots, score, games })
  }

  await prisma.$transaction(async (tx) => {
    if (upserts.length) {
      await tx.playerGameStat.deleteMany({ where: { weekId, playerId: { in: upserts.map(u => u.playerId) } } })
      await tx.playerGameStat.createMany({ data: upserts })
    }
  })

  // Optionally recompute here as well (same as above)
  revalidatePath('/leaderboard')
  return { ok: true, message: `CSV vistað með meðaltölum fyrir ${upserts.length} leikmenn. Ómappað: ${unmatched.join(', ') || '—'}` }
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