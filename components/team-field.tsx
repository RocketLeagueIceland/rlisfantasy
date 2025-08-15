// components/team-field.tsx
'use client'

type Role = 'STRIKER'|'MIDFIELD'|'DEFENSE'
type Item = { id: string; name: string; role: Role; teamName?: string | null; teamLogo?: string | null }

async function postJSON(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || `Villa (${res.status})`)
  }
}

export default function TeamField({
  strikers, mids, defs, canEdit,
}: {
  strikers: Item[]; mids: Item[]; defs: Item[];
  canEdit: boolean;
}) {
  const Slot = ({ label, item }: { label: Role; item?: Item }) => {
    const droppable = (e: React.DragEvent) => { if (canEdit) e.preventDefault() }
    const drop = async (e: React.DragEvent) => {
      e.preventDefault()
      if (!canEdit) return
      const draggedId = e.dataTransfer.getData('text/plain')
      if (!draggedId) return
      try {
        await postJSON('/api/team/role', { teamPlayerId: draggedId, role: label })
        window.location.reload()
      } catch (err) {
        alert((err as Error).message)
      }
    }
    const dragStart = (e: React.DragEvent, id: string) => {
      e.dataTransfer.setData('text/plain', id)
    }

    return (
      <div
        onDragOver={droppable}
        onDrop={drop}
        className="w-full max-w-[240px] rounded-lg border border-green-900/40 bg-green-950/30 backdrop-blur-sm px-3 py-2"
      >
        {!item ? (
          <div className="h-12 flex items-center justify-center text-xs text-neutral-400">
            Laus sæti – {label}
          </div>
        ) : (
          <div
            className="flex items-center justify-between gap-3"
            draggable={canEdit}
            onDragStart={(e) => dragStart(e, item.id)}
          >
            <div className="min-w-0 flex items-center gap-2">
              {item.teamLogo ? (
                <img src={item.teamLogo} alt={item.teamName || 'Lið'} className="w-7 h-7 border border-neutral-700 object-cover rounded-none" />
              ) : (
                <div className="w-6 h-6 rounded-full border border-neutral-700 grid place-items-center text-[10px] text-neutral-300">RL</div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{item.name}</div>
                <div className="text-[10px] text-neutral-300 truncate">
                  {item.teamName || '—'} · <span className="uppercase tracking-wide">{label}</span>
                </div>
              </div>
            </div>
            {canEdit && (
              <button
                className="text-[10px] px-2 py-1 rounded border border-neutral-700 text-neutral-300"
                onClick={async () => {
                  try {
                    await postJSON('/api/market/sell', { teamPlayerId: item.id })
                    window.location.reload()
                  } catch (err) {
                    alert((err as Error).message)
                  }
                }}
                title="Selja leikmann"
              >
                Selja
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height: 420 }}>
      {/* field background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04)_0_8%,rgba(0,0,0,0)_8%_16%)]" />
      <div className="absolute inset-0 border-2 border-green-900/40 rounded-xl" />
      {/* miðlína lárétt */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-px bg-green-900/40" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-green-900/40 rounded-full" style={{ width: 120, height: 120 }} />

      <div className="absolute inset-4 grid grid-rows-3">
        <div className="grid grid-cols-2 gap-4 place-items-center">
          {[0,1].map(i => <Slot key={`S-${i}`} label="STRIKER" item={strikers[i]} />)}
        </div>
        <div className="grid grid-cols-2 gap-4 place-items-center">
          {[0,1].map(i => <Slot key={`M-${i}`} label="MIDFIELD" item={mids[i]} />)}
        </div>
        <div className="grid grid-cols-2 gap-4 place-items-center">
          {[0,1].map(i => <Slot key={`D-${i}`} label="DEFENSE" item={defs[i]} />)}
        </div>
      </div>
    </div>
  )
}
