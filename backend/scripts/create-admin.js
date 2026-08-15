require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const email = process.argv[2];
const password = process.argv[3];

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.admins.findFirst({ where: { email } });

  if (existing) {
    await prisma.admins.update({ where: { id: existing.id }, data: { password_hash: passwordHash, is_active: true, is_super_admin: false, role: 'admin' } });
    console.log(`Regular admin account updated: ${email}`);
    return;
  }

  const latest = await prisma.admins.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  await prisma.admins.create({ data: { id: (latest?.id || 0) + 1, full_name: 'System Administrator', email, password_hash: passwordHash, is_active: true, is_super_admin: false, role: 'admin' } });
  console.log(`Regular admin account created: ${email}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
