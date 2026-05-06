import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      discordId?: string
      discordUsername?: string
      discordAvatar?: string
      djangoAccessToken?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    discordId?: string
    discordUsername?: string
    discordAvatar?: string
    accessToken?: string
    djangoAccessToken?: string
    djangoRefreshToken?: string
  }
}
