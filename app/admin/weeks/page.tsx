export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { rebuildWeekScores } from '@/lib/fantasy'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'ADMIN') throw new Error('Forbidden')
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

export async function recomputeWeek(formData: FormData) {
  'use server'
  await requireAdmin()
  const number = Number(formData.get('number') || 0)
  await rebuildWeekScores(number)
  revalidatePath('/leaderboard')
}

export default async function WeeksAdminPage() {
  await requireAdmin()
  const weeks = await prisma.week.findMany({ orderBy: { number: 'asc' } })
  const now = new Date()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Vikuyfirlit</h1>
      <ul className="space-y-3">
        {weeks.map(w => {
          const autoLocked = now >= w.firstBroadcastAt && now < w.unlockedAt
          return (
            <li key={w.id} className="rounded-xl border border-neutral-800 p-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="space-y-1">
                <div className="font-medium">Vika {w.number}</div>
                <div className="text-xs text-neutral-400">
                  {new Date(w.firstBroadcastAt).toUTCString().replace('GMT','UTC')} → {new Date(w.unlockedAt).toUTCString().replace('GMT','UTC')}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {autoLocked && <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-600/40 text-yellow-200">Sjálflæst (14:00–17:00)</span>}
                  {w.isLocked && <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-600/40 text-red-200">Handvirkt læst</span>}
                  {!autoLocked && !w.isLocked && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-600/40 text-emerald-200">Opinn</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <form action={toggleLock}>
                  <input type="hidden" name="id" value={w.id} />
                  <button className="text-xs border border-neutral-700 rounded px-2 py-1">
                    {w.isLocked ? 'Opna markað' : 'Læsa markað'}
                  </button>
                </form>
                <form action={recomputeWeek}>
                  <input type="hidden" name="number" value={w.number} />
                  <button className="text-xs border border-neutral-700 rounded px-2 py-1">Endurreikna stig</button>
                </form>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
