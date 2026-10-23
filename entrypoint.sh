#!/bin/sh

echo "🚀 Starting container entrypoint..."

# Run database migrations if DATABASE_URL is provided, without blocking the app
if [ -n "$DATABASE_URL" ]; then
    echo "📦 Checking database migrations..."
    if [ -f "./node_modules/.bin/prisma" ]; then
        ./node_modules/.bin/prisma migrate deploy || echo "⚠️ Prisma migrate deploy warning, continuing..."
    else
        npx --yes prisma migrate deploy || echo "⚠️ Prisma migrate deploy warning, continuing..."
    fi
fi

echo "🚀 Launching application on port ${PORT:-3000}..."
exec node dist/server.js
