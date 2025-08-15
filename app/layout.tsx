import './globals.css'
import Link from 'next/link'
import { AuthButton } from '@/components/auth-button'
import NextAuthProvider from '@/components/session-provider'
import { AdminLink } from '@/components/admin-link'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="is">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <NextAuthProvider>
          <header className="border-b border-neutral-800">
            <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
              <Link href="/" className="font-semibold tracking-wide">RLÍS Fantasídeild</Link>
              <nav className="flex items-center gap-6 text-sm">
                <Link href="/how-to-play">Hvernig virkar?</Link>
                <Link href="/leaderboard">Stigatafla</Link>
                <Link href="/dashboard">Liðið mitt</Link>
                <AdminLink />
                <AuthButton />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-12 text-xs text-neutral-400">© {new Date().getFullYear()} RLÍS</footer>
        </NextAuthProvider>
      </body>
    </html>
  )
}