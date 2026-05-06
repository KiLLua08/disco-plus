'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getSeason, getStandings, getSeasonSchedule,
  openRegistration, startSeason, nextRound, registerTeamForSeason, getMe,
} from '@/lib/api'
import { formatRole } from '@/lib/utils'
import { Trophy, Medal, Calendar, Swords, Play, UserPlus } from 'lucide-react'

export default function SeasonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [season, setSeason] = useState<any>(null)
  const [standings, setStandings] = useState<any[]>([])
  const [schedule, setSchedule] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  // For start/next round form
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('16:00')
  const [showSchedForm, setShowSchedForm] = useState(false)
  const [schedAction, setSchedAction] = useState<'start' | 'next'>('start')

  const token = (session?.user as any)?.djangoAccessToken
  const seasonId = parseInt(id)

  const refresh = async () => {
    const [s, st, sc, m] = await Promise.all([
      getSeason(seasonId, token),
      getStandings(seasonId, token).catch(() => []),
      getSeasonSchedule(seasonId, token).catch(() => []),
      token ? getMe(token).catch(() => null) : null,
    ])
    setSeason(s)
    setStandings(st)
    setSchedule(sc)
    setMe(m)
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [id, token])

  const handleOpenRegistration = async () => {
    setActionLoading(true)
    setError('')
    try {
      await openRegistration(seasonId, token)
      await refresh()
    } catch (err: any) { setError(err.message) }
    finally { setActionLoading(false) }
  }

  const handleStartOrNext = async () => {
    if (!schedDate) { setError('Please select a date.'); return }
    setActionLoading(true)
    setError('')
    try {
      const data = { scheduled_date: schedDate, scheduled_time: schedTime }
      if (schedAction === 'start') {
        await startSeason(seasonId, data, token)
      } else {
        await nextRound(seasonId, data, token)
      }
      setShowSchedForm(false)
      await refresh()
    } catch (err: any) { setError(err.message) }
    finally { setActionLoading(false) }
  }

  const handleRegisterTeam = async () => {
    setActionLoading(true)
    setError('')
    try {
      await registerTeamForSeason(seasonId, token)
      await refresh()
    } catch (err: any) { setError(err.message) }
    finally { setActionLoading(false) }
  }

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (!season) {
    return <div className="flex min-h-[80vh] items-center justify-center"><p className="text-gray-400">Season not found.</p></div>
  }

  const isAdmin = me?.is_admin
  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600']

  // Group schedule by round
  const byRound: Record<number, any[]> = {}
  schedule.forEach((m) => {
    if (!byRound[m.round_number]) byRound[m.round_number] = []
    byRound[m.round_number].push(m)
  })

  const statusVariant: Record<string, any> = {
    upcoming: 'warning',
    registration: 'default',
    active: 'success',
    completed: 'secondary',
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-3xl font-bold text-white">{season.name}</h1>
          <Badge variant={statusVariant[season.status] || 'secondary'}>
            {season.status === 'registration' ? 'Registration Open' : season.status}
          </Badge>
        </div>
        <p className="text-gray-400">
          Split {season.split_number} · Round {season.current_round}/{season.total_rounds}
          {season.start_date && ` · Started ${new Date(season.start_date).toLocaleDateString()}`}
          {season.match_day && ` · Matches: ${season.match_day} ${season.match_time}`}
        </p>
        {season.status === 'registration' && (
          <p className="mt-1 text-sm text-indigo-300">
            {season.registered_teams_count}/{season.min_teams} teams registered
            {season.can_start ? ' — Ready to start!' : ` — Need ${season.min_teams - season.registered_teams_count} more`}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <Card className="mb-6 border-indigo-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-indigo-300">Admin Controls</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {season.status === 'upcoming' && (
              <Button size="sm" onClick={handleOpenRegistration} disabled={actionLoading}>
                Open Registration
              </Button>
            )}
            {season.status === 'registration' && season.can_start && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => { setSchedAction('start'); setShowSchedForm(true) }}
              >
                <Play className="h-3 w-3" /> Start Season & Generate Round 1
              </Button>
            )}
            {season.status === 'active' && season.current_round < season.total_rounds && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setSchedAction('next'); setShowSchedForm(true) }}
              >
                Generate Round {season.current_round + 1}
              </Button>
            )}
          </CardContent>
          {showSchedForm && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Match Date</label>
                  <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Time (UTC)</label>
                  <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none [color-scheme:dark]" />
                </div>
                <Button size="sm" onClick={handleStartOrNext} disabled={actionLoading}>
                  {actionLoading ? 'Generating...' : 'Confirm'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSchedForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Register team button for captains */}
      {season.status === 'registration' && me && !isAdmin && (
        <Card className="mb-6 border-green-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Register your team for this season</p>
              <p className="text-xs text-gray-400">Your roster must have all 5 main roles filled.</p>
            </div>
            <Button size="sm" className="gap-1" onClick={handleRegisterTeam} disabled={actionLoading}>
              <UserPlus className="h-3 w-3" /> Register Team
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Standings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" /> Standings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {standings.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              {season.status === 'registration' ? 'Teams are registering...' : 'No teams yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-gray-400">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Team</th>
                    <th className="pb-3 pr-4 text-center">W</th>
                    <th className="pb-3 pr-4 text-center">L</th>
                    <th className="pb-3 pr-4 text-center">Pts</th>
                    <th className="pb-3 text-center">Buchholz</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {standings.map((team, i) => (
                    <tr key={team.id} className="hover:bg-white/5">
                      <td className="py-3 pr-4">
                        {i < 3 ? <Medal className={`h-4 w-4 ${medalColors[i]}`} /> : <span className="text-gray-500">{i + 1}</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <Link href={`/teams/${team.id}`} className="hover:text-indigo-400">
                          <span className="font-medium text-white">{team.name}</span>
                          <span className="ml-2 text-xs text-gray-500">[{team.tag}]</span>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-center text-green-400 font-semibold">{team.wins}</td>
                      <td className="py-3 pr-4 text-center text-red-400 font-semibold">{team.losses}</td>
                      <td className="py-3 pr-4 text-center font-bold text-white">{team.points}</td>
                      <td className="py-3 text-center text-gray-400">{team.buchholz.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match Schedule */}
      {Object.keys(byRound).length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-white flex items-center gap-2">
            <Swords className="h-5 w-5 text-indigo-400" /> Match Schedule
          </h2>
          {Object.entries(byRound).map(([round, matches]) => (
            <div key={round} className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Round {round}
              </h3>
              <div className="space-y-2">
                {matches.map((match: any) => (
                  <Card key={match.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[80px]">
                            <span className="text-lg font-bold text-blue-400">{match.team_blue?.name}</span>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 font-bold">VS</p>
                            {match.winner && (
                              <p className="text-xs text-green-400 mt-0.5">✓ {match.winner.name}</p>
                            )}
                          </div>
                          <div className="text-center min-w-[80px]">
                            <span className="text-lg font-bold text-red-400">{match.team_red?.name}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {match.scheduled_at && (
                            <p className="text-sm text-gray-300 flex items-center gap-1 justify-end">
                              <Calendar className="h-3 w-3" />
                              {new Date(match.scheduled_at).toLocaleString('en-GB', {
                                weekday: 'short', day: 'numeric', month: 'short',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          )}
                          <Badge className={`mt-1 ${
                            match.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                            match.status === 'scheduled' ? 'bg-blue-500/20 text-blue-300' :
                            'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {match.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
