const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNonNegativeNumber = (value) => typeof value === 'number' && value >= 0;
const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const { isStrongPassword } = require('../services/passwordReset');

const validateEmail = (email) => {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

const validateUppercaseName = (value) => {
  return typeof value === 'string' && /^[A-ZÑ\s.'-]+$/u.test(value.trim()) && value.trim().length > 0;
};

const validateOptionalUppercaseName = (value) => {
  return value === undefined || value === null || value === '' || validateUppercaseName(value);
};

const validateMobile = (value) => {
  return typeof value === 'string' && /^\d{1,11}$/.test(value.trim());
};

const validateDateString = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }

  const parsed = new Date(trimmed);
  return !Number.isNaN(parsed.getTime());
};

const allowedMunicipalities = [
  'Basud',
  'Capalonga',
  'Daet',
  'Jose Panganiban',
  'Labo',
  'Mercedes',
  'Paracale',
  'San Lorenzo Ruiz',
  'Talisay',
  'Others',
];

const allowedBarangays = [
  'Aguirangan',
  'Magang',
  'Bagong Silang',
  'Calintaan',
  'Poblacion',
  'San Antonio',
  'San Francisco',
  'San Vicente',
  'Others',
];

const allowedYearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate'];
const allowedSexOptions = ['Male', 'Female', 'Prefer not to say'];
const allowedCivilStatuses = ['Single', 'Married', 'Separated', 'Widowed'];
const allowedIncomeOptions = [
  'Below ₱50,000',
  '₱50,000 - ₱100,000',
  '₱100,001 - ₱150,000',
  '₱150,001 - ₱200,000',
  'Above ₱200,000',
];
const allowedCountOptions = ['0', '1', '2', '3', '4', '5+'];
const allowedYesNoOptions = ['Yes', 'No'];

const validateRegister = (req, res, next) => {
  const { email, password } = req.body;

  if (!validateEmail(email)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }

  if (!isNonEmptyString(password) || password.length < 8) {
    return res.status(400).json({ message: 'Password is required and must be at least 8 characters.' });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ message: 'Control number/email and password are required.' });
  }

  next();
};

const validatePasswordResetRequest = (req, res, next) => {
  const { identifier } = req.body;
  if (!isNonEmptyString(identifier) || identifier.trim().length > 150) {
    return res.status(400).json({ message: 'Enter a valid email address or control number.' });
  }
  next();
};

const validatePasswordReset = (req, res, next) => {
  const { token, password } = req.body;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      message: 'Use 12–128 characters with at least one uppercase letter, one lowercase letter, and one number.',
    });
  }
  next();
};

const validateCreateApplication = (req, res, next) => {
  const { email, personalInfo } = req.body;

  if (!req.user) {
    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'A valid email address is required for anonymous applications.' });
    }
  }

  if (!isPlainObject(personalInfo) || Object.keys(personalInfo).length === 0) {
    return res.status(400).json({ message: 'personalInfo is required and must be an object.' });
  }

  const { identity, address, schoolPlan, family, eligibility } = personalInfo;

  if (!isPlainObject(identity)) {
    return res.status(400).json({ message: 'identity is required and must be an object.' });
  }

  if (!validateUppercaseName(identity.firstName)) {
    return res.status(400).json({ message: 'First name must be provided in uppercase letters.' });
  }

  if (!validateUppercaseName(identity.familyName)) {
    return res.status(400).json({ message: 'Family name must be provided in uppercase letters.' });
  }

  if (!validateOptionalUppercaseName(identity.middleName)) {
    return res.status(400).json({ message: 'Middle name must be provided in uppercase letters if supplied.' });
  }

  if (!validateOptionalUppercaseName(identity.nameExtension)) {
    return res.status(400).json({ message: 'Name extension must be provided in uppercase letters if supplied.' });
  }

  if (!validateEmail(identity.email || email)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }

  if (!validateMobile(identity.mobile)) {
    return res.status(400).json({ message: 'Mobile number must contain up to 11 digits.' });
  }

  if (!validateDateString(identity.birthday)) {
    return res.status(400).json({ message: 'Birthday must be a valid date in YYYY-MM-DD format.' });
  }

  if (!isNonEmptyString(identity.birthplace)) {
    return res.status(400).json({ message: 'Birthplace is required.' });
  }

  if (!allowedSexOptions.includes(identity.sex)) {
    return res.status(400).json({ message: 'Sex must be one of the allowed options.' });
  }

  if (!allowedCivilStatuses.includes(identity.civilStatus)) {
    return res.status(400).json({ message: 'Civil status must be one of the allowed options.' });
  }

  if (!isPlainObject(address)) {
    return res.status(400).json({ message: 'address is required and must be an object.' });
  }

  if (!isNonEmptyString(address.houseNumber)) {
    return res.status(400).json({ message: 'House number or street is required.' });
  }

  if (!allowedMunicipalities.includes(address.municipality)) {
    return res.status(400).json({ message: 'Municipality is invalid.' });
  }

  // Barangays come from the complete frontend barangay dataset, so do not
  // restrict valid submissions to a small hard-coded sample list.
  if (!isNonEmptyString(address.barangay)) {
    return res.status(400).json({ message: 'Barangay is invalid.' });
  }

  if (!isPlainObject(schoolPlan)) {
    return res.status(400).json({ message: 'schoolPlan is required and must be an object.' });
  }

  // Schools and courses are real-world catalog data and must not be limited
  // by the old sample lists. Validate only when a value is supplied.
  if (schoolPlan.school !== undefined && !isNonEmptyString(schoolPlan.school)) {
    return res.status(400).json({ message: 'School is invalid.' });
  }

  if (schoolPlan.course !== undefined && !isNonEmptyString(schoolPlan.course)) {
    return res.status(400).json({ message: 'Course is invalid.' });
  }

  if (!allowedYearLevels.includes(schoolPlan.incomingYearLevel)) {
    return res.status(400).json({ message: 'Incoming year level is invalid.' });
  }

  if (!isPlainObject(family)) {
    return res.status(400).json({ message: 'family is required and must be an object.' });
  }

  if (!validateUppercaseName(family.fatherName)) {
    return res.status(400).json({ message: 'Father name must be provided in uppercase letters.' });
  }

  if (!isNonEmptyString(family.fatherOccupation)) {
    return res.status(400).json({ message: 'Father occupation is required.' });
  }

  if (!validateUppercaseName(family.motherName)) {
    return res.status(400).json({ message: 'Mother name must be provided in uppercase letters.' });
  }

  if (!isNonEmptyString(family.motherOccupation)) {
    return res.status(400).json({ message: 'Mother occupation is required.' });
  }

  if (!validateUppercaseName(family.guardianName)) {
    return res.status(400).json({ message: 'Guardian name must be provided in uppercase letters.' });
  }

  if (!isNonEmptyString(family.guardianOccupation)) {
    return res.status(400).json({ message: 'Guardian occupation is required.' });
  }

  if (!allowedIncomeOptions.includes(family.familyIncome)) {
    return res.status(400).json({ message: 'Family income is invalid.' });
  }

  const gwaValue = Number(family.gwa);
  const isPercentageGwa = gwaValue >= 0 && gwaValue <= 100;
  const isCollegeGwa = gwaValue >= 1 && gwaValue <= 5;
  if (!Number.isFinite(gwaValue) || (!isPercentageGwa && !isCollegeGwa)) {
    return res.status(400).json({ message: 'GWA must be a percentage from 0 to 100 or a college grade from 1.00 to 5.00.' });
  }

  if (!allowedCountOptions.includes(family.brothersCount)) {
    return res.status(400).json({ message: 'Brothers count is invalid.' });
  }

  if (!allowedCountOptions.includes(family.sistersCount)) {
    return res.status(400).json({ message: 'Sisters count is invalid.' });
  }

  if (!isPlainObject(eligibility)) {
    return res.status(400).json({ message: 'eligibility is required and must be an object.' });
  }

  const eligibilityFields = [
    'graduatedHonors',
    'championContest',
    'alsPasser',
    'pwd',
    'childOfPwd',
    'soloParent',
    'indigenousGroup',
  ];

  for (const field of eligibilityFields) {
    if (!allowedYesNoOptions.includes(eligibility[field])) {
      return res.status(400).json({ message: `${field} must be Yes or No.` });
    }
  }

  next();
};

