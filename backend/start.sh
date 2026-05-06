#!/usr/bin/env bash
set -e

echo "==> Starting Celery worker..."
celery -A core worker -l info --pool=solo &
CELERY_PID=$!
echo "==> Celery started (PID $CELERY_PID)"

echo "==> Starting Gunicorn..."
exec gunicorn core.wsgi:application \
  --bind 0.0.0.0:$PORT \
  --workers 2 \
  --timeout 120 \
  --log-level info
