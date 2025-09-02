// app/page.tsx
import Link from 'next/link'
import { getServerSession } from 'next-auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getServerSession()
  return (
    <div className="space-y-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.18),transparent_60%)] p-8 md:p-10">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-neutral-300/80">RLÍS • FANTASY</p>
          <h1 className="mt-2 text-4xl md:text-5xl font-bold leading-tight">
            Byggðu draumalið, stilltu stöður og klifrar upp stigatöfluna.
          </h1>
          <p className="mt-4 text-neutral-300">
            Veldu 6 leikmenn innan <span className="font-semibold">Salary Cap 10.000.000 kr</span>.
            Settu þá í stöður á vellinum og safnaðu stigum fyrir frammistöðu þeirra í leikjum.
            Stöðubónus er <strong>2×</strong> fyrir tengdu tölfræðina.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {session && (
            <Link href="/dashboard" className="rounded-xl px-5 py-3 bg-white text-black font-medium hover:opacity-90">
              Byrja núna
            </Link>
            )}
            <Link href="/how-to-play" className="rounded-xl px-5 py-3 border border-neutral-700 hover:bg-neutral-900">
              Hvernig virkar?
            </Link>
            <Link href="/leaderboard" className="rounded-xl px-5 py-3 border border-neutral-700 hover:bg-neutral-900">
              Sjá stigatöflu
            </Link>
          </div>
        </div>

        {/* Subtle glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
      </section>

      {/* QUICK RULES */}
      <section className="grid lg:grid-cols-3 gap-6">
        {/* Scoring */}
        <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-950/50">
          <h2 className="text-lg font-semibold">Stigagjöf</h2>
          <ul className="mt-3 grid grid-cols-2 gap-y-2 text-sm text-neutral-300">
            <li>⚽ Mark: <strong>50</strong></li>
            <li>🎯 Stoðsending: <strong>25</strong></li>
            <li>🧤 Varsla: <strong>25</strong></li>
            <li>🥅 Skot: <strong>15</strong></li>
            <li className="col-span-2">
              📊 Töflustig (scoreboard): <strong>1</strong> fyrir hvert stig
            </li>
          </ul>
          <p className="mt-3 text-xs text-neutral-400">
            Ath: <em>Tortímingar</em> teljast ekki til stiga. því miður......
          </p>
        </div>

        {/* Positions & bonus */}
        <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-950/50">
          <h2 className="text-lg font-semibold">Stöður & bónus</h2>
          <p className="mt-2 text-sm text-neutral-300">
            Hver leikmaður er settur í stöðu sem gefur <strong>2×</strong> bónus á ákveðna tölfræði:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-300">
            <li>⚡ <strong>Striker</strong> → tvöfalt fyrir <em>mörk</em>.</li>
            <li>🧭 <strong>Midfield</strong> → tvöfalt fyrir <em>stoðsendingar</em>.</li>
            <li>🧱 <strong>Defense</strong> → tvöfalt fyrir <em>Vörslur</em>.</li>
          </ul>
          <p className="mt-3 text-xs text-neutral-400">
            Þitt lið: 6 leikmenn (2× hver staða). Allt fellur undir Salary Cap.
          </p>
        </div>

        {/* Locking / flow */}
        <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-950/50">
          <h2 className="text-lg font-semibold">Flæði & læsing</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-300">
            <li>🛒 Kaup/sala á markaði milli umferða.</li>
            <li>🔒 Markaður <strong>læst</strong> á sunnudögum kl. <strong>14:00–17:00</strong> (Reykjavík) meðan leikir standa yfir.</li>
            <li>🛠️ Stjórnandi getur einnig læst/aflæst handvirkt.</li>
          </ul>
          <p className="mt-3 text-xs text-neutral-400">
            Stig eru reiknuð eftir hverja útsendingu.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS – 3 steps */}
      <section className="rounded-3xl border border-neutral-800 p-6 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),transparent_60%)]">
        <h2 className="text-lg font-semibold">Svona byrjarðu</h2>
        <ol className="mt-4 grid md:grid-cols-3 gap-4">
          <li className="rounded-xl border border-neutral-800 p-4 bg-neutral-950/60">
            <div className="text-2xl">🛒</div>
            <h3 className="mt-2 font-medium">1) Veldu leikmenn</h3>
            <p className="text-sm text-neutral-300">Kauptu allt að 6 leikmenn innan Salary Cap.</p>
          </li>
          <li className="rounded-xl border border-neutral-800 p-4 bg-neutral-950/60">
            <div className="text-2xl">📍</div>
            <h3 className="mt-2 font-medium">2) Settu í stöður</h3>
            <p className="text-sm text-neutral-300">2× Striker, 2× Midfield, 2× Defense – 2× bónus á tengdu metrici.</p>
          </li>
          <li className="rounded-xl border border-neutral-800 p-4 bg-neutral-950/60">
            <div className="text-2xl">📈</div>
            <h3 className="mt-2 font-medium">3) Safnaðu stigum</h3>
            <p className="text-sm text-neutral-300">
              Mörk, stoðsendingar, vörslur, skot og taflustig leggja öll saman.
            </p>
          </li>
        </ol>
        <div className="mt-5">
          {session && (
          <Link href="/dashboard" className="inline-block rounded-xl px-5 py-3 bg-white text-black font-medium hover:opacity-90">
            Áfram á „Liðið mitt“
          </Link>
          )}
          {!session && (
          <p className="inline-block rounded-xl px-5 py-3 bg-white text-black font-medium hover:opacity-90">
            Skráðu þig inn til að byrja
          </p>
          )}
        </div>
      </section>
    </div>
  )
}
