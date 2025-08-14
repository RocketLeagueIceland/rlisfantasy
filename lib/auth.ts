import NextAuth, { type NextAuthOptions } from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // Persist id/role in the JWT
    async jwt({ token, user }) {
      if (user) {
        // on sign in
        ;(token as any).id = (user as any).id
        ;(token as any).role = (user as any).role ?? 'USER'
      }
      return token
    },
    // Expose id/role on the session.user for the client/server
    async session({ session, token }) {
      if (session?.user) {
        ;(session.user as any).id = (token as any).id
        ;(session.user as any).role = (token as any).role
      }
      return session
    },
  },
}