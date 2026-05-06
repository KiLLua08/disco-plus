import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Swords, Trophy, Zap, Users, BarChart3, Bot } from 'lucide-react'

const features = [
  {
    icon: Trophy,
    title: 'Swiss Seasons',
    description: '4-week splits with Buchholz tiebreakers. No spreadsheets, no Faceit.',
  },
  {
    icon: BarChart3,
    title: 'TrueSkill MMR',
    description: 'Role-based MMR tracked separately per position. Seeded from your Riot rank.',
  },
  {
    icon: Zap,
    title: 'Auto Riot Reporting',
    description: 'Paste a match ID and Celery pulls full stats, updates standings, resolves bounties.',
  },
  {
    icon: Users,
    title: 'Team Rosters',
    description: 'One player per role. Captains invite via Discord or the web dashboard.',
  },
  {
    icon: Bot,
    title: 'Discord Bot',
    description: '/register, /standings, /report — all from your server. No external tools.',
  },
  {
    icon: Swords,
    title: 'LP Economy',
    description: 'Earn LP tokens from bounties and predictions. Flex on the leaderboard.',
  },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
        {/* Background glow */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-600 to-purple-600 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300">
            <Swords className="h-4 w-4" />
            Free · Self-hosted · Discord-native
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            LCS vibes for your{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Discord server
            </span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-400">
            Swiss seasons, TrueSkill MMR, Riot API auto-reporting, and a live draft UI.
            Turn casual 5v5s into a real competitive season — no spreadsheets, no Faceit, no cost.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/login">
              <Button variant="discord" size="lg" className="gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                Login with Discord
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-indigo-500/40 transition-colors"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20">
                    <Icon className="h-5 w-5 text-indigo-400" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-white mb-4">100% free to run</h2>
          <p className="text-gray-400 mb-8">
            Vercel Hobby + Render free tier + Supabase 500MB + Upstash Redis. Zero monthly cost.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Next.js 14', 'Django 5', 'PostgreSQL', 'Redis', 'Celery', 'discord.py', 'TrueSkill', 'Riot API'].map(
              (tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-gray-300"
                >
                  {tech}
                </span>
              ),
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
