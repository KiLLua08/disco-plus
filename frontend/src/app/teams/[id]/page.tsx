'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getTeam, invitePlayer, getPlayers } from '@/lib/api'
import { Team, Player } from '@/types'
import { Shield, Users, Plus, AlertCircle } from 'lucide-react'
import { formatRole } from '@/lib/utils'

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
  const [team, setTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [invitePlayerId, setInvitePlayerId] = useState('')
  const [inviteRole, setInviteRole] = useState('mid')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const token = (session?.user as any)?.djangoAccessToken
  const user = session?.user as any

  useEffect(() => {
    const teamId = parseInt(id)
    Promise.all([getTeam(teamId, token), getPlayers(token)])
      .then(([t, p]) => { setTeam(t); setPlayers(p) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, token])

  const isCaptain = team?.captain?.discord_id === user?.discordId

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteError('')
    setInviteSuccess(false)
    try {
      await invitePlayer(team!.id, { player_id: parseInt(invitePlayerId), role: inviteRole }, token)
      setInviteSuccess(true)
      setInvitePlayerId('')
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite.')
    } finally {
      setInviting(false)
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

  const filledRoles = new Set(team.members?.map((m) => m.role) || [])
  const openRoles = ROLES.filter((r) => !filledRoles.has(r))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold text-white">{team.name}</h1>
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-sm text-gray-400 font-mono">{team.tag}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Shield className="h-4 w-4" /> Captain: {team.captain?.discord_username}
          <span className="mx-2">·</span>{team.wins}W / {team.losses}L
          <span className="mx-2">·</span>{team.points} pts
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Roster ({team.members?.length ?? 0}/5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ROLES.map((role) => {
              const member = team.members?.find((m) => m.role === role)
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
                    <span className="text-xs text-gray-400">{member.player.riot_rank}</span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {isCaptain && openRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Invite Player</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Player</label>
                <select value={invitePlayerId} onChange={(e) => setInvitePlayerId(e.target.value)} required
                  className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                  <option value="">Select a player...</option>
                  {players.filter((p) => !team.members?.some((m) => m.player.id === p.id)).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.discord_username}{p.riot_game_name ? ` (${p.riot_game_name}#${p.riot_tag_line})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Role</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                  {openRoles.map((r) => <option key={r} value={r}>{formatRole(r)}</option>)}
                </select>
              </div>
              {inviteError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{inviteError}
                </div>
              )}
              {inviteSuccess && <p className="text-sm text-green-400">Invite sent!</p>}
              <Button type="submit" disabled={inviting} className="gap-2">
                <Plus className="h-4 w-4" />{inviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
