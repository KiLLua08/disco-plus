import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDiscordAvatarUrl(discordId: string, avatar: string): string {
  if (!avatar) {
    const defaultIndex = parseInt(discordId) % 6
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
  }
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`
}

export function formatRole(role: string): string {
  const map: Record<string, string> = {
    top: 'Top',
    jgl: 'Jungle',
    mid: 'Mid',
    adc: 'ADC',
    sup: 'Support',
  }
  return map[role] || role.toUpperCase()
}

export function formatRank(rank: string): string {
  if (!rank) return 'Unranked'
  return rank
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function getRankColor(rank: string): string {
  const tier = rank?.split(' ')[0]?.toUpperCase()
  const colors: Record<string, string> = {
    IRON: 'text-gray-400',
    BRONZE: 'text-amber-700',
    SILVER: 'text-gray-300',
    GOLD: 'text-yellow-400',
    PLATINUM: 'text-teal-400',
    EMERALD: 'text-emerald-400',
    DIAMOND: 'text-blue-400',
    MASTER: 'text-purple-400',
    GRANDMASTER: 'text-red-400',
    CHALLENGER: 'text-yellow-300',
  }
  return colors[tier] || 'text-gray-400'
}

export function getMatchStatusColor(status: string): string {
  const colors: Record<string, string> = {
    scheduled: 'bg-blue-500/20 text-blue-300',
    pending_report: 'bg-yellow-500/20 text-yellow-300',
    processing: 'bg-orange-500/20 text-orange-300',
    completed: 'bg-green-500/20 text-green-300',
    disputed: 'bg-red-500/20 text-red-300',
  }
  return colors[status] || 'bg-gray-500/20 text-gray-300'
}
