@echo off
echo ========================================
echo Unified Backend Setup Script
echo ========================================
echo.

echo [1/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)

echo.
echo [2/5] Generating Prisma Client...
call npm run prisma:generate
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate Prisma Client
    exit /b 1
)

echo.
echo [3/5] Running database migrations...
echo NOTE: This requires user input. Press Enter when prompted.
call npx prisma migrate dev --name init
if %errorlevel% neq 0 (
    echo WARNING: Migration may have failed. Check the error above.
    echo You can run manually with: npx prisma migrate dev --name init
)

echo.
echo [4/5] Seeding database...
call npm run prisma:seed
if %errorlevel% neq 0 (
    echo WARNING: Seeding failed. You can seed manually with: npm run prisma:seed
)

echo.
echo [5/5] Building TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo WARNING: Build failed. Check TypeScript errors above.
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the development server, run:
echo   npm run dev
echo.
echo To start the production server, run:
echo   npm start
echo.
echo Test credentials (see README.md for details):
echo   Admin: admin@example.com / Admin@123456
echo   Customer: customer1@example.com / Customer@123456
echo   Partner: partner1@example.com / Partner@123456
echo.
