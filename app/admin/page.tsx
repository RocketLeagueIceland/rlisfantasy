import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'ADMIN') return <div>Aðgangur bannaður.</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="text-neutral-400 text-sm">Velkomin(n), {(session.user as any).id}</p>
      <ul className="grid md:grid-cols-2 gap-4">
        <li className="border border-neutral-800 rounded-xl p-4">
          <h2 className="font-medium mb-2">Leikmenn & verð</h2>
          <p className="text-sm text-neutral-400">Hækka/lækka verð, bæta við nýjum leikmönnum.</p>
          <Link href="/admin/players" className="inline-block mt-3 underline">Opna</Link>
        </li>
        <li className="border border-neutral-800 rounded-xl p-4">
          <h2 className="font-medium mb-2">Vikuyfirlit</h2>
          <p className="text-sm text-neutral-400">Læsa markað, setja firstBroadcastAt o.s.frv.</p>
          <Link href="/admin/weeks" className="inline-block mt-3 underline">Opna</Link>
        </li>
      </ul>
    </div>
  )
}