require('dotenv').config();

const { verifyConnection } = require('../services/mailer');

const run = async () => {
  const result = await verifyConnection();
  if (!result.verified) {
    if (result.reason === 'mailer_not_configured') {
      const gmailApiVariables = ['GMAIL_USER', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
      const gmailSmtpVariables = ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];
      const missingApi = gmailApiVariables.filter((key) => !String(process.env[key] || '').trim());
      const missingSmtp = gmailSmtpVariables.filter((key) => !String(process.env[key] || '').trim());
      console.error(`Gmail API missing: ${missingApi.join(', ') || 'none'}.`);
      console.error(`Gmail SMTP missing: ${missingSmtp.join(', ') || 'none'}. Configure one complete method; never commit credentials.`);
    }
    console.error(`Gmail connection could not be verified (${result.reason}).`);
    process.exitCode = 1;
    return;
  }
  console.log(`Gmail connection verified successfully using ${result.provider}.`);
};

run();
