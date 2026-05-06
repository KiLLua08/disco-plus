from django.db import models
from django.contrib.auth.models import User


# ---------------------------------------------------------------------------
# Player
# ---------------------------------------------------------------------------

class Player(models.Model):
    ROLE_CHOICES = [
        ('top', 'Top'),
        ('jgl', 'Jungle'),
        ('mid', 'Mid'),
        ('adc', 'ADC'),
        ('sup', 'Support'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='player')
    discord_id = models.CharField(max_length=64, unique=True, db_index=True)
    discord_username = models.CharField(max_length=100, blank=True)
    discord_avatar = models.CharField(max_length=200, blank=True)

    riot_puuid = models.CharField(max_length=100, blank=True, db_index=True)
    riot_game_name = models.CharField(max_length=64, blank=True)
    riot_tag_line = models.CharField(max_length=16, blank=True)
    riot_summoner_id = models.CharField(max_length=100, blank=True)
    riot_rank = models.CharField(max_length=32, blank=True)

    role_mmr = models.JSONField(default=dict)
    lp_tokens = models.IntegerField(default=0)
    preferred_role = models.CharField(max_length=8, choices=ROLE_CHOICES, blank=True)

    is_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.discord_username} ({self.riot_game_name}#{self.riot_tag_line})"

    def get_role_mmr(self, role: str) -> dict:
        defaults = {'mu': 25.0, 'sigma': 8.333}
        return self.role_mmr.get(role, defaults)

    def set_role_mmr(self, role: str, mu: float, sigma: float):
        if not self.role_mmr:
            self.role_mmr = {}
        self.role_mmr[role] = {'mu': round(mu, 4), 'sigma': round(sigma, 4)}


# ---------------------------------------------------------------------------
# Season
# ---------------------------------------------------------------------------

class Season(models.Model):
    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('registration', 'Registration Open'),
        ('active', 'Active'),
        ('completed', 'Completed'),
    ]

    name = models.CharField(max_length=100)
    split_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='upcoming')
    total_rounds = models.PositiveIntegerField(default=4)
    current_round = models.PositiveIntegerField(default=0)
    min_teams = models.PositiveIntegerField(default=5)  # min teams to start
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    # Day/time for matches (e.g. "Sunday 16:00")
    match_day = models.CharField(max_length=20, blank=True, default='Sunday')
    match_time = models.CharField(max_length=10, blank=True, default='16:00')
    created_by = models.ForeignKey(
        Player, on_delete=models.SET_NULL, null=True, related_name='seasons_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} (Split {self.split_number})"

    @property
    def registered_teams_count(self):
        return self.teams.count()

    @property
    def can_start(self):
        return self.status == 'registration' and self.registered_teams_count >= self.min_teams


# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------

class Team(models.Model):
    name = models.CharField(max_length=100, unique=True)
    tag = models.CharField(max_length=8)
    captain = models.ForeignKey(
        Player, on_delete=models.SET_NULL, null=True, related_name='captained_teams'
    )
    # Season is set when team registers for a season, null = not registered yet
    season = models.ForeignKey(
        Season, on_delete=models.SET_NULL, related_name='teams', null=True, blank=True
    )

    wins = models.PositiveIntegerField(default=0)
    losses = models.PositiveIntegerField(default=0)
    buchholz = models.FloatField(default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} [{self.tag}]"

    @property
    def points(self):
        return self.wins * 2

    @property
    def main_members(self):
        return self.members.filter(is_sub=False)

    @property
    def sub_members(self):
        return self.members.filter(is_sub=True)

    @property
    def is_roster_complete(self):
        """True when all 5 main roles are filled."""
        return self.main_members.count() == 5

    @property
    def open_main_roles(self):
        filled = set(self.main_members.values_list('role', flat=True))
        all_roles = {'top', 'jgl', 'mid', 'adc', 'sup'}
        return list(all_roles - filled)


# ---------------------------------------------------------------------------
# TeamMember
# ---------------------------------------------------------------------------

class TeamMember(models.Model):
    ROLE_CHOICES = Player.ROLE_CHOICES

    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='members')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='team_memberships')
    role = models.CharField(max_length=8, choices=ROLE_CHOICES)
    is_sub = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Main players: one per role per team. Subs: no role uniqueness constraint.
        # Enforced in code, not DB, to allow subs with same role.
        unique_together = []

    def __str__(self):
        sub_label = ' (sub)' if self.is_sub else ''
        return f"{self.player.discord_username} → {self.team.name} ({self.role}{sub_label})"


