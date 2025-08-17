'use client'

import { useActionState, useState } from 'react'

type Role = 'STRIKER' | 'MIDFIELD' | 'DEFENSE'

type ReplaceOpt = { id: string; label: string } // TeamPlayer.id + nafn/hlutverk

type Props = {
  playerId: string
  owned: boolean
  disabled?: boolean
  rolesLeft: { STRIKER: number; MIDFIELD: number; DEFENSE: number }
  locked: boolean
  teamFull: boolean
  replaceOptions?: ReplaceOpt[] // sendu team.members.map(...)
  action: (prevState: any, formData: FormData) => Promise<{ ok?: boolean; error?: string }>
}

export function BuyButton({ playerId, owned, disabled, rolesLeft, locked, teamFull, replaceOptions = [], action }: Props) {
  const [state, formAction, pending] = useActionState(action, { ok: false, error: '' })
  const [role, setRole] = useState<Role | ''>('')
  const [replaceId, setReplaceId] = useState('')

  const canPick = rolesLeft.STRIKER + rolesLeft.MIDFIELD + rolesLeft.DEFENSE > 0
  const needReplace = locked && teamFull
  const isDisabled =
    owned || disabled || pending || role === '' || (!needReplace && !canPick) || (needReplace && !replaceId)

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="playerId" value={playerId} />

      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-300">
        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input type="radio" name="role" value="STRIKER" disabled={pending || (!needReplace && rolesLeft.STRIKER <= 0)} onChange={() => setRole('STRIKER')} />
          Striker ({Math.max(0, rolesLeft.STRIKER)})
        </label>
        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input type="radio" name="role" value="MIDFIELD" disabled={pending || (!needReplace && rolesLeft.MIDFIELD <= 0)} onChange={() => setRole('MIDFIELD')} />
          Midfield ({Math.max(0, rolesLeft.MIDFIELD)})
        </label>
        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input type="radio" name="role" value="DEFENSE" disabled={pending || (!needReplace && rolesLeft.DEFENSE <= 0)} onChange={() => setRole('DEFENSE')} />
          Defense ({Math.max(0, rolesLeft.DEFENSE)})
        </label>
      </div>

      {needReplace && (
        <div className="flex items-center gap-2">
          <select
            name="replaceTeamPlayerId"
            value={replaceId}
            onChange={(e) => setReplaceId(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          >
            <option value="">— Skipta út leikmanni —</option>
            {replaceOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      )}

      <button
        disabled={isDisabled}
        className="text-sm bg-white text-black rounded px-3 py-1.5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      >
        {owned ? 'Í liðinu' : pending ? 'Kaupir…' : (needReplace ? 'Skipta (kaupa)' : 'Kaupa')}
      </button>

      {!owned && state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      {!owned && state?.ok && <p className="text-xs text-green-400">Bætt í liðið</p>}
      {!needReplace && !owned && !canPick && <p className="text-xs text-neutral-400">Engin staða laus — seldu fyrst (áður en þú staðfestir lið).</p>}
    </form>
  )
}
