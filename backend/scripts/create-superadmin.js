require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const email = (process.argv[2] || 'superadmin@example.com').toLowerCase().trim();
const password = process.argv[3] || 'SuperAdmin@123';

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.admins.findFirst({ where: { email } });

  if (existing) {
    await prisma.admins.update({
      where: { id: existing.id },
      data: {
        password_hash: passwordHash,
        is_active: true,
        is_super_admin: true,
        role: 'admin',
      },
    });
    console.log(`Super admin account updated: ${email}`);
    console.log(`Password: ${password}`);
    return;
  }

  const latest = await prisma.admins.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  await prisma.admins.create({
    data: {
      id: (latest?.id || 0) + 1,
      full_name: 'System Administrator',
      email,
      password_hash: passwordHash,
      is_active: true,
      is_super_admin: true,
      role: 'admin',
    },
  });

  console.log('Super admin account created successfully:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((error) => {
    console.error('Unable to create super admin:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
