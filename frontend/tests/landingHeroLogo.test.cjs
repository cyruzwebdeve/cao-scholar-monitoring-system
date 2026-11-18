const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pageSource = fs.readFileSync(path.join(__dirname, '../src/LandingPage.jsx'), 'utf8');
const styleSource = fs.readFileSync(path.join(__dirname, '../src/styles/landing.css'), 'utf8');

test('landing hero uses the responsive CAO seal instead of the community photo', () => {
  assert.match(pageSource, /import caologoHero from '\.\/assets\/caologo-512\.webp';/);
  assert.match(pageSource, /import caologoHeroLarge from '\.\/assets\/caologo-1024\.webp';/);
  assert.match(pageSource, /srcSet=\{`\$\{caologoHero\} 512w, \$\{caologoHeroLarge\} 1024w`\}/);
  assert.match(pageSource, /alt="Community Affairs Office seal"/);
  assert.doesNotMatch(pageSource, /landing-community-|landing-photo-shade|landing-photo-caption/);
});

test('landing hero keeps the full circular seal visible across responsive layouts', () => {
  const logoRule = styleSource.match(/\.landing-hero-logo\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(logoRule, /object-fit:\s*contain/);
  assert.match(logoRule, /border-radius:\s*50%/);
  assert.match(styleSource, /\.landing-logo-frame\s*\{/);
  assert.doesNotMatch(styleSource, /\.landing-photo-(?:frame|shade|caption)/);
});
