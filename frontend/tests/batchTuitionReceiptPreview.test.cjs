const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const parser = (() => {
  try { return require('@babel/parser'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  for (const root of [process.env.TEMP, process.env.TMP].filter(Boolean)) {
    const cached = path.join(root, 'cao-intake-syntax', 'babel-parser.cjs');
    if (fs.existsSync(cached)) return require(cached);
  }
  throw new Error('Install frontend dependencies or provide the cached Babel parser to run receipt tests.');
})();
const componentSource = fs.readFileSync(path.join(__dirname, '../src/components/BatchTuitionReceiptPreview.jsx'), 'utf8');
const ast = parser.parse(componentSource, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
const globals = ast.program.body.filter(node => node.type === 'VariableDeclaration').map(node => componentSource.slice(node.start, node.end)).join('\n');
const declarations = component.body.body.filter(node => node.type !== 'ReturnStatement').map(node => componentSource.slice(node.start, node.end)).join('\n');
const stateNames = component.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations.filter(item => item.init?.callee?.name === 'useState').map(item => item.id.elements[0].name));
const sameDeps = (left, right) => left && right && left.length === right.length && left.every((item, index) => Object.is(item, right[index]));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let count = 0; count < 20; count++) await Promise.resolve(); };
const response = (type = 'application/pdf') => ({ ok: true, blob: async () => ({ type }) });

// Execute the actual preview effects with mocked hooks, document reads and URLs.
function harness(fetcher = async () => response()) {
  const states = [], refs = [], memos = [], requests = [], created = [], revoked = [];
  let stateIndex = 0, refIndex = 0, memoIndex = 0, layoutDeps, layoutCleanup, passiveDeps, passiveCleanup, pendingEffect, current;
  const context = {
    props: { token: 'SYNTHETIC-TOKEN', applicantId: 7, periodId: 9, label: 'Synthetic Scholar', active: true },
    API_BASE: '/api', AbortController, authHeaders: token => ({ Authorization: `Bearer ${token}` }),
    useState: initial => { const index = stateIndex++; states[index] ||= { value: initial }; return [states[index].value, next => { states[index].value = typeof next === 'function' ? next(states[index].value) : next; }]; },
    useRef: initial => refs[refIndex++] ||= { current: initial },
    useMemo: (callback, deps) => { const index = memoIndex++; if (!sameDeps(memos[index]?.deps, deps)) memos[index] = { value: callback(), deps }; return memos[index].value; },
    useLayoutEffect: (callback, deps) => { if (!sameDeps(layoutDeps, deps)) { layoutCleanup?.(); layoutCleanup = callback(); layoutDeps = deps; } },
    useEffect: (callback, deps) => { pendingEffect = { callback, deps }; },
    fetch: async (url, options) => { requests.push({ url, options }); return fetcher(url, options); },
    URL: { createObjectURL: blob => { const url = `blob:synthetic-receipt-${created.length + 1}`; created.push({ url, type: blob.type }); return url; }, revokeObjectURL: url => revoked.push(url) },
  };
  vm.createContext(context); vm.runInContext(globals, context);
  const factory = vm.runInContext(`(function () { const { token, applicantId, periodId, label, active = true } = props; ${declarations}\nreturn { canLoad, endpoint, currentView, currentZoom, retryPreview, setZoom }; })`, context);
  const render = props => { Object.assign(context.props, props); stateIndex = 0; refIndex = 0; memoIndex = 0; current = factory(); return current; };
  const commitEffects = () => {
    if (!sameDeps(passiveDeps, pendingEffect.deps)) { passiveCleanup?.(); passiveCleanup = pendingEffect.callback(); passiveDeps = pendingEffect.deps; }
  };
  render();
  return {
    requests, created, revoked, render, commitEffects,
    get current() { return current; },
    get state() { return Object.fromEntries(stateNames.map((name, index) => [name, states[index].value])); },
    close() { layoutCleanup?.(); passiveCleanup?.(); },
  };
}

test('preview uses the selected Scholar and period, authenticated private reads and supported document types', async () => {
  for (const type of ['application/pdf', 'image/jpeg', 'image/png']) {
    const preview = harness(async () => response(type)); preview.commitEffects(); await flush(); preview.render();
    assert.equal(preview.requests[0].url, '/api/scholars/7/tuition-receipt?academicPeriodId=9');
    assert.equal(preview.requests[0].options.cache, 'no-store');
    assert.equal(preview.requests[0].options.headers.Authorization, 'Bearer SYNTHETIC-TOKEN');
    assert.equal(preview.current.currentView.type, type); assert.equal(preview.current.currentView.url, preview.created[0].url);
    preview.close(); assert.deepEqual(preview.revoked, [preview.created[0].url]); assert.equal(preview.requests[0].options.signal.aborted, true);
  }
});

test('inactive, unauthenticated or invalid identities never fetch or expose a receipt', async () => {
  for (const props of [{ active: false }, { token: '' }, { applicantId: null }, { periodId: 0 }, { applicantId: true }, { periodId: 'invalid' }]) {
    const preview = harness(); preview.render(props); preview.commitEffects(); await flush();
    assert.equal(preview.requests.length, 0); assert.equal(preview.current.canLoad, false); assert.equal(preview.current.currentView, null);
  }
});

