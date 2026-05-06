'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getTeams } from '@/lib/api'
import { Team } from '@/types'
import { Users, Plus, Shield } from 'lucide-react'
import { formatRole } from '@/lib/utils'

const ROLE_COLORS: Record<string, string> = {
  top: 'bg-red-500/20 text-red-300',
  jgl: 'bg-green-500/20 text-green-300',
  mid: 'bg-blue-500/20 text-blue-300',
  adc: 'bg-yellow-500/20 text-yellow-300',
  sup: 'bg-purple-500/20 text-purple-300',
}

export default function TeamsPage() {
  const { data: session } = useSession()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const token = (session?.user as any)?.djangoAccessToken

  useEffect(() => {
    getTeams(token)
      .then(setTeams)
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Teams</h1>
        {session && (
          <Link href="/teams/create">
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create Team</Button>
          </Link>
        )}
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-gray-600" />
            <p className="text-gray-400">No teams yet. Be the first to create one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <Link key={team.id} href={`/teams/${team.id}`}>
              <Card className="hover:border-indigo-500/40 transition-colors cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {team.name} <span className="text-sm text-gray-400">[{team.tag}]</span>
                      </h2>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> {team.captain?.discord_username}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{team.wins}W / {team.losses}L</p>
                      <p className="text-xs text-gray-400">{team.points} pts</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {team.members?.map((member) => (
                      <span key={member.id} className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[member.role] || 'bg-gray-500/20 text-gray-300'}`}>
                        {formatRole(member.role)}: {member.player.discord_username}
                      </span>
                    ))}
                    {(!team.members || team.members.length === 0) && (
                      <span className="text-xs text-gray-500">No members yet</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
