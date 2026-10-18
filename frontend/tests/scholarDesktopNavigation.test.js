import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { currentScholarSection, scholarSections } from '../src/utils/scholarSectionNavigation.js';
let server, Navigation;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  Navigation = (await server.ssrLoadModule('/src/components/ScholarDesktopNavigation.jsx')).default;
});
after(async () => { await server?.close(); });
test('desktop navigation has five meaningful in-page destinations and an accessible current-section indicator', () => {
  const html = renderToStaticMarkup(createElement(Navigation));
  assert.match(html, /aria-label="Scholar portal sections"/);
  assert.equal((html.match(/<a /g) || []).length, 5);
  for (const section of scholarSections) { assert.ok(html.includes(`href="#${section.id}"`)); assert.ok(html.includes(section.label)); }
  assert.equal((html.match(/aria-current="location"/g) || []).length, 1);
  assert.match(html, /href="#scholar-overview" aria-current="location"/);
});
test('scroll tracking follows actual visual positions rather than an assumed DOM order', () => {
  const positions = [{ id: 'requirements', top: 900 }, { id: 'scholar-summary', top: 100 }, { id: 'scholar-overview', top: -100 }, { id: 'scholar-updates', top: 500 }];
  assert.equal(currentScholarSection(positions, 160), 'scholar-summary');
  assert.equal(currentScholarSection(positions, 520), 'scholar-updates');
  assert.equal(currentScholarSection(positions, -200), 'scholar-overview');
  assert.equal(currentScholarSection(positions, 160, true), 'requirements');
  assert.equal(currentScholarSection([], 160), 'scholar-overview');
  assert.equal(currentScholarSection([{ id: 'bad', top: NaN }], 160), 'scholar-overview');
});
test('desktop rail reserves its own column, collapses for smaller desktops and stays hidden on phones', async () => {
  const css = await readFile(new URL('../src/styles/scholar-desktop-navigation.css', import.meta.url), 'utf8');
  for (const text of ['display: none', '@media (min-width: 761px)', '@media (min-width: 1024px)', 'grid-template-columns: 140px minmax(0, 1fr)', 'position: sticky', 'a::before', 'a::after', 'aria-current="location"', ':focus-visible', 'flex-wrap: wrap']) assert.ok(css.includes(text), text);
  assert.doesNotMatch(css, /scroll-behavior:\s*smooth/);
});
test('desktop integration preserves mobile quick links and existing workflows and handles dynamic content cleanup', async () => {
  const source = await readFile(new URL('../src/ScholarDashboard.jsx', import.meta.url), 'utf8');
  for (const text of ['application && <ScholarDesktopNavigation', 'application && <ScholarMobileNavigation', 'id="scholar-overview"', 'id="scholar-summary"', 'id="requirements"', 'requirementsSubmissionClosed || loadingRequirements || Boolean(uploadingRequirement)']) assert.ok(source.includes(text), text);
  const next = await readFile(new URL('../src/components/ScholarNextStep.jsx', import.meta.url), 'utf8'); assert.match(next, /id="scholar-next-step"/);
  const nav = await readFile(new URL('../src/components/ScholarDesktopNavigation.jsx', import.meta.url), 'utf8');
  for (const text of ["passive: true", 'window.requestAnimationFrame', 'window.cancelAnimationFrame', "removeEventListener('scroll'", 'ResizeObserver', 'observer?.disconnect()', 'media.matches']) assert.ok(nav.includes(text), text);
  assert.doesNotMatch(nav, /fetch\(|API_BASE|authHeaders|localStorage/);
});


test('wide desktop rail stays fixed at the left viewport centre and remains scrollable on short screens', async () => {
  const css = await readFile(new URL('../src/styles/scholar-desktop-navigation.css', import.meta.url), 'utf8');
  const wide = css.split('@media (min-width: 1024px)')[1];
  const rail = wide.match(/\.scholar-dashboard \.scholar-desktop-navigation \{([^}]+)\}/)[1];
  for (const rule of ['position: fixed', 'top: 50%', 'transform: translateY(-50%)', 'left: max(28px, calc((100vw - 1280px) / 2))', 'width: 140px', 'max-height: max(44px, calc(100dvh - 160px))', 'overflow-y: auto', 'overscroll-behavior: contain', 'margin: 0']) assert.ok(rail.includes(rule), rule);
  assert.doesNotMatch(rail, /position:\s*sticky|margin:\s*120px/);
  assert.match(wide, /grid-template-columns: 140px minmax\(0, 1fr\)/);
  assert.match(css.split('@media (min-width: 1024px)')[0], /position: sticky/);
});


test('section links scroll smoothly only in Scholar Portal when reduced motion is not requested', async () => {
  const css = await readFile(new URL('../src/styles/scholar-portal-layout.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*html:has\(\.scholar-dashboard\)\s*\{\s*scroll-behavior: smooth;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*html:has\(\.scholar-dashboard\)\s*\{\s*scroll-behavior: auto !important;/);
  for (const file of ['ScholarDesktopNavigation', 'ScholarMobileNavigation', 'ScholarNextStep']) {
    const source = await readFile(new URL(`../src/components/${file}.jsx`, import.meta.url), 'utf8');
    assert.match(source, /href=/);
    assert.doesNotMatch(source, /scrollIntoView|behavior: ['"]smooth|preventDefault/);
  }
});
