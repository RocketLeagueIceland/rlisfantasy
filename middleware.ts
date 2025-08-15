import { withAuth } from 'next-auth/middleware'
import type { NextRequest } from 'next/server'

export default withAuth({
  pages: { signIn: '/' },
  callbacks: {
    authorized: ({ token, req }) => {
      const path = (req as NextRequest).nextUrl.pathname
      if (path.startsWith('/admin')) return token?.role === 'ADMIN'
      return !!token
    },
  },
})

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}