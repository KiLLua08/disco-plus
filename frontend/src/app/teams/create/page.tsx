'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createTeam } from '@/lib/api'
import { AlertCircle } from 'lucide-react'
import { ROLE_LABELS, Role } from '@/types'

const ROLES: Role[] = ['top', 'jgl', 'mid', 'adc', 'sup']

export default function CreateTeamPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [captainRole, setCaptainRole] = useState<Role>('mid')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const token = (session?.user as any)?.djangoAccessToken

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const team = await createTeam({ name, tag, captain_role: captainRole }, token)
      router.push(`/teams/${team.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create team.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-bold text-white">Create Team</h1>
      <Card>
        <CardHeader>
          <CardTitle>Team Details</CardTitle>
          <CardDescription>
            You&apos;ll be the captain. Pick your role and invite the rest of the roster after.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm text-gray-300">
                Team Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cloud9"
                required
                maxLength={100}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="tag" className="mb-1 block text-sm text-gray-300">
                Tag (max 8 chars)
              </label>
              <input
                id="tag"
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="C9"
                required
                maxLength={8}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">Your Role</label>
              <div className="grid grid-cols-5 gap-2">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setCaptainRole(role)}
                    className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                      captainRole === role
                        ? 'border-indigo-500 bg-indigo-600/30 text-indigo-300'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : `Create Team as ${ROLE_LABELS[captainRole]}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
