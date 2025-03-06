#!/bin/bash
set -e

# Wait for postgres
echo "Waiting for postgres..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "postgres" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q'; do
  echo "Postgres is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL ready - running migrations"

# Run migrations
npx prisma migrate deploy

# Seed the database if needed
if [ "$SEED_DATABASE" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

echo "Database setup complete!"
exec "$@"
