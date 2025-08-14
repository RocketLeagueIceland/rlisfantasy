import { NextResponse } from 'next/server'
import { rebuildWeekScores } from '@/lib/fantasy'

export async function POST(req: Request) {
  const { weekNumber } = await req.json()
  await rebuildWeekScores(weekNumber)
  return NextResponse.json({ ok: true })
}