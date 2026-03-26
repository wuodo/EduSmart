# EduSmart CRM - Deployment Guide

## Prerequisites
- Node.js 18+ installed
- PostgreSQL 14+ database (provided by hosting company)

## Environment Variables Required

The hosting company needs to set these environment variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# PostgreSQL Configuration (hosting company provides this)
DATABASE_URL="postgresql://username:password@host:5432/database_name"

# JWT Configuration (IMPORTANT: Generate strong secrets)
JWT_SECRET=<generate-strong-random-secret-32-chars-minimum>
JWT_EXPIRES_IN=7d

# Password Reset Secret
RESET_SECRET=<generate-different-strong-secret>

# File Upload Configuration
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# CORS Configuration (add your production domain)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## Deployment Steps

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Set Up Database

```bash
cd backend

# Run Prisma migrations to create tables
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 3. Seed Initial Data (Optional)

```bash
# Create super admin user
npm run seed:superadmin

# Create tenant admin user
npm run seed:tenant-admin
```

### 4. Build Applications

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

### 5. Start Services

```bash
# Start backend (from backend directory)
npm start

# Start frontend (from frontend directory)
npm start
```

## Production Checklist

- [ ] PostgreSQL database created and accessible
- [ ] All environment variables set with production values
- [ ] Strong JWT_SECRET and RESET_SECRET generated
- [ ] CORS_ORIGINS includes production domain
- [ ] Database migrations run successfully
- [ ] SSL/HTTPS configured for production domain
- [ ] File upload directory has write permissions
- [ ] Backup strategy in place for database

## Important Notes

1. **Database Connection**: The hosting company should provide the `DATABASE_URL` in this format:
   ```
   postgresql://username:password@host:5432/database_name
   ```

2. **Security**: Never commit `.env` files to GitHub. The `.gitignore` is already configured to exclude them.

3. **Secrets**: Generate strong random secrets for JWT_SECRET and RESET_SECRET:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **CORS**: Update `CORS_ORIGINS` to include your production domain(s).

5. **File Uploads**: Ensure the `uploads` directory exists and has proper write permissions.

## GitHub Workflow

### For Development Updates:

```bash
# Make your changes locally
git add .
git commit -m "Your update message"
git push origin main
```

### For Hosting Company:

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Run new migrations if any
cd backend
npx prisma migrate deploy
npx prisma generate

# Rebuild applications
npm run build
cd ../frontend
npm run build

# Restart services
pm2 restart all  # or your process manager
```

## Support

For issues during deployment, check:
- Database connection string is correct
- All environment variables are set
- PostgreSQL is running and accessible
- Node.js version is 18 or higher
- Prisma migrations completed successfully

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL 14+
- **Authentication**: JWT with bcrypt password hashing
