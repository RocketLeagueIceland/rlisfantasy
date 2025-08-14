import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'ADMIN') throw new Error('Forbidden')
  return session
}

export async function updatePlayer(formData: FormData) {
  'use server'
  await requireAdmin()
  const id = String(formData.get('id') || '')
  const price = Number(formData.get('price') || 0)
  const rlTeamId = String(formData.get('rlTeamId') || '') || null
  await prisma.player.update({ where: { id }, data: { price, rlTeamId: rlTeamId || null } })
  revalidatePath('/admin/players')
}

export async function addPlayer(formData: FormData) {
  'use server'
  await requireAdmin()
  const name = String(formData.get('name') || '').trim()
  const price = Number(formData.get('price') || 10)
  const rlTeamId = String(formData.get('rlTeamId') || '') || null
  if (!name) throw new Error('Name required')
  await prisma.player.create({ data: { name, price, rlTeamId: rlTeamId || null } })
  revalidatePath('/admin/players')
}

export default async function AdminPlayers() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'ADMIN') return <div>Aðgangur bannaður.</div>

  const [players, teams] = await Promise.all([
    prisma.player.findMany({ orderBy: [{ price: 'desc' }, { name: 'asc' }] }),
    prisma.rLTeam.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Leikmenn & verð</h1>

      <form action={addPlayer} className="flex flex-wrap gap-2 items-end border border-neutral-800 rounded-xl p-4">
        <div>
          <label className="block text-xs text-neutral-400">Nafn</label>
          <input name="name" className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" placeholder="Nýr leikmaður" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400">Verð</label>
          <input name="price" type="number" defaultValue={20} className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 w-24" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400">RL lið</label>
          <select name="rlTeamId" className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
            <option value="">(ekkert)</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button className="bg-white text-black rounded px-4 py-2">Bæta við</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr>
            <th className="py-2">Leikmaður</th>
            <th>Verð</th>
            <th>RL lið</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id} className="border-t border-neutral-800">
              <td className="py-2 pr-4">{p.name}</td>
              <td className="py-2 pr-4">
                <form action={updatePlayer} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="price" type="number" defaultValue={p.price} className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 w-24" />
                  <select name="rlTeamId" defaultValue={p.rlTeamId ?? ''} className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1">
                    <option value="">(ekkert)</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button className="text-xs border border-neutral-700 rounded px-2 py-1">Vista</button>
                </form>
              </td>
              <td className="py-2 pr-4 text-neutral-400">{teams.find(t => t.id === p.rlTeamId)?.name ?? '—'}</td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}