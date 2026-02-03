import { prisma } from '../models/prisma';

async function checkOrganizations() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: { id: 'asc' }
  });

  console.log('Organizations:');
  console.table(orgs);

  await prisma.$disconnect();
}

checkOrganizations();
