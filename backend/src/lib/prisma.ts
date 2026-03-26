import { PrismaClient } from '../../generated/prisma'

// Cap connection pool to avoid exhausting Supabase free-tier limits (max 20 direct connections).
// Override via DATABASE_CONNECTION_LIMIT env var if needed.
const connectionLimit = Number(process.env.DATABASE_CONNECTION_LIMIT || '5')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.includes('connection_limit')
          ? process.env.DATABASE_URL
          : `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&pool_timeout=10`
        : undefined,
    },
  },
})

export default prisma