'use client'

import { useActionState } from 'react'

type ActionResult = { ok: boolean; message?: string }

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" fill="none" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function BallFormClient({
  action,            // server action: (formData) => Promise<ActionResult>
  weeks,
  defaultWeekId,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  weeks: { id: string; number: number }[]
  defaultWeekId?: string
}) {
  // Wrap the server action so we can use the new React.useActionState API
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => {
      try {
        return await action(formData)
      } catch (e) {
        return { ok: false, message: (e as Error).message || 'Villa' }
      }
    },
    null
  )

  return (
    <>
      <form action={formAction} className="grid md:grid-cols-[1fr,220px,auto] gap-2 items-end" aria-busy={pending}>
        <label className="flex flex-col">
          <span className="text-xs text-neutral-400 mb-1">Group slóð eða ID</span>
          <input
            name="group"
            placeholder="https://ballchasing.com/group/xxxxx"
            className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2"
            required
          />
        </label>

        <label className="flex flex-col">
          <span className="text-xs text-neutral-400 mb-1">Vika</span>
          <select
            name="weekId"
            defaultValue={defaultWeekId}
            className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2"
            required
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                Vika {w.number}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={pending}
          className={`rounded px-4 py-2 ${pending ? 'opacity-70 cursor-not-allowed' : ''} bg-white text-black`}
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Sæki…
            </span>
          ) : (
            'Sækja & vista'
          )}
        </button>
      </form>

      {state?.message && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-2 rounded border px-3 py-2 text-sm ${
            state.ok
              ? 'border-emerald-700 bg-emerald-500/10 text-emerald-200'
              : 'border-red-700 bg-red-500/10 text-red-200'
          }`}
        >
          {state.message}
        </div>
      )}
    </>
  )
}
