'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getMatches, reportMatch } from '@/lib/api'
import { Match } from '@/types'
import { Swords, AlertCircle, CheckCircle } from 'lucide-react'
import { getMatchStatusColor } from '@/lib/utils'

export default function MatchesPage() {
  const { data: session } = useSession()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [reportingId, setReportingId] = useState<number | null>(null)
  const [riotMatchId, setRiotMatchId] = useState('')
  const [reportError, setReportError] = useState('')
  const [reportSuccess, setReportSuccess] = useState(false)
  const token = (session?.user as any)?.djangoAccessToken

  useEffect(() => {
    getMatches(token)
      .then(setMatches)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  const handleReport = async (matchId: number) => {
    setReportError('')
    setReportSuccess(false)
    try {
      await reportMatch(matchId, riotMatchId, token)
      setReportSuccess(true)
      setReportingId(null)
      setRiotMatchId('')
      const updated = await getMatches(token)
      setMatches(updated)
    } catch (err: any) {
      setReportError(err.message || 'Failed to report match.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Swords className="h-8 w-8 text-indigo-400" />
        <h1 className="text-3xl font-bold text-white">Matches</h1>
      </div>

      {reportSuccess && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <CheckCircle className="h-4 w-4" /> Match reported! Results will be processed shortly.
        </div>
      )}

      {matches.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Swords className="mx-auto mb-4 h-12 w-12 text-gray-600" />
            <p className="text-gray-400">No matches scheduled yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <Card key={match.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">Round {match.round_number}</span>
                      <Badge className={getMatchStatusColor(match.status)}>
                        {match.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-blue-400">{match.team_blue?.name}</span>
                      <span className="text-gray-500 text-sm">vs</span>
                      <span className="text-lg font-semibold text-red-400">{match.team_red?.name}</span>
                    </div>
                    {match.winner && <p className="mt-1 text-sm text-green-400">✅ Winner: {match.winner.name}</p>}
                    {match.riot_match_id && <p className="mt-1 text-xs text-gray-500 font-mono">{match.riot_match_id}</p>}
                  </div>

                  {session && match.status === 'scheduled' && (
                    <div>
                      {reportingId === match.id ? (
                        <div className="flex flex-col gap-2">
                          <input type="text" value={riotMatchId} onChange={(e) => setRiotMatchId(e.target.value)}
                            placeholder="NA1_1234567890"
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none font-mono w-48" />
                          {reportError && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />{reportError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleReport(match.id)} disabled={!riotMatchId}>Submit</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setReportingId(null); setRiotMatchId(''); setReportError('') }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setReportingId(match.id)}>Report Result</Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
