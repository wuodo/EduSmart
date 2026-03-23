import { PrismaClient } from '../../generated/prisma';

async function main() {
	const prisma = new PrismaClient();
	const tenant = (process.env.TENANT || '').trim();
	if (!tenant) {
		console.error('TENANT env required. Use subdomain/name used in tenants.subdomain');
		process.exit(1);
	}
	const t = await prisma.tenant.findFirst({ where: { OR: [{ subdomain: { equals: tenant } }, { name: { equals: tenant } }] } });
	if (!t) {
		console.error(`Tenant not found: ${tenant}`);
		process.exit(1);
	}
	const tenantId = t.id;
	console.log(`Clearing data for tenant '${tenant}' (id=${tenantId})...`);

	// Order matters due to FKs
	await prisma.followupComment.deleteMany({ where: { followup: { tenantId } } });
	await prisma.followup.deleteMany({ where: { tenantId } });
	await prisma.inquiryDetail.deleteMany({ where: { inquiry: { tenantId } } });
	await prisma.inquiry.deleteMany({ where: { tenantId } });
	await prisma.task.deleteMany({ where: { tenantId } });

	console.log('Done.');
	await prisma.$disconnect();
}

main().catch(async (e) => {
	console.error(e);
	process.exit(1);
});





