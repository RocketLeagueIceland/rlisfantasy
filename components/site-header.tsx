'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { AuthButton } from '@/components/auth-button'
import { AdminLink } from '@/components/admin-link'

export default function SiteHeader() {
  const [open, setOpen] = useState(false)

  // Loka scrolling þegar valmynd er opin
  useEffect(() => {
    const prev = document.body.style.overflow
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        {/* Logo + brand */}
        <Link href="/" className="flex items-center gap-2">
          {/* png logo */}
          <Image
            src="/rlis-logo.png"
            alt="RLÍS"
            width={28}
            height={28}
            priority
            className="shrink-0"
          />
          <span className="hidden sm:block font-semibold tracking-wide">
            RLÍS Fantasídeild
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link className="hover:underline" href="/how-to-play">Hvernig virkar?</Link>
          <Link className="hover:underline" href="/leaderboard">Stigatafla</Link>
          <Link className="hover:underline" href="/dashboard">Liðið mitt</Link>
          <AdminLink />
          <AuthButton />
        </nav>

        {/* Mobile burger */}
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Opna valmynd"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="p-2 rounded border border-neutral-800 hover:border-neutral-700 cursor-pointer"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* ===== MOBILE MENU (FULLSCREEN, Opaque) ===== */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-neutral-950 text-neutral-100 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Top bar */}
          <div className="px-4 h-14 flex items-center justify-between border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Image src="/rlis-logo.png" alt="RLÍS" width={24} height={24} />
              <span className="font-semibold">RLÍS Fantasídeild</span>
            </div>
            <button
              type="button"
              aria-label="Loka valmynd"
              onClick={() => setOpen(false)}
              className="p-2 rounded border border-neutral-800 hover:border-neutral-700 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Links */}
          <nav className="px-4 py-4 grid gap-2 text-sm">
            <MobileLink href="/how-to-play" onClick={() => setOpen(false)}>Hvernig virkar?</MobileLink>
            <MobileLink href="/leaderboard" onClick={() => setOpen(false)}>Stigatafla</MobileLink>
            <MobileLink href="/dashboard" onClick={() => setOpen(false)}>Liðið mitt</MobileLink>

            <div className="pt-3 border-t border-neutral-800 mt-3">
              <AdminLink />
            </div>
            <div className="pt-2">
              <AuthButton />
            </div>
          </nav>

          <div className="px-4 mt-auto pb-6 text-xs text-neutral-500">
            © {new Date().getFullYear()} RLÍS
          </div>
        </div>
      )}
    </header>
  )
}

function MobileLink({
  href,
  children,
  onClick,
}: {
  href: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg border border-neutral-800 px-3 py-2 hover:border-neutral-700 cursor-pointer"
    >
      {children}
    </Link>
  )
}
