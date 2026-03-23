import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * Creates or resets a tenant admin for the first active tenant.
 * Requires env vars: TENANT_ADMIN_EMAIL and TENANT_ADMIN_PASSWORD.
 */
async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
  if (!tenant) {
    console.log('No tenant found. Create a tenant first (e.g. via cpanel).');
    process.exit(1);
  }

  const email = String(process.env.TENANT_ADMIN_EMAIL || '').trim().toLowerCase();
  const passwordPlain = String(process.env.TENANT_ADMIN_PASSWORD || '');
  if (!email || !passwordPlain) {
    throw new Error('TENANT_ADMIN_EMAIL and TENANT_ADMIN_PASSWORD are required.');
  }
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, tenantId: tenant.id },
  });

  if (existing) {
    const hashed = bcrypt.hashSync(passwordPlain, 10);
    await prisma.user.update({ where: { id: existing.id }, data: { password: hashed } });
    console.log(`Password reset for ${email} in tenant "${tenant.name}" (id=${tenant.id})`);
    return;
  }

  const password = bcrypt.hashSync(passwordPlain, 10);
  await prisma.user.create({
    data: {
      email,
      password,
      role: 'admin',
      approved: true,
      name: 'Tenant Admin',
      tenantId: tenant.id,
    },
  });
  console.log(`Created ${email} for tenant "${tenant.name}" (id=${tenant.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
