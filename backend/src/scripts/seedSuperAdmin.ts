import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const passwordPlain = String(process.env.SUPERADMIN_PASSWORD || '');
  if (!email || !passwordPlain) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required.');
  }
  const password = bcrypt.hashSync(passwordPlain, 10);

  const existing = await prisma.user.findFirst({ where: { email, tenantId: null } });
  if (existing) {
    console.log('Super admin already exists.');
    return;
  }
  await prisma.user.create({
    data: {
      email,
      password,
      role: 'admin' as any,
      approved: true,
      tenantId: null,
    }
  });
  console.log('Super admin created:', email);
}

main().then(()=>process.exit(0)).catch((e)=>{ console.error(e); process.exit(1); });




