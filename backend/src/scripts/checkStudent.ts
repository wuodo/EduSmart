/**
 * Legacy script - Student model was removed from Prisma schema.
 * This CRM uses Inquiry -> paid registration flow instead of a Student entity.
 * Run seedSuperAdmin / seedTenantAdmin for user management.
 */
async function main() {
  console.log('checkStudent: Student model removed. Use inquiry/registration flow instead.');
  process.exit(0);
}
main();
