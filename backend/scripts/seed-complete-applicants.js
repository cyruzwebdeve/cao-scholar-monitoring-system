require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const PASSWORD = 'Applicant@2026';
const SCHOOL_YEAR = '2026-2027';

const applicants = [
  { first: 'Andrea', middle: 'Mae', last: 'Flores', gender: 'Female', birthDate: '2007-01-18', municipality: 'Daet', barangay: 'Gubat', street: '18 Mabini Street', school: 'University of Camarines Norte, Main Campus', course: 'Bachelor of Science in Information Systems', yearLevel: '1st Year' },
  { first: 'Joshua', middle: 'Reyes', last: 'Lim', gender: 'Male', birthDate: '2006-03-09', municipality: 'Labo', barangay: 'Cabay', street: '42 Rizal Avenue', school: 'Mabini Colleges, Inc.', course: 'Bachelor of Science in Accountancy', yearLevel: '2nd Year' },
  { first: 'Camille', middle: 'Santos', last: 'Rivera', gender: 'Female', birthDate: '2005-05-27', municipality: 'Mercedes', barangay: 'Poblacion', street: '7 Quezon Street', school: 'University of Camarines Norte, Main Campus', course: 'Bachelor of Secondary Education', yearLevel: '3rd Year' },
  { first: 'Nathaniel', middle: 'Cruz', last: 'Bautista', gender: 'Male', birthDate: '2007-02-14', municipality: 'Vinzons', barangay: 'Calangcawan Norte', street: '25 Bonifacio Road', school: 'Camarines Norte State College, Entienza Campus', course: 'Bachelor of Science in Agriculture', yearLevel: '1st Year' },
  { first: 'Princess', middle: 'Garcia', last: 'Mendoza', gender: 'Female', birthDate: '2006-08-03', municipality: 'Basud', barangay: 'Mampili', street: '11 Maharlika Highway', school: 'University of Camarines Norte, Main Campus', course: 'Bachelor of Science in Nursing', yearLevel: '2nd Year' },
  { first: 'Mark', middle: 'Navarro', last: 'Villareal', gender: 'Male', birthDate: '2005-11-21', municipality: 'Paracale', barangay: 'Bagumbayan', street: '63 Del Pilar Street', school: 'Mabini Colleges, Inc.', course: 'Bachelor of Science in Civil Engineering', yearLevel: '3rd Year' },
  { first: 'Samantha', middle: 'Aquino', last: 'Lopez', gender: 'Female', birthDate: '2007-04-12', municipality: 'Jose Panganiban', barangay: 'Larap', street: '9 Molave Street', school: 'University of Camarines Norte, Main Campus', course: 'Bachelor of Elementary Education', yearLevel: '1st Year' },
  { first: 'Christian', middle: 'Ramos', last: 'Domingo', gender: 'Male', birthDate: '2006-06-30', municipality: 'Talisay', barangay: 'San Isidro', street: '31 Luna Street', school: 'Camarines Norte State College, Entienza Campus', course: 'Bachelor of Science in Fisheries', yearLevel: '2nd Year' },
  { first: 'Bianca', middle: 'Dela Cruz', last: 'Castillo', gender: 'Female', birthDate: '2005-09-16', municipality: 'San Vicente', barangay: 'Poblacion', street: '56 Sampaguita Street', school: 'Mabini Colleges, Inc.', course: 'Bachelor of Science in Business Administration', yearLevel: '4th Year' },
  { first: 'Jerome', middle: 'Torres', last: 'Manalo', gender: 'Male', birthDate: '2006-12-05', municipality: 'Santa Elena', barangay: 'Patag Ibaba', street: '14 Narra Street', school: 'University of Camarines Norte, Main Campus', course: 'Bachelor of Science in Computer Science', yearLevel: '2nd Year' },
];

const fatherNames = ['ROBERTO', 'EDUARDO', 'ANTONIO', 'RAMON', 'ERNESTO', 'RICARDO', 'BENJAMIN', 'MANUEL', 'ARTURO', 'DANILO'];
const motherNames = ['ELENA', 'TERESA', 'LORNA', 'CECILIA', 'MERCEDES', 'PATRICIA', 'ROSARIO', 'GLORIA', 'LOURDES', 'AMELIA'];
const guardianNames = ['MARIO', 'ALMA', 'REYNALDO', 'NORA', 'FELIPE', 'CORAZON', 'RENATO', 'LILIA', 'ROGELIO', 'ESTELA'];

const nextId = async (model) => {
  const latest = await model.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  return (latest?.id || 0) + 1;
};

