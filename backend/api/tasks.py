"""
Celery tasks for Discord Clash+.

- process_match_report: Pull Riot match data, update standings, MMR, bounties.
- generate_weekly_pairings: Auto-generate Swiss pairings every Monday.
- settle_predictions: Pay out LP tokens after a match completes.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone

from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_match_report(self, match_id: int):
    """
    Triggered when a captain reports a Riot match ID.
    1. Fetch full match data from Riot API.
    2. Determine winner.
    3. Update team wins/losses.
    4. Update player role MMR (TrueSkill).
    5. Resolve bounties.
    6. Settle predictions.
    7. Update Buchholz scores.
    """
    from .models import Match, Team, Player, TeamMember, Bounty
    from . import riot
    from .swiss import update_buchholz
    import trueskill

    try:
        match = Match.objects.select_related(
            'team_blue', 'team_red', 'season'
        ).get(id=match_id)
    except Match.DoesNotExist:
        logger.error(f'Match {match_id} not found')
        return

    if not match.riot_match_id:
        logger.error(f'Match {match_id} has no riot_match_id')
        return

    # 1. Fetch Riot data
    match_data = riot.get_match_data(match.riot_match_id)
    if not match_data:
        logger.warning(f'Could not fetch Riot data for {match.riot_match_id}, retrying...')
        raise self.retry()

    # 2. Cache raw data
    match.data = match_data
    match.status = 'processing'
    match.save(update_fields=['data', 'status'])

    # 3. Determine winner by checking which team's players are on the winning side
    winning_team_id = riot.determine_match_winner_puuids(match_data)
    if winning_team_id is None:
        logger.error(f'Could not determine winner for match {match_id}')
        match.status = 'disputed'
        match.save(update_fields=['status'])
        return

    # Map Riot team IDs (100/200) to our teams via PUUID lookup
    blue_members = TeamMember.objects.filter(team=match.team_blue).select_related('player')
    red_members = TeamMember.objects.filter(team=match.team_red).select_related('player')

    blue_puuids = {m.player.riot_puuid for m in blue_members if m.player.riot_puuid}
    red_puuids = {m.player.riot_puuid for m in red_members if m.player.riot_puuid}

    participants = match_data.get('info', {}).get('participants', [])
    riot_team_for_blue = None
    for p in participants:
        if p.get('puuid') in blue_puuids:
            riot_team_for_blue = p.get('teamId')
            break

    if riot_team_for_blue is None:
        # Fallback: use first participant
        riot_team_for_blue = participants[0].get('teamId') if participants else 100

    with transaction.atomic():
        if riot_team_for_blue == winning_team_id:
            winner = match.team_blue
            loser = match.team_red
        else:
            winner = match.team_red
            loser = match.team_blue

        # 4. Update team records
        winner.wins += 1
        loser.losses += 1
        winner.save(update_fields=['wins'])
        loser.save(update_fields=['losses'])

        match.winner = winner
        match.status = 'completed'
        match.completed_at = datetime.now(timezone.utc)
        match.save(update_fields=['winner', 'status', 'completed_at'])

        # 5. Update TrueSkill MMR per role
        _update_mmr(match_data, blue_members, red_members, winner == match.team_blue)

        # 6. Resolve bounties
        _resolve_bounties(match, match_data)

        # 7. Settle predictions
        settle_predictions.delay(match_id)

        # 8. Update Buchholz
        update_buchholz(match.season)

    logger.info(f'Match {match_id} processed. Winner: {winner.name}')


def _update_mmr(match_data: dict, blue_members, red_members, blue_won: bool):
    """Update TrueSkill MMR for all players in the match."""
    import trueskill

    env = trueskill.TrueSkill(draw_probability=0.0)

    def get_rating(player, role):
        mmr = player.get_role_mmr(role)
        return env.create_rating(mu=mmr['mu'], sigma=mmr['sigma'])

    participants = match_data.get('info', {}).get('participants', [])
    puuid_to_stats = {p['puuid']: p for p in participants}

    blue_ratings = []
    blue_players_roles = []
    for member in blue_members:
        p = member.player
        if not p.riot_puuid:
            continue
        stats = puuid_to_stats.get(p.riot_puuid, {})
        role = stats.get('teamPosition', member.role).lower() or member.role
        rating = get_rating(p, role)
        blue_ratings.append(rating)
        blue_players_roles.append((p, role))

    red_ratings = []
    red_players_roles = []
    for member in red_members:
        p = member.player
        if not p.riot_puuid:
            continue
        stats = puuid_to_stats.get(p.riot_puuid, {})
        role = stats.get('teamPosition', member.role).lower() or member.role
        rating = get_rating(p, role)
        red_ratings.append(rating)
        red_players_roles.append((p, role))

    if not blue_ratings or not red_ratings:
        return

    if blue_won:
        ranks = [0, 1]
    else:
        ranks = [1, 0]

    try:
        new_blue, new_red = env.rate([blue_ratings, red_ratings], ranks=ranks)
    except Exception as e:
        logger.error(f'TrueSkill rating failed: {e}')
        return

    for (player, role), new_rating in zip(blue_players_roles, new_blue):
        player.set_role_mmr(role, new_rating.mu, new_rating.sigma)
        player.save(update_fields=['role_mmr'])

    for (player, role), new_rating in zip(red_players_roles, new_red):
        player.set_role_mmr(role, new_rating.mu, new_rating.sigma)
        player.save(update_fields=['role_mmr'])


def _resolve_bounties(match, match_data: dict):
    """Check and complete any open bounties for players in this match."""
    from .models import Bounty
    from . import riot

    open_bounties = Bounty.objects.filter(
        match=match, completed=False
    ).select_related('player')

    for bounty in open_bounties:
        if not bounty.player.riot_puuid:
            continue
        if riot.verify_bounty(match_data, bounty.player.riot_puuid, bounty.bounty_type):
            bounty.completed = True
            bounty.completed_at = datetime.now(timezone.utc)
            bounty.save(update_fields=['completed', 'completed_at'])
            # Award LP tokens
            bounty.player.lp_tokens += bounty.lp_reward
            bounty.player.save(update_fields=['lp_tokens'])
            logger.info(f'Bounty completed: {bounty}')


@shared_task
def settle_predictions(match_id: int):
    """Pay out LP tokens for correct predictions after a match completes."""
    from .models import Match, Prediction

    try:
        match = Match.objects.get(id=match_id, status='completed')
    except Match.DoesNotExist:
        return

    if not match.winner:
        return

    predictions = Prediction.objects.filter(match=match, settled=False)

    for pred in predictions:
        if pred.predicted_winner == match.winner:
            # Simple 2x payout for correct prediction
            payout = pred.lp_wagered * 2
            pred.player.lp_tokens += payout
            pred.payout = payout
        else:
            pred.payout = -pred.lp_wagered

        pred.settled = True
        pred.player.save(update_fields=['lp_tokens'])
        pred.save(update_fields=['payout', 'settled'])


@shared_task
def generate_weekly_pairings():
    """
    Auto-generate Swiss pairings for the active season's next round.
    Runs every Monday via Celery Beat.
    """
    from .models import Season, Match, Team
    from .swiss import generate_pairings, update_buchholz

    active_seasons = Season.objects.filter(status='active')

    for season in active_seasons:
        if season.current_round >= season.total_rounds:
            season.status = 'completed'
            season.save(update_fields=['status'])
            logger.info(f'Season {season.name} completed.')
            continue

        # Get existing match pairs to avoid rematches
        existing_pairs = set()
        for match in Match.objects.filter(season=season):
            existing_pairs.add(frozenset([match.team_blue_id, match.team_red_id]))

        teams = list(season.teams.all())
        if len(teams) < 2:
            logger.warning(f'Season {season.name} has fewer than 2 teams, skipping pairing.')
            continue

        pairings = generate_pairings(teams, existing_pairs)
        next_round = season.current_round + 1

        for team_a, team_b in pairings:
            if team_b is None:
                # Bye — team_a gets a free win
                team_a.wins += 1
                team_a.save(update_fields=['wins'])
                logger.info(f'{team_a.name} gets a bye in round {next_round}')
                continue

            Match.objects.create(
                season=season,
                team_blue=team_a,
                team_red=team_b,
                round_number=next_round,
                status='scheduled',
            )

        season.current_round = next_round
        season.save(update_fields=['current_round'])
        update_buchholz(season)
        logger.info(f'Generated {len(pairings)} pairings for {season.name} round {next_round}')


@shared_task
def sync_riot_rank(player_id: int):
    """Fetch and update a player's current Riot rank."""
    from .models import Player
    from . import riot

    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return

    if not player.riot_puuid:
        return

    summoner = riot.get_summoner_by_puuid(player.riot_puuid)
    if not summoner:
        return

    player.riot_summoner_id = summoner.get('id', '')
    ranked = riot.get_ranked_stats(player.riot_summoner_id)

    if ranked:
        solo_queue = next(
            (r for r in ranked if r.get('queueType') == 'RANKED_SOLO_5x5'), None
        )
        if solo_queue:
            tier = solo_queue.get('tier', '')
            rank = solo_queue.get('rank', '')
            player.riot_rank = f'{tier} {rank}'.strip()

            # Seed MMR if not yet set
            if not player.role_mmr:
                mu = riot.seed_mmr_from_rank(player.riot_rank)
                for role in ['top', 'jgl', 'mid', 'adc', 'sup']:
                    player.set_role_mmr(role, mu, 8.333)

    player.save(update_fields=['riot_summoner_id', 'riot_rank', 'role_mmr'])
    logger.info(f'Synced rank for {player.discord_username}: {player.riot_rank}')
