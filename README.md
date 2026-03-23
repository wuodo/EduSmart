# EduSmart - Marketing CRM System

A comprehensive marketing and CRM system for educational institutions, built with Next.js (frontend) and Node.js (backend).

## Project Structure

```
edusmart/
├── frontend/              # Next.js frontend application
│   ├── app/              # Next.js app directory
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── types/        # TypeScript type definitions
│   │   └── lib/          # Utility functions
│   └── package.json
│
└── backend/              # Node.js backend application
    ├── src/
    │   ├── controllers/  # Route controllers
    │   ├── routes/       # API routes
    │   ├── middleware/   # Custom middleware
    │   ├── utils/        # Utility functions
    │   └── lib/          # Prisma client
    ├── prisma/           # Database schema
    └── package.json
```

## Features

### Marketing & CRM
- **Inquiry Management**
  - Create, view, edit, and delete inquiries
  - Lead scoring and tagging (Hot, Warm, Cold)
  - Import via CSV, Excel, or API (Google Forms, Meta Ads)
  - Advanced filter and search functionality
  - Document attachment support
  - Lead assignment to sales team
  - Smart follow-up recommendations

- **Follow-up System**
  - Schedule and track follow-ups (calls, SMS, WhatsApp, email)
  - Follow-up comments and notes
  - Payment tracking integration
  - Automated reminders

- **Admission Letters**
  - Generate admission letters
  - Bulk letter generation
  - Reference number tracking

- **Multi-Tenant Support**
  - Separate data for multiple organizations
  - Custom branding per tenant
  - Role-based access control

- **Communication**
  - Internal chat system
  - Team collaboration
  - Inquiry tagging in messages

- **Analytics & Reports**
  - Lead conversion tracking
  - Follow-up effectiveness
  - Team performance metrics

## Tech Stack

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- Radix UI Components
- Lucide Icons
- Recharts (analytics)

### Backend
- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma ORM
- bcryptjs (authentication)
- JWT (session management)

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/edusmart.git
cd edusmart
```

2. Install dependencies:
```bash
# Install all dependencies (frontend and backend)
npm install

# Or install separately
cd frontend && npm install
cd ../backend && npm install
```

3. Set up PostgreSQL database:
```bash
# Create database
createdb edusmart

# Or using psql
psql -U postgres
CREATE DATABASE edusmart;
```

4. Set up environment variables:
```bash
# Backend
cp backend/env.example backend/.env
# Edit backend/.env with your PostgreSQL credentials and secrets

# Frontend
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local with your API URL
```

**Important:** Update the following in `backend/.env`:
- `DATABASE_URL` - Your PostgreSQL connection string
- `JWT_SECRET` - Generate a strong random secret (at least 32 characters)
- `RESET_SECRET` - Generate a different strong secret
- `CORS_ORIGINS` - Add your frontend URLs

5. Run Prisma migrations:
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

6. Seed initial data (optional):
```bash
# Create super admin user
npm run seed:superadmin

# Create tenant admin user
npm run seed:tenant-admin
```

7. Run the development servers:
```bash
# From root directory - run both frontend and backend
npm run dev

# Or run separately
npm run dev:frontend
npm run dev:backend
```

8. Open [http://localhost:3000](http://localhost:3000) to access the application.

### Default Login
- Super Admin: Check the console output after running `seed:superadmin`
- Tenant Admin: Check the console output after running `seed:tenant-admin`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 