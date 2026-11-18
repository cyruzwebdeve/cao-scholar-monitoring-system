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
  throw new Error('Install frontend dependencies or provide the cached Babel parser to run integration tests.');
})();
const source = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };
const helpers = ['utils/processingVisibility.js', 'utils/processingHandoff.js', 'utils/staffAccess.js']
  .map(name => source(name).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')).join('\n');
const declarationName = node => node.type === 'VariableDeclaration' && node.declarations[0].id.name;
function component(name, componentName) {
  const text = source(name), ast = parser.parse(text, { sourceType: 'module', plugins: ['jsx'] });
  const node = ast.program.body.map(item => item.type === 'ExportDefaultDeclaration' ? item.declaration : item)
    .find(item => item.type === 'FunctionDeclaration' && item.id.name === componentName);
  return { text, body: node.body.body };
}

// Execute the actual component loader/navigation handlers with mocked hooks and reads.
function harness(code, stateNames, props, exposed, fetcher) {
  const states = [], refs = [], effects = [], store = new Map(), navigations = [], requests = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0;
  const context = {
    props, API_BASE: '/api', authHeaders: token => ({ Authorization: `Bearer ${token}` }),
    sessionStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    useState: initial => { const index = stateIndex++; if (!states[index]) states[index] = { value: typeof initial === 'function' ? initial() : initial }; return [states[index].value, next => { states[index].value = typeof next === 'function' ? next(states[index].value) : next; }]; },
    useRef: initial => refs[refIndex++] ||= { current: initial },
    useCallback: callback => callback,
    useLayoutEffect: (callback, deps) => {
      const index = effectIndex++, previous = effects[index];
      if (!previous || !deps.every((item, i) => Object.is(item, previous.deps[i]))) {
        previous?.cleanup?.(); effects[index] = { deps, cleanup: callback() };
      }
    },
    fetch: async (url, options) => { requests.push({ url, options }); return fetcher(url, options); },
    setSelected: value => navigations.push({ selected: value }),
    onSectionChange: section => navigations.push({ section }),
  };
  vm.createContext(context); vm.runInContext(helpers, context);
  const factory = vm.runInContext(`(function () { const { token, mode = 'billing', userId, user, sectionTab } = props; ${code}\nreturn { ${exposed.join(', ')} }; })`, context);
  let handlers;
  const render = updates => { Object.assign(props, updates); stateIndex = 0; refIndex = 0; effectIndex = 0; handlers = factory(); };
  return {
    context, store, requests, navigations, render,
    get handlers() { return handlers; },
    get state() { return Object.fromEntries(stateNames.filter(Boolean).map(name => [name, states[stateNames.indexOf(name)].value])); },
    set(name, value) { states[stateNames.indexOf(name)].value = value; },
    close() { effects.forEach(effect => effect.cleanup?.()); },
  };
}
const batch = { periodId: 9, applicantIds: [7, 8, 10], actorId: 99, mode: 'billing', queuePrepared: true, createdAt: Date.now() };
const record = (id, extra = {}) => ({ id, applicantId: id, academicPeriodId: 9, name: `Synthetic Scholar ${id}`, controlNumber: `SYN-${id}`, schoolType: 'Private', processRoute: 'billing', processEligible: true, grantPrepared: true, billed: false, ...extra });
const body = (scholars = [record(7), record(8)], periodId = 9) => ({ scholars, activePeriod: { id: periodId, schoolYear: '2026-2027', semester: '1st Semester', isActive: true }, activePeriods: [] });
const response = (value, ok = true) => ({ ok, json: async () => value });
function billingHarness({ handoff = batch, fetcher = () => response(body()) } = {}) {
  const { text, body: statements } = component('BillingPayrollManagement.jsx', 'BillingPayrollWorkspace');
  const nodes = statements.slice(0, statements.findIndex(node => declarationName(node) === 'loadRecords') + 1);
  const stateNames = nodes.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations.filter(item => item.init?.callee?.name === 'useState').map(item => item.id.elements[0]?.name));
  const workflow = harness(nodes.map(node => text.slice(node.start, node.end)).join('\n'), stateNames, { token: 'SYNTHETIC-TOKEN', userId: 99 }, ['loadRecords'], fetcher);
  if (handoff) workflow.store.set('pgceap-processing-handoff', JSON.stringify(handoff));
  workflow.render(); return workflow;
}

test('Billing rereads the selected period and queues only fresh prepared eligible batch rows once', async () => {
  const workflow = billingHarness({ fetcher: () => response(body([record(7), record(8, { billed: true }), record(10, { grantPrepared: false })])) });
  await workflow.handlers.loadRecords();
  assert.match(workflow.requests[0].url, /academicPeriodId=9/);
  assert.deepEqual(plain(workflow.state.queuedIds), [7]);
  assert.match(workflow.state.operationNotice.text, /2 record\(s\) are no longer eligible/);
  assert.equal(workflow.store.size, 0); assert.equal(workflow.state.handoffBatch, null);
  workflow.render(); await workflow.handlers.loadRecords(); assert.deepEqual(plain(workflow.state.queuedIds), [7]);
});

