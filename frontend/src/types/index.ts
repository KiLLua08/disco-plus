export interface Player {
  id: number
  username: string
  discord_id?: string
  discord_username: string
  discord_avatar: string
  riot_game_name: string
  riot_tag_line: string
  riot_rank: string
  lp_tokens: number
  preferred_role: string
  role_mmr?: Record<string, { mu: number; sigma: number }>
  is_admin?: boolean
  created_at?: string
}

export interface Team {
  id: number
  name: string
  tag: string
  captain: Player
  season: number | null
  wins: number
  losses: number
  buchholz: number
  points: number
  members: TeamMember[]
  created_at: string
}

export interface TeamMember {
  id: number
  player: Player
  role: string
  joined_at: string
}

export interface Season {
  id: number
  name: string
  split_number: number
  status: 'upcoming' | 'active' | 'completed'
  total_rounds: number
  current_round: number
  start_date: string | null
  end_date: string | null
  created_by: Player
  teams: Team[]
  created_at: string
}

export interface Match {
  id: number
  season: number
  team_blue: Team
  team_red: Team
  winner: Team | null
  round_number: number
  status: 'scheduled' | 'pending_report' | 'processing' | 'completed' | 'disputed'
  riot_match_id: string
  scheduled_at: string | null
  reported_at: string | null
  completed_at: string | null
  discord_thread_id: string
  created_at: string
}

export interface Bounty {
  id: number
  match: number | null
  player: Player
  bounty_type: string
  description: string
  lp_reward: number
  completed: boolean
  completed_at: string | null
  season: number | null
  created_at: string
}

export type Role = 'top' | 'jgl' | 'mid' | 'adc' | 'sup'

export const ROLE_LABELS: Record<Role, string> = {
  top: 'Top',
  jgl: 'Jungle',
  mid: 'Mid',
  adc: 'ADC',
  sup: 'Support',
}

export const ROLE_COLORS: Record<Role, string> = {
  top: 'bg-red-500',
  jgl: 'bg-green-500',
  mid: 'bg-blue-500',
  adc: 'bg-yellow-500',
  sup: 'bg-purple-500',
}
