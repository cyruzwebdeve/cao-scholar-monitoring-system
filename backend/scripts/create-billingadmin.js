require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const email = (process.argv[2] || 'billingadmin@example.com').toLowerCase().trim();
const password = process.argv[3] || 'BillingAdmin@123';

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.admins.findFirst({ where: { email } });
  const data = { full_name: 'Billing and Payroll Administrator', email, password_hash: passwordHash, is_active: true, is_super_admin: false, role: 'billing' };
  if (existing) await prisma.admins.update({ where: { id: existing.id }, data });
  else {
    const latest = await prisma.admins.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    await prisma.admins.create({ data: { id: (latest?.id || 0) + 1, ...data } });
  }
  console.log(`Billing admin account ready: ${email}`);
  console.log(`Password: ${password}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