const validateExamInput = (req, res, next) => {
  const { examScore } = req.body;

  if (typeof examScore !== 'number' || examScore < 0 || examScore > 100) {
    return res.status(400).json({ message: 'examScore must be a number between 0 and 100.' });
  }

  next();
};

const validateRequirements = (req, res, next) => {
  const { payoutComplianceDocs } = req.body;

  if (!isPlainObject(payoutComplianceDocs)) {
    return res.status(400).json({ message: 'payoutComplianceDocs must be an object.' });
  }

  next();
};

const validatePayrollBatch = (req, res, next) => {
  const { totalAmount } = req.body;

  if (!isNonNegativeNumber(totalAmount)) {
    return res.status(400).json({ message: 'totalAmount is required and must be a non-negative number.' });
  }

  next();
};

const validateAnnouncement = (req, res, next) => {
  const { title, content } = req.body;

  if (!isNonEmptyString(title)) {
    return res.status(400).json({ message: 'Announcement title is required.' });
  }

  if (!isNonEmptyString(content)) {
    return res.status(400).json({ message: 'Announcement content is required.' });
  }

  next();
};

const staffRoles = ['RegularAdmin', 'BillingPayrollAdmin', 'Moderator', 'SuperAdmin'];

const validateStaffFields = (req, res, next) => {
  const { fullName, email, role } = req.body;
  if (!isNonEmptyString(fullName) || fullName.trim().length < 2 || fullName.trim().length > 150) {
    return res.status(400).json({ message: 'Full name must contain between 2 and 150 characters.' });
  }
  if (!validateEmail(email) || email.trim().length > 150) {
    return res.status(400).json({ message: 'A valid staff email address is required.' });
  }
  if (!staffRoles.includes(role)) {
    return res.status(400).json({ message: `Role must be one of: ${staffRoles.join(', ')}.` });
  }
  return next();
};

const validateStaffCreate = (req, res, next) => validateStaffFields(req, res, () => {
  if (!isStrongPassword(req.body.password)) {
    return res.status(400).json({ message: 'Password must be 12-128 characters and include uppercase, lowercase, and a number.' });
  }
  return next();
});

const validateStaffUpdate = (req, res, next) => validateStaffFields(req, res, () => {
  if (typeof req.body.isActive !== 'boolean') {
    return res.status(400).json({ message: 'Account status must be active or inactive.' });
  }
  return next();
});

const validateStaffPassword = (req, res, next) => {
  if (!isNonEmptyString(req.body.currentPassword)) {
    return res.status(400).json({ message: 'Your current administrator password is required.' });
  }
  if (!isStrongPassword(req.body.newPassword)) {
    return res.status(400).json({ message: 'New password must be 12-128 characters and include uppercase, lowercase, and a number.' });
  }
  return next();
};

const validateDocumentReview = (req, res, next) => {
  const { decision, notes = '' } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ message: 'Review decision must be approved or rejected.' });
  }
  if (typeof notes !== 'string' || notes.trim().length > 500) {
    return res.status(400).json({ message: 'Review notes cannot exceed 500 characters.' });
  }
  if (decision === 'rejected' && notes.trim().length < 3) {
    return res.status(400).json({ message: 'Please explain why the document was rejected.' });
  }
  return next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateCreateApplication,
  validateExamInput,
  validateRequirements,
  validatePayrollBatch,
  validateAnnouncement,
  validateStaffCreate,
  validateStaffPassword,
  validateStaffUpdate,
  validateDocumentReview,
};
