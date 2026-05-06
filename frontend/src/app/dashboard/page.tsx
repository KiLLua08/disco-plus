'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSeasons, getMyMatches, getLeaderboard, getMyTeam } from '@/lib/api'
import { Season, Match, Player } from '@/types'
import { Trophy, Swords, Users, Zap, ChevronRight, Calendar, Shield } from 'lucide-react'
import { getMatchStatusColor, formatRole } from '@/lib/utils'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [myMatches, setMyMatches] = useState<Match[]>([])
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [myTeam, setMyTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    const token = (session?.user as any)?.djangoAccessToken
    Promise.all([
      getSeasons(token),
      getMyMatches(token).catch(() => []),
      getLeaderboard(token),
      getMyTeam(token).catch(() => null),
    ])
      .then(([s, m, l, t]) => {
        setSeasons(s)
        setMyMatches(m)
        setLeaderboard(l.slice(0, 5))
        setMyTeam(t)
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
  const registrationSeason = seasons.find((s) => s.status === 'registration')
  const user = session?.user as any
  const nextMatch = myMatches.find((m) => m.status === 'scheduled')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {user?.discordUsername || user?.name || 'Summoner'} 👋
        </h1>
        <p className="mt-1 text-gray-400">
          {activeSeason
            ? `${activeSeason.name} — Round ${activeSeason.current_round}/${activeSeason.total_rounds}`
            : registrationSeason
            ? `${registrationSeason.name} — Registration open (${registrationSeason.registered_teams_count}/${registrationSeason.min_teams} teams)`
            : 'No active season right now.'}
        </p>
      </div>

      {/* My Team + Next Match row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* My Team */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-indigo-400" /> My Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myTeam ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-lg font-bold text-white">
                      {myTeam.name}{' '}
                      <span className="text-sm text-gray-400 font-mono">[{myTeam.tag}]</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {myTeam.main_count}/5 main · {myTeam.sub_count}/2 subs
                      {myTeam.season ? (
                        <span className="ml-2 text-green-400">✓ Registered</span>
                      ) : (
                        <span className="ml-2 text-yellow-400">Not registered</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{myTeam.wins}W / {myTeam.losses}L</p>
                    <p className="text-xs text-gray-400">{myTeam.points} pts</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/teams/${myTeam.id}`}>
                    <Button variant="outline" size="sm">Manage Roster</Button>
                  </Link>
                  {!myTeam.season && myTeam.is_roster_complete && registrationSeason && (
                    <Link href={`/seasons/${registrationSeason.id}`}>
                      <Button size="sm" className="gap-1">
                        <Trophy className="h-3 w-3" /> Join Season
                      </Button>
                    </Link>
                  )}
                  {!myTeam.season && !myTeam.is_roster_complete && (
                    <p className="text-xs text-yellow-400 self-center">
                      Need {myTeam.open_main_roles?.length} more main players
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-3">You&apos;re not part of any team yet.</p>
                <div className="flex gap-2">
                  <Link href="/teams/create">
                    <Button size="sm" className="gap-1">
                      <Users className="h-3 w-3" /> Create Team
                    </Button>
                  </Link>
                  <Link href="/teams/browse">
                    <Button variant="outline" size="sm">Browse Teams</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Match */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Swords className="h-4 w-4 text-indigo-400" /> Next Match
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextMatch ? (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-blue-400 font-semibold">{nextMatch.team_blue?.name}</span>
                  <span className="text-gray-500 text-sm">vs</span>
                  <span className="text-red-400 font-semibold">{nextMatch.team_red?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <Calendar className="h-3 w-3" />
                  {nextMatch.scheduled_at
                    ? new Date(nextMatch.scheduled_at).toLocaleString('en-GB', {
                        weekday: 'long', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : 'TBD'}
                  <span className="ml-1">· Round {nextMatch.round_number}</span>
                </div>
                <Link href="/matches">
                  <Button size="sm" variant="outline" className="gap-1">
                    View & Report
                  </Button>
                </Link>
              </div>
            ) : myTeam?.season ? (
              <p className="text-sm text-gray-400">No upcoming matches scheduled yet.</p>
            ) : (
              <p className="text-sm text-gray-400">Register your team in a season to get matches.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* My Matches */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>My Matches</CardTitle>
              <Link href="/matches">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  All matches <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {myMatches.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  No matches yet. Register your team in a season to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {myMatches.slice(0, 5).map((match) => (
                    <div key={match.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-gray-400">R{match.round_number}</p>
                        <div>
                          <p className="text-sm font-medium text-white">
                            <span className="text-blue-400">{match.team_blue?.name}</span>
                            <span className="mx-2 text-gray-500">vs</span>
                            <span className="text-red-400">{match.team_red?.name}</span>
                          </p>
                          {match.scheduled_at && (
                            <p className="text-xs text-gray-400">
                              {new Date(match.scheduled_at).toLocaleString('en-GB', {
                                weekday: 'short', day: 'numeric', month: 'short',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          )}
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
        </div>
      </div>
    </div>
  )
}