# ---------------------------------------------------------------------------
# JoinRequest — player requests to join a team
# ---------------------------------------------------------------------------

class JoinRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]

    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='join_requests')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='join_requests')
    role = models.CharField(max_length=8, choices=Player.ROLE_CHOICES)
    is_sub = models.BooleanField(default=False)
    message = models.CharField(max_length=200, blank=True)  # optional note from player
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # One pending request per player per team
        unique_together = ('team', 'player')

    def __str__(self):
        return f"{self.player.discord_username} → {self.team.name} ({self.role}) [{self.status}]"


# ---------------------------------------------------------------------------
# Match
# ---------------------------------------------------------------------------

class Match(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('pending_report', 'Pending Report'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('disputed', 'Disputed'),
    ]

    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name='matches')
    team_blue = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='blue_matches')
    team_red = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='red_matches')
    winner = models.ForeignKey(
        Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='won_matches'
    )
    round_number = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')

    riot_match_id = models.CharField(max_length=100, blank=True, db_index=True)
    data = models.JSONField(default=dict, blank=True)

    scheduled_at = models.DateTimeField(null=True, blank=True)
    reported_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    reported_by = models.ForeignKey(
        Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='reported_matches'
    )
    discord_thread_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"R{self.round_number}: {self.team_blue} vs {self.team_red} [{self.status}]"


# ---------------------------------------------------------------------------
# Bounty
# ---------------------------------------------------------------------------

class Bounty(models.Model):
    BOUNTY_TYPES = [
        ('pentakill', 'Get a Pentakill'),
        ('ace', 'Ace the enemy team'),
        ('baron_steal', 'Steal Baron'),
        ('first_blood', 'Get First Blood'),
        ('perfect_game', 'Win with 0 deaths'),
        ('custom', 'Custom'),
    ]

    match = models.ForeignKey(
        Match, on_delete=models.CASCADE, related_name='bounties', null=True, blank=True
    )
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='bounties')
    bounty_type = models.CharField(max_length=32, choices=BOUNTY_TYPES, default='custom')
    description = models.TextField()
    lp_reward = models.PositiveIntegerField(default=50)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    season = models.ForeignKey(
        Season, on_delete=models.CASCADE, related_name='bounties', null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        status = '✅' if self.completed else '⬜'
        return f"{status} {self.player.discord_username}: {self.description} (+{self.lp_reward} LP)"


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

class Prediction(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='predictions')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='predictions')
    predicted_winner = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name='predicted_wins'
    )
    lp_wagered = models.PositiveIntegerField(default=0)
    payout = models.IntegerField(default=0)
    settled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('match', 'player')

    def __str__(self):
        return f"{self.player.discord_username} bets {self.lp_wagered} LP on {self.predicted_winner}"


# ---------------------------------------------------------------------------
# TeamInvite — captain invites a player directly
# ---------------------------------------------------------------------------

class TeamInvite(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('expired', 'Expired'),
    ]

    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='invites')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='invites')
    role = models.CharField(max_length=8, choices=Player.ROLE_CHOICES)
    is_sub = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='pending')
    invited_by = models.ForeignKey(
        Player, on_delete=models.SET_NULL, null=True, related_name='sent_invites'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Invite: {self.player.discord_username} → {self.team.name} ({self.status})"
