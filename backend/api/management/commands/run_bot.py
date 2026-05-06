"""
Discord bot as a Django management command.
Run with: python manage.py run_bot

Commands:
  /register          - Link Discord account + prompt for Riot ID
  /register_team     - Create a team
  /invite            - Invite a player to your team
  /match             - Schedule a match (admin)
  /report            - Report a match result
  /standings         - Show current season standings
  /draft             - Start a snake draft
"""
import os
import logging
import django
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run the Discord Clash+ bot'

    def handle(self, *args, **options):
        import discord
        from discord import app_commands
        from django.conf import settings

        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True

        class ClashBot(discord.Client):
            def __init__(self):
                super().__init__(intents=intents)
                self.tree = app_commands.CommandTree(self)

            async def setup_hook(self):
                await self.tree.sync()
                logger.info('Slash commands synced.')

            async def on_ready(self):
                self.stdout_write(f'Bot ready: {self.user} (ID: {self.user.id})')

            def stdout_write(self, msg):
                print(msg)

        bot = ClashBot()

        # ----------------------------------------------------------------
        # /register
        # ----------------------------------------------------------------
        @bot.tree.command(name='register', description='Register your Discord account for Clash+')
        async def register(interaction: discord.Interaction):
            from api.models import Player
            from django.contrib.auth.models import User

            discord_id = str(interaction.user.id)
            discord_username = str(interaction.user)
            avatar = str(interaction.user.display_avatar.url) if interaction.user.display_avatar else ''

            user, _ = User.objects.get_or_create(
                username=f'discord_{discord_id}',
                defaults={'email': f'{discord_id}@discord.local'},
            )
            player, created = Player.objects.get_or_create(
                discord_id=discord_id,
                defaults={'user': user},
            )
            player.discord_username = discord_username
            player.discord_avatar = avatar
            player.save(update_fields=['discord_username', 'discord_avatar'])

            if created:
                await interaction.response.send_message(
                    f'✅ Registered! Now link your Riot account at http://localhost:3000/profile\n'
                    f'Or use `/link_riot YourName#TAG`',
                    ephemeral=True,
                )
            else:
                await interaction.response.send_message(
                    f'You\'re already registered as **{player.discord_username}**.',
                    ephemeral=True,
                )

        # ----------------------------------------------------------------
        # /link_riot
        # ----------------------------------------------------------------
        @bot.tree.command(name='link_riot', description='Link your Riot account (GameName#TAG)')
        @app_commands.describe(game_name='Your Riot game name', tag_line='Your tag (e.g. NA1)')
        async def link_riot(interaction: discord.Interaction, game_name: str, tag_line: str):
            from api.models import Player
            from api import riot
            from api.tasks import sync_riot_rank

            discord_id = str(interaction.user.id)
            try:
                player = Player.objects.get(discord_id=discord_id)
            except Player.DoesNotExist:
                await interaction.response.send_message(
                    'Please `/register` first.', ephemeral=True
                )
                return

            await interaction.response.defer(ephemeral=True)

            account = riot.get_account_by_riot_id(game_name, tag_line)
            if not account:
                await interaction.followup.send(
                    f'❌ Could not find Riot account **{game_name}#{tag_line}**. Check spelling.',
                    ephemeral=True,
                )
                return

            player.riot_puuid = account['puuid']
            player.riot_game_name = account['gameName']
            player.riot_tag_line = account['tagLine']
            player.save(update_fields=['riot_puuid', 'riot_game_name', 'riot_tag_line'])
            sync_riot_rank.delay(player.id)

            await interaction.followup.send(
                f'✅ Linked **{account["gameName"]}#{account["tagLine"]}** to your account!',
                ephemeral=True,
            )

        # ----------------------------------------------------------------
        # /register_team
        # ----------------------------------------------------------------
        @bot.tree.command(name='register_team', description='Create a new team')
        @app_commands.describe(name='Team name', tag='Short tag (max 8 chars)')
        async def register_team(interaction: discord.Interaction, name: str, tag: str):
            from api.models import Player, Team, Season, TeamMember

            discord_id = str(interaction.user.id)
            try:
                player = Player.objects.get(discord_id=discord_id)
            except Player.DoesNotExist:
                await interaction.response.send_message('Please `/register` first.', ephemeral=True)
                return

            # Get active season
            season = Season.objects.filter(status='active').first()

            team, created = Team.objects.get_or_create(
                name=name,
                season=season,
                defaults={'tag': tag[:8], 'captain': player},
            )

            if not created:
                await interaction.response.send_message(
                    f'A team named **{name}** already exists this season.', ephemeral=True
                )
                return

            role = player.preferred_role or 'mid'
            TeamMember.objects.get_or_create(team=team, player=player, defaults={'role': role})

            await interaction.response.send_message(
                f'🏆 Team **{name} [{tag}]** created! You are the captain.\n'
                f'Use `/invite @player` to fill your roster.',
            )

        # ----------------------------------------------------------------
        # /invite
        # ----------------------------------------------------------------
        @bot.tree.command(name='invite', description='Invite a player to your team')
        @app_commands.describe(member='Discord member to invite', role='Role: top/jgl/mid/adc/sup')
        async def invite(interaction: discord.Interaction, member: discord.Member, role: str):
            from api.models import Player, Team, TeamInvite, Season

            discord_id = str(interaction.user.id)
            try:
                captain = Player.objects.get(discord_id=discord_id)
            except Player.DoesNotExist:
                await interaction.response.send_message('Please `/register` first.', ephemeral=True)
                return

            season = Season.objects.filter(status='active').first()
            try:
                team = Team.objects.get(captain=captain, season=season)
            except Team.DoesNotExist:
                await interaction.response.send_message(
                    'You are not a captain of any team this season.', ephemeral=True
                )
                return

            invitee_id = str(member.id)
            try:
                invitee = Player.objects.get(discord_id=invitee_id)
            except Player.DoesNotExist:
                await interaction.response.send_message(
                    f'{member.mention} is not registered. Ask them to use `/register` first.',
                    ephemeral=True,
                )
                return

            invite_obj, created = TeamInvite.objects.get_or_create(
                team=team, player=invitee, status='pending',
                defaults={'role': role, 'invited_by': captain},
            )

            if not created:
                await interaction.response.send_message(
                    f'{member.mention} already has a pending invite.', ephemeral=True
                )
                return

            await interaction.response.send_message(
                f'📨 {member.mention}, you\'ve been invited to join **{team.name}** as **{role}**!\n'
                f'Accept at http://localhost:3000/invites or use the web dashboard.'
            )

        # ----------------------------------------------------------------
        # /match
        # ----------------------------------------------------------------
        @bot.tree.command(name='match', description='Schedule a match between two teams (admin only)')
        @app_commands.describe(team1='First team name', team2='Second team name')
        async def schedule_match(interaction: discord.Interaction, team1: str, team2: str):
            from api.models import Player, Team, Match, Season

            discord_id = str(interaction.user.id)
            try:
                player = Player.objects.get(discord_id=discord_id)
            except Player.DoesNotExist:
                await interaction.response.send_message('Not registered.', ephemeral=True)
                return

            if not player.is_admin:
                await interaction.response.send_message('Admin only.', ephemeral=True)
                return

            season = Season.objects.filter(status='active').first()
            if not season:
                await interaction.response.send_message('No active season.', ephemeral=True)
                return

            try:
                t1 = Team.objects.get(name__iexact=team1, season=season)
                t2 = Team.objects.get(name__iexact=team2, season=season)
            except Team.DoesNotExist:
                await interaction.response.send_message(
                    f'Could not find both teams. Check names.', ephemeral=True
                )
                return

            match = Match.objects.create(
                season=season,
                team_blue=t1,
                team_red=t2,
                round_number=season.current_round,
                status='scheduled',
            )

            # Create a Discord thread for the match
            thread = await interaction.channel.create_thread(
                name=f'Match: {t1.name} vs {t2.name} — Round {season.current_round}',
                type=discord.ChannelType.public_thread,
            )
            match.discord_thread_id = str(thread.id)
            match.save(update_fields=['discord_thread_id'])

            await thread.send(
                f'⚔️ **{t1.name}** (Blue) vs **{t2.name}** (Red)\n'
                f'Round {season.current_round} | Season: {season.name}\n\n'
                f'When the game is done, the captain uses `/report <riot_match_id>` to submit results.\n'
                f'op.gg: https://www.op.gg/multisearch/na?summoners='
            )

            await interaction.response.send_message(
                f'✅ Match scheduled! Thread created: {thread.mention}'
            )

        # ----------------------------------------------------------------
        # /report
        # ----------------------------------------------------------------
        @bot.tree.command(name='report', description='Report a match result with Riot Match ID')
        @app_commands.describe(riot_match_id='The Riot match ID (e.g. NA1_1234567890)')
        async def report(interaction: discord.Interaction, riot_match_id: str):
            from api.models import Player, Match, Season
            from api.tasks import process_match_report

            discord_id = str(interaction.user.id)
            try:
                player = Player.objects.get(discord_id=discord_id)
            except Player.DoesNotExist:
                await interaction.response.send_message('Not registered.', ephemeral=True)
                return

            # Find the most recent scheduled match for this player's team
            from api.models import TeamMember
            team_ids = TeamMember.objects.filter(player=player).values_list('team_id', flat=True)
            match = Match.objects.filter(
                status__in=['scheduled', 'pending_report'],
            ).filter(
                team_blue_id__in=team_ids
            ).union(
                Match.objects.filter(
                    status__in=['scheduled', 'pending_report'],
                    team_red_id__in=team_ids,
                )
            ).order_by('-created_at').first()

            if not match:
                await interaction.response.send_message(
                    'No pending match found for your team.', ephemeral=True
                )
                return

            match.riot_match_id = riot_match_id
            match.status = 'pending_report'
            match.reported_by = player
            from datetime import datetime, timezone
            match.reported_at = datetime.now(timezone.utc)
            match.save(update_fields=['riot_match_id', 'status', 'reported_by', 'reported_at'])

            process_match_report.delay(match.id)

            await interaction.response.send_message(
                f'✅ Match reported! Processing results for `{riot_match_id}`...\n'
                f'Results will be posted shortly.'
            )

        # ----------------------------------------------------------------
        # /standings
        # ----------------------------------------------------------------
        @bot.tree.command(name='standings', description='Show current season standings')
        async def standings(interaction: discord.Interaction):
            from api.models import Season, Team

            season = Season.objects.filter(status='active').first()
            if not season:
                await interaction.response.send_message('No active season.', ephemeral=True)
                return

            teams = season.teams.order_by('-wins', '-buchholz')
            if not teams.exists():
                await interaction.response.send_message('No teams registered yet.', ephemeral=True)
                return

            lines = [f'**{season.name} — Round {season.current_round}/{season.total_rounds}**\n']
            for i, team in enumerate(teams, 1):
                lines.append(
                    f'{i}. **{team.name}** [{team.tag}] — '
                    f'{team.wins}W/{team.losses}L (Buchholz: {team.buchholz:.1f})'
                )

            await interaction.response.send_message('\n'.join(lines))

        # ----------------------------------------------------------------
        # Run the bot
        # ----------------------------------------------------------------
        token = settings.DISCORD_BOT_TOKEN
        if not token:
            self.stderr.write('DISCORD_BOT_TOKEN is not set in .env')
            return

        bot.run(token)
