const PRIVATE_SCHOLAR_GRANT_AMOUNT = 5000;
const PUBLIC_SCHOLAR_GRANT_AMOUNT = 3000;

const isPrivateSchool = (schoolType) => String(schoolType || '').trim().toLowerCase() === 'private';

const resolveBillingAmount = (schoolType, configuredAmount) => {
  if (isPrivateSchool(schoolType)) return PRIVATE_SCHOLAR_GRANT_AMOUNT;
  return PUBLIC_SCHOLAR_GRANT_AMOUNT;
};

module.exports = { PRIVATE_SCHOLAR_GRANT_AMOUNT, PUBLIC_SCHOLAR_GRANT_AMOUNT, isPrivateSchool, resolveBillingAmount };
