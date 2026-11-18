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
const helpers = ['utils/processingVisibility.js', 'utils/processingHandoff.js', 'utils/staffAccess.js', 'utils/batchBillingQueue.js']
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
  const propNames = exposed.includes('onPreparedRows') ? 'token, userId, userRole, sectionAccess'
    : "token, mode = 'billing', userId, preparedQueues = {}, reviewRequest, onPreparedQueueConsumed, onQueueBusyChange";
  const factory = vm.runInContext(`(function () { const { ${propNames} } = props; ${code}\nreturn { ${exposed.join(', ')} }; })`, context);
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
function billingHarness({ handoff = batch, fetcher = () => response(body()), preparedQueues = {} } = {}) {
  const { text, body: statements } = component('BillingPayrollManagement.jsx', 'BillingPayrollWorkspace');
  const nodes = statements.slice(0, statements.findIndex(node => declarationName(node) === 'loadRecords') + 1);
  const stateNames = nodes.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations.filter(item => item.init?.callee?.name === 'useState').map(item => item.id.elements[0]?.name));
  const consumed = [];
  const workflow = harness(nodes.map(node => text.slice(node.start, node.end)).join('\n'), stateNames, { token: 'SYNTHETIC-TOKEN', userId: 99, preparedQueues, onPreparedQueueConsumed: value => consumed.push(plain(value)) }, ['loadRecords'], fetcher);
  workflow.consumed = consumed;
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

function preparationHarness() {
  const { text, body: nodes } = component('BillingPayrollManagement.jsx', 'BillingPreparationWorkspace');
  const chosen = nodes.filter(node => node.type !== 'ReturnStatement');
  const stateNames = chosen.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations.filter(item => item.init?.callee?.name === 'useState').map(item => item.id.elements[0]?.name));
  const workflow = harness(chosen.map(node => text.slice(node.start, node.end)).join('\n'), stateNames,
    { token: 'SYNTHETIC-TOKEN', userId: 99, userRole: 'RegularAdmin', sectionAccess: ['billing'] }, ['onPreparedRows', 'onOpenBilling', 'onPreparedQueueConsumed'], () => { throw new Error('Staging must not fetch.'); });
  workflow.render(); return workflow;
}

test('successes stage per period without navigation and accumulate beyond the per-save limit', () => {
  const workflow = preparationHarness(); workflow.set('section', 'preparation'); workflow.render();
  assert.equal(workflow.handlers.onPreparedRows({ periodId: 9, applicantIds: Array.from({ length: 100 }, (_, i) => i + 1) }), true);
  workflow.render(); assert.equal(workflow.handlers.onPreparedRows({ periodId: 9, applicantIds: [101, 102] }), true);
  workflow.render(); assert.equal(workflow.handlers.onPreparedRows({ periodId: 10, applicantIds: [103] }), true);
  assert.equal(workflow.state.section, 'preparation'); assert.equal(workflow.store.size, 0);
  assert.equal(workflow.state.preparedState.requests[9].applicantIds.length, 102);
  assert.deepEqual(plain(workflow.state.preparedState.requests[10].applicantIds), [103]);
  workflow.render(); assert.equal(workflow.handlers.onOpenBilling({ periodId: 9, applicantIds: Array.from({ length: 102 }, (_, i) => i + 1) }), true);
  assert.equal(workflow.state.section, 'lists'); assert.equal(workflow.state.reviewRequest.periodId, 9);
});

test('stale callbacks cannot stage after auth/actor/access changes or unmount; hidden saves never navigate', () => {
  for (const change of ['tab', 'token', 'actor', 'access', 'busy', 'unmount']) {
    const workflow = preparationHarness(); workflow.set('section', 'preparation'); workflow.render();
    const completion = workflow.handlers.onPreparedRows, review = workflow.handlers.onOpenBilling;
    if (change === 'tab') { workflow.set('section', 'lists'); workflow.render(); }
    if (change === 'token') workflow.render({ token: 'SYNTHETIC-NEW-TOKEN' });
    if (change === 'actor') workflow.render({ userId: 100 });
    if (change === 'access') workflow.render({ sectionAccess: ['scholars'] });
    if (change === 'busy') { workflow.set('queueBusy', true); workflow.render(); }
    if (change === 'unmount') workflow.close();
    assert.equal(completion({ periodId: 9, applicantIds: [7, 8] }), ['tab', 'busy'].includes(change), change);
    assert.equal(review({ periodId: 9, applicantIds: [7, 8] }), false, change);
    assert.equal(workflow.store.size, 0); assert.deepEqual(workflow.navigations, []);
  }
});

