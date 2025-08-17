// components/team-field.tsx
'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'

type Role = 'STRIKER' | 'MIDFIELD' | 'DEFENSE'
type Item = {
  id: string
  name: string
  role: Role
  teamName?: string | null
  teamLogo?: string | null
}

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

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" fill="none" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function TeamField({
  strikers,
  mids,
  defs,
  canEdit,
}: {
  strikers: Item[]
  mids: Item[]
  defs: Item[]
  canEdit: boolean
}) {
  // Build 2 fixed slots per row and keep them in sync with server props
  const initialSlots = useMemo(() => {
    const fill = (arr: Item[]) => [arr[0] || null, arr[1] || null] as (Item | null)[]
    return {
      STRIKER: fill(strikers),
      MIDFIELD: fill(mids),
      DEFENSE: fill(defs),
    }
  }, [strikers, mids, defs])

  const [ui, setUi] = useState(initialSlots)
  useEffect(() => setUi(initialSlots), [initialSlots])

  const [active, setActive] = useState<Item | null>(null)          // for drag overlay
  const [selectedId, setSelectedId] = useState<string | null>(null) // for tap-to-swap on mobile
  const [pending, setPending] = useState(false)
  const [affected, setAffected] = useState<string[]>([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const router = useRouter()

  // Helpers to find a player’s current slot in ui
  const findSlot = (id: string): { role: Role; index: number } | null => {
    for (const role of ['STRIKER', 'MIDFIELD', 'DEFENSE'] as Role[]) {
      const idx = ui[role].findIndex(x => x?.id === id)
      if (idx >= 0) return { role, index: idx }
    }
    return null
  }

  const optimisticSwap = (aId: string, bId: string) => {
    setUi(prev => {
      const next = { ...prev, STRIKER: [...prev.STRIKER], MIDFIELD: [...prev.MIDFIELD], DEFENSE: [...prev.DEFENSE] }
      const A = findSlot(aId)
      const B = findSlot(bId)
      if (!A || !B) return prev
      const a = next[A.role][A.index]
      const b = next[B.role][B.index]
      next[A.role][A.index] = b
      next[B.role][B.index] = a
      return next
    })
  }

  const optimisticMove = (id: string, to: { role: Role; index: number }) => {
    setUi(prev => {
      const next = { ...prev, STRIKER: [...prev.STRIKER], MIDFIELD: [...prev.MIDFIELD], DEFENSE: [...prev.DEFENSE] }
      const from = findSlot(id)
      if (!from) return prev
      // remove from source
      next[from.role][from.index] = null
      // place into target (use a known object reference if possible)
      const candidate =
        prev[from.role][from.index] ||
        prev[to.role][to.index] ||
        initialSlots[from.role][from.index] ||
        initialSlots[to.role][to.index]
      next[to.role][to.index] = (candidate && (candidate as Item).id === id) ? (candidate as Item) : (candidate as Item) || ({} as Item)
      return next
    })
  }

  // -------- DnD handlers (desktop) --------
  const onDragStart = (e: DragStartEvent) => {
    if (!canEdit || pending) return
    const it = (e.active?.data?.current as any)?.item as Item | undefined
    setActive(it ?? null)
  }

  const onDragEnd = async (event: DragEndEvent) => {
    if (!canEdit || pending) { setActive(null); return }
    const over = event.over
    const activeItem = event.active?.data?.current?.item as Item | undefined
    const overRole = over?.data?.current?.role as Role | undefined
    const overIndex = over?.data?.current?.index as number | undefined
    const overOccupantId = over?.data?.current?.occupantId as string | null | undefined

    setActive(null)
    if (!activeItem || overRole == null || overIndex == null) return

    const revertState = ui
    try {
      setPending(true)
      setAffected(overOccupantId ? [activeItem.id, overOccupantId] : [activeItem.id])

      if (overOccupantId && overOccupantId !== activeItem.id) {
        // Optimistic SWAP
        optimisticSwap(activeItem.id, overOccupantId)
        await postJSON('/api/team/role', {
          teamPlayerId: activeItem.id,
          role: overRole,
          swapWithId: overOccupantId,
        })
      } else {
        // Optimistic MOVE (empty slot)
        optimisticMove(activeItem.id, { role: overRole, index: overIndex })
        await postJSON('/api/team/role', {
          teamPlayerId: activeItem.id,
          role: overRole,
        })
      }
      router.refresh()
    } catch (err) {
      setUi(revertState)
      alert((err as Error).message)
    } finally {
      setPending(false)
      setAffected([])
      setSelectedId(null)
    }
  }

  // -------- Tap-to-swap (mobile) --------
  async function handleTapTarget(target: { role: Role; index: number; occupantId: string | null }) {
    if (!canEdit || pending) return

    // First tap: select the occupant (if any)
    if (!selectedId) {
      if (target.occupantId) setSelectedId(target.occupantId)
      return
    }

    // Second tap: move/swap selected → target
    const movingId = selectedId
    setSelectedId(null)

    const revertState = ui
    try {
      setPending(true)
      if (target.occupantId && target.occupantId !== movingId) {
        setAffected([movingId, target.occupantId])
        optimisticSwap(movingId, target.occupantId)
        await postJSON('/api/team/role', {
          teamPlayerId: movingId,
          role: target.role,
          swapWithId: target.occupantId,
        })
      } else {
        setAffected([movingId])
        optimisticMove(movingId, { role: target.role, index: target.index })
        await postJSON('/api/team/role', {
          teamPlayerId: movingId,
          role: target.role,
        })
      }
      router.refresh()
    } catch (err) {
      setUi(revertState)
      alert((err as Error).message)
    } finally {
      setPending(false)
      setAffected([])
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragCancel={() => setActive(null)}
      onDragEnd={onDragEnd}
    >
      <div className="relative rounded-xl overflow-hidden" style={{ height: 420 }}>
        {/* background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04)_0_8%,rgba(0,0,0,0)_8%_16%)]" />
        <div className="absolute inset-0 border-2 border-green-900/40 rounded-xl" />
        {/* horizontal mid line + circle */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-px bg-green-900/40" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-green-900/40 rounded-full" style={{ width: 120, height: 120 }} />

        {/* saving ribbon */}
        {pending && (
          <div className="absolute left-1/2 -translate-x-1/2 top-3 z-10 px-3 py-1 rounded-full border border-neutral-700 bg-neutral-900/90 text-xs text-neutral-300 flex items-center gap-2">
            <Spinner />
            <span>Vista breytingu…</span>
          </div>
        )}

        <div className="absolute inset-4 grid grid-rows-3">
          <Row
            label="STRIKER"
            items={ui.STRIKER}
            canEdit={canEdit && !pending}
            affected={affected}
            selectedId={selectedId}
            onTap={handleTapTarget}
          />
          <Row
            label="MIDFIELD"
            items={ui.MIDFIELD}
            canEdit={canEdit && !pending}
            affected={affected}
            selectedId={selectedId}
            onTap={handleTapTarget}
          />
          <Row
            label="DEFENSE"
            items={ui.DEFENSE}
            canEdit={canEdit && !pending}
            affected={affected}
            selectedId={selectedId}
            onTap={handleTapTarget}
          />
        </div>
      </div>

      {/* drag preview */}
      <DragOverlay dropAnimation={{ duration: 140 }}>
        {active ? <PlayerCard item={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function Row({
  label,
  items,
  canEdit,
  affected,
  selectedId,
  onTap,
}: {
  label: Role
  items: (Item | null)[]
  canEdit: boolean
  affected: string[]
  selectedId: string | null
  onTap: (target: { role: Role; index: number; occupantId: string | null }) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 place-items-center">
      {[0, 1].map((i) => (
        <Slot
          key={`${label}-${i}`}
          role={label}
          index={i}
          item={items[i]}
          canEdit={canEdit}
          affected={affected}
          selectedId={selectedId}
          onTap={onTap}
        />
      ))}
    </div>
  )
}

function Slot({
  role,
  index,
  item,
  canEdit,
  affected,
  selectedId,
  onTap,
}: {
  role: Role
  index: number
  item: Item | null
  canEdit: boolean
  affected: string[]
  selectedId: string | null
  onTap: (target: { role: Role; index: number; occupantId: string | null }) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${role}-${index}`,
    data: { role, index, occupantId: item?.id ?? null },
  })

  const isAffected = item && affected.includes(item.id)
  const isSelected = item && selectedId === item.id
  const hasSelection = !!selectedId

  return (
    <div
      ref={setNodeRef}
      onClick={() => canEdit && onTap({ role, index, occupantId: item?.id ?? null })}
      className={`w-full max-w-[240px] rounded-lg border bg-green-950/30 backdrop-blur-sm px-3 py-2 transition
        ${canEdit ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'border-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]' :
          isOver ? 'border-emerald-500/50' : 'border-green-900/40'}
        ${isAffected ? 'opacity-70' : ''}`}
    >
      {!item ? (
        <div className="h-12 flex items-center justify-center text-xs text-neutral-400">
          {hasSelection ? 'Setja hér' : <>Laus sæti – {role}</>}
        </div>
      ) : (
        <DraggableCard item={item} canEdit={canEdit} role={role} index={index} affected={isAffected} />
      )}
    </div>
  )
}

function DraggableCard({
  item,
  canEdit,
  role,
  index,
  affected,
}: {
  item: Item
  canEdit: boolean
  role: Role
  index: number
  affected: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item, fromRole: role, fromIndex: index },
    disabled: !canEdit,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.2 : 1,
    cursor: canEdit ? (isDragging ? 'grabbing' as const : 'grab' as const) : 'default',
  } as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full"
    >
      <PlayerCard item={item} role={role} />

      {/* On mobile this block drops UNDER the name; on ≥sm it sits to the right */}
      <div className="flex items-center gap-2 mt-1 sm:mt-0">
        {affected && <Spinner className="text-neutral-300" />}
        {canEdit && (
          <button
            className="text-[10px] px-2 py-1 rounded border border-neutral-700 text-neutral-300 cursor-pointer"
            onClick={async () => {
              try {
                await postJSON('/api/market/sell', { teamPlayerId: item.id })
                // Prefer a soft refresh over a hard reload
                window?.requestAnimationFrame(() => {
                  // If you already have a router in scope here you can call router.refresh()
                  // but since this is a tiny client island, a simple reload is fine:
                  window.location.reload()
                })
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
    </div>
  )
}

function PlayerCard({
  item,
  role,
  overlay = false,
}: {
  item: Item
  role?: Role
  overlay?: boolean
}) {
  return (
    <div className={`min-w-0 flex items-start gap-2 ${overlay ? 'rounded-lg border border-neutral-700 bg-neutral-900/90 px-3 py-2 shadow-xl' : ''}`}>
      {item.teamLogo ? (
        <img
          src={item.teamLogo}
          alt={item.teamName || 'Lið'}
          className="w-7 h-7 border border-neutral-700 object-cover rounded-none"
        />
      ) : (
        <div className="w-7 h-7 border border-neutral-700 grid place-items-center text-[10px] text-neutral-300 rounded-none">RL</div>
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{item.name}</div>
        <div className="text-[10px] text-neutral-300 truncate">{item.teamName || '—'}</div>
        {role ? (
          <div className="text-[10px] text-neutral-400 uppercase tracking-wide">{role}</div>
        ) : null}
      </div>
    </div>
  )
}
