"""
Swiss pairing algorithm with Buchholz tiebreakers.

Rules:
- Teams are sorted by points (wins * 2), then Buchholz score.
- Closest-record teams are paired together.
- No rematches within the same season if avoidable.
- Returns a list of (team_a, team_b) tuples.
"""
from __future__ import annotations
from typing import List, Tuple, Optional
import random


def generate_pairings(
    teams: list,
    existing_match_pairs: set[frozenset],
) -> List[Tuple]:
    """
    Generate Swiss pairings for a round.

    Args:
        teams: QuerySet or list of Team model instances.
        existing_match_pairs: Set of frozensets of team IDs that have already
                              played each other this season.

    Returns:
        List of (team_a, team_b) tuples.
    """
    # Sort by points desc, then buchholz desc, then shuffle within same score
    sorted_teams = sorted(
        teams,
        key=lambda t: (-t.points, -t.buchholz, random.random()),
    )

    paired: List[Tuple] = []
    unpaired = list(sorted_teams)

    while len(unpaired) >= 2:
        team_a = unpaired.pop(0)
        opponent = _find_opponent(team_a, unpaired, existing_match_pairs)

        if opponent is None:
            # Fallback: ignore rematch constraint
            opponent = unpaired[0]

        unpaired.remove(opponent)
        paired.append((team_a, opponent))

    # If odd number of teams, the last team gets a bye (recorded as None)
    if unpaired:
        paired.append((unpaired[0], None))

    return paired


def _find_opponent(
    team,
    candidates: list,
    existing_pairs: set[frozenset],
) -> Optional[object]:
    """
    Find the best opponent for team_a from candidates.
    Prefers closest points, avoids rematches.
    """
    for candidate in candidates:
        pair_key = frozenset([team.id, candidate.id])
        if pair_key not in existing_pairs:
            return candidate

    # All candidates are rematches — return None to signal fallback
    return None


def update_buchholz(season) -> None:
    """
    Recalculate Buchholz scores for all teams in a season.
    Buchholz = sum of all opponents' current win points.
    """
    from .models import Match

    teams = list(season.teams.all())
    team_map = {t.id: t for t in teams}

    # Build opponent map
    opponent_points: dict[int, float] = {t.id: 0.0 for t in teams}

    matches = Match.objects.filter(
        season=season,
        status='completed',
    ).select_related('team_blue', 'team_red')

    for match in matches:
        blue_id = match.team_blue_id
        red_id = match.team_red_id
        if blue_id in team_map and red_id in team_map:
            opponent_points[blue_id] += team_map[red_id].points
            opponent_points[red_id] += team_map[blue_id].points

    for team in teams:
        team.buchholz = opponent_points[team.id]

    # Bulk update
    from django.db import models as django_models
    season.teams.model.objects.bulk_update(teams, ['buchholz'])
