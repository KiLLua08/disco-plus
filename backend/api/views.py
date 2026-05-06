from __future__ import annotations
import logging
from datetime import datetime, timezone, date, time

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Player, Season, Team, TeamMember, Match, Bounty,
    Prediction, TeamInvite, JoinRequest,
)
from .serializers import (
    PlayerSerializer, SeasonSerializer, TeamSerializer, TeamMemberSerializer,
    MatchSerializer, BountySerializer, PredictionSerializer, TeamInviteSerializer,
    MatchReportSerializer, DiscordAuthSerializer, RiotLinkSerializer,
    PlayerPublicSerializer, JoinRequestSerializer, GeneratePairingsSerializer,
)

logger = logging.getLogger(__name__)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


# ---------------------------------------------------------------------------
# Discord OAuth
# ---------------------------------------------------------------------------

class DiscordAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = DiscordAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        discord_id = data['discord_id']

        with transaction.atomic():
            user, _ = User.objects.get_or_create(
                username=f'discord_{discord_id}',
                defaults={'email': data.get('email') or f'{discord_id}@discord.local'},
            )
            player, created = Player.objects.get_or_create(
                discord_id=discord_id, defaults={'user': user},
            )
            player.discord_username = data['discord_username']
            player.discord_avatar = data.get('discord_avatar', '')
            player.save(update_fields=['discord_username', 'discord_avatar'])

        tokens = get_tokens_for_user(user)
        return Response({
            'player': PlayerSerializer(player).data,
            'created': created,
            'access': tokens['access'],
            'refresh': tokens['refresh'],
        })


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------

