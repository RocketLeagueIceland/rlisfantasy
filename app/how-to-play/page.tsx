import Link from 'next/link'
import { getServerSession } from 'next-auth'

export default async function HowToPlay() {
  const session = await getServerSession()
  return (
    <div className="space-y-8">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-neutral-800 p-6 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.15),transparent_60%)]">
        <h1 className="text-3xl md:text-4xl font-bold">Hvernig virkar Fantasídeild RLÍS?</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          Byggðu 6 manna lið, raðaðu þeim í stöður á vellinum og safnaðu stigum út frá frammistöðu þeirra í leikjum.
          Stöður hækka tengda tölfræði <span className="font-semibold">2×</span> (sjá hér að neðan).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {session && <Link href="/dashboard" className="rounded-xl px-4 py-2 bg-white text-black text-sm">Byrja núna</Link>}
          <Link href="/leaderboard" className="rounded-xl px-4 py-2 border border-neutral-700 text-sm">Sjá stigatöflu</Link>
        </div>
      </section>

      {/* 3 STEPS */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Skref fyrir skref</h2>
        <ol className="grid md:grid-cols-3 gap-4">
          <li className="rounded-xl border border-neutral-800 p-4 bg-neutral-950/40">
            <div className="text-2xl">🛒</div>
            <h3 className="mt-2 font-medium">1) Veldu leikmenn</h3>
            <p className="text-sm text-neutral-300">Kauptu allt að 6 leikmenn innan <strong>Salary Cap 10000000 kr</strong>.</p>
          </li>
          <li className="rounded-xl border border-neutral-800 p-4 bg-neutral-950/40">
            <div className="text-2xl">📍</div>
            <h3 className="mt-2 font-medium">2) Settu í stöður</h3>
            <p className="text-sm text-neutral-300">2× <strong>Striker</strong>, 2× <strong>Midfield</strong>, 2× <strong>Defense</strong>. Stöður hækka tengda tölfræði <strong>2×</strong>.</p>
          </li>
          <li className="rounded-xl border border-neutral-800 p-4 bg-neutral-950/40">
            <div className="text-2xl">📈</div>
            <h3 className="mt-2 font-medium">3) Safnaðu stigum</h3>
            <p className="text-sm text-neutral-300">Stig á <em>leik</em> leggjast saman yfir vikuna. Sjá stigagjöf hér að neðan.</p>
          </li>
        </ol>
      </section>

      {/* POSITIONS & BONUS */}
      <section className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-800 p-4">
          <h3 className="font-medium">Stöður & bónus</h3>
          <ul className="mt-2 text-sm text-neutral-300 space-y-1">
            <li>⚽ <strong>Striker</strong> → <span className="font-semibold">2×</span> stig fyrir <em>mörk</em>.</li>
            <li>🎯 <strong>Midfield</strong> → <span className="font-semibold">2×</span> stig fyrir <em>stoðsendingar</em>.</li>
            <li>🧱 <strong>Defense</strong> → <span className="font-semibold">2×</span> stig fyrir <em>varslur</em>.</li>
          </ul>
          <p className="mt-3 text-xs text-neutral-400">Stöðubónus er stilltur á <strong>2×</strong> sjálfgefið.</p>
        </div>
        <div className="rounded-xl border border-neutral-800 p-4">
          <h3 className="font-medium">Stigagjöf (á leik)</h3>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-sm text-neutral-300">
            <li>Mark: <strong>50</strong></li>
            <li>Stoðsending: <strong>25</strong></li>
            <li>Varsla: <strong>25</strong></li>
            <li>Skot: <strong>15</strong></li>
            <li className="col-span-2">Score (RL stigatafla): <strong>1</strong> per stig</li>
          </ul>
        </div>
        <div className="rounded-xl border border-neutral-800 p-4">
          <h3 className="font-medium">Launaþak & markaður</h3>
          <ul className="mt-2 text-sm text-neutral-300 space-y-1">
            <li>💰 <strong>Salary Cap:</strong> 10000000 kr</li>
            <li>🔄 Selurðu leikmann færðu <em>upphaflegt kaupverð</em> til baka.</li>
            <li>🔒 Markaður getur verið <em>læstur</em> á leikdögum.</li>
          </ul>
        </div>
      </section>

      {/* EXAMPLE */}
      <section className="rounded-2xl border border-neutral-800 p-4">
        <h2 className="text-lg font-semibold">Dæmi um stig</h2>
        <p className="text-sm text-neutral-300 mt-2">Leikmaður í <strong>Striker</strong> fær í einum leik: 2 mörk, 1 skot.</p>
        <ul className="text-sm text-neutral-300 mt-2 list-disc pl-5">
          <li>Mörk: 2 × 50 = 100 → <span className="font-semibold">2× bónus = 200</span></li>
          <li>Skot: 1 × 15 = 15</li>
          <li><strong>Samtals:</strong> 215 stig</li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-800 p-4">
          <h3 className="font-medium">Algengar spurningar</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-neutral-200">Hvernig stofna ég lið?</dt>
              <dd className="text-neutral-400">Skráðu þig inn → farðu á <Link href="/dashboard" className="underline">Liðið mitt</Link> → sláðu inn heiti og staðfestu.</dd>
            </div>
            <div>
              <dt className="text-neutral-200">Hvenær get ég keypt/selt?</dt>
              <dd className="text-neutral-400">Þegar markaður er opinn. Markaðurinn er lokaður þegar leikir standa yfir. Stjórnendur geta líka lokað markaðnum handvirkt.</dd>
            </div>
            <div>
              <dt className="text-neutral-200">Hvernig breytist verð?</dt>
              <dd className="text-neutral-400">Verð er uppfært reglulega út frá frammistöðu (stýrt af stjórnendum).</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border border-neutral-800 p-4">
          <h3 className="font-medium">Góð ráð</h3>
          <ul className="mt-2 text-sm text-neutral-300 space-y-2 list-disc pl-5">
            <li>Stilla stöður út frá styrkleikum leikmanna (markaskorarar í Striker o.s.frv.).</li>
            <li>Dreifðu fjárhættunni – ekki eyða öllu í tvo leikmenn.</li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-wrap gap-3">
        {session && <Link href="/dashboard" className="rounded-xl px-4 py-2 bg-white text-black text-sm">Setja upp lið</Link>}
        <Link href="/leaderboard" className="rounded-xl px-4 py-2 border border-neutral-700 text-sm">Skoða stigatöflu</Link>
      </section>
    </div>
  )
}