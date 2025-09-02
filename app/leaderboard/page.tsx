export const dynamic = 'force-dynamic';
export const revalidate = 0;

// app/leaderboard/page.tsx
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SP = { week?: string | string[] }
type PageProps = { searchParams: Promise<SP> }

type Row = {
  teamId: string
  teamName: string
  manager: string
  image: string | null
  points: number
  weeksPlayed: number
}

function Avatar({ src, alt, size = 56 }: { src?: string | null; alt: string; size?: number }) {
  const fallback = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(alt || 'User')}`
  return (
    <img
      src={src || fallback}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full object-cover border border-neutral-800 bg-neutral-900"
      referrerPolicy="no-referrer"
    />
  )
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  // ✅ Next 15: searchParams is async
  const sp = (await searchParams) ?? {}
  const toFirst = (v: unknown) => (Array.isArray(v) ? v[0] ?? '' : (v ?? ''))
  const weekParam = String(toFirst(sp.week)).trim()
  const selectedWeek = weekParam && /^\d+$/.test(weekParam) ? Number(weekParam) : null

  const weeks = await prisma.week.findMany({ orderBy: { number: 'asc' } })

  const teams = await prisma.team.findMany({
    include: {
      user: { select: { name: true, email: true, image: true } },
      scores: selectedWeek
        ? { where: { week: { number: selectedWeek } }, include: { week: true } }
        : { include: { week: true } },
    },
  })

  const rows: Row[] = teams.map((t) => {
    const points = selectedWeek
      ? (t.scores[0]?.points ?? 0)
      : t.scores.reduce((sum, s) => sum + s.points, 0)
    return {
      teamId: t.id,
      teamName: t.name,
      manager: t.user?.name || t.user?.email || '—',
      image: t.user?.image ?? null,
      points,
      weeksPlayed: t.scores.length,
    }
  })

  // Sort + rank (ties share rank)
  rows.sort((a, b) => (b.points - a.points) || a.teamName.localeCompare(b.teamName))
  let lastPts = Infinity
  let rank = 0
  const ranked = rows.map((r, i) => {
    if (r.points !== lastPts) rank = i + 1
    lastPts = r.points
    return { ...r, rank }
  })

  const title = selectedWeek ? `Stigatafla – Vika ${selectedWeek}` : 'Stigatafla – Heildarstig'
  const podium = ranked.slice(0, 3)

  return (
    <div className="space-y-8">
      {/* Header + filter */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-neutral-400">
            {selectedWeek ? 'Sýnir stig fyrir valda viku.' : 'Samtala stiga yfir allar vikur.'}
          </p>
        </div>

        <form className="flex items-center gap-2" action="/leaderboard" method="get">
          <label className="text-sm text-neutral-300">Vika</label>
          <select
            name="week"
            defaultValue={selectedWeek ?? ''}
            className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm"
          >
            <option value="">Allar</option>
            {weeks.map((w) => (
              <option key={w.id} value={w.number}>
                Vika {w.number}
              </option>
            ))}
          </select>
          <button className="text-sm border border-neutral-700 rounded px-3 py-2">
            Sía
          </button>
          {selectedWeek && (
            <Link
              href="/leaderboard"
              className="text-sm border border-neutral-700 rounded px-3 py-2"
            >
              Hreinsa
            </Link>
          )}
        </form>
      </header>

      {/* Podium */}
      <section className="rounded-2xl border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold mb-4">Top 3</h2>
        {podium.length === 0 ? (
          <div className="text-sm text-neutral-400">Engin lið á toppnum ennþá.</div>
        ) : (
          <div className="grid grid-cols-3 gap-4 items-end">
            <PodiumCard place={2} entry={podium[1]} className="translate-y-4" />
            <PodiumCard place={1} entry={podium[0]} className="" highlight />
            <PodiumCard place={3} entry={podium[2]} className="translate-y-6" />
          </div>
        )}
      </section>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-950/60">
            <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-left [&>th]:font-medium [&>th]:text-neutral-300">
              <th>#</th>
              <th>Lið</th>
              <th>Stjórnandi</th>
              <th className="text-right">Stig</th>
              {!selectedWeek && <th className="text-right">Vikur</th>}
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr
                key={r.teamId}
                className={`border-t border-neutral-900/60 ${
                  i < 3 ? 'bg-gradient-to-r from-amber-500/5 to-transparent' : ''
                }`}
              >
                <td className="px-3 py-3">{r.rank}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={r.image} alt={r.manager} size={28} />
                    <Link href={`/dashboard?team=${r.teamId}`} className="hover:underline">
                      {r.teamName}
                    </Link>
                  </div>
                </td>
                <td className="px-3 py-3 text-neutral-300">{r.manager}</td>
                <td className="px-3 py-3 text-right font-semibold">{r.points}</td>
                {!selectedWeek && (
                  <td className="px-3 py-3 text-right text-neutral-400">{r.weeksPlayed}</td>
                )}
              </tr>
            ))}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-neutral-400">
                  Engin lið eða stig til að sýna (ennþá).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500">
        Stig endurreiknuð í Admin → Weeks. Heildarstig eru summa af vikustigum.
      </p>
    </div>
  )
}

function PodiumCard({
  place,
  entry,
  className,
  highlight,
}: {
  place: 1 | 2 | 3
  entry?: Row & { rank: number }
  className?: string
  highlight?: boolean
}) {
  if (!entry) return <div />
  const crown = place === 1 ? '👑' : place === 2 ? '🥈' : '🥉'
  const ring =
    place === 1
      ? 'from-amber-500/20 to-transparent'
      : place === 2
      ? 'from-slate-400/20 to-transparent'
      : 'from-orange-500/15 to-transparent'

  return (
    <div
      className={`relative rounded-2xl border border-neutral-800 p-5 text-center bg-gradient-to-b ${ring} ${className || ''} ${
        highlight ? 'scale-105 shadow-[0_0_0_1px_rgba(255,255,255,.04)]' : ''
      }`}
    >
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl">{crown}</div>
      <div className="flex justify-center mb-3">
        <Avatar src={entry.image} alt={entry.manager} size={72} />
      </div>
      <div className="text-sm text-neutral-400">#{place}</div>
      <div className="mt-1 font-semibold">{entry.teamName}</div>
      <div className="text-xs text-neutral-400">{entry.manager}</div>
      <div className="mt-2 text-lg font-bold">{entry.points} stig</div>
      <Link
        href={`/dashboard?team=${entry.teamId}`}
        className="mt-3 inline-block text-xs border border-neutral-700 rounded px-3 py-1 hover:bg-neutral-900"
      >
        Skoða lið
      </Link>
    </div>
  )
}
