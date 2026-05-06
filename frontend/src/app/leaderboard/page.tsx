'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getLeaderboard } from '@/lib/api'
import { Player } from '@/types'
import { Trophy, Medal } from 'lucide-react'
import { formatRole, getRankColor } from '@/lib/utils'

export default function LeaderboardPage() {
  const { data: session } = useSession()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const token = (session?.user as any)?.djangoAccessToken

  useEffect(() => {
    getLeaderboard(token)
      .then(setPlayers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600']

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Trophy className="h-8 w-8 text-yellow-400" />
        <h1 className="text-3xl font-bold text-white">LP Leaderboard</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Top Players by LP Tokens</CardTitle></CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No players yet.</p>
          ) : (
            <div className="space-y-1">
              {players.map((player, i) => (
                <div key={player.id} className={`flex items-center justify-between rounded-lg p-3 ${i < 3 ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-8 text-center">
                      {i < 3 ? <Medal className={`h-5 w-5 mx-auto ${medalColors[i]}`} /> : <span className="text-sm text-gray-500">{i + 1}</span>}
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600/20 text-sm font-bold text-indigo-300">
                      {player.discord_username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{player.discord_username}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {player.riot_game_name && <span>{player.riot_game_name}#{player.riot_tag_line}</span>}
                        {player.riot_rank && <span className={getRankColor(player.riot_rank)}>{player.riot_rank}</span>}
                        {player.preferred_role && <span>{formatRole(player.preferred_role)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-yellow-400">{player.lp_tokens}</p>
                    <p className="text-xs text-gray-500">LP</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
