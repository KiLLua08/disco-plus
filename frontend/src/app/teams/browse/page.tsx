'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getBrowseTeams, requestJoinTeam, getMyTeam } from '@/lib/api'
import { formatRole } from '@/lib/utils'
import { Users, Search, CheckCircle, AlertCircle } from 'lucide-react'
import { ROLE_LABELS, Role } from '@/types'

const ROLE_COLORS: Record<string, string> = {
  top: 'bg-red-500/20 text-red-300',
  jgl: 'bg-green-500/20 text-green-300',
  mid: 'bg-blue-500/20 text-blue-300',
  adc: 'bg-yellow-500/20 text-yellow-300',
  sup: 'bg-purple-500/20 text-purple-300',
}

const ROLES: Role[] = ['top', 'jgl', 'mid', 'adc', 'sup']

export default function BrowseTeamsPage() {
  const { data: session } = useSession()
  const [teams, setTeams] = useState<any[]>([])
  const [myTeam, setMyTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState<number | null>(null)
  const [requestRole, setRequestRole] = useState<Role>('mid')
  const [isSub, setIsSub] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const token = (session?.user as any)?.djangoAccessToken
  const user = session?.user as any

  useEffect(() => {
    Promise.all([
      getBrowseTeams(token),
      token ? getMyTeam(token).catch(() => null) : Promise.resolve(null),
    ])
      .then(([t, mt]) => { setTeams(t); setMyTeam(mt) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  const handleRequest = async (teamId: number) => {
    setError('')
    try {
      await requestJoinTeam(teamId, { role: requestRole, is_sub: isSub, message }, token)
      setSuccess(teamId)
      setRequesting(null)
      setMessage('')
    } catch (err: any) {
      setError(err.message || 'Failed to send request.')
    }
  }

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.tag.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">Browse Teams</h1>
        <p className="text-gray-400 text-sm">Find a team with open spots and request to join.</p>
      </div>

      {/* Search */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by team name or tag..."
          className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-gray-600" />
            <p className="text-gray-400">No teams available to join right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((team) => {
            const filledRoles = new Set(
              team.members?.filter((m: any) => !m.is_sub).map((m: any) => m.role) || []
            )
            const openRoles = ROLES.filter((r) => !filledRoles.has(r))
            const isMyTeam = myTeam?.id === team.id
            const alreadyRequested = success === team.id

            return (
              <Card key={team.id} className={isMyTeam ? 'border-indigo-500/40' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold text-white">{team.name}</h2>
                        <span className="text-xs text-gray-400 font-mono border border-white/10 rounded px-1.5 py-0.5">{team.tag}</span>
                        {isMyTeam && <Badge variant="default">Your Team</Badge>}
                      </div>
                      <p className="text-xs text-gray-400 mb-3">
                        Captain: {team.captain?.discord_username}
                        <span className="mx-2">·</span>
                        {team.main_count}/5 main · {team.sub_count}/2 subs
                      </p>

                      {/* Roster slots */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {ROLES.map((role) => {
                          const member = team.members?.find((m: any) => m.role === role && !m.is_sub)
                          return (
                            <span
                              key={role}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                                member
                                  ? ROLE_COLORS[role] + ' border-transparent'
                                  : 'border-white/20 text-gray-500'
                              }`}
                            >
                              {formatRole(role)}{member ? `: ${member.player.discord_username}` : ' (open)'}
                            </span>
                          )
                        })}
                      </div>

                      {/* Subs */}
                      {team.members?.filter((m: any) => m.is_sub).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {team.members.filter((m: any) => m.is_sub).map((m: any) => (
                            <span key={m.id} className="rounded-full px-2 py-0.5 text-xs bg-white/5 text-gray-400 border border-white/10">
                              Sub ({formatRole(m.role)}): {m.player.discord_username}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Request button */}
                    {session && !isMyTeam && (
                      <div className="flex-shrink-0">
                        {alreadyRequested ? (
                          <div className="flex items-center gap-1 text-green-400 text-sm">
                            <CheckCircle className="h-4 w-4" /> Requested
                          </div>
                        ) : requesting === team.id ? (
                          <div className="space-y-2 w-52">
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Role</label>
                              <select
                                value={requestRole}
                                onChange={(e) => setRequestRole(e.target.value as Role)}
                                className="w-full rounded-lg border border-white/10 bg-gray-900 px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                              >
                                {openRoles.map((r) => (
                                  <option key={r} value={r}>{ROLE_LABELS[r]} (open)</option>
                                ))}
                                {ROLES.filter((r) => !openRoles.includes(r)).map((r) => (
                                  <option key={r} value={r}>{ROLE_LABELS[r]} (as sub)</option>
                                ))}
                              </select>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSub}
                                onChange={(e) => setIsSub(e.target.checked)}
                                className="rounded"
                              />
                              Request as substitute
                            </label>
                            <input
                              type="text"
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Optional message to captain..."
                              maxLength={200}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                            />
                            {error && (
                              <p className="text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />{error}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleRequest(team.id)}>Send</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setRequesting(null); setError('') }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRequesting(team.id)
                              setRequestRole(openRoles[0] || 'mid')
                              setIsSub(openRoles.length === 0)
                              setError('')
                            }}
                            disabled={team.main_count >= 5 && team.sub_count >= 2}
                          >
                            {team.main_count >= 5 && team.sub_count >= 2 ? 'Full' : 'Request to Join'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
