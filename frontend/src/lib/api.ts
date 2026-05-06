const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function request<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `API error ${res.status}`)
  }
  return res.json()
}

// Players
export const getPlayers = (token?: string) => request<any[]>('/api/players/', token)
export const getLeaderboard = (token?: string) => request<any[]>('/api/players/leaderboard/', token)
export const getMe = (token?: string) => request<any>('/api/me/', token)
export const updateMe = (data: any, token?: string) =>
  request<any>('/api/me/', token, { method: 'PATCH', body: JSON.stringify(data) })

// Seasons
export const getSeasons = (token?: string) => request<any[]>('/api/seasons/', token)
export const getSeason = (id: number, token?: string) => request<any>(`/api/seasons/${id}/`, token)
export const getStandings = (seasonId: number, token?: string) =>
  request<any[]>(`/api/seasons/${seasonId}/standings/`, token)
export const getSeasonSchedule = (seasonId: number, token?: string) =>
  request<any[]>(`/api/seasons/${seasonId}/schedule/`, token)
export const createSeason = (data: any, token?: string) =>
  request<any>('/api/seasons/', token, { method: 'POST', body: JSON.stringify(data) })
export const openRegistration = (id: number, token?: string) =>
  request<any>(`/api/seasons/${id}/open-registration/`, token, { method: 'POST' })
export const startSeason = (id: number, data: any, token?: string) =>
  request<any>(`/api/seasons/${id}/start/`, token, { method: 'POST', body: JSON.stringify(data) })
export const nextRound = (id: number, data: any, token?: string) =>
  request<any>(`/api/seasons/${id}/next-round/`, token, { method: 'POST', body: JSON.stringify(data) })
export const registerTeamForSeason = (seasonId: number, token?: string) =>
  request<any>(`/api/seasons/${seasonId}/register-team/`, token, { method: 'POST' })

// Teams
export const getTeams = (token?: string) => request<any[]>('/api/teams/', token)
export const getBrowseTeams = (token?: string) => request<any[]>('/api/teams/browse/', token)
export const getTeam = (id: number, token?: string) => request<any>(`/api/teams/${id}/`, token)
export const getMyTeam = (token?: string) => request<any>('/api/teams/my-team/', token)
export const createTeam = (data: any, token?: string) =>
  request<any>('/api/teams/', token, { method: 'POST', body: JSON.stringify(data) })
export const requestJoinTeam = (teamId: number, data: any, token?: string) =>
  request<any>(`/api/teams/${teamId}/request-join/`, token, { method: 'POST', body: JSON.stringify(data) })
export const getJoinRequests = (teamId: number, token?: string) =>
  request<any[]>(`/api/teams/${teamId}/join-requests/`, token)
export const handleJoinRequest = (teamId: number, data: any, token?: string) =>
  request<any>(`/api/teams/${teamId}/handle-request/`, token, { method: 'POST', body: JSON.stringify(data) })
export const invitePlayer = (teamId: number, data: any, token?: string) =>
  request<any>(`/api/teams/${teamId}/invite/`, token, { method: 'POST', body: JSON.stringify(data) })
export const acceptInvite = (teamId: number, token?: string) =>
  request<any>(`/api/teams/${teamId}/accept-invite/`, token, { method: 'POST' })

// Matches
export const getMatches = (token?: string) => request<any[]>('/api/matches/', token)
export const getMyMatches = (token?: string) => request<any[]>('/api/matches/my-matches/', token)
export const reportMatch = (matchId: number, riotMatchId: string, token?: string) =>
  request<any>(`/api/matches/${matchId}/report/`, token, {
    method: 'POST',
    body: JSON.stringify({ riot_match_id: riotMatchId }),
  })

// Riot
export const linkRiotAccount = (gameName: string, tagLine: string, token?: string) =>
  request<any>('/api/riot/link/', token, {
    method: 'POST',
    body: JSON.stringify({ riot_game_name: gameName, riot_tag_line: tagLine }),
  })