test('acknowledging an older request cannot remove newer successes in the same period', () => {
  const workflow = preparationHarness(); workflow.handlers.onPreparedRows({ periodId: 9, applicantIds: [7] }); workflow.render();
  const first = workflow.state.preparedState.requests[9].requestId;
  workflow.handlers.onPreparedRows({ periodId: 9, applicantIds: [8] }); workflow.render();
  workflow.handlers.onPreparedQueueConsumed({ periodId: 9, requestId: first });
  assert.deepEqual(plain(workflow.state.preparedState.requests[9].applicantIds), [7, 8]);
  workflow.handlers.onPreparedQueueConsumed({ periodId: 9, requestId: workflow.state.preparedState.requests[9].requestId });
  assert.deepEqual(plain(workflow.state.preparedState.requests), {});
});

const pendingQueue = (periodId = 9, applicantIds = [7, 8], requestId = 1) => ({ periodId, applicantIds, actorId: 99, requestId });

test('same-period prepared rows merge into an existing queue after a fresh read and acknowledge their version', async () => {
  const workflow = billingHarness({ handoff: null }); workflow.set('selectedPeriodId', '9'); workflow.set('queuedIds', [10]); workflow.render({ preparedQueues: { 9: pendingQueue() } });
  await workflow.handlers.loadRecords();
  assert.deepEqual(plain(workflow.state.queuedIds), [10, 7, 8]);
  assert.deepEqual(workflow.consumed, [{ periodId: 9, requestId: 1 }]);
});

test('other-period preparations stay staged until Review explicitly switches the period, once', async () => {
  const workflow = billingHarness({ handoff: null, fetcher: url => response(url.includes('academicPeriodId=10') ? body([record(8, { academicPeriodId: 10 })], 10) : body()) });
  workflow.set('selectedPeriodId', '9'); workflow.set('queuedIds', [7]); workflow.render({ preparedQueues: { 10: pendingQueue(10, [8]) } });
  await workflow.handlers.loadRecords(); assert.equal(workflow.state.selectedPeriodId, '9'); assert.deepEqual(plain(workflow.state.queuedIds), [7]); assert.deepEqual(workflow.consumed, []);
  workflow.render({ reviewRequest: { periodId: 10, actorId: 99, token: 'SYNTHETIC-TOKEN', requestId: 1 } }); workflow.render();
  await workflow.handlers.loadRecords(); assert.deepEqual(plain(workflow.state.queuedIds), [8]); assert.equal(workflow.state.selectedPeriodId, '10');
  workflow.set('selectedPeriodId', '9'); workflow.render(); assert.equal(workflow.state.selectedPeriodId, '9');
});

test('pending staged requests survive failures and are deferred while generation or amount editing is busy', async () => {
  for (const busyState of ['processing', 'editingAmount', 'routingApplicant']) {
    let fail = true;
    const workflow = billingHarness({ handoff: null, fetcher: () => fail ? response({ message: 'Synthetic read error.' }, false) : response(body()) });
    workflow.set('selectedPeriodId', '9'); workflow.render({ preparedQueues: { 9: pendingQueue() } });
    await workflow.handlers.loadRecords(); assert.deepEqual(workflow.consumed, []);
    fail = false; workflow.set(busyState, busyState === 'processing' ? true : { applicantId: 10 }); workflow.render();
    await workflow.handlers.loadRecords(); assert.deepEqual(plain(workflow.state.queuedIds), []); assert.deepEqual(workflow.consumed, []);
    workflow.set(busyState, busyState === 'processing' ? false : null); workflow.render();
    await workflow.handlers.loadRecords(); assert.deepEqual(plain(workflow.state.queuedIds), [7, 8]); assert.equal(workflow.consumed.length, 1);
  }
});

test('a newer staged revision or processing start invalidates in-flight reads and retained loaders', async () => {
  for (const change of ['revision', 'processing']) {
    const gate = deferred(), workflow = billingHarness({ handoff: null, fetcher: () => gate.promise });
    workflow.set('selectedPeriodId', '9'); workflow.render({ preparedQueues: { 9: pendingQueue() } });
    const old = workflow.handlers.loadRecords, pending = old();
    if (change === 'revision') workflow.render({ preparedQueues: { 9: pendingQueue(9, [7, 8, 10], 2) } });
    else { workflow.set('processing', true); workflow.render(); }
    gate.resolve(response(body())); await pending; await old();
    assert.deepEqual(plain(workflow.state.queuedIds), []); assert.deepEqual(workflow.consumed, []); assert.equal(workflow.requests.length, 1);
  }
});

test('a cumulative queue over 100 rereads eligibility and filters listed/unprepared rows', async () => {
  const ids = Array.from({ length: 102 }, (_, i) => i + 1);
  const workflow = billingHarness({ handoff: null, fetcher: () => response(body(ids.map(id => record(id, { billed: id === 101, grantPrepared: id !== 102 })))) });
  workflow.set('selectedPeriodId', '9'); workflow.render({ preparedQueues: { 9: pendingQueue(9, ids) } }); await workflow.handlers.loadRecords();
  assert.equal(workflow.state.queuedIds.length, 100); assert.equal(workflow.consumed.length, 1);
  assert.match(workflow.state.operationNotice.text, /2 record\(s\) are no longer eligible/);
});