test('legacy single-Scholar handoff still searches/highlights without automatically queuing', async () => {
  const workflow = billingHarness({ handoff: { periodId: 9, applicantId: 7, mode: 'billing', createdAt: Date.now() } });
  await workflow.handlers.loadRecords();
  assert.equal(workflow.state.query, 'SYN-7'); assert.deepEqual(plain(workflow.state.queuedIds), []);
  assert.match(workflow.state.operationNotice.text, /Synthetic Scholar 7 is loaded/); assert.equal(workflow.store.size, 0);
});

test('failed or mismatched reads retain the handoff for retry and do not queue records', async () => {
  for (const result of [response({ message: 'Synthetic read failed.' }, false), response(body([record(7)], 10))]) {
    let calls = 0;
    const workflow = billingHarness({ fetcher: () => ++calls === 1 ? result : response(body()) });
    await workflow.handlers.loadRecords(); assert.ok(workflow.state.loadError);
    assert.deepEqual(plain(workflow.state.queuedIds), []); assert.equal(workflow.store.size, 1);
    await workflow.handlers.loadRecords(); assert.equal(workflow.state.loadError, '');
    assert.deepEqual(plain(workflow.state.queuedIds), [7, 8]); assert.equal(workflow.store.size, 0);
  }
});

test('pending reads and retained callbacks cannot apply results across period/token/actor changes or unmount', async () => {
  for (const change of ['period', 'token', 'actor', 'unmount']) {
    const gate = deferred(), workflow = billingHarness({ fetcher: () => gate.promise });
    const oldLoad = workflow.handlers.loadRecords, pending = oldLoad();
    if (change === 'period') { workflow.set('selectedPeriodId', '10'); workflow.render(); }
    if (change === 'token') workflow.render({ token: 'SYNTHETIC-NEW-TOKEN' });
    if (change === 'actor') workflow.render({ userId: 100 });
    if (change === 'unmount') workflow.close();
    gate.resolve(response(body())); await pending;
    assert.deepEqual(plain(workflow.state.records), []); assert.deepEqual(plain(workflow.state.queuedIds), []);
    assert.equal(workflow.store.size, 1);
    await oldLoad(); assert.equal(workflow.requests.length, 1);
  }
});

test('a slower earlier read cannot overwrite newer data or consume the handoff twice', async () => {
  const first = deferred(), second = deferred(); let count = 0;
  const workflow = billingHarness({ fetcher: () => ++count === 1 ? first.promise : second.promise });
  const older = workflow.handlers.loadRecords(), newer = workflow.handlers.loadRecords();
  second.resolve(response(body([record(8)]))); await newer;
  first.resolve(response(body([record(7)]))); await older;
  assert.deepEqual(plain(workflow.state.records.map(item => item.applicantId)), [8]);
  assert.deepEqual(plain(workflow.state.queuedIds), [8]); assert.equal(workflow.store.size, 0);
});

function scholarHarness() {
  const { text, body: nodes } = component('ScholarsManagement.jsx', 'ScholarsManagement');
  const chosen = nodes.filter(node => ['batchBillingScopeRef', 'canPrepareBatchBilling', 'openPreparedBatchBilling'].includes(declarationName(node))
    || node.type === 'ExpressionStatement' && node.expression.callee?.name === 'useLayoutEffect' && text.slice(node.start, node.end).includes('batchBillingScopeRef.current'));
  const workflow = harness(chosen.map(node => text.slice(node.start, node.end)).join('\n'), [],
    { token: 'SYNTHETIC-TOKEN', user: { id: 99, role: 'RegularAdmin', sectionAccess: ['billing'] }, sectionTab: 'batch-billing' }, ['openPreparedBatchBilling'], () => { throw new Error('Navigation must not fetch.'); });
  workflow.render(); return workflow;
}

test('Scholars saves only an actor-bound ID handoff and opens Billing while the Batch tab is active', () => {
  const workflow = scholarHarness();
  assert.equal(workflow.handlers.openPreparedBatchBilling({ periodId: 9, applicantIds: [7, 8] }), true);
  const handoff = JSON.parse(workflow.store.get('pgceap-processing-handoff'));
  assert.deepEqual(handoff.applicantIds, [7, 8]); assert.equal(handoff.actorId, 99); assert.equal(handoff.periodId, 9);
  assert.deepEqual(workflow.navigations, [{ selected: null }, { section: 'Billing' }]);
});

test('save completion cannot navigate after tab/auth/actor/access changes or unmount', () => {
  for (const change of ['tab', 'token', 'actor', 'access', 'unmount']) {
    const workflow = scholarHarness(), completion = workflow.handlers.openPreparedBatchBilling;
    if (change === 'tab') workflow.render({ sectionTab: 'directory' });
    if (change === 'token') workflow.render({ token: 'SYNTHETIC-NEW-TOKEN' });
    if (change === 'actor') workflow.render({ user: { id: 100, role: 'RegularAdmin', sectionAccess: ['billing'] } });
    if (change === 'access') workflow.render({ user: { id: 99, role: 'RegularAdmin', sectionAccess: ['scholars'] } });
    if (change === 'unmount') workflow.close();
    assert.equal(completion({ periodId: 9, applicantIds: [7, 8] }), false, change);
    assert.equal(workflow.store.size, 0); assert.deepEqual(workflow.navigations, []);
  }
});
