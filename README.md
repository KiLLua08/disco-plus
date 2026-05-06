# Discord Clash+ — Agent Context & Build Guide

## What This Project Is
A free-to-run, self-hosted League of Legends tournament platform for Discord communities. It turns casual 5v5s into persistent, hype-driven seasons with real progression, bounties, live draft nights, and role-based MMR. Think LCS vibes — no spreadsheets, no Faceit, no cost.

**One-liner:** Discord-native LoL tournament platform with Swiss seasons, TrueSkill MMR, Riot API auto-reporting, and a live draft UI.

---

## Target User
- Private Discord server with 100+ LoL players
- Competitive range: Silver to Diamond
- Play 2–4x per week
- Want competitive structure without being pro
- Later: other LoL Discord servers (50–2000 members)

---

## Tech Stack

| Layer | Tech | Free Tier | Notes |
|---|---|---|---|
| Frontend | Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui | Vercel Hobby | SSR, OG images |
| Auth | Discord OAuth via next-auth | Free | Users already on Discord |
| Backend | Django 5 + DRF + Celery + Channels | Render free | Riot API, Swiss logic, websockets |
| Database | Postgres 15 | Supabase 500MB | Relational + JSON for Riot cache |
| Cache/Queue | Redis | Upstash 10k cmds/day | Celery broker + live draft |
| Bot | discord.py 2.3 as Django mgmt command | Render worker | No extra host needed |
| LoL Data | Riot API + Cassiopeia | Dev key | Match, summoner, champion data |
| Media | @vercel/og | Free | Player card image generation |

---

## Project Structure

```
discord-clash/
├── frontend/               ← Next.js 14 (TypeScript, Tailwind, shadcn/ui)
│   ├── src/
│   │   └── app/            ← App Router pages
│   └── .env.local
├── backend/                ← Django 5
│   ├── core/               ← settings.py, urls.py, wsgi.py, asgi.py
│   ├── api/                ← models, views, serializers, tasks
│   ├── bot/                ← discord.py bot as Django mgmt command
│   ├── venv/
│   └── .env
└── README.md
```

---

## Environment Variables

### `backend/.env`
```env
DEBUG=True
SECRET_KEY=...

DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres

REDIS_URL=redis://localhost:6379/0

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...

RIOT_API_KEY=...
```

### `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

---

## Django Models (planned)

```
Season
  └── Tournament
        └── Team
              └── TeamMember → Player

Match → Bounty
Match → Prediction

Player:
  discord_id, riot_puuid, role_mmr (JSON), lp_tokens

Match:
  riot_match_id, data (JSON cache), round_number, status

Bounty:
  description, player, completed, lp_reward
```

---

## Key Features to Build (MVP → V1)

### MVP
- [ ] Discord OAuth login (next-auth frontend + Django session backend)
- [ ] Player registration: link Discord ID + Riot PUUID
- [ ] Team creation + roster management (5 players, one per role)
- [ ] Season creation (admin)
- [ ] Swiss pairing generation (Buchholz tiebreakers)
- [ ] Manual match reporting (captain pastes Riot Match ID)
- [ ] Auto Riot API match pull via Celery task
- [ ] Basic standings page

### V1
- [ ] Role-based TrueSkill MMR (TOP/JGL/MID/ADC/SUP tracked separately)
- [ ] Bounties & quests (auto-verified via Riot API)
- [ ] LP token economy (earn, spend, leaderboard)
- [ ] Discord bot commands: `/register`, `/register_team`, `/invite`, `/match`, `/standings`
- [ ] Bot creates threads, pings players, posts op.gg links
- [ ] Match predictions (bet LP tokens, odds from MMR)

### V2
- [ ] Live draft night (Django Channels WebSockets + Next.js)
- [ ] Auto-generated player cards (@vercel/og)
- [ ] Clip/VOD hub (YouTube links + Discord reaction voting)
- [ ] Play of the Week

---

## Discord Bot Commands (discord.py)

| Command | Who | What it does |
|---|---|---|
| `/register` | Player | Links Discord + prompts Riot ID |
| `/register_team <name> <tag>` | Captain | Creates a team |
| `/invite @player` | Captain | Sends invite, player confirms |
| `/match @team1 @team2` | Admin | Schedules a match |
| `/report <match_id>` | Captain | Pastes Riot Match ID, triggers Celery task |
| `/standings` | Anyone | Posts current season standings |
| `/draft` | Captain | Starts snake draft with Discord buttons |

Bot runs as a Django management command (`python manage.py run_bot`) on the Render worker dyno.

---

## Riot API Strategy

- Use **Cassiopeia** Python library for rate-limit-safe requests
- Dev key: 100 req/2min — sufficient for MVP
- Cache all match data as JSON in `Match.data` field (Postgres)
- Celery task triggered on match report — pulls full match, updates KDA, win/loss, MMR, resolves bounties
- PUUID is the stable player identifier (survives name changes)

---

## Swiss Pairing Logic

- 4-week seasons, weekly rounds
- Players/teams paired by current points (closest records play each other)
- Buchholz tiebreaker: sum of opponents' scores
- No rematches within the same season if avoidable
- Auto-generated each Monday via Celery beat

---

## MMR System

- TrueSkill (Python `trueskill` library)
- Separate mu/sigma per role per player stored in `Player.role_mmr` JSON field
- Example: `{"mid": {"mu": 32.1, "sigma": 2.4}, "top": {"mu": 25.0, "sigma": 4.1}}`
- Only the role played in a given match updates
- Starting MMR seeded from Riot rank (Iron → Challenger mapped to TrueSkill mu range)

---

## Current Build Progress

| Step | Status |
|---|---|
| Project scaffold (Next.js + Django) | ✅ Done |
| Supabase Postgres connected + migrated | ⬜ Pending |
| Redis / Upstash setup | ⬜ Pending |
| Discord OAuth app created | ⬜ Pending |
| Discord OAuth login (frontend + backend) | ⬜ Pending |
| Django models | ⬜ Pending |
| Discord bot scaffold | ⬜ Pending |
| Riot API integration | ⬜ Pending |
| Swiss pairing algorithm | ⬜ Pending |
| Frontend dashboard | ⬜ Pending |
| WebSocket draft night | ⬜ Pending |
| Deployment (Vercel + Render) | ⬜ Pending |

---

## Dev Workflow

- **AI tools in use:** Cursor (scaffolding), Claude (Django logic + architecture), Codeium (autocomplete)
- **Developer background:** Full-stack, comfortable with Next.js, Django, Postgres, Docker. New to discord.py and Riot API rate limits.
- **Goal:** Run first 16-team tournament within 2 weekends of MVP launch
- **Success metric:** 80% of registered players play 2+ matches in Split 1

---

## How to Run Locally

```powershell
# Backend
cd backend
venv\Scripts\activate
python manage.py runserver        # Django on :8000

# In a second terminal
cd backend
venv\Scripts\activate
celery -A core worker -l info     # Celery worker

# Bot (later)
python manage.py run_bot

# Frontend
cd frontend
npm run dev                       # Next.js on :3000
```

---

## Next Step for Agent

**We are currently on: Step 3 — Create Discord Application + wire OAuth login**

The next task is:
1. Create a Discord application at discord.com/developers
2. Add OAuth2 redirect URI: `http://localhost:3000/api/auth/callback/discord`
3. Install `next-auth` on the frontend with Discord provider
4. Create Django endpoint to receive and store the Discord user after login
5. Test: user clicks "Login with Discord" → session created → Discord ID stored in DB

Follow the step-by-step, get confirmation after each step before proceeding.