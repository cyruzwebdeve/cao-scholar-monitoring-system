const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2/callback`;
const OUTPUT_PATH = path.resolve(__dirname, '../.env.gmail.generated');

const credentialsPath = process.argv[2];
if (!credentialsPath) {
  console.error('Usage: npm run gmail:authorize -- "C:\\path\\to\\downloaded-client.json"');
  process.exit(1);
}

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsPath), 'utf8'));
} catch (error) {
  console.error(`Unable to read the OAuth client JSON: ${error.message}`);
  process.exit(1);
}

const client = credentials.installed || credentials.web;
if (!client?.client_id || !client?.client_secret) {
  console.error('The selected file is not a valid Google OAuth client JSON file.');
  process.exit(1);
}

const state = crypto.randomBytes(24).toString('base64url');
const verifier = crypto.randomBytes(64).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authorizationUrl.search = new URLSearchParams({
  client_id: client.client_id,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: GMAIL_SEND_SCOPE,
  access_type: 'offline',
  prompt: 'consent',
  include_granted_scopes: 'true',
  state,
  code_challenge: challenge,
  code_challenge_method: 'S256',
}).toString();

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, REDIRECT_URI);
  if (requestUrl.pathname !== '/oauth2/callback') {
    res.writeHead(404).end('Not found');
    return;
  }

  if (requestUrl.searchParams.get('state') !== state) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Invalid OAuth state. Close this tab and try again.');
    return;
  }

  const authorizationError = requestUrl.searchParams.get('error');
  const code = requestUrl.searchParams.get('code');
  if (authorizationError || !code) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Google authorization failed: ${authorizationError || 'missing code'}`);
    server.close();
    return;
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: client.client_id,
        client_secret: client.client_secret,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.refresh_token) {
      throw new Error(tokens.error_description || tokens.error || 'Google did not return a refresh token.');
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`
      <h1>PGCEAP Gmail authorization completed</h1>
      <p>You can close this browser tab and return to the terminal.</p>
    `);
    const output = [
      `GMAIL_CLIENT_ID=${client.client_id}`,
      `GMAIL_CLIENT_SECRET=${client.client_secret}`,
      `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`,
      '',
    ].join('\n');
    fs.writeFileSync(OUTPUT_PATH, output, { encoding: 'utf8', mode: 0o600 });
    console.log('\nAuthorization completed successfully.');
    console.log(`Credentials were saved to the git-ignored local file: ${OUTPUT_PATH}`);
    console.log('Open that file locally, copy its values directly to Render, and then delete it.');
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Token exchange failed. Return to the terminal for details.');
    console.error(`Token exchange failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Open this URL in your browser and authorize the sender Gmail account:\n');
  console.log(authorizationUrl.toString());
  console.log('\nWaiting for Google to redirect back to this computer...');
});

server.on('error', (error) => {
  console.error(`Unable to start the local OAuth callback on port ${PORT}: ${error.message}`);
  process.exit(1);
});

setTimeout(() => {
  console.error('\nAuthorization timed out. Run the command again when ready.');
  server.close();
  process.exitCode = 1;
}, 10 * 60 * 1000).unref();
