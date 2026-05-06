'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSeasons } from '@/lib/api'
import { Season } from '@/types'
import { Trophy, ChevronRight, Calendar, Plus } from 'lucide-react'

const statusVariant: Record<string, any> = {
  upcoming: 'warning',
  active: 'success',
  completed: 'secondary',
}

export default function SeasonsPage() {
  const { data: session } = useSession()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const token = (session?.user as any)?.djangoAccessToken

  useEffect(() => {
    getSeasons(token)
      .then(setSeasons)
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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Seasons</h1>
        {session && (
          <Link href="/seasons/create">
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create Season</Button>
          </Link>
        )}
      </div>

      {seasons.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Trophy className="mx-auto mb-4 h-12 w-12 text-gray-600" />
            <p className="text-gray-400">No seasons yet. An admin will create the first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {seasons.map((season) => (
            <Card key={season.id} className="hover:border-indigo-500/40 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20">
                      <Trophy className="h-6 w-6 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">{season.name}</h2>
                        <Badge variant={statusVariant[season.status] || 'secondary'}>
                          {season.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-400">
                        <span>Split {season.split_number}</span>
                        <span>Round {season.current_round}/{season.total_rounds}</span>
                        <span>{season.teams?.length ?? 0} teams</span>
                        {season.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(season.start_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link href={`/seasons/${season.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1">
                      View <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
