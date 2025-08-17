'use client'

import { useActionState, useState } from 'react'

type Role = 'STRIKER' | 'MIDFIELD' | 'DEFENSE'

type Props = {
  playerId: string
  owned: boolean
  disabled?: boolean
  rolesLeft: { STRIKER: number; MIDFIELD: number; DEFENSE: number }
  action: (prevState: any, formData: FormData) => Promise<{ ok?: boolean; error?: string }>
}

export function BuyButton({ playerId, owned, disabled, rolesLeft, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { ok: false, error: '' })
  const [role, setRole] = useState<Role | ''>('')

  const canPick =
    rolesLeft.STRIKER + rolesLeft.MIDFIELD + rolesLeft.DEFENSE > 0

  const isDisabled =
    owned || disabled || pending || !canPick || role === ''

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="playerId" value={playerId} />

      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-300">
        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="role"
            value="STRIKER"
            disabled={rolesLeft.STRIKER <= 0 || pending}
            onChange={() => setRole('STRIKER')}
          />
          Striker ({rolesLeft.STRIKER})
        </label>

        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="role"
            value="MIDFIELD"
            disabled={rolesLeft.MIDFIELD <= 0 || pending}
            onChange={() => setRole('MIDFIELD')}
          />
          Midfield ({rolesLeft.MIDFIELD})
        </label>

        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="role"
            value="DEFENSE"
            disabled={rolesLeft.DEFENSE <= 0 || pending}
            onChange={() => setRole('DEFENSE')}
          />
          Defense ({rolesLeft.DEFENSE})
        </label>
      </div>

      <button
        disabled={isDisabled}
        className="text-sm bg-white text-black rounded px-3 py-1.5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      >
        {owned ? 'Í liðinu' : pending ? 'Kaupir…' : 'Kaupa'}
      </button>

      {!owned && state?.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      {!owned && state?.ok && (
        <p className="text-xs text-green-400">Bætt í liðið</p>
      )}
      {!canPick && !owned && (
        <p className="text-xs text-neutral-400">
          Engin staða laus — seldu fyrst til að kaupa.
        </p>
      )}
    </form>
  )
}
