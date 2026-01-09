# Unified Backend System

A production-grade unified backend system built with Express.js, TypeScript, Prisma, Socket.IO, and Redis.

## Features

- 🔐 Complete authentication system with JWT
- 👥 Multi-role support (Super Admin, Admin, Business Partner, Service Partner, Customer)
- 🔄 Real-time features with Socket.IO
- 💳 Payment integration (Razorpay/Stripe)
- 📧 Email notifications
- 🗄️ PostgreSQL database with Prisma ORM
- 🚀 Redis caching and session management
- 📝 Comprehensive API documentation
- 🧪 Test coverage with Jest
- 🐳 Docker support

## Tech Stack

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Real-time**: Socket.IO
- **Authentication**: JWT with bcryptjs
- **Validation**: Express-validator
- **Email**: Nodemailer
- **Background Jobs**: BullMQ
- **Logging**: Winston
- **Documentation**: Swagger

## Prerequisites

- Node.js v18+ 
- PostgreSQL
- Redis
- npm or yarn

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```
Edit `.env` and configure your environment variables.

4. **Setup database**
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database with test data
npm run prisma:seed
```

## Development

Start the development server with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Building for Production

```bash
npm run build
npm start
```

## Database Commands

```bash
# Generate Prisma client
npm run prisma:generate

# Create a new migration
npm run prisma:migrate

# Deploy migrations to production
npm run prisma:migrate:prod

# Open Prisma Studio (Database GUI)
npm run prisma:studio

# Seed database
npm run prisma:seed
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## API Documentation

Once the server is running, access the API documentation at:
- Swagger UI: `http://localhost:3000/api/docs`

## Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Request handlers
├── middleware/       # Express middleware
├── routes/           # Route definitions
├── services/         # Business logic
├── validators/       # Request validation
├── utils/            # Utility functions
├── socket/           # Socket.IO setup
├── jobs/             # Background jobs
├── app.ts            # Express app setup
└── server.ts         # Server entry point
```

## Environment Variables

Key environment variables (see `.env.example` for full list):

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` - Redis host
- `JWT_SECRET` - Secret for JWT signing
- `REFRESH_TOKEN_SECRET` - Secret for refresh tokens
- `SMTP_HOST` - Email server host
- `SMTP_USER` - Email username
- `SMTP_PASSWORD` - Email password

## Test Credentials

After running the seed script, you can use these test accounts:

- **Super Admin**: admin@example.com / Admin@123456
- **Admin**: admin2@example.com / Admin@123456
- **Business Partner**: business@example.com / Partner@123456
- **Service Partner**: partner1@example.com / Partner@123456
- **Customer**: customer1@example.com / Customer@123456

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/verify-email` - Verify email with OTP
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/profile` - Get user profile
- `PATCH /api/v1/auth/profile` - Update profile
- `POST /api/v1/auth/change-password` - Change password
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password with OTP

## User Roles & Permissions

### SUPER_ADMIN
- Full system access
- Create/manage admins
- System configuration
- View all financial data

### ADMIN
- Manage day-to-day operations
- Approve/verify partners (KYC)
- Handle customer support
- Process refunds

### BUSINESS_PARTNER
- Manage their business
- Onboard service partners
- Set pricing for services
- Manage booking assignments

### SERVICE_PARTNER
- Accept/complete bookings
- Update real-time location
- Manage availability
- View earnings

### CUSTOMER
- Browse and book services
- Track booking status
- Make payments
- Rate and review services

## Troubleshooting

### PowerShell Execution Policy (Windows)
If you encounter script execution errors, run PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Database Connection Issues
1. Ensure PostgreSQL is running
2. Verify `DATABASE_URL` in `.env`
3. Check firewall settings

### Redis Connection Issues
1. Ensure Redis is running
2. Verify `REDIS_HOST` and `REDIS_PORT` in `.env`

## Docker Support

```bash
# Build image
docker build -t unified-backend .

# Run with docker-compose
docker-compose up -d
```

## License

MIT

## Support

For issues and questions, please open an issue on the repository.
