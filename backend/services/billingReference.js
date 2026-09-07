const createBillingReference = (processedAt = new Date()) => {
  const timestamp = processedAt instanceof Date ? processedAt : new Date(processedAt);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError('A valid billing processing timestamp is required.');
  return `BILL-${timestamp.toISOString().replace(/\D/g, '').slice(0, 17)}`;
};

module.exports = { createBillingReference };
