import { PrismaClient } from '../../generated/prisma'

// Cap connection pool to avoid exhausting Supabase free-tier limits.
// Supabase free tier: 20 direct connections; via PgBouncer pooler: safe to keep low.
const connectionLimit = Number(process.env.DATABASE_CONNECTION_LIMIT || '5')

function buildDatabaseUrl(): string | undefined {
  const base = process.env.DATABASE_URL
  if (!base) return undefined

  // Collect query params that are missing and need to be appended
  const params: string[] = []

  if (!base.includes('connection_limit=')) {
    params.push(`connection_limit=${connectionLimit}`)
  }
  if (!base.includes('pool_timeout=')) {
    params.push('pool_timeout=10')
  }
  if (!base.includes('connect_timeout=')) {
    // Allow 30s for Render free-tier cold starts before giving up on a connection
    params.push('connect_timeout=30')
  }
  // CRITICAL: Supabase uses PgBouncer (Transaction Pooler) at pooler.supabase.com.
  // Without pgbouncer=true, Prisma emits PREPARE/DEALLOCATE statements that
  // PgBouncer transaction mode resets between transactions, causing intermittent
  // "prepared statement does not exist" errors and failed DB queries.
  if (!base.includes('pgbouncer=')) {
    params.push('pgbouncer=true')
  }
  if (params.length === 0) return base
  return `${base}${base.includes('?') ? '&' : '?'}${params.join('&')}`
}

const prisma = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl() } },
})

export default prisma