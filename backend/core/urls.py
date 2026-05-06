from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from api.views import (
    DiscordAuthView, MeView, RiotLinkView,
    PlayerViewSet, SeasonViewSet, TeamViewSet, MatchViewSet,
    BountyViewSet, PredictionViewSet,
)

router = DefaultRouter()
router.register(r'players', PlayerViewSet, basename='player')
router.register(r'seasons', SeasonViewSet, basename='season')
router.register(r'teams', TeamViewSet, basename='team')
router.register(r'matches', MatchViewSet, basename='match')
router.register(r'bounties', BountyViewSet, basename='bounty')
router.register(r'predictions', PredictionViewSet, basename='prediction')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/discord/', DiscordAuthView.as_view(), name='discord-auth'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/me/', MeView.as_view(), name='me'),
    path('api/riot/link/', RiotLinkView.as_view(), name='riot-link'),
]