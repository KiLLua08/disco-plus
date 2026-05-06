from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Player, Season, Team, TeamMember, Match, Bounty,
    Prediction, TeamInvite, JoinRequest,
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class PlayerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Player
        fields = [
            'id', 'username', 'discord_id', 'discord_username', 'discord_avatar',
            'riot_game_name', 'riot_tag_line', 'riot_rank',
            'role_mmr', 'lp_tokens', 'preferred_role', 'is_admin', 'created_at',
        ]
        read_only_fields = [
            'discord_id', 'role_mmr', 'lp_tokens', 'is_admin', 'created_at',
            'riot_game_name', 'riot_tag_line', 'riot_rank',
        ]


class PlayerPublicSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Player
        fields = [
            'id', 'username', 'discord_username', 'discord_avatar',
            'riot_game_name', 'riot_tag_line', 'riot_rank',
            'lp_tokens', 'preferred_role',
        ]


class TeamMemberSerializer(serializers.ModelSerializer):
    player = PlayerPublicSerializer(read_only=True)

    class Meta:
        model = TeamMember
        fields = ['id', 'player', 'role', 'is_sub', 'joined_at']


class JoinRequestSerializer(serializers.ModelSerializer):
    player = PlayerPublicSerializer(read_only=True)

    class Meta:
        model = JoinRequest
        fields = ['id', 'team', 'player', 'role', 'is_sub', 'message', 'status', 'created_at', 'responded_at']
        read_only_fields = ['status', 'created_at', 'responded_at']


class TeamSerializer(serializers.ModelSerializer):
    members = TeamMemberSerializer(many=True, read_only=True)
    captain = PlayerPublicSerializer(read_only=True)
    points = serializers.IntegerField(read_only=True)
    is_roster_complete = serializers.BooleanField(read_only=True)
    open_main_roles = serializers.ListField(read_only=True)
    main_count = serializers.SerializerMethodField()
    sub_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            'id', 'name', 'tag', 'captain', 'season',
            'wins', 'losses', 'buchholz', 'points',
            'members', 'is_roster_complete', 'open_main_roles',
            'main_count', 'sub_count', 'created_at',
        ]
        read_only_fields = ['wins', 'losses', 'buchholz', 'created_at']

    def get_main_count(self, obj):
        return obj.main_members.count()

    def get_sub_count(self, obj):
        return obj.sub_members.count()


class SeasonSerializer(serializers.ModelSerializer):
    teams = TeamSerializer(many=True, read_only=True)
    created_by = PlayerPublicSerializer(read_only=True)
    registered_teams_count = serializers.IntegerField(read_only=True)
    can_start = serializers.BooleanField(read_only=True)

    class Meta:
        model = Season
        fields = [
            'id', 'name', 'split_number', 'status', 'total_rounds',
            'current_round', 'min_teams', 'start_date', 'end_date',
            'match_day', 'match_time',
            'created_by', 'teams', 'registered_teams_count', 'can_start',
            'created_at',
        ]
        read_only_fields = ['current_round', 'created_at']


class MatchSerializer(serializers.ModelSerializer):
    team_blue = TeamSerializer(read_only=True)
    team_red = TeamSerializer(read_only=True)
    winner = TeamSerializer(read_only=True)
    team_blue_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), source='team_blue', write_only=True
    )
    team_red_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), source='team_red', write_only=True
    )

    class Meta:
        model = Match
        fields = [
            'id', 'season', 'team_blue', 'team_blue_id', 'team_red', 'team_red_id',
            'winner', 'round_number', 'status', 'riot_match_id',
            'scheduled_at', 'reported_at', 'completed_at', 'discord_thread_id',
            'created_at',
        ]
        read_only_fields = ['winner', 'status', 'reported_at', 'completed_at', 'created_at']


class BountySerializer(serializers.ModelSerializer):
    player = PlayerPublicSerializer(read_only=True)

    class Meta:
        model = Bounty
        fields = [
            'id', 'match', 'player', 'bounty_type', 'description',
            'lp_reward', 'completed', 'completed_at', 'season', 'created_at',
        ]
        read_only_fields = ['completed', 'completed_at', 'created_at']


class PredictionSerializer(serializers.ModelSerializer):
    player = PlayerPublicSerializer(read_only=True)
    predicted_winner = TeamSerializer(read_only=True)
    predicted_winner_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), source='predicted_winner', write_only=True
    )

    class Meta:
        model = Prediction
        fields = [
            'id', 'match', 'player', 'predicted_winner', 'predicted_winner_id',
            'lp_wagered', 'payout', 'settled', 'created_at',
        ]
        read_only_fields = ['payout', 'settled', 'created_at']


class TeamInviteSerializer(serializers.ModelSerializer):
    team = TeamSerializer(read_only=True)
    player = PlayerPublicSerializer(read_only=True)
    invited_by = PlayerPublicSerializer(read_only=True)

    class Meta:
        model = TeamInvite
        fields = [
            'id', 'team', 'player', 'role', 'is_sub', 'status',
            'invited_by', 'created_at', 'responded_at',
        ]
        read_only_fields = ['status', 'created_at', 'responded_at']


class MatchReportSerializer(serializers.Serializer):
    riot_match_id = serializers.CharField(max_length=100)


class DiscordAuthSerializer(serializers.Serializer):
    discord_id = serializers.CharField(max_length=64)
    discord_username = serializers.CharField(max_length=100)
    discord_avatar = serializers.CharField(max_length=200, allow_blank=True, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    access_token = serializers.CharField(required=False, allow_blank=True)


class RiotLinkSerializer(serializers.Serializer):
    riot_game_name = serializers.CharField(max_length=64)
    riot_tag_line = serializers.CharField(max_length=16)


class GeneratePairingsSerializer(serializers.Serializer):
    """Used by admin to generate pairings with a scheduled date/time."""
    scheduled_date = serializers.DateField()
    scheduled_time = serializers.TimeField()
