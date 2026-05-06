from __future__ import annotations
import logging
from datetime import datetime, timezone

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Player, Season, Team, TeamMember, Match, Bounty, Prediction, TeamInvite
from .serializers import (
    PlayerSerializer, SeasonSerializer, TeamSerializer, TeamMemberSerializer,
    MatchSerializer, BountySerializer, PredictionSerializer, TeamInviteSerializer,
    MatchReportSerializer, DiscordAuthSerializer, RiotLinkSerializer,
    PlayerPublicSerializer,
)

logger = logging.getLogger(__name__)


def get_tokens_for_user(user):
    """Return a JWT access + refresh token pair for a Django user."""
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


# ---------------------------------------------------------------------------
# Discord OAuth endpoint — called by Next.js after login
# ---------------------------------------------------------------------------

class DiscordAuthView(APIView):
    """
    POST /api/auth/discord/
    Receives Discord user info from Next.js after OAuth completes.
    Creates or updates the Player record and returns a JWT token pair.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = DiscordAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        discord_id = data['discord_id']
        discord_username = data['discord_username']
        discord_avatar = data.get('discord_avatar', '')
        email = data.get('email', '')

        with transaction.atomic():
            user, _ = User.objects.get_or_create(
                username=f'discord_{discord_id}',
                defaults={'email': email or f'{discord_id}@discord.local'},
            )

            player, created = Player.objects.get_or_create(
                discord_id=discord_id,
                defaults={'user': user},
            )

            player.discord_username = discord_username
            player.discord_avatar = discord_avatar
            player.save(update_fields=['discord_username', 'discord_avatar'])

        tokens = get_tokens_for_user(user)

        return Response({
            'player': PlayerSerializer(player).data,
            'created': created,
            'access': tokens['access'],
            'refresh': tokens['refresh'],
        }, status=status.HTTP_200_OK)


class MeView(APIView):
    """GET/PATCH /api/me/ — return or update the current logged-in player."""
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

        allowed_fields = {'preferred_role', 'discord_username'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}

        serializer = PlayerSerializer(player, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save()
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Riot account linking
# ---------------------------------------------------------------------------

class RiotLinkView(APIView):
    """
    POST /api/riot/link/
    Links a Riot account (gameName#tagLine) to the current player.
    Fetches PUUID from Riot API and queues a rank sync.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RiotLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        from . import riot
        from .tasks import sync_riot_rank

        game_name = serializer.validated_data['riot_game_name']
        tag_line = serializer.validated_data['riot_tag_line']

        account = riot.get_account_by_riot_id(game_name, tag_line)
        if not account:
            return Response(
                {'detail': f'Riot account {game_name}#{tag_line} not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        player = request.user.player
        player.riot_puuid = account['puuid']
        player.riot_game_name = account['gameName']
        player.riot_tag_line = account['tagLine']
        player.save(update_fields=['riot_puuid', 'riot_game_name', 'riot_tag_line'])

        # Queue rank sync
        sync_riot_rank.delay(player.id)

        return Response(PlayerSerializer(player).data)


# ---------------------------------------------------------------------------
# Player ViewSet
# ---------------------------------------------------------------------------

class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Player.objects.select_related('user').order_by('-lp_tokens')
    serializer_class = PlayerPublicSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=False, methods=['get'], url_path='leaderboard')
    def leaderboard(self, request):
        """GET /api/players/leaderboard/ — top players by LP tokens."""
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
        if self.action in ['create', 'update', 'partial_update', 'start_season']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def perform_create(self, serializer):
        player = self.request.user.player
        serializer.save(created_by=player)

    @action(detail=True, methods=['post'], url_path='start')
    def start_season(self, request, pk=None):
        """POST /api/seasons/{id}/start/ — activate a season."""
        season = self.get_object()
        if season.status != 'upcoming':
            return Response({'detail': 'Season is not in upcoming state.'}, status=400)
        season.status = 'active'
        season.save(update_fields=['status'])
        return Response(SeasonSerializer(season).data)

    @action(detail=True, methods=['get'], url_path='standings')
    def standings(self, request, pk=None):
        """GET /api/seasons/{id}/standings/ — sorted team standings."""
        season = self.get_object()
        teams = season.teams.order_by('-wins', '-buchholz')
        return Response(TeamSerializer(teams, many=True).data)

    @action(detail=True, methods=['post'], url_path='generate-pairings')
    def generate_pairings(self, request, pk=None):
        """POST /api/seasons/{id}/generate-pairings/ — manually trigger Swiss pairing."""
        from .tasks import generate_weekly_pairings
        generate_weekly_pairings.delay()
        return Response({'detail': 'Pairing generation queued.'})


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
        # Captain must supply their own role — no silent default
        captain_role = self.request.data.get('captain_role', '').strip()
        valid_roles = {'top', 'jgl', 'mid', 'adc', 'sup'}
        if captain_role not in valid_roles:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {'captain_role': f'Required. Must be one of: {", ".join(sorted(valid_roles))}'}
            )
        team = serializer.save(captain=player)
        TeamMember.objects.get_or_create(team=team, player=player, defaults={'role': captain_role})
        # Also save as preferred role if not already set
        if not player.preferred_role:
            player.preferred_role = captain_role
            player.save(update_fields=['preferred_role'])

    @action(detail=True, methods=['post'], url_path='invite')
    def invite_player(self, request, pk=None):
        """POST /api/teams/{id}/invite/ — invite a player to the team."""
        team = self.get_object()
        player_id = request.data.get('player_id')
        role = request.data.get('role')

        if not player_id or not role:
            return Response({'detail': 'player_id and role are required.'}, status=400)

        try:
            invitee = Player.objects.get(id=player_id)
        except Player.DoesNotExist:
            return Response({'detail': 'Player not found.'}, status=404)

        invite, created = TeamInvite.objects.get_or_create(
            team=team,
            player=invitee,
            status='pending',
            defaults={'role': role, 'invited_by': request.user.player},
        )

        if not created:
            return Response({'detail': 'Invite already pending.'}, status=400)

        return Response(TeamInviteSerializer(invite).data, status=201)

    @action(detail=True, methods=['post'], url_path='accept-invite')
    def accept_invite(self, request, pk=None):
        """POST /api/teams/{id}/accept-invite/ — accept a pending invite."""
        team = self.get_object()
        player = request.user.player

        try:
            invite = TeamInvite.objects.get(team=team, player=player, status='pending')
        except TeamInvite.DoesNotExist:
            return Response({'detail': 'No pending invite found.'}, status=404)

        with transaction.atomic():
            TeamMember.objects.create(team=team, player=player, role=invite.role)
            invite.status = 'accepted'
            invite.responded_at = datetime.now(timezone.utc)
            invite.save(update_fields=['status', 'responded_at'])

        return Response(TeamSerializer(team).data)

    @action(detail=True, methods=['post'], url_path='decline-invite')
    def decline_invite(self, request, pk=None):
        """POST /api/teams/{id}/decline-invite/ — decline a pending invite."""
        team = self.get_object()
        player = request.user.player

        try:
            invite = TeamInvite.objects.get(team=team, player=player, status='pending')
        except TeamInvite.DoesNotExist:
            return Response({'detail': 'No pending invite found.'}, status=404)

        invite.status = 'declined'
        invite.responded_at = datetime.now(timezone.utc)
        invite.save(update_fields=['status', 'responded_at'])

        return Response({'detail': 'Invite declined.'})


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

    @action(detail=True, methods=['post'], url_path='report')
    def report_match(self, request, pk=None):
        """
        POST /api/matches/{id}/report/
        Captain pastes Riot Match ID → triggers Celery task.
        """
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

        return Response({'detail': 'Match report queued for processing.', 'match_id': match.id})


# ---------------------------------------------------------------------------
# Bounty ViewSet
# ---------------------------------------------------------------------------

class BountyViewSet(viewsets.ModelViewSet):
    queryset = Bounty.objects.select_related('player').order_by('-created_at')
    serializer_class = BountySerializer

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.IsAuthenticated(), IsAdminPlayer()]
        return [permissions.IsAuthenticatedOrReadOnly()]


# ---------------------------------------------------------------------------
# Prediction ViewSet
# ---------------------------------------------------------------------------

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
