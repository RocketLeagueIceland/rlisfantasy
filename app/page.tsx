import Link from 'next/link'

export default function Page() {
  return (
    <div className="grid lg:grid-cols-2 gap-10 items-center">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold">Byggðu draumalið RLÍS</h1>
        <p className="text-neutral-300">
          Veldu 6 leikmenn, stilltu 3 virka með stöður á vellinum og safnaðu stigum á hverri viku.
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard" className="rounded-xl px-5 py-3 bg-white text-black">Byrja</Link>
          <Link href="/how-to-play" className="rounded-xl px-5 py-3 border border-neutral-700">Hvernig virkar?</Link>
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-800 p-6">
        <h2 className="font-semibold mb-2">Stigagjöf</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm text-neutral-300">
          <li>Mark: 50</li>
          <li>Stoðsending: 35</li>
          <li>Varsla: 25</li>
          <li>Skot: 15</li>
          <li>Demo: 15</li>
        </ul>
        <div className="mt-4 text-sm text-neutral-400">
          Skyttan fær tvöfalt fyrir mörk, Skaparinn tvöfalt fyrir stoðsendingar, Veggurinn tvöfalt fyrir varslur.
        </div>
      </div>
    </div>
  )
}