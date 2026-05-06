'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getTeam, getJoinRequests, handleJoinRequest } from '@/lib/api'
import { formatRole, getRankColor } from '@/lib/utils'
import { Shield, Users, CheckCircle, XCircle, Bell } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  top: 'bg-red-500/20 text-red-300 border-red-500/30',
  jgl: 'bg-green-500/20 text-green-300 border-green-500/30',
  mid: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  adc: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  sup: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
}

const ROLES = ['top', 'jgl', 'mid', 'adc', 'sup']

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [team, setTeam] = useState<any>(null)
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [handling, setHandling] = useState<number | null>(null)

  const token = (session?.user as any)?.djangoAccessToken
  const user = session?.user as any

  const refresh = async () => {
    const teamId = parseInt(id)
    const t = await getTeam(teamId, token)
    setTeam(t)
    if (t.captain?.discord_id === user?.discordId) {
      const reqs = await getJoinRequests(teamId, token).catch(() => [])
      setJoinRequests(reqs)
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [id, token])

  const handleRequest = async (requestId: number, action: 'accept' | 'decline') => {
    setHandling(requestId)
    try {
      await handleJoinRequest(parseInt(id), { request_id: requestId, action }, token)
      await refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setHandling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (!team) {
    return <div className="flex min-h-[80vh] items-center justify-center"><p className="text-gray-400">Team not found.</p></div>
  }

  const isCaptain = team.captain?.discord_id === user?.discordId

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold text-white">{team.name}</h1>
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-sm text-gray-400 font-mono">{team.tag}</span>
          {team.season && <Badge variant="success">In Season</Badge>}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Shield className="h-4 w-4" /> Captain: {team.captain?.discord_username}
          <span className="mx-2">·</span>{team.wins}W / {team.losses}L
          <span className="mx-2">·</span>{team.points} pts
        </div>
      </div>

      {/* Join Requests — captain only */}
      {isCaptain && joinRequests.length > 0 && (
        <Card className="mb-6 border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-yellow-400" />
              Join Requests
              <span className="ml-1 rounded-full bg-yellow-500/20 text-yellow-300 text-xs px-2 py-0.5">
                {joinRequests.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {joinRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {req.player.discord_username}
                      {req.player.riot_game_name && (
                        <span className="ml-2 text-xs text-gray-400">
                          {req.player.riot_game_name}#{req.player.riot_tag_line}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs border ${ROLE_COLORS[req.role]}`}>
                        {formatRole(req.role)}{req.is_sub ? ' (sub)' : ''}
                      </span>
                      {req.player.riot_rank && (
                        <span className={`text-xs ${getRankColor(req.player.riot_rank)}`}>
                          {req.player.riot_rank}
                        </span>
                      )}
                    </div>
                    {req.message && (
                      <p className="text-xs text-gray-400 mt-1 italic">&ldquo;{req.message}&rdquo;</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1 bg-green-600/20 text-green-300 hover:bg-green-600/40 border border-green-500/30"
                      disabled={handling === req.id}
                      onClick={() => handleRequest(req.id, 'accept')}
                    >
                      <CheckCircle className="h-3 w-3" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-red-400 hover:bg-red-500/10"
                      disabled={handling === req.id}
                      onClick={() => handleRequest(req.id, 'decline')}
                    >
                      <XCircle className="h-3 w-3" /> Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roster */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Main Roster ({team.main_count}/5)
            {team.is_roster_complete && <Badge variant="success">Complete</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ROLES.map((role) => {
              const member = team.members?.find((m: any) => m.role === role && !m.is_sub)
              return (
                <div key={role} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[role]}`}>
                      {formatRole(role)}
                    </span>
                    {member ? (
                      <div>
                        <p className="text-sm font-medium text-white">{member.player.discord_username}</p>
                        {member.player.riot_game_name && (
                          <p className="text-xs text-gray-400">{member.player.riot_game_name}#{member.player.riot_tag_line}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Open slot</span>
                    )}
                  </div>
                  {member?.player.riot_rank && (
                    <span className={`text-xs ${getRankColor(member.player.riot_rank)}`}>
                      {member.player.riot_rank}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Subs */}
      {(team.sub_count > 0 || isCaptain) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Substitutes ({team.sub_count}/2)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team.members?.filter((m: any) => m.is_sub).length === 0 ? (
              <p className="text-sm text-gray-500">No subs yet.</p>
            ) : (
              <div className="space-y-2">
                {team.members?.filter((m: any) => m.is_sub).map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[member.role]}`}>
                        {formatRole(member.role)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{member.player.discord_username}</p>
                        {member.player.riot_game_name && (
                          <p className="text-xs text-gray-400">{member.player.riot_game_name}#{member.player.riot_tag_line}</p>
                        )}
                      </div>
                    </div>
                    {member.player.riot_rank && (
                      <span className={`text-xs ${getRankColor(member.player.riot_rank)}`}>
                        {member.player.riot_rank}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
