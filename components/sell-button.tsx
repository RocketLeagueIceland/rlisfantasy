'use client'
import { useFormState, useFormStatus } from 'react-dom'

type Props = {
  teamPlayerId: string
  action: (prevState: any, formData: FormData) => Promise<{ ok?: boolean; error?: string }>
}

export function SellButton({ teamPlayerId, action }: Props) {
  const [state, formAction] = useFormState(action, { ok: false, error: '' })
  const { pending } = useFormStatus()

  return (
    <form action={formAction}>
      <input type="hidden" name="teamPlayerId" value={teamPlayerId} />
      <button
        disabled={pending}
        className="text-xs border border-red-500 text-red-300 rounded px-2 py-1 hover:bg-red-500/10"
      >
        {pending ? 'Selur…' : 'Selja'}
      </button>
      {state?.error && (
        <p className="text-xs text-red-400 mt-1">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-xs text-green-400 mt-1">Selt</p>
      )}
    </form>
  )
}