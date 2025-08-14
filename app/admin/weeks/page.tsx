import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'ADMIN') throw new Error('Forbidden')
  return session
}

export async function createWeek() {
  'use server'
  await requireAdmin()
  const latest = await prisma.week.findFirst({ orderBy: { number: 'desc' } })
  const n = (latest?.number ?? 0) + 1
  const now = new Date()
  const first = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const unlock = new Date(first.getTime() + 24 * 60 * 60 * 1000)
  await prisma.week.create({ data: { number: n, startDate: now, firstBroadcastAt: first, unlockedAt: unlock, isLocked: false } })
  revalidatePath('/admin/weeks')
}

export async function toggleLock(formData: FormData) {
  'use server'
  await requireAdmin()
  const id = String(formData.get('id') || '')
  const week = await prisma.week.findUnique({ where: { id } })
  if (!week) return
  await prisma.week.update({ where: { id }, data: { isLocked: !week.isLocked } })
  revalidatePath('/admin/weeks')
}

export async function updateTimes(formData: FormData) {
  'use server'
  await requireAdmin()
  const id = String(formData.get('id') || '')
  const startDate = new Date(String(formData.get('startDate')))
  const firstBroadcastAt = new Date(String(formData.get('firstBroadcastAt')))
  const unlockedAt = new Date(String(formData.get('unlockedAt')))
  await prisma.week.update({ where: { id }, data: { startDate, firstBroadcastAt, unlockedAt } })
  revalidatePath('/admin/weeks')
}

export default async function AdminWeeks() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'ADMIN') return <div>Aðgangur bannaður.</div>

  const weeks = await prisma.week.findMany({ orderBy: { number: 'asc' } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vikuyfirlit</h1>
        <form action={createWeek}><button className="bg-white text-black rounded px-4 py-2">Bæta við viku</button></form>
      </div>
      <ul className="space-y-4">
        {weeks.map(w => (
          <li key={w.id} className="border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">Vika {w.number}</div>
              <form action={toggleLock}>
                <input type="hidden" name="id" value={w.id} />
                <button className={`text-xs rounded px-2 py-1 border ${w.isLocked ? 'border-yellow-600 text-yellow-300' : 'border-emerald-600 text-emerald-300'}`}>
                  {w.isLocked ? 'Læst' : 'Opið'}
                </button>
              </form>
            </div>

            <form action={updateTimes} className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
              <input type="hidden" name="id" value={w.id} />
              <label className="flex flex-col">
                <span className="text-xs text-neutral-400 mb-1">Upphaf</span>
                <input name="startDate" type="datetime-local" defaultValue={new Date(w.startDate).toISOString().slice(0,16)} className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-neutral-400 mb-1">Fyrsta útsending</span>
                <input name="firstBroadcastAt" type="datetime-local" defaultValue={new Date(w.firstBroadcastAt).toISOString().slice(0,16)} className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-neutral-400 mb-1">Læsing af</span>
                <input name="unlockedAt" type="datetime-local" defaultValue={new Date(w.unlockedAt).toISOString().slice(0,16)} className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
              </label>
              <div className="md:col-span-3">
                <button className="mt-2 text-xs border border-neutral-700 rounded px-2 py-1">Vista tíma</button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </div>
  )
}