from django.db import models
from django.contrib.auth.models import User


# ---------------------------------------------------------------------------
# Player
# ---------------------------------------------------------------------------

class Player(models.Model):
    """Extends Django User with Discord + Riot identity and MMR data."""

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

    # Riot identity
    riot_puuid = models.CharField(max_length=100, blank=True, db_index=True)
    riot_game_name = models.CharField(max_length=64, blank=True)   # e.g. "Faker"
    riot_tag_line = models.CharField(max_length=16, blank=True)    # e.g. "KR1"
    riot_summoner_id = models.CharField(max_length=100, blank=True)
    riot_rank = models.CharField(max_length=32, blank=True)        # e.g. "GOLD II"

    # Role-based TrueSkill MMR stored as JSON
    # {"mid": {"mu": 32.1, "sigma": 2.4}, "top": {"mu": 25.0, "sigma": 4.1}}
    role_mmr = models.JSONField(default=dict)

    # LP token economy
    lp_tokens = models.IntegerField(default=0)

    # Preferred role
    preferred_role = models.CharField(max_length=8, choices=ROLE_CHOICES, blank=True)

    is_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.discord_username} ({self.riot_game_name}#{self.riot_tag_line})"

    def get_role_mmr(self, role: str) -> dict:
        """Return TrueSkill mu/sigma for a role, seeding defaults if missing."""
        defaults = {'mu': 25.0, 'sigma': 8.333}
        return self.role_mmr.get(role, defaults)

    def set_role_mmr(self, role: str, mu: float, sigma: float):
        """Update TrueSkill values for a specific role."""
        if not self.role_mmr:
            self.role_mmr = {}
        self.role_mmr[role] = {'mu': round(mu, 4), 'sigma': round(sigma, 4)}


# ---------------------------------------------------------------------------
# Season
# ---------------------------------------------------------------------------

class Season(models.Model):
    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('active', 'Active'),
        ('completed', 'Completed'),
    ]

    name = models.CharField(max_length=100)
    split_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='upcoming')
    total_rounds = models.PositiveIntegerField(default=4)
    current_round = models.PositiveIntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        Player, on_delete=models.SET_NULL, null=True, related_name='seasons_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} (Split {self.split_number})"


# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------

class Team(models.Model):
    name = models.CharField(max_length=100)
    tag = models.CharField(max_length=8)
    captain = models.ForeignKey(
        Player, on_delete=models.SET_NULL, null=True, related_name='captained_teams'
    )
    season = models.ForeignKey(
        Season, on_delete=models.CASCADE, related_name='teams', null=True, blank=True
    )

    # Swiss standings
    wins = models.PositiveIntegerField(default=0)
    losses = models.PositiveIntegerField(default=0)
    buchholz = models.FloatField(default=0.0)  # tiebreaker

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('name', 'season')

    def __str__(self):
        return f"{self.name} [{self.tag}]"

    @property
    def points(self):
        return self.wins * 2  # 2 pts per win, 0 per loss (no draws in LoL)


# ---------------------------------------------------------------------------
# TeamMember
# ---------------------------------------------------------------------------

class TeamMember(models.Model):
    ROLE_CHOICES = Player.ROLE_CHOICES

    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='members')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='team_memberships')
    role = models.CharField(max_length=8, choices=ROLE_CHOICES)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('team', 'role')  # one player per role per team

    def __str__(self):
        return f"{self.player.discord_username} → {self.team.name} ({self.role})"


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

    # Riot data
    riot_match_id = models.CharField(max_length=100, blank=True, db_index=True)
    data = models.JSONField(default=dict, blank=True)  # full Riot API response cached here

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
    payout = models.IntegerField(default=0)  # can be negative
    settled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('match', 'player')

    def __str__(self):
        return f"{self.player.discord_username} bets {self.lp_wagered} LP on {self.predicted_winner}"


# ---------------------------------------------------------------------------
# TeamInvite
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
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='pending')
    invited_by = models.ForeignKey(
        Player, on_delete=models.SET_NULL, null=True, related_name='sent_invites'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Invite: {self.player.discord_username} → {self.team.name} ({self.status})"
