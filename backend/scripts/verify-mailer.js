require('dotenv').config();

const { verifyConnection } = require('../services/mailer');

const run = async () => {
  const result = await verifyConnection();
  if (!result.verified) {
    console.error(`Gmail connection could not be verified (${result.reason}).`);
    process.exitCode = 1;
    return;
  }
  console.log('Gmail connection verified successfully.');
};

run();