class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            player = request.user.player
        except Player.DoesNotExist:
            return Response({'detail': 'Player profile not found.'}, status=404)
        return Response(PlayerSerializer(player).data)

    def patch(self, request):
        try:
            player = request.user.player
        except Player.DoesNotExist:
            return Response({'detail': 'Player profile not found.'}, status=404)
        allowed = {'preferred_role', 'discord_username'}
        data = {k: v for k, v in request.data.items() if k in allowed}
        serializer = PlayerSerializer(player, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save()
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Riot linking
# ---------------------------------------------------------------------------

class RiotLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RiotLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        from . import riot
        from .tasks import sync_riot_rank

        game_name = serializer.validated_data['riot_game_name']
        tag_line = serializer.validated_data['riot_tag_line']

        account = riot.get_account_by_riot_id(game_name, tag_line)
        if not account:
            return Response(
                {'detail': f'Riot account {game_name}#{tag_line} not found.'},
                status=404,
            )

        player = request.user.player
        player.riot_puuid = account['puuid']
        player.riot_game_name = account['gameName']
        player.riot_tag_line = account['tagLine']
        player.save(update_fields=['riot_puuid', 'riot_game_name', 'riot_tag_line'])
        sync_riot_rank.delay(player.id)
        return Response(PlayerSerializer(player).data)


# ---------------------------------------------------------------------------
# Player ViewSet
# ---------------------------------------------------------------------------

class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Player.objects.select_related('user').order_by('-lp_tokens')
    serializer_class = PlayerPublicSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        players = Player.objects.order_by('-lp_tokens')[:50]
        return Response(PlayerPublicSerializer(players, many=True).data)


# ---------------------------------------------------------------------------
# Season ViewSet
# ---------------------------------------------------------------------------

class SeasonViewSet(viewsets.ModelViewSet):
    queryset = Season.objects.prefetch_related('teams').order_by('-created_at')
    serializer_class = SeasonSerializer

    def get_permissions(self):
        if self.action in ['destroy']:
            return [permissions.IsAuthenticated(), IsAdminPlayer()]
        if self.action in ['create', 'update', 'partial_update',
                           'start_season', 'open_registration', 'generate_pairings']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def perform_create(self, serializer):
        serializer.save(created_by=request.user.player if hasattr(self.request.user, 'player') else None)

    def perform_create(self, serializer):
        try:
            player = self.request.user.player
        except Exception:
            player = None
        serializer.save(created_by=player)

    @action(detail=True, methods=['post'], url_path='open-registration')
    def open_registration(self, request, pk=None):
        """Admin opens registration so teams can join."""
        season = self.get_object()
        if season.status != 'upcoming':
            return Response({'detail': 'Season must be in upcoming state.'}, status=400)
        season.status = 'registration'
        season.save(update_fields=['status'])
        return Response(SeasonSerializer(season).data)

    @action(detail=True, methods=['post'], url_path='start')
    def start_season(self, request, pk=None):
        """Admin starts the season and generates round 1 pairings."""
        season = self.get_object()
        if season.status != 'registration':
            return Response({'detail': 'Season must be in registration state.'}, status=400)
        if not season.can_start:
            return Response(
                {'detail': f'Need at least {season.min_teams} teams. Currently {season.registered_teams_count}.'},
                status=400,
            )

        serializer = GeneratePairingsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        scheduled_date = serializer.validated_data['scheduled_date']
        scheduled_time = serializer.validated_data['scheduled_time']
        scheduled_dt = datetime.combine(scheduled_date, scheduled_time).replace(tzinfo=timezone.utc)

        with transaction.atomic():
            season.status = 'active'
            season.current_round = 1
            season.save(update_fields=['status', 'current_round'])
            _generate_round_pairings(season, 1, scheduled_dt)

        return Response(SeasonSerializer(season).data)

    @action(detail=True, methods=['post'], url_path='next-round')
    def next_round(self, request, pk=None):
        """Admin generates pairings for the next round."""
        season = self.get_object()
        if season.status != 'active':
            return Response({'detail': 'Season is not active.'}, status=400)
        if season.current_round >= season.total_rounds:
            return Response({'detail': 'All rounds completed.'}, status=400)

        serializer = GeneratePairingsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        scheduled_date = serializer.validated_data['scheduled_date']
        scheduled_time = serializer.validated_data['scheduled_time']
        scheduled_dt = datetime.combine(scheduled_date, scheduled_time).replace(tzinfo=timezone.utc)

        with transaction.atomic():
            next_round = season.current_round + 1
            season.current_round = next_round
            season.save(update_fields=['current_round'])
            _generate_round_pairings(season, next_round, scheduled_dt)

        return Response(SeasonSerializer(season).data)

    @action(detail=True, methods=['post'], url_path='register-team')
    def register_team(self, request, pk=None):
        """Captain registers their team into this season."""
        season = self.get_object()
        if season.status != 'registration':
            return Response({'detail': 'Season is not open for registration.'}, status=400)

        try:
            player = request.user.player
        except Exception:
            return Response({'detail': 'Player not found.'}, status=404)

        # Find the team this player captains
        try:
            team = Team.objects.get(captain=player, season__isnull=True)
        except Team.DoesNotExist:
            return Response(
                {'detail': 'No eligible team found. Your team must not already be registered in a season.'},
                status=404,
            )
        except Team.MultipleObjectsReturned:
            # Take the most recent one
            team = Team.objects.filter(captain=player, season__isnull=True).order_by('-created_at').first()

        if not team.is_roster_complete:
            open_roles = ', '.join(team.open_main_roles)
            return Response(
                {'detail': f'Roster incomplete. Missing main roles: {open_roles}'},
                status=400,
            )

        team.season = season
        team.save(update_fields=['season'])
        return Response(TeamSerializer(team).data)

    @action(detail=True, methods=['get'], url_path='standings')
    def standings(self, request, pk=None):
        season = self.get_object()
        teams = season.teams.order_by('-wins', '-buchholz')
        return Response(TeamSerializer(teams, many=True).data)

    @action(detail=True, methods=['get'], url_path='schedule')
    def schedule(self, request, pk=None):
        """All matches for this season grouped by round."""
        season = self.get_object()
        matches = Match.objects.filter(season=season).select_related(
            'team_blue', 'team_red', 'winner'
        ).order_by('round_number', 'scheduled_at')
        return Response(MatchSerializer(matches, many=True).data)


def _generate_round_pairings(season, round_number, scheduled_dt):
    """Generate Swiss pairings for a round and create Match objects."""
    from .swiss import generate_pairings, update_buchholz

    teams = list(season.teams.all())
    existing_pairs = set()
    for match in Match.objects.filter(season=season):
        existing_pairs.add(frozenset([match.team_blue_id, match.team_red_id]))

    pairings = generate_pairings(teams, existing_pairs)

    for team_a, team_b in pairings:
        if team_b is None:
            team_a.wins += 1
            team_a.save(update_fields=['wins'])
            continue
        Match.objects.create(
            season=season,
            team_blue=team_a,
            team_red=team_b,
            round_number=round_number,
            status='scheduled',
            scheduled_at=scheduled_dt,
        )

    update_buchholz(season)


# ---------------------------------------------------------------------------
# Team ViewSet
# ---------------------------------------------------------------------------

class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.prefetch_related('members__player').select_related('captain')
    serializer_class = TeamSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsTeamCaptain()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def perform_create(self, serializer):
        player = self.request.user.player
        captain_role = self.request.data.get('captain_role', '').strip()
        valid_roles = {'top', 'jgl', 'mid', 'adc', 'sup'}
        if captain_role not in valid_roles:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {'captain_role': f'Required. Must be one of: {", ".join(sorted(valid_roles))}'}
            )
        team = serializer.save(captain=player)
        TeamMember.objects.create(team=team, player=player, role=captain_role, is_sub=False)
        if not player.preferred_role:
            player.preferred_role = captain_role
            player.save(update_fields=['preferred_role'])

    @action(detail=False, methods=['get'], url_path='browse')
    def browse(self, request):
        """GET /api/teams/browse/ — teams with open spots, not yet in a season."""
        teams = Team.objects.prefetch_related('members__player').select_related('captain').filter(
            season__isnull=True
        )
        return Response(TeamSerializer(teams, many=True).data)

    @action(detail=True, methods=['post'], url_path='request-join')
    def request_join(self, request, pk=None):
        """Player requests to join a team."""
        team = self.get_object()
        player = request.user.player

        # Can't join your own team
        if team.captain == player:
            return Response({'detail': 'You are the captain of this team.'}, status=400)

        # Already a member?
        if TeamMember.objects.filter(team=team, player=player).exists():
            return Response({'detail': 'You are already a member of this team.'}, status=400)

        role = request.data.get('role', player.preferred_role)
        is_sub = request.data.get('is_sub', False)
        message = request.data.get('message', '')

        if not role:
            return Response({'detail': 'role is required.'}, status=400)

        # Check if role is already filled (for main players)
        if not is_sub:
            if TeamMember.objects.filter(team=team, role=role, is_sub=False).exists():
                return Response(
                    {'detail': f'The {role} spot is already filled. You can request as a sub instead.'},
                    status=400,
                )

        # Check sub limit
        if is_sub and team.sub_members.count() >= 2:
            return Response({'detail': 'This team already has 2 subs.'}, status=400)

        join_req, created = JoinRequest.objects.get_or_create(
            team=team,
            player=player,
            defaults={'role': role, 'is_sub': is_sub, 'message': message},
        )

        if not created:
            if join_req.status == 'pending':
                return Response({'detail': 'You already have a pending request for this team.'}, status=400)
            # Allow re-requesting if previously declined
            join_req.role = role
            join_req.is_sub = is_sub
            join_req.message = message
            join_req.status = 'pending'
            join_req.responded_at = None
            join_req.save()

        return Response(JoinRequestSerializer(join_req).data, status=201)

    @action(detail=True, methods=['get'], url_path='join-requests')
    def join_requests(self, request, pk=None):
        """Captain views pending join requests."""
        team = self.get_object()
        if team.captain != request.user.player:
            return Response({'detail': 'Only the captain can view join requests.'}, status=403)
        requests = JoinRequest.objects.filter(team=team, status='pending').select_related('player__user')
        return Response(JoinRequestSerializer(requests, many=True).data)

    @action(detail=True, methods=['post'], url_path='handle-request')
    def handle_request(self, request, pk=None):
        """Captain accepts or declines a join request."""
        team = self.get_object()
        if team.captain != request.user.player:
            return Response({'detail': 'Only the captain can handle requests.'}, status=403)

        request_id = request.data.get('request_id')
        action_type = request.data.get('action')  # 'accept' or 'decline'

        if action_type not in ('accept', 'decline'):
            return Response({'detail': 'action must be "accept" or "decline".'}, status=400)

        try:
            join_req = JoinRequest.objects.get(id=request_id, team=team, status='pending')
        except JoinRequest.DoesNotExist:
            return Response({'detail': 'Join request not found.'}, status=404)

        with transaction.atomic():
            join_req.status = 'accepted' if action_type == 'accept' else 'declined'
            join_req.responded_at = datetime.now(timezone.utc)
            join_req.save(update_fields=['status', 'responded_at'])

            if action_type == 'accept':
                # Final validation before adding
                if not join_req.is_sub:
                    if TeamMember.objects.filter(team=team, role=join_req.role, is_sub=False).exists():
                        return Response(
                            {'detail': f'The {join_req.role} spot was filled by someone else.'},
                            status=400,
                        )
                else:
                    if team.sub_members.count() >= 2:
                        return Response({'detail': 'Sub spots are now full.'}, status=400)

                TeamMember.objects.create(
                    team=team,
                    player=join_req.player,
                    role=join_req.role,
                    is_sub=join_req.is_sub,
                )

        return Response(TeamSerializer(team).data)

    @action(detail=True, methods=['post'], url_path='invite')
    def invite_player(self, request, pk=None):
        """Captain directly invites a player."""
        team = self.get_object()
        player_id = request.data.get('player_id')
        role = request.data.get('role')
        is_sub = request.data.get('is_sub', False)

        if not player_id or not role:
            return Response({'detail': 'player_id and role are required.'}, status=400)

        try:
            invitee = Player.objects.get(id=player_id)
        except Player.DoesNotExist:
            return Response({'detail': 'Player not found.'}, status=404)

        invite, created = TeamInvite.objects.get_or_create(
            team=team, player=invitee, status='pending',
            defaults={'role': role, 'is_sub': is_sub, 'invited_by': request.user.player},
        )
        if not created:
            return Response({'detail': 'Invite already pending.'}, status=400)

        return Response(TeamInviteSerializer(invite).data, status=201)

    @action(detail=True, methods=['post'], url_path='accept-invite')
    def accept_invite(self, request, pk=None):
        team = self.get_object()
        player = request.user.player
        try:
            invite = TeamInvite.objects.get(team=team, player=player, status='pending')
        except TeamInvite.DoesNotExist:
            return Response({'detail': 'No pending invite found.'}, status=404)

        with transaction.atomic():
            TeamMember.objects.create(
                team=team, player=player, role=invite.role, is_sub=invite.is_sub
            )
            invite.status = 'accepted'
            invite.responded_at = datetime.now(timezone.utc)
            invite.save(update_fields=['status', 'responded_at'])

        return Response(TeamSerializer(team).data)

    @action(detail=False, methods=['get'], url_path='my-team')
    def my_team(self, request):
        """GET /api/teams/my-team/ — the team the current user captains or is a member of."""
        player = request.user.player
        # Check if captain first
        team = Team.objects.filter(captain=player).order_by('-created_at').first()
        if not team:
            membership = TeamMember.objects.filter(player=player).select_related('team').order_by('-joined_at').first()
            if membership:
                team = membership.team
        if not team:
            return Response({'detail': 'You are not part of any team.'}, status=404)
        return Response(TeamSerializer(team).data)


