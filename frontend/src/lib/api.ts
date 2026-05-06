/**
 * API client for the Django backend.
 *
 * Usage: pass the djangoAccessToken from useSession() into each call.
 * Components get it via: const { data: session } = useSession()
 * Then: getMe(session?.user?.djangoAccessToken)
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function request<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { ...options, headers })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `API error ${res.status}`)
  }

  return res.json()
}

// ---- Players ----
export const getPlayers = (token?: string) =>
  request<any[]>('/api/players/', token)
export const getLeaderboard = (token?: string) =>
  request<any[]>('/api/players/leaderboard/', token)
export const getMe = (token?: string) =>
  request<any>('/api/me/', token)

// ---- Seasons ----
export const getSeasons = (token?: string) =>
  request<any[]>('/api/seasons/', token)
export const getSeason = (id: number, token?: string) =>
  request<any>(`/api/seasons/${id}/`, token)
export const getStandings = (seasonId: number, token?: string) =>
  request<any[]>(`/api/seasons/${seasonId}/standings/`, token)
export const createSeason = (data: any, token?: string) =>
  request<any>('/api/seasons/', token, { method: 'POST', body: JSON.stringify(data) })
export const startSeason = (id: number, token?: string) =>
  request<any>(`/api/seasons/${id}/start/`, token, { method: 'POST' })

// ---- Teams ----
export const getTeams = (token?: string) =>
  request<any[]>('/api/teams/', token)
export const getTeam = (id: number, token?: string) =>
  request<any>(`/api/teams/${id}/`, token)
export const createTeam = (data: any, token?: string) =>
  request<any>('/api/teams/', token, { method: 'POST', body: JSON.stringify(data) })
export const invitePlayer = (teamId: number, data: any, token?: string) =>
  request<any>(`/api/teams/${teamId}/invite/`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
export const acceptInvite = (teamId: number, token?: string) =>
  request<any>(`/api/teams/${teamId}/accept-invite/`, token, { method: 'POST' })

// ---- Matches ----
export const getMatches = (token?: string) =>
  request<any[]>('/api/matches/', token)
export const getMatch = (id: number, token?: string) =>
  request<any>(`/api/matches/${id}/`, token)
export const reportMatch = (matchId: number, riotMatchId: string, token?: string) =>
  request<any>(`/api/matches/${matchId}/report/`, token, {
    method: 'POST',
    body: JSON.stringify({ riot_match_id: riotMatchId }),
  })

// ---- Bounties ----
export const getBounties = (token?: string) =>
  request<any[]>('/api/bounties/', token)

// ---- Riot ----
export const linkRiotAccount = (gameName: string, tagLine: string, token?: string) =>
  request<any>('/api/riot/link/', token, {
    method: 'POST',
    body: JSON.stringify({ riot_game_name: gameName, riot_tag_line: tagLine }),
  })
