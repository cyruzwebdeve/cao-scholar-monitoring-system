import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist');
const entryFile = path.join(distRoot, 'index.html');
const clientRoutes = [
  'applicant-dashboard',
  'application',
  'dashboard',
  'exam',
  'examination',
  'forgot-password',
  'login',
  'privacy-policy',
  'reset-password',
  'scholar-dashboard',
  'terms-of-service',
];

await Promise.all(clientRoutes.map(async (route) => {
  const routeDirectory = path.join(distRoot, route);
  await mkdir(routeDirectory, { recursive: true });
  await copyFile(entryFile, path.join(routeDirectory, 'index.html'));
}));

console.log(`Generated static fallbacks for ${clientRoutes.length} client routes.`);
