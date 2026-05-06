from django.contrib import admin
from .models import Player, Season, Team, TeamMember, Match, Bounty, Prediction, TeamInvite


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['discord_username', 'riot_game_name', 'riot_tag_line', 'riot_rank', 'lp_tokens', 'is_admin']
    search_fields = ['discord_username', 'riot_game_name', 'discord_id']
    list_filter = ['is_admin', 'preferred_role']
    readonly_fields = ['discord_id', 'riot_puuid', 'created_at', 'updated_at']


@admin.register(Season)
class SeasonAdmin(admin.ModelAdmin):
    list_display = ['name', 'split_number', 'status', 'current_round', 'total_rounds', 'start_date']
    list_filter = ['status']
    actions = ['activate_season']

    def activate_season(self, request, queryset):
        queryset.update(status='active')
    activate_season.short_description = 'Activate selected seasons'


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'tag', 'captain', 'season', 'wins', 'losses', 'buchholz']
    list_filter = ['season']
    search_fields = ['name', 'tag']


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ['player', 'team', 'role', 'joined_at']
    list_filter = ['role']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'season', 'round_number', 'status', 'winner', 'riot_match_id']
    list_filter = ['status', 'season', 'round_number']
    search_fields = ['riot_match_id']
    readonly_fields = ['data', 'reported_at', 'completed_at']


@admin.register(Bounty)
class BountyAdmin(admin.ModelAdmin):
    list_display = ['player', 'bounty_type', 'description', 'lp_reward', 'completed']
    list_filter = ['completed', 'bounty_type']


@admin.register(Prediction)
class PredictionAdmin(admin.ModelAdmin):
    list_display = ['player', 'match', 'predicted_winner', 'lp_wagered', 'payout', 'settled']
    list_filter = ['settled']


@admin.register(TeamInvite)
class TeamInviteAdmin(admin.ModelAdmin):
    list_display = ['player', 'team', 'role', 'status', 'invited_by', 'created_at']
    list_filter = ['status']
