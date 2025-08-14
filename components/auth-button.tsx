'use client'
import { signIn, signOut, useSession } from 'next-auth/react'

export function AuthButton() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <span className="text-sm text-neutral-400">Hleður…</span>
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn('discord')}
        className="text-sm border border-neutral-700 rounded-lg px-3 py-1.5"
      >
        Innskrá
      </button>
    )
  }

  const name = session.user.name || 'Notandi'
  const image = (session.user as any).image as string | undefined

  return (
    <div className="flex items-center gap-2">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="h-6 w-6 rounded-full" />
      ) : (
        <div className="h-6 w-6 rounded-full bg-neutral-700 flex items-center justify-center text-[10px]">
          {name.slice(0,1).toUpperCase()}
        </div>
      )}
      <span className="text-sm">{name.split(' ')[0]}</span>
      <button onClick={() => signOut()} className="text-xs border border-neutral-700 rounded px-2 py-1">
        Útskrá
      </button>
    </div>
  )
}