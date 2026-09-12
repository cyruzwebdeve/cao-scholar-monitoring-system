const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeFacebookPostUrl } = require('../services/announcementLinks');

test('accepts official Facebook HTTPS links and removes fragments', () => {
  assert.equal(
    normalizeFacebookPostUrl('https://www.facebook.com/official.page/posts/123#comments'),
    'https://www.facebook.com/official.page/posts/123',
  );
});

test('accepts supported Facebook mobile and web hosts', () => {
  assert.equal(normalizeFacebookPostUrl('https://m.facebook.com/story.php?id=1'), 'https://m.facebook.com/story.php?id=1');
  assert.equal(normalizeFacebookPostUrl('https://web.facebook.com/official/posts/2'), 'https://web.facebook.com/official/posts/2');
});

test('rejects non-HTTPS and deceptive Facebook-like hosts', () => {
  assert.equal(normalizeFacebookPostUrl('http://facebook.com/posts/1'), null);
  assert.equal(normalizeFacebookPostUrl('https://facebook.com.example.test/posts/1'), null);
  assert.equal(normalizeFacebookPostUrl('https://example.test/facebook.com/posts/1'), null);
});

test('treats an empty value as no external link', () => {
  assert.equal(normalizeFacebookPostUrl(''), null);
  assert.equal(normalizeFacebookPostUrl(null), null);
});
