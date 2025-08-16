// app/layout.tsx
import './globals.css'
import NextAuthProvider from '@/components/session-provider'
import SiteHeader from '@/components/site-header' // ⬅️ nýtt

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="is">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <NextAuthProvider>
          <SiteHeader /> {/* ⬅️ nýi, responsive headerinn með RLÍS logo */}
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-12 text-xs text-neutral-400">
            © {new Date().getFullYear()} RLÍS
          </footer>
        </NextAuthProvider>
      </body>
    </html>
  )
}
