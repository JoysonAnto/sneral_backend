# 🚀 Quick Start Guide

## Immediate Next Steps

### 1. Test the Running Server (2 minutes)

The server is already running! Test it now:

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Expected response:
{
  "status": "OK",
  "timestamp": "2025-12-13T...",
  "uptime": 123.456
}
```

### 2. Test Authentication (5 minutes)

```bash
# Register a new user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "Test@123456",
    "fullName": "Test User",
    "phoneNumber": "+919876543210",
    "role": "CUSTOMER"
  }'

# Login (after email verification)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "Test@123456"
  }'
```

### 3. Use Existing Test Data

```javascript
// Already seeded in database:
Super Admin: admin@example.com / Admin@123456
Customer: customer1@example.com / Customer@123456
Partner: partner1@example.com / Partner@123456
```

## Production Deployment (30 minutes)

### Step 1: Configure Redis (5 min)

**Option A: Local Redis**
```bash
# Windows (via Memurai or Docker)
docker run -d -p 6379:6379 redis:alpine

# Update .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Option B: Cloud Redis (Recommended)**
```bash
# Upstash (Free tier)
# 1. Visit upstash.com
# 2. Create Redis database
# 3. Copy connection details

# Update .env
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

### Step 2: Deploy to Railway (15 min)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set DATABASE_URL=${{Postgres.DATABASE_URL}}

# Deploy
railway up
```

### Step 3: Configure Domain (10 min)

```bash
# In Railway dashboard:
# Settings → Domains → Generate Domain
# Or add custom domain

# Update CORS in .env
CORS_ORIGINS=https://your-frontend.com,https://your-app.com
```

## Testing Checklist

- [ ] Health endpoint works
- [ ] User registration works  
- [ ] Login returns JWT token
- [ ] Protected routes require token
- [ ] Database operations work
- [ ] File upload (KYC) works
- [ ] Payment creation works
- [ ] Socket.IO connects

## Production Checklist

- [ ] Redis configured
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] SSL/HTTPS enabled
- [ ] CORS origins configured
- [ ] Rate limiting active
- [ ] Error monitoring setup
- [ ] Backup strategy in place

## Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm start

# Tests
npm test

# Database
npm run prisma:migrate
npm run prisma:seed
```

## Troubleshooting

**Redis Connection Error**
- Non-blocking, app continues without cache
- Configure Redis for full functionality

**Port Already in Use**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

**Database Connection Failed**
- Check DATABASE_URL in .env
- Verify PostgreSQL is running
- Test connection string

## API Endpoints Summary

Base URL: `http://localhost:3000/api/v1`

- **Auth**: `/auth/*` (11 endpoints)
- **Bookings**: `/bookings/*` (10 endpoints)
- **Services**: `/services/*` (6 endpoints)
- **Partners**: `/partners/*` (10 endpoints)
- **Wallet**: `/wallet/*` (4 endpoints)
- **Payments**: `/payments/*` (4 endpoints)
- **KYC**: `/kyc/*` (3 endpoints)
- **Users**: `/users/*` (5 endpoints)
- **Messages**: `/messages/*` (3 endpoints)
- **Notifications**: `/notifications/*` (3 endpoints)
- **Admin**: `/admin/*` (2 endpoints)

## Socket.IO Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/customer', {
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => {
  console.log('Connected!');
});
```

## Support

- **Docs**: See README.md
- **API Spec**: api_specification.md.resolved
- **Deployment**: DEPLOYMENT.md
- **Testing**: testing_report.md

---

**Your backend is ready! Start building the frontend now! 🎉**
