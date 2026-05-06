import { NextAuthOptions } from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'identify email guilds' },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // On first sign-in, sync to Django and store the JWT it returns
      if (account && profile) {
        token.discordId = (profile as any).id
        token.discordUsername = (profile as any).username
        token.discordAvatar = (profile as any).avatar
        token.accessToken = account.access_token

        // Sync to Django backend, get back a JWT
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
          const res = await fetch(`${apiUrl}/api/auth/discord/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              discord_id: (profile as any).id,
              discord_username: (profile as any).username,
              discord_avatar: (profile as any).avatar || '',
              email: token.email || '',
              access_token: account.access_token || '',
            }),
          })
          if (res.ok) {
            const data = await res.json()
            // Store Django JWT in the next-auth token
            token.djangoAccessToken = data.access
            token.djangoRefreshToken = data.refresh
          }
        } catch (err) {
          console.error('Failed to sync user to Django backend:', err)
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).discordId = token.discordId
        ;(session.user as any).discordUsername = token.discordUsername
        ;(session.user as any).discordAvatar = token.discordAvatar
        // Expose Django JWT to the client so API calls can use it
        ;(session.user as any).djangoAccessToken = token.djangoAccessToken
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
