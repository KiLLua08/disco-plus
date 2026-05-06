'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Swords, Trophy, Users, LayoutDashboard, LogOut, User } from 'lucide-react'

export function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Swords className="h-6 w-6 text-indigo-400" />
            <span className="text-lg font-bold text-white">Discord Clash+</span>
          </Link>

          {/* Nav links */}
          {session && (
            <div className="hidden md:flex items-center gap-1">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/seasons">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Trophy className="h-4 w-4" />
                  Seasons
                </Button>
              </Link>
              <Link href="/teams/browse">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  Teams
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Trophy className="h-4 w-4" />
                  Leaderboard
                </Button>
              </Link>
            </div>
          )}

          {/* User menu */}
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {(session.user as any)?.discordUsername || session.user?.name}
                    </span>
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="discord" size="sm">
                  Login with Discord
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
