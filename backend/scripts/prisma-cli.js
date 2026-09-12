const path = require('path');

const prismaPackagePath = require.resolve('prisma/package.json');
const prismaPackage = require(prismaPackagePath);

if (!prismaPackage.bin?.prisma) {
  throw new Error('The installed Prisma package does not declare a CLI executable.');
}

module.exports = path.resolve(path.dirname(prismaPackagePath), prismaPackage.bin.prisma);