test('scope changes immediately hide a loaded receipt and abort/revoke it before displaying the replacement', async () => {
  for (const props of [{ applicantId: 8 }, { periodId: 10 }, { token: 'SYNTHETIC-NEW-TOKEN' }, { active: false }]) {
    const preview = harness(); preview.commitEffects(); await flush(); preview.render();
    const previousUrl = preview.current.currentView.url;
    preview.render(props); assert.equal(preview.current.currentView, null);
    preview.commitEffects(); assert.equal(preview.requests[0].options.signal.aborted, true); assert.deepEqual(preview.revoked, [previousUrl]);
    await flush(); preview.render();
    if (props.active === false) { assert.equal(preview.requests.length, 1); assert.equal(preview.current.currentView, null); }
    else assert.notEqual(preview.current.currentView.url, previousUrl);
    preview.close();
  }
});

test('delayed receipt responses cannot update state after row/period/token changes, deactivation or unmount', async () => {
  for (const props of [{ applicantId: 8 }, { periodId: 10 }, { token: 'SYNTHETIC-NEW-TOKEN' }, { active: false }, null]) {
    const gate = deferred(), preview = harness(() => gate.promise); preview.commitEffects();
    if (props) preview.render(props); else preview.close();
    gate.resolve(response()); await flush();
    assert.equal(preview.state.view, null); assert.equal(preview.created.length, 0);
    if (props) { preview.commitEffects(); preview.close(); }
  }
});

test('a slow blob read is discarded after the request scope changes', async () => {
  const gate = deferred(), preview = harness(async () => ({ ok: true, blob: () => gate.promise }));
  preview.commitEffects(); await flush(); preview.render({ applicantId: 8 });
  gate.resolve({ type: 'image/png' }); await flush();
  assert.equal(preview.state.view, null); assert.equal(preview.created.length, 0); preview.close();
});

test('missing, failed and unsafe receipts show an error without creating a document URL, and retry can recover', async () => {
  for (const failedResponse of [
    { ok: false, json: async () => ({ message: 'No tuition receipt is available for this academic period.' }) },
    { ok: false, json: async () => { throw new Error('Synthetic invalid JSON.'); } },
    response('text/html'),
  ]) {
    let calls = 0;
    const preview = harness(async () => ++calls === 1 ? failedResponse : response());
    preview.commitEffects(); await flush(); preview.render();
    assert.ok(preview.current.currentView.error); assert.equal(preview.created.length, 0);
    preview.current.retryPreview(); preview.render(); assert.equal(preview.current.currentView, null);
    preview.commitEffects(); await flush(); preview.render();
    assert.equal(preview.requests.length, 2); assert.equal(preview.current.currentView.type, 'application/pdf'); preview.close();
  }
});

test('image zoom is scoped to the selected receipt and an unrelated render does not refetch', async () => {
  const preview = harness(async () => response('image/png')); preview.commitEffects(); await flush(); preview.render();
  preview.current.setZoom({ endpoint: preview.current.endpoint, token: 'SYNTHETIC-TOKEN', percent: 200 }); preview.render(); preview.commitEffects();
  assert.equal(preview.current.currentZoom, 200); assert.equal(preview.requests.length, 1);
  preview.render({ applicantId: 8 }); assert.equal(preview.current.currentZoom, 100); preview.commitEffects(); preview.close();
});

test('reactivating the same receipt stays loading until a fresh URL replaces the revoked one', async () => {
  const gate = deferred(); let calls = 0;
  const preview = harness(() => ++calls === 1 ? response() : gate.promise);
  preview.commitEffects(); await flush(); preview.render();
  const oldUrl = preview.current.currentView.url;
  preview.render({ active: false }); preview.commitEffects();
  assert.equal(preview.current.currentView, null); assert.deepEqual(preview.revoked, [oldUrl]);
  preview.render({ active: true }); assert.equal(preview.current.currentView, null);
  preview.commitEffects(); await flush(); preview.render();
  assert.equal(preview.current.currentView, null); assert.equal(preview.requests.length, 2);
  gate.resolve(response('image/png')); await flush(); preview.render();
  assert.notEqual(preview.current.currentView.url, oldUrl); assert.equal(preview.current.currentView.type, 'image/png');
  preview.close(); assert.deepEqual(preview.revoked, preview.created.map(item => item.url));
});

test('returning A to B to A cannot redisplay the revoked A URL or accept the delayed B file', async () => {
  const pendingB = deferred(), pendingA = deferred(); let calls = 0;
  const preview = harness(() => ++calls === 1 ? response() : calls === 2 ? pendingB.promise : pendingA.promise);
  preview.commitEffects(); await flush(); preview.render();
  const oldAUrl = preview.current.currentView.url;
  preview.render({ applicantId: 8 }); preview.commitEffects();
  assert.deepEqual(preview.revoked, [oldAUrl]); assert.equal(preview.current.currentView, null);
  preview.render({ applicantId: 7 }); assert.equal(preview.current.currentView, null);
  preview.commitEffects(); assert.equal(preview.requests[1].options.signal.aborted, true);
  pendingB.resolve(response('image/png')); await flush(); preview.render();
  assert.equal(preview.current.currentView, null); assert.equal(preview.created.length, 1);
  pendingA.resolve(response('image/jpeg')); await flush(); preview.render();
  assert.notEqual(preview.current.currentView.url, oldAUrl); assert.equal(preview.current.currentView.type, 'image/jpeg');
  assert.equal(preview.requests[2].url, '/api/scholars/7/tuition-receipt?academicPeriodId=9');
  preview.close(); assert.deepEqual(preview.revoked, preview.created.map(item => item.url));
});
