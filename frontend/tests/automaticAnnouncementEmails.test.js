import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('announcement editor describes built-in delivery with no opt-out checkbox or preference payload', async () => {
  const source = await readFile(new URL('../src/AnnouncementsManagement.jsx', import.meta.url), 'utf8');
  assert.match(source, /Publishing automatically emails the selected applicants and\/or scholars/);
  assert.match(source, /Drafts and administrator-only notices do not send email/);
  assert.doesNotMatch(source, /type="checkbox"|form\.notifyEmail|notifyEmail:/);
  assert.doesNotMatch(source, /Email disabled|Notify the selected applicants and\/or scholars by email/);
  assert.match(source, /announcement\.emailDeliveries/);
});
