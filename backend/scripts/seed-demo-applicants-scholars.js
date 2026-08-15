require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const APPLICANT_COUNT = 30;
const SCHOLAR_COUNT = 20;
const APPLICANT_PASSWORD = 'Applicant@2026';
const SCHOLAR_PASSWORD = 'Scholar@2026';

const firstNames = ['Juan', 'Maria', 'Carlo', 'Angela', 'Daniel', 'Sofia', 'Miguel', 'Ariana', 'Gabriel', 'Bea'];
const lastNames = ['Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Dela Cruz', 'Navarro', 'Ramos', 'Villanueva', 'Aquino'];
const municipalities = ['Daet', 'Labo', 'Mercedes', 'Vinzons', 'Paracale', 'Basud'];

const getNextId = async (model) => {
  const latest = await model.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  return (latest?.id || 0) + 1;
};

const findOrCreate = async (model, where, createData, updateData = {}) => {
  const existing = await model.findFirst({ where });
  if (existing) {
    return model.update({ where: { id: existing.id }, data: updateData });
  }
  return model.create({ data: createData });
};

async function main() {
  const applicantPasswordHash = await bcrypt.hash(APPLICANT_PASSWORD, 12);
  const scholarPasswordHash = await bcrypt.hash(SCHOLAR_PASSWORD, 12);
  let nextApplicantId = await getNextId(prisma.applicants);
  let nextControlAccountId = await getNextId(prisma.control_accounts);
  let nextScholarAccountId = await getNextId(prisma.scholar_accounts);
  const applicantIds = [];

  for (let index = 1; index <= APPLICANT_COUNT; index += 1) {
    const firstName = firstNames[(index - 1) % firstNames.length];
    const lastName = lastNames[(index - 1) % lastNames.length];
    const email = `demo.applicant${String(index).padStart(2, '0')}@pgceap.test`;
    const applicant = await findOrCreate(
      prisma.applicants,
      { email },
      {
        id: nextApplicantId++,
        first_name: firstName,
        middle_name: 'Demo',
        last_name: lastName,
        email,
        phone: `09${String(170000000 + index)}`,
        street: `${index} PGCEAP Avenue`,
        barangay: `Barangay ${((index - 1) % 10) + 1}`,
        municipality: municipalities[(index - 1) % municipalities.length],
        gender: index % 2 === 0 ? 'Female' : 'Male',
        date_of_birth: new Date(`200${index % 6}-0${(index % 8) + 1}-15T00:00:00.000Z`),
        birthplace: 'Camarines Norte',
        civil_status: 'Single',
        family_income: index % 3 === 0 ? 'low' : 'below_poverty_line',
        gwa: (1.75 + (index % 8) * 0.1).toFixed(2),
        guardians: `Demo Guardian ${index}`,
        siblings_boys: index % 4,
        siblings_girls: (index + 1) % 4,
        status: index <= SCHOLAR_COUNT ? 'passed' : 'pending',
        school_year: '2026-2027',
      },
      {
        first_name: firstName,
        last_name: lastName,
        status: index <= SCHOLAR_COUNT ? 'passed' : 'pending',
      },
    );
    applicantIds.push(applicant.id);

    const isScholar = index <= SCHOLAR_COUNT;
    const controlNumber = `PGCEAP-${isScholar ? 'SCH' : 'APP'}-${String(index).padStart(3, '0')}`;
    const username = `demo_${isScholar ? 'scholar' : 'applicant'}${String(index).padStart(2, '0')}`;
    const passwordHash = isScholar ? scholarPasswordHash : applicantPasswordHash;

    await findOrCreate(
      prisma.control_accounts,
      { applicant_id: applicant.id },
      {
        id: nextControlAccountId++,
        applicant_id: applicant.id,
        control_number: controlNumber,
        username,
        password_hash: passwordHash,
        is_active: true,
      },
      { control_number: controlNumber, username, password_hash: passwordHash, is_active: true },
    );

    if (isScholar) {
      await findOrCreate(
        prisma.scholar_accounts,
        { applicant_id: applicant.id },
        {
          id: nextScholarAccountId++,
          applicant_id: applicant.id,
          scholar_id: `SCHOLAR-${String(index).padStart(4, '0')}`,
          is_active: true,
          notes: 'Demo scholar account',
        },
        { scholar_id: `SCHOLAR-${String(index).padStart(4, '0')}`, is_active: true },
      );
    }
  }

  console.log(`Seeded ${applicantIds.length} applicants and ${SCHOLAR_COUNT} scholars.`);
  console.log(`Applicant accounts: PGCEAP-APP-021 to PGCEAP-APP-030 / password ${APPLICANT_PASSWORD}`);
  console.log(`Scholar accounts: PGCEAP-SCH-001 to PGCEAP-SCH-020 / password ${SCHOLAR_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Unable to seed demo applicants and scholars:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