# ---------------------------------------------------------------------------
# Match ViewSet
# ---------------------------------------------------------------------------

class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.select_related(
        'team_blue', 'team_red', 'winner', 'season'
    ).order_by('-created_at')
    serializer_class = MatchSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated(), IsAdminPlayer()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    @action(detail=False, methods=['get'], url_path='my-matches')
    def my_matches(self, request):
        """GET /api/matches/my-matches/ — matches for the current player's team."""
        player = request.user.player
        team_ids = list(TeamMember.objects.filter(player=player).values_list('team_id', flat=True))
        captain_team_ids = list(Team.objects.filter(captain=player).values_list('id', flat=True))
        all_team_ids = list(set(team_ids + captain_team_ids))

        matches = Match.objects.filter(
            team_blue_id__in=all_team_ids
        ).union(
            Match.objects.filter(team_red_id__in=all_team_ids)
        ).order_by('scheduled_at')

        return Response(MatchSerializer(matches, many=True).data)

    @action(detail=True, methods=['post'], url_path='report')
    def report_match(self, request, pk=None):
        match = self.get_object()
        serializer = MatchReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        if match.status not in ('scheduled', 'pending_report'):
            return Response({'detail': 'Match cannot be reported in its current state.'}, status=400)

        from .tasks import process_match_report

        match.riot_match_id = serializer.validated_data['riot_match_id']
        match.status = 'pending_report'
        match.reported_at = datetime.now(timezone.utc)
        match.reported_by = request.user.player
        match.save(update_fields=['riot_match_id', 'status', 'reported_at', 'reported_by'])
        process_match_report.delay(match.id)

        return Response({'detail': 'Match report queued.', 'match_id': match.id})


# ---------------------------------------------------------------------------
# Bounty / Prediction ViewSets
# ---------------------------------------------------------------------------

class BountyViewSet(viewsets.ModelViewSet):
    queryset = Bounty.objects.select_related('player').order_by('-created_at')
    serializer_class = BountySerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated(), IsAdminPlayer()]
        return [permissions.IsAuthenticatedOrReadOnly()]


class PredictionViewSet(viewsets.ModelViewSet):
    queryset = Prediction.objects.select_related('player', 'match', 'predicted_winner')
    serializer_class = PredictionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        player = self.request.user.player
        lp_wagered = serializer.validated_data.get('lp_wagered', 0)
        if player.lp_tokens < lp_wagered:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Insufficient LP tokens.')
        player.lp_tokens -= lp_wagered
        player.save(update_fields=['lp_tokens'])
        serializer.save(player=player)


# ---------------------------------------------------------------------------
# Custom permissions
# ---------------------------------------------------------------------------

class IsAdminPlayer(permissions.BasePermission):
    def has_permission(self, request, view):
        try:
            return request.user.player.is_admin
        except Exception:
            return False


class IsTeamCaptain(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        try:
            return obj.captain == request.user.player
        except Exception:
            return False
