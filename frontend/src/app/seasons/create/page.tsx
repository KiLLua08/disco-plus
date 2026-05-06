'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createSeason } from '@/lib/api'
import { AlertCircle, Trophy } from 'lucide-react'

export default function CreateSeasonPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [splitNumber, setSplitNumber] = useState(1)
  const [totalRounds, setTotalRounds] = useState(4)
  const [startDate, setStartDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const token = (session?.user as any)?.djangoAccessToken

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const season = await createSeason(
        {
          name,
          split_number: splitNumber,
          total_rounds: totalRounds,
          start_date: startDate || null,
        },
        token,
      )
      router.push(`/seasons/${season.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create season.')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    router.push('/login')
    return null
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Trophy className="h-8 w-8 text-yellow-400" />
        <h1 className="text-3xl font-bold text-white">Create Season</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Season Details</CardTitle>
          <CardDescription>
            After creating, you can add teams and start the season when ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm text-gray-300">
                Season Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Split 1 — Spring 2026"
                required
                maxLength={100}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="split" className="mb-1 block text-sm text-gray-300">
                  Split #
                </label>
                <input
                  id="split"
                  type="number"
                  min={1}
                  max={99}
                  value={splitNumber}
                  onChange={(e) => setSplitNumber(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="rounds" className="mb-1 block text-sm text-gray-300">
                  Total Rounds
                </label>
                <input
                  id="rounds"
                  type="number"
                  min={1}
                  max={10}
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="startDate" className="mb-1 block text-sm text-gray-300">
                Start Date <span className="text-gray-500">(optional)</span>
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none [color-scheme:dark]"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : 'Create Season'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
