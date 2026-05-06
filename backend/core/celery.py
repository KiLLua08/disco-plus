import os
import sys
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Windows: prefork uses shared memory semaphores that Windows blocks.
# Use 'solo' pool for local dev — single-threaded but no permission errors.
# On Linux/Render in production this is ignored (prefork works fine there).
if sys.platform == 'win32':
    app.conf.worker_pool = 'solo'

# Celery Beat schedule
app.conf.beat_schedule = {
    # Generate Swiss pairings every Monday at 08:00 UTC
    'generate-swiss-pairings-monday': {
        'task': 'api.tasks.generate_weekly_pairings',
        'schedule': crontab(hour=8, minute=0, day_of_week='monday'),
    },
}