const requirementDocuments = (index) => {
  const uploadedAt = new Date(Date.UTC(2026, 7, 1 + index, 2, 30)).toISOString();
  return {
    requirements: {
      cor: { fileName: `complete-${index}-registration.pdf`, fileType: 'application/pdf', status: 'Submitted', uploadedAt },
      indigency: { fileName: `complete-${index}-indigency.pdf`, fileType: 'application/pdf', status: 'Submitted', uploadedAt },
      valid_id: { fileName: `complete-${index}-valid-id.pdf`, fileType: 'application/pdf', status: 'Submitted', uploadedAt },
      income: { fileName: `complete-${index}-income.pdf`, fileType: 'application/pdf', status: 'Submitted', uploadedAt },
      grades: { fileName: `complete-${index}-grades.pdf`, fileType: 'application/pdf', status: 'Submitted', uploadedAt },
    },
  };
};

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  let nextApplicantId = await nextId(prisma.applicants);
  let nextAccountId = await nextId(prisma.control_accounts);

  for (let position = 0; position < applicants.length; position += 1) {
    const index = position + 1;
    const data = applicants[position];
    const email = `complete.applicant${String(index).padStart(2, '0')}@pgceap.test`;
    const fatherName = `${fatherNames[position]} ${data.last.toUpperCase()}`;
    const motherName = `${motherNames[position]} ${data.last.toUpperCase()}`;
    const guardianName = `${guardianNames[position]} ${data.last.toUpperCase()}`;
    const identity = {
      firstName: data.first.toUpperCase(),
      middleName: data.middle.toUpperCase(),
      familyName: data.last.toUpperCase(),
      nameExtension: '',
      email,
      mobile: `0918${String(1000000 + index).slice(-7)}`,
      birthday: data.birthDate,
      birthplace: `${data.municipality}, Camarines Norte`,
      sex: data.gender,
      civilStatus: 'Single',
    };
    const address = { houseNumber: data.street, municipality: data.municipality, barangay: data.barangay };
    const schoolPlan = { school: data.school, course: data.course, incomingYearLevel: data.yearLevel };
    const family = {
      fatherName,
      fatherOccupation: index % 2 ? 'Farmer' : 'Driver',
      motherName,
      motherOccupation: index % 2 ? 'Vendor' : 'Homemaker',
      guardianName,
      guardianOccupation: 'Government Employee',
      familyIncome: index % 2 ? 'Below ₱50,000' : '₱50,000 - ₱100,000',
      gwa: (1.25 + position * 0.05).toFixed(2),
      brothersCount: String(position % 3),
      sistersCount: String((position + 1) % 3),
    };
    const eligibility = {
      graduatedHonors: index % 3 === 0 ? 'Yes' : 'No',
      championContest: index % 4 === 0 ? 'Yes' : 'No',
      alsPasser: 'No',
      pwd: 'No',
      childOfPwd: 'No',
      soloParent: 'No',
      indigenousGroup: index === 7 ? 'Yes' : 'No',
      siblingRuleAccepted: true,
    };

    let applicant = await prisma.applicants.findFirst({ where: { email } });
    const applicantData = {
      first_name: identity.firstName,
      middle_name: identity.middleName,
      last_name: identity.familyName,
      email,
      phone: identity.mobile,
      street: address.houseNumber,
      barangay: address.barangay,
      municipality: address.municipality,
      gender: identity.sex,
      date_of_birth: new Date(`${identity.birthday}T00:00:00.000Z`),
      birthplace: identity.birthplace,
      civil_status: identity.civilStatus,
      family_income: family.familyIncome,
      gwa: family.gwa,
      guardians: JSON.stringify({ fatherName, motherName, guardianName }),
      siblings_boys: Number(family.brothersCount),
      siblings_girls: Number(family.sistersCount),
      status: 'pending',
      school_year: SCHOOL_YEAR,
      deleted_at: null,
      updated_at: new Date(),
    };
    if (applicant) {
      applicant = await prisma.applicants.update({ where: { id: applicant.id }, data: applicantData });
    } else {
      applicant = await prisma.applicants.create({ data: { id: nextApplicantId, ...applicantData } });
      nextApplicantId += 1;
    }

    const controlNumber = `PGCEAP-DMY-${String(index).padStart(3, '0')}`;
    const existingAccount = await prisma.control_accounts.findFirst({ where: { applicant_id: applicant.id } });
    const accountData = { control_number: controlNumber, username: email, password_hash: passwordHash, is_active: true, updated_at: new Date() };
    if (existingAccount) {
      await prisma.control_accounts.update({ where: { id: existingAccount.id }, data: accountData });
    } else {
      await prisma.control_accounts.create({ data: { id: nextAccountId, applicant_id: applicant.id, ...accountData } });
      nextAccountId += 1;
    }

    const applicationData = {
      email,
      identity,
      address,
      school_plan: schoolPlan,
      family,
      eligibility,
      initial_docs: requirementDocuments(index),
      status: 'Applied',
      updated_at: new Date(),
    };
    const existingApplication = await prisma.application_submissions.findFirst({ where: { applicant_id: applicant.id }, orderBy: { submitted_at: 'desc' } });
    if (existingApplication) {
      await prisma.application_submissions.update({ where: { id: existingApplication.id }, data: applicationData });
    } else {
      await prisma.application_submissions.create({ data: { applicant_id: applicant.id, ...applicationData } });
    }
  }

  console.log(`Seeded ${applicants.length} complete dummy applicants.`);
  console.log(`Accounts: PGCEAP-DMY-001 to PGCEAP-DMY-010 / password ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Unable to seed complete dummy applicants:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
