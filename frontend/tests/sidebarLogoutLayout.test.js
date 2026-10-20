import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server, Sidebar;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default;
});
after(async () => { await server?.close(); });

test('each staff role retains one labelled logout action outside navigation', () => {
  for (const role of ['SuperAdmin', 'BillingPayrollAdmin', 'RegularAdmin']) {
    const html = renderToStaticMarkup(createElement(Sidebar, { role, sectionAccess: ['dashboard'] }));
    assert.equal((html.match(/class="sidebar-logout"/g) || []).length, 1);
    assert.match(html, /class="sidebar-logout" type="button" aria-label="Logout"/);
    assert.match(html, /class="sidebar-logout-icon" aria-hidden="true"/);
    assert.match(html, /class="sidebar-logout-label">Logout<\/span>/);
    assert.match(html, /End your session/);
    assert.ok(html.indexOf('</nav>') < html.indexOf('class="sidebar-footer"'));
    if (role !== 'SuperAdmin') assert.doesNotMatch(html, />Reports<\/span>/);
  }
});

test('logout remains directly wired to the supplied session handler', () => {
  let calls = 0;
  const handler = () => { calls += 1; };
  const tree = Sidebar({ role: 'SuperAdmin', onLogout: handler });
  const footer = tree.props.children.find(child => child?.props?.className === 'sidebar-footer');
  const button = footer.props.children;
  assert.equal(button.props.onClick, handler);
  button.props.onClick();
  assert.equal(calls, 1);
});

test('footer remains separate from scrollable navigation with touch, focus and motion support', async () => {
  const css = await readFile(new URL('../src/components/Sidebar.css', import.meta.url), 'utf8');
  assert.match(css, /height: 100vh;\s*height: 100dvh;/);
  assert.match(css, /padding-bottom: max\(18px, env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.sidebar-nav \{[^}]*min-height: 0;[^}]*overflow-y: auto;/);
  assert.match(css, /\.sidebar-footer \{[^}]*flex-shrink: 0;[^}]*border-top:/);
  assert.match(css, /\.sidebar-logout \{[^}]*min-height: 64px;/);
  assert.match(css, /\.sidebar-logout:focus-visible \{[^}]*outline: 3px solid #fff;/);
  assert.match(css, /@media \(max-width: 960px\) \{\s*\.sidebar \{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sidebar,\s*\.sidebar-logout \{\s*transition: none;/);
});
