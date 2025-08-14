import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'

export default async function Dashboard() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <div>Þú þarft að vera skráður inn.</div>

  const team = await prisma.team.findUnique({
    where: { userId: (session.user as any).id },
    include: { members: { include: { player: true } } },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Liðið mitt</h1>
      {!team ? (
        <div>
          <p>Engin lið — smelltu til að stofna.</p>
          <form action={createTeam}>
            <input name="name" placeholder="Heiti liðs" className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 mr-2" />
            <button className="bg-white text-black rounded px-4 py-2">Stofna lið</button>
          </form>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-neutral-800 p-4">
            <h2 className="font-medium mb-3">Virkir leikmenn</h2>
            <ul className="space-y-2">
              {team.members.filter(m => m.isActive).sort((a,b)=> (a.activeOrder!-b.activeOrder!)).map(m => (
                <li key={m.id} className="flex justify-between">
                  <span>{m.activeOrder}. {m.player.name}</span>
                  <span className="text-xs text-neutral-400">{m.role}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-neutral-800 p-4">
            <h2 className="font-medium mb-3">Varamenn</h2>
            <ul className="space-y-2">
              {team.members.filter(m => !m.isActive).sort((a,b)=> (a.benchOrder!-b.benchOrder!)).map(m => (
                <li key={m.id} className="flex justify-between">
                  <span>{m.benchOrder}. {m.player.name}</span>
                  <span className="text-xs text-neutral-400">{m.pricePaid} cr</span>
                </li>
              ))}
            </ul>
          </div>
          <Link href="/market" className="col-span-full inline-block mt-2 underline">Á markað</Link>
        </div>
      )}
    </div>
  )
}

async function createTeam(formData: FormData) {
  'use server'
  const name = String(formData.get('name') || 'Mitt lið')
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Unauthorized')
  await prisma.team.create({ data: { name, userId: (session.user as any).id } })
}