'use client'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

export function AdminLink() {
  const { data } = useSession()
  if ((data?.user as any)?.role !== 'ADMIN') return null
  return (
    <Link href="/admin" className="text-xs px-2 py-1 rounded-full border border-emerald-600 text-emerald-300">
      Admin
    </Link>
  )
}