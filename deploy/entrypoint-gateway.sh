#!/bin/bash
set -e
echo "Running database migrations..."
alembic upgrade head
echo "Starting Gateway..."
exec uvicorn app.main:app --host 0.0.0.0 --port 3001 --workers 2
