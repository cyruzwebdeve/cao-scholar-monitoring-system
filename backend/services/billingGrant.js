const PRIVATE_SCHOLAR_GRANT_AMOUNT = 5000;
const PUBLIC_SCHOLAR_GRANT_AMOUNT = 3000;
const MAX_GRANT_AMOUNT = 99999999.99;
const isPrivateSchool = (schoolType) => String(schoolType || '').trim().toLowerCase() === 'private';
const validateGrantAmount = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_GRANT_AMOUNT || value !== Math.round(value * 100) / 100) {
    throw Object.assign(new Error('Enter an amount from PHP 0 to PHP 99,999,999.99 with at most two decimal places.'), { statusCode: 400 });
  }
  return value;
};
const resolveBillingAmount = (schoolType, configuredAmount) => configuredAmount == null
  ? (isPrivateSchool(schoolType) ? PRIVATE_SCHOLAR_GRANT_AMOUNT : PUBLIC_SCHOLAR_GRANT_AMOUNT)
  : validateGrantAmount(Number(configuredAmount));
module.exports = { PRIVATE_SCHOLAR_GRANT_AMOUNT, PUBLIC_SCHOLAR_GRANT_AMOUNT, MAX_GRANT_AMOUNT, isPrivateSchool, validateGrantAmount, resolveBillingAmount };
