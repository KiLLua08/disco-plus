"""
Riot API integration.

Uses the requests library directly (no Cassiopeia dependency for MVP).
All match data is cached in Match.data (JSON field).
"""
from __future__ import annotations
import logging
import time
from typing import Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

RIOT_API_BASE = 'https://americas.api.riotgames.com'
RIOT_PLATFORM_BASE = 'https://na1.api.riotgames.com'  # change for other regions

# TrueSkill mu range mapped from Riot ranks
RANK_TO_MU = {
    'IRON': 10.0,
    'BRONZE': 15.0,
    'SILVER': 20.0,
    'GOLD': 25.0,
    'PLATINUM': 28.0,
    'EMERALD': 30.0,
    'DIAMOND': 33.0,
    'MASTER': 36.0,
    'GRANDMASTER': 38.0,
    'CHALLENGER': 40.0,
}


def _headers() -> dict:
    return {'X-Riot-Token': settings.RIOT_API_KEY}


def _get(url: str, params: dict = None, retries: int = 3) -> Optional[dict]:
    """Rate-limit-safe GET with exponential backoff."""
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=_headers(), params=params, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                retry_after = int(resp.headers.get('Retry-After', 2 ** attempt))
                logger.warning(f'Riot API rate limited. Waiting {retry_after}s...')
                time.sleep(retry_after)
            elif resp.status_code == 404:
                logger.warning(f'Riot API 404: {url}')
                return None
            else:
                logger.error(f'Riot API error {resp.status_code}: {url}')
                return None
        except requests.RequestException as e:
            logger.error(f'Riot API request failed: {e}')
            time.sleep(2 ** attempt)
    return None


def get_account_by_riot_id(game_name: str, tag_line: str) -> Optional[dict]:
    """
    Fetch account info by Riot ID (gameName#tagLine).
    Returns: {puuid, gameName, tagLine}
    """
    url = f'{RIOT_API_BASE}/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}'
    return _get(url)


def get_summoner_by_puuid(puuid: str) -> Optional[dict]:
    """Fetch summoner data by PUUID."""
    url = f'{RIOT_PLATFORM_BASE}/lol/summoner/v4/summoners/by-puuid/{puuid}'
    return _get(url)


def get_ranked_stats(summoner_id: str) -> Optional[list]:
    """Fetch ranked stats for a summoner."""
    url = f'{RIOT_PLATFORM_BASE}/lol/league/v4/entries/by-summoner/{summoner_id}'
    return _get(url)


def get_match_data(match_id: str) -> Optional[dict]:
    """
    Fetch full match data by Riot match ID.
    Returns the complete match JSON from Riot API.
    """
    url = f'{RIOT_API_BASE}/lol/match/v5/matches/{match_id}'
    return _get(url)


def get_match_timeline(match_id: str) -> Optional[dict]:
    """Fetch match timeline (for bounty verification)."""
    url = f'{RIOT_API_BASE}/lol/match/v5/matches/{match_id}/timeline'
    return _get(url)


def seed_mmr_from_rank(rank_str: str) -> float:
    """Convert a Riot rank string to a TrueSkill mu seed value."""
    if not rank_str:
        return 25.0
    tier = rank_str.split()[0].upper()
    return RANK_TO_MU.get(tier, 25.0)


def extract_player_stats(match_data: dict, puuid: str) -> Optional[dict]:
    """
    Extract a single player's stats from a match data blob.
    Returns a dict with kills, deaths, assists, champion, role, win, etc.
    """
    if not match_data:
        return None

    participants = match_data.get('info', {}).get('participants', [])
    for p in participants:
        if p.get('puuid') == puuid:
            return {
                'kills': p.get('kills', 0),
                'deaths': p.get('deaths', 0),
                'assists': p.get('assists', 0),
                'champion': p.get('championName', ''),
                'role': p.get('teamPosition', '').lower(),
                'win': p.get('win', False),
                'cs': p.get('totalMinionsKilled', 0) + p.get('neutralMinionsKilled', 0),
                'vision_score': p.get('visionScore', 0),
                'damage_dealt': p.get('totalDamageDealtToChampions', 0),
                'pentakills': p.get('pentaKills', 0),
                'first_blood': p.get('firstBloodKill', False),
            }
    return None


def verify_bounty(match_data: dict, puuid: str, bounty_type: str) -> bool:
    """
    Check if a bounty condition was met in a match.
    """
    stats = extract_player_stats(match_data, puuid)
    if not stats:
        return False

    if bounty_type == 'pentakill':
        return stats['pentakills'] > 0
    elif bounty_type == 'first_blood':
        return stats['first_blood']
    elif bounty_type == 'perfect_game':
        return stats['win'] and stats['deaths'] == 0
    # baron_steal and ace require timeline data — simplified here
    return False


def determine_match_winner_puuids(match_data: dict) -> Optional[int]:
    """
    Return the winning team ID (100 or 200) from match data.
    """
    teams = match_data.get('info', {}).get('teams', [])
    for team in teams:
        if team.get('win'):
            return team.get('teamId')
    return None
