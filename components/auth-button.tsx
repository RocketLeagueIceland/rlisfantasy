'use client'

import { signIn, signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'

export function AuthButton() {
  const { data, status } = useSession()
  const loading = status === 'loading'
  const user = data?.user as any

  if (loading) {
    return <div className="text-xs text-neutral-400">…</div>
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || 'User'}
            width={24}
            height={24}
            className="rounded-full object-cover border border-neutral-800"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="text-sm text-neutral-300 max-w-[140px] truncate">{user.name || user.email}</span>
        <button
          onClick={() => signOut()}
          className="text-xs px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-900"
        >
          Útskrá
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => signIn('discord')}
        className="text-xs px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-900"
        title="Sign in with Discord"
      >
        Innskrá (Discord)
      </button>
      <button
        onClick={() => signIn('google')}
        className="text-xs px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-900"
        title="Sign in with Google"
      >
        Innskrá (Google)
      </button>
    </div>
  )
}
