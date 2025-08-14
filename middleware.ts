import { withAuth } from 'next-auth/middleware'
import type { NextRequest } from 'next/server'

export default withAuth({
  pages: { signIn: '/' },
  callbacks: {
    authorized: ({ token, req }) => {
      const path = (req as NextRequest).nextUrl.pathname
      // Admin routes require ADMIN role
      if (path.startsWith('/admin')) return token?.role === 'ADMIN'
      // Other protected routes: any signed-in user
      return !!token
    },
  },
})

export const config = {
  matcher: ['/dashboard/:path*', '/market/:path*', '/admin/:path*'],
}