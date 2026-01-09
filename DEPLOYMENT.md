# 🚀 Production Deployment Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database
- Redis server
- Domain name (for production)
- SSL certificate (for HTTPS)

---

## 1. Environment Setup

### Create Production `.env`

```bash
# Copy example
cp .env.example .env
```

### Configure Environment Variables

```env
# Application
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Database (Use production PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# Redis (Use production Redis)
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT Secrets (Generate strong secrets)
JWT_ACCESS_SECRET=<generate-strong-secret>
JWT_REFRESH_SECRET=<generate-strong-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Payment Gateways
RAZORPAY_KEY_ID=your_live_key_id
RAZORPAY_KEY_SECRET=your_live_secret
STRIPE_SECRET_KEY=your_live_stripe_key

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Admin Credentials
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong-password>
```

---

## 2. Database Setup

### Run Migrations

```bash
npm run prisma:generate
npx prisma migrate deploy
```

### Seed Production Data (Optional)

```bash
# Modify seed.ts for production data first
npm run prisma:seed
```

---

## 3. Build for Production

```bash
# Install dependencies
npm ci --production=false

# Build TypeScript
npm run build

# Install only production dependencies
npm ci --production
```

---

## 4. Deployment Options

### Option A: Traditional Server (PM2)

#### Install PM2

```bash
npm install -g pm2
```

#### Create PM2 Ecosystem File

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'snearal-backend',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
```

#### Start with PM2

```bash
# Start
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs

# Restart
pm2 restart snearal-backend

# Stop
pm2 stop snearal-backend

# Startup on boot
pm2 startup
pm2 save
```

---

### Option B: Docker Deployment

#### Build Docker Image

```bash
docker build -t snearal-backend:latest .
```

#### Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

---

### Option C: Cloud Platform (Railway/Render/Heroku)

#### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add database
railway add

# Set environment variables
railway variables set NODE_ENV=production

# Deploy
railway up
```

#### Render

1. Connect GitHub repository
2. Create Web Service
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables
6. Deploy

---

## 5. Nginx Configuration (Reverse Proxy)

### Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### Configure Nginx

```nginx
# /etc/nginx/sites-available/snearal-backend
server {
    listen 80;
    server_name api.yourdomain.com;

    # Socket.IO support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API routes
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/snearal-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 7. Monitoring & Logging

### Install Monitoring Tools

```bash
# Install PM2 monitoring
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Setup Application Monitoring

```javascript
// Use services like:
// - New Relic
// - DataDog
// - Sentry for error tracking
```

---

## 8. Security Checklist

- [ ] Use HTTPS only
- [ ] Strong JWT secrets
- [ ] Database credentials secured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Regular security updates
- [ ] Firewall configured
- [ ] Only necessary ports open
- [ ] Regular backups
- [ ] Environment variables secured

---

## 9. Performance Optimization

### Enable Clustering

Already configured in PM2 ecosystem file

### Database Optimization

```bash
# Add database indexes (already in schema)
# Enable connection pooling in Prisma
```

### Redis Caching

```typescript
// Implement caching for frequently accessed data
// Already configured for sessions
```

---

## 10. Backup Strategy

### Database Backups

```bash
# Automated PostgreSQL backup
pg_dump -U username -d database > backup_$(date +%Y%m%d).sql

# Scheduled with cron
0 2 * * * /path/to/backup-script.sh
```

### File Backups

```bash
# Backup uploaded files (KYC documents)
tar -czf uploads_backup.tar.gz uploads/
```

---

## 11. Health Checks

### API Health Check

```bash
curl https://api.yourdomain.com/api/v1/health
```

### Response

```json
{
  "status": "OK",
  "timestamp": "2025-12-13T...",
  "uptime": 12345
}
```

---

## 12. Scaling Considerations

### Horizontal Scaling

```typescript
// Install Redis adapter for Socket.IO
npm install @socket.io/redis-adapter

// Update socket.server.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

### Load Balancing

Use Nginx or cloud load balancer to distribute traffic across multiple instances.

---

## 13. Troubleshooting

### Common Issues

**Port already in use:**
```bash
lsof -i :3000
kill -9 <PID>
```

**Database connection failed:**
- Check DATABASE_URL
- Verify PostgreSQL is running
- Check firewall rules

**Redis connection failed:**
- Verify Redis is running
- Check REDIS_HOST and REDIS_PORT
- Verify password

---

## 14. Maintenance

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update packages
npm update

# Rebuild
npm run build

# Restart
pm2 restart all
```

### Database Migrations

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Deploy to production
npx prisma migrate deploy
```

---

## 15. Contact & Support

- **Documentation**: `/docs`
- **API Docs**: `/api/v1/docs`
- **Health**: `/api/v1/health`

---

**Deployment Checklist:**

- [ ] Environment variables configured
- [ ] Database migrated
- [ ] SSL certificate installed
- [ ] Nginx configured
- [ ] PM2 or Docker running
- [ ] Health check passing
- [ ] Logs configured
- [ ] Monitoring setup
- [ ] Backups automated
- [ ] Security hardened

---

**Your backend is now production-ready! 🚀**
