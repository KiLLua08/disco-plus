'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getMe, linkRiotAccount } from '@/lib/api'
import { Player, ROLE_LABELS, Role } from '@/types'
import { formatRank, getRankColor } from '@/lib/utils'
import { Swords, Link2, CheckCircle, AlertCircle, Save } from 'lucide-react'

const ROLES: Role[] = ['top', 'jgl', 'mid', 'adc', 'sup']

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  // Riot linking
  const [gameName, setGameName] = useState('')
  const [tagLine, setTagLine] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [linkSuccess, setLinkSuccess] = useState(false)
  const [showLinkForm, setShowLinkForm] = useState(false)

  // Role preference
  const [selectedRole, setSelectedRole] = useState<Role | ''>('')
  const [savingRole, setSavingRole] = useState(false)
  const [roleSaved, setRoleSaved] = useState(false)

  const token = (session?.user as any)?.djangoAccessToken
  const user = session?.user as any

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated' || !token) return
    getMe(token)
      .then((p) => {
        setPlayer(p)
        setSelectedRole(p.preferred_role || '')
        setShowLinkForm(!p.riot_game_name)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [status, token])

  const handleLinkRiot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLinking(true)
    setLinkError('')
    setLinkSuccess(false)
    try {
      const updated = await linkRiotAccount(gameName, tagLine, token)
      setPlayer(updated)
      setLinkSuccess(true)
      setShowLinkForm(false)
      setGameName('')
      setTagLine('')
    } catch (err: any) {
      setLinkError(err.message || 'Failed to link Riot account.')
    } finally {
      setLinking(false)
    }
  }

  const handleSaveRole = async () => {
    if (!selectedRole || !token) return
    setSavingRole(true)
    setRoleSaved(false)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/me/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferred_role: selectedRole }),
        },
      )
      if (!res.ok) throw new Error('Failed to save role')
      const updated = await res.json()
      setPlayer(updated)
      setRoleSaved(true)
      setTimeout(() => setRoleSaved(false), 3000)
    } catch (err: any) {
      console.error(err)
    } finally {
      setSavingRole(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-bold text-white">Your Profile</h1>

      {/* Discord identity */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Discord Account</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {user?.discordAvatar && user?.discordId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png`}
              alt="Discord avatar"
              className="h-16 w-16 rounded-full border-2 border-indigo-500/40"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/20 text-2xl">
              👤
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-white">
              {player?.discord_username || user?.discordUsername || user?.name}
            </p>
            <p className="text-sm text-gray-400">
              Discord ID: {player?.discord_id || user?.discordId}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="success">Connected</Badge>
              {player?.is_admin && <Badge variant="default">Admin</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferred role */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Preferred Role</CardTitle>
          <CardDescription>
            This is your main role. It&apos;s used as your default when creating a team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`rounded-lg border py-3 text-xs font-semibold transition-colors ${
                  selectedRole === role
                    ? 'border-indigo-500 bg-indigo-600/30 text-indigo-300'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/30 hover:text-white'
                }`}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
          <Button
            onClick={handleSaveRole}
            disabled={savingRole || !selectedRole || selectedRole === player?.preferred_role}
            size="sm"
            className="gap-2"
          >
            {roleSaved ? (
              <><CheckCircle className="h-4 w-4" /> Saved</>
            ) : (
              <><Save className="h-4 w-4" /> {savingRole ? 'Saving...' : 'Save Role'}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Riot account */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Riot Account</CardTitle>
          <CardDescription>
            Link your League of Legends account to enable auto-reporting and MMR tracking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {player?.riot_game_name && !showLinkForm ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div>
                  <p className="font-semibold text-white">
                    {player.riot_game_name}#{player.riot_tag_line}
                  </p>
                  <p className={`text-sm ${getRankColor(player.riot_rank)}`}>
                    {formatRank(player.riot_rank) || 'Rank syncing...'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowLinkForm(true)}>
                Change
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLinkRiot} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="gameName" className="mb-1 block text-xs text-gray-400">
                    Game Name
                  </label>
                  <input
                    id="gameName"
                    type="text"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder="Faker"
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="w-28">
                  <label htmlFor="tagLine" className="mb-1 block text-xs text-gray-400">
                    Tag
                  </label>
                  <input
                    id="tagLine"
                    type="text"
                    value={tagLine}
                    onChange={(e) => setTagLine(e.target.value)}
                    placeholder="NA1"
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              {linkError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {linkError}
                </div>
              )}
              {linkSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  Riot account linked! Rank syncing in the background.
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={linking} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  {linking ? 'Linking...' : 'Link Account'}
                </Button>
                {player?.riot_game_name && (
                  <Button type="button" variant="ghost" onClick={() => setShowLinkForm(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* MMR */}
      {player?.role_mmr && Object.keys(player.role_mmr).length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Role MMR</CardTitle>
            <CardDescription>TrueSkill ratings per role. Higher mu = stronger.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(player.role_mmr).map(([role, mmr]) => (
                <div key={role} className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                  <p className="mb-1 text-xs font-medium text-gray-400 uppercase">
                    {ROLE_LABELS[role as Role] || role}
                  </p>
                  <p className="text-lg font-bold text-white">{mmr.mu.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">σ {mmr.sigma.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* LP Tokens */}
      <Card>
        <CardHeader>
          <CardTitle>LP Tokens</CardTitle>
          <CardDescription>Earn LP from bounties and correct predictions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Swords className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-3xl font-bold text-yellow-400">{player?.lp_tokens ?? 0}</p>
              <p className="text-sm text-gray-400">LP Tokens</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
