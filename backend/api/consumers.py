"""
Django Channels WebSocket consumers for live draft night and match updates.
"""
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class DraftConsumer(AsyncWebsocketConsumer):
    """
    Live draft night consumer.
    Group: draft_{season_id}
    
    Messages:
      - pick: {player_id, team_id, role, round}
      - state: full draft state broadcast
    """

    async def connect(self):
        self.season_id = self.scope['url_route']['kwargs']['season_id']
        self.group_name = f'draft_{self.season_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f'Draft WS connected: season {self.season_id}')

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(json.dumps({'error': 'Invalid JSON'}))
            return

        msg_type = data.get('type')

        if msg_type == 'pick':
            # Broadcast pick to all clients in the draft room
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'draft_pick',
                    'payload': data,
                },
            )

    async def draft_pick(self, event):
        await self.send(json.dumps({
            'type': 'pick',
            'payload': event['payload'],
        }))


class MatchConsumer(AsyncWebsocketConsumer):
    """
    Live match status updates.
    Group: match_{match_id}
    """

    async def connect(self):
        self.match_id = self.scope['url_route']['kwargs']['match_id']
        self.group_name = f'match_{self.match_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass  # Clients only receive, not send

    async def match_update(self, event):
        await self.send(json.dumps({
            'type': 'match_update',
            'payload': event['payload'],
        }))
