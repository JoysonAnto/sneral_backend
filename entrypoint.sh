#!/bin/sh

# Exit on error
set -e

echo "Running migrations..."
npx prisma migrate deploy || echo "⚠️ Prisma migrate deploy encountered a warning or database already migrated, proceeding..."

echo "Starting server..."
exec node dist/server.js
