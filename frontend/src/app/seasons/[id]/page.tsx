'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSeason, getStandings } from '@/lib/api'
import { Season, Team } from '@/types'
import { Trophy, Medal } from 'lucide-react'

export default function SeasonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [season, setSeason] = useState<Season | null>(null)
  const [standings, setStandings] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const token = (session?.user as any)?.djangoAccessToken

  useEffect(() => {
    const seasonId = parseInt(id)
    Promise.all([getSeason(seasonId, token), getStandings(seasonId, token)])
      .then(([s, st]) => { setSeason(s); setStandings(st) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, token])

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

  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600']

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">{season.name}</h1>
          <Badge variant={season.status === 'active' ? 'success' : 'secondary'}>{season.status}</Badge>
        </div>
        <p className="text-gray-400">
          Split {season.split_number} · Round {season.current_round}/{season.total_rounds}
          {season.start_date && ` · Started ${new Date(season.start_date).toLocaleDateString()}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" /> Standings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {standings.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No teams registered yet.</p>
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

      {season.teams && season.teams.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold text-white">Teams</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {season.teams.map((team) => (
              <Link key={team.id} href={`/teams/${team.id}`}>
                <Card className="hover:border-indigo-500/40 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{team.name} <span className="text-xs text-gray-400">[{team.tag}]</span></p>
                        <p className="text-xs text-gray-400">Captain: {team.captain?.discord_username}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{team.wins}W / {team.losses}L</p>
                        <p className="text-xs text-gray-400">{team.members?.length ?? 0}/5 players</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
