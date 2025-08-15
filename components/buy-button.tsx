'use client'
import { useFormState, useFormStatus } from 'react-dom'

type Props = {
  playerId: string
  owned: boolean
  disabled?: boolean
  rolesLeft: { STRIKER: number; MIDFIELD: number; DEFENSE: number }
  action: (prevState: any, formData: FormData) => Promise<{ ok?: boolean; error?: string }>
}

export function BuyButton({ playerId, owned, disabled, rolesLeft, action }: Props) {
  const [state, formAction] = useFormState(action, { ok: false, error: '' })
  const { pending } = useFormStatus()
  const canPick = rolesLeft.STRIKER + rolesLeft.MIDFIELD + rolesLeft.DEFENSE > 0

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="playerId" value={playerId} />
      <div className="flex items-center gap-2 text-xs text-neutral-300">
        <label><input type="radio" name="role" value="STRIKER" disabled={rolesLeft.STRIKER <= 0} className="mr-1" /> Striker ({rolesLeft.STRIKER})</label>
        <label><input type="radio" name="role" value="MIDFIELD" disabled={rolesLeft.MIDFIELD <= 0} className="mr-1" /> Midfield ({rolesLeft.MIDFIELD})</label>
        <label><input type="radio" name="role" value="DEFENSE" disabled={rolesLeft.DEFENSE <= 0} className="mr-1" /> Defense ({rolesLeft.DEFENSE})</label>
      </div>
      <button disabled={owned || disabled || pending || !canPick} className="text-sm bg-white text-black rounded px-3 py-1.5 disabled:opacity-40">
        {owned ? 'Í liðinu' : pending ? 'Kaupir…' : 'Kaupa'}
      </button>
      {!owned && state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      {!owned && state?.ok && <p className="text-xs text-green-400">Bætt í liðið</p>}
    </form>
  )
}
