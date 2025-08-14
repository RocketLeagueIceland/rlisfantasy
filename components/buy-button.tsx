'use client'
import { useFormState, useFormStatus } from 'react-dom'

type Props = {
  playerId: string
  owned: boolean
  disabled?: boolean
  action: (prevState: any, formData: FormData) => Promise<{ ok?: boolean; error?: string }>
}

export function BuyButton({ playerId, owned, disabled, action }: Props) {
  const [state, formAction] = useFormState(action, { ok: false, error: '' })
  const { pending } = useFormStatus()

  return (
    <form action={formAction}>
      <input type="hidden" name="playerId" value={playerId} />
      <button
        disabled={owned || disabled || pending}
        className="mt-3 text-sm bg-white text-black rounded px-3 py-1.5 disabled:opacity-40"
      >
        {owned ? 'Í liðinu' : pending ? 'Kaupir…' : 'Kaupa'}
      </button>
      {!owned && state?.error && (
        <p className="text-xs text-red-400 mt-2">{state.error}</p>
      )}
      {!owned && state?.ok && (
        <p className="text-xs text-green-400 mt-2">Bætt í liðið</p>
      )}
    </form>
  )
}