'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSeasons, getMatches, getLeaderboard } from '@/lib/api'
import { Season, Match, Player } from '@/types'
import { Trophy, Swords, Users, Zap, ChevronRight } from 'lucide-react'
import { getMatchStatusColor } from '@/lib/utils'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    const token = (session?.user as any)?.djangoAccessToken
    Promise.all([getSeasons(token), getMatches(token), getLeaderboard(token)])
      .then(([s, m, l]) => {
        setSeasons(s)
        setMatches(m.slice(0, 5))
        setLeaderboard(l.slice(0, 5))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [status, session])

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  const activeSeason = seasons.find((s) => s.status === 'active')
  const user = session?.user as any

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {user?.discordUsername || user?.name || 'Summoner'} 👋
        </h1>
        <p className="mt-1 text-gray-400">
          {activeSeason
            ? `${activeSeason.name} — Round ${activeSeason.current_round}/${activeSeason.total_rounds}`
            : 'No active season right now.'}
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Active Season', value: activeSeason?.name || '—', icon: Trophy },
          { label: 'Current Round', value: activeSeason ? `${activeSeason.current_round}/${activeSeason.total_rounds}` : '—', icon: Swords },
          { label: 'Teams', value: activeSeason?.teams?.length ?? '—', icon: Users },
          { label: 'Recent Matches', value: matches.length, icon: Zap },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20">
                    <Icon className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                    <p className="text-lg font-semibold text-white">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Matches */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Recent Matches</CardTitle>
              <Link href="/matches">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {matches.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No matches yet.</p>
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-gray-400">R{match.round_number}</p>
                        <div>
                          <p className="text-sm font-medium text-white">
                            <span className="text-blue-400">{match.team_blue?.name}</span>
                            <span className="mx-2 text-gray-500">vs</span>
                            <span className="text-red-400">{match.team_red?.name}</span>
                          </p>
                          {match.winner && (
                            <p className="text-xs text-green-400">Winner: {match.winner.name}</p>
                          )}
                        </div>
                      </div>
                      <Badge className={getMatchStatusColor(match.status)}>
                        {match.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* LP Leaderboard */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>LP Leaderboard</CardTitle>
              <Link href="/leaderboard">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  Full <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No players yet.</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((player, i) => (
                    <div key={player.id} className="flex items-center justify-between rounded-lg p-2 hover:bg-white/5">
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-center text-sm font-bold text-gray-500">{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{player.discord_username}</p>
                          {player.riot_game_name && (
                            <p className="text-xs text-gray-400">{player.riot_game_name}#{player.riot_tag_line}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-yellow-400">{player.lp_tokens} LP</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/teams/create" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Users className="h-4 w-4" /> Create Team
                </Button>
              </Link>
              <Link href="/profile" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Zap className="h-4 w-4" /> Link Riot Account
                </Button>
              </Link>
              {activeSeason && (
                <Link href={`/seasons/${activeSeason.id}`} className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Trophy className="h-4 w-4" /> View Standings
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
