const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const parser = (() => {
  try { return require('@babel/parser'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  for (const root of [process.env.TEMP, process.env.TMP].filter(Boolean)) {
    const candidate = path.join(root, 'cao-intake-syntax', 'babel-parser.cjs');
    if (fs.existsSync(candidate)) return require(candidate);
  }
  throw new Error('Install frontend dependencies or provide the existing cached Babel parser to run workflow tests.');
})();
const componentSource = fs.readFileSync(path.join(__dirname, '../src/BatchScholarBillingPreparation.jsx'), 'utf8');
const ast = parser.parse(componentSource, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
const globalDeclarations = ast.program.body.filter(node => node.type === 'VariableDeclaration').map(node => componentSource.slice(node.start, node.end)).join('\n');
const declarations = component.body.body.filter(node => node.type !== 'ReturnStatement').map(node => componentSource.slice(node.start, node.end)).join('\n');
const stateNames = component.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations.filter(binding => binding.init?.callee?.name === 'useState').map(binding => binding.id.elements[0].name));
const handlers = ['loadRecords', 'changePeriod', 'selectRows', 'editTuition', 'resetDraft', 'focusRecord', 'navigateReceipt', 'handleAmountKey', 'applyAmountToSelected', 'openBilling', 'saveBatch'];
const helperSource = fs.readFileSync(path.join(__dirname, '../src/utils/batchScholarBilling.js'), 'utf8').replace(/^export /gm, '');
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let count = 0; count < 15; count++) await Promise.resolve(); };
const sameDeps = (left, right) => left && right && left.length === right.length && left.every((item, index) => Object.is(item, right[index]));
const token = 'SYNTHETIC-TOKEN';
const period = { id: 9, schoolYear: '2026-2027', semester: '1st Semester', isActive: true, isPrimary: true };
const record = id => ({ applicantId: id, academicPeriodId: 9, name: `Synthetic Scholar ${id}`, school: 'Synthetic Private School', status: 'Active', schoolType: 'Private', processRoute: 'billing', notYetIncluded: true, totalGrant: 5000, grantPrepared: false, billingEligibilityReasons: [{ code: 'GRANT_PREPARATION_REQUIRED' }] });
const grant = tuition => ({ grantPrepared: true, totalGrant: 5000, tuitionFeeAssistance: tuition, allowance: 5000 - tuition, grantPreparedAt: '2026-11-18T01:00:00.000Z' });
const response = (body, ok = true) => ({ ok, json: async () => body });

// This VM executes the component's actual handlers/effects; React/API are mocked.
function harness({ fetch: request, onPreparedRows, onOpenBilling } = {}) {
  const states = [], refs = [], callbacks = [], requests = [], handoffs = [], queueOpens = [];
  let stateIndex = 0, refIndex = 0, callbackIndex = 0, layoutDeps, layoutCleanup, effectCleanup, effectCallback;
  const context = {
    props: { token, active: true,
      onPreparedRows: async payload => { handoffs.push(plain(payload)); return onPreparedRows ? onPreparedRows(payload) : true; },
      onOpenBilling: async payload => { queueOpens.push(plain(payload)); return onOpenBilling ? onOpenBilling(payload) : true; },
    },
    API_BASE: '/api', AbortController, authHeaders: value => ({ Authorization: `Bearer ${value}` }),
    useState: initial => { const index = stateIndex++; if (!states[index]) states[index] = { value: initial }; return [states[index].value, next => { states[index].value = typeof next === 'function' ? next(states[index].value) : next; }]; },
    useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useCallback: (callback, deps) => { const index = callbackIndex++; if (!sameDeps(callbacks[index]?.deps, deps)) callbacks[index] = { callback, deps }; return callbacks[index].callback; },
    useLayoutEffect: (callback, deps) => { if (!sameDeps(layoutDeps, deps)) { layoutCleanup?.(); layoutCleanup = callback(); layoutDeps = deps; } },
    useEffect: callback => { effectCallback = callback; },
    useMemo: callback => callback(),
    fetch: async (url, options = {}) => {
      requests.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null, signal: options.signal });
      return request ? request(url, options) : response({ scholars: [record(7), record(8)], activePeriod: period, activePeriods: [period] });
    },
  };
  vm.createContext(context);
  vm.runInContext(helperSource + '\n' + globalDeclarations, context);
  const factory = vm.runInContext(`(function () { const { token, onPreparedRows, onOpenBilling, active = true } = props; ${declarations}\nreturn { ${handlers.join(', ')}, view: { filtered, statusCounts, readyCount, previewRecord, bulkTuition } }; })`, context);
  let current;
  const render = props => { if (props) Object.assign(context.props, props); stateIndex = 0; refIndex = 0; callbackIndex = 0; current = factory(); return current; };
  render();
  const set = (name, value) => { states[stateNames.indexOf(name)].value = value; };
  return {
    requests, handoffs, queueOpens, refs,
    get handlers() { return current; },
    get state() { return Object.fromEntries(stateNames.map((name, index) => [name, states[index].value])); },
    render,
    set,
    seed(records = [record(7), record(8)], selected = [7, 8]) {
      set('periodId', '9'); set('data', { periodId: '9', token, records, periods: [period], loading: false, error: '' });
      set('draftState', { periodId: '9', token, rows: Object.fromEntries(records.map(row => [row.applicantId, { tuition: row.applicantId === 7 ? '3500' : '0', preparedAt: null, dirty: true, error: '' }])) });
      set('selection', { periodId: '9', token, ids: selected }); render();
    },
    startEffect() { effectCleanup?.(); effectCleanup = effectCallback(); },
    close() { layoutCleanup?.(); effectCleanup?.(); },
  };
}

test('initial loader selects the server primary and filters the table to Private Billing records', async () => {
  const workflow = harness({ fetch: () => response({ scholars: [record(7), { ...record(8), processRoute: 'payroll' }, { ...record(9), schoolType: 'Public' }], activePeriod: period, activePeriods: [period] }) });
  await workflow.handlers.loadRecords(); workflow.render();
  assert.equal(workflow.state.periodId, '9'); assert.deepEqual(plain(workflow.state.data.records.map(row => row.applicantId)), [7]);
  assert.equal(workflow.state.draftState.rows[7].tuition, '');
  assert.equal(workflow.requests[0].method, 'GET');
});

test('one batch save preserves zero and per-Scholar tuition, merges authoritative grants, and hands off only confirmed rows', async () => {
  const workflow = harness({ fetch: (url, options) => {
    assert.equal(options.method, 'POST'); assert.equal(url, '/api/scholars/grant-preparation/batch');
    return response({ results: [{ applicantId: 7, success: true, grant: grant(3500) }, { applicantId: 8, success: true, grant: grant(0) }] });
  } });
  workflow.seed(); await workflow.handlers.saveBatch();
  assert.deepEqual(workflow.requests[0].body, { academicPeriodId: 9, entries: [{ applicantId: 7, tuitionFeeAssistance: 3500, preparedAt: null }, { applicantId: 8, tuitionFeeAssistance: 0, preparedAt: null }] });
  assert.deepEqual(plain(workflow.state.saved.ids), [7, 8]); assert.deepEqual(plain(workflow.state.selection.ids), []);
  assert.equal(workflow.state.data.records[0].allowance, 1500);
  assert.deepEqual(workflow.handoffs, [{ periodId: 9, applicantIds: [7, 8] }]);
  assert.match(workflow.state.notice.text, /Continue preparing/); assert.equal(workflow.state.saving, false);
  assert.deepEqual(workflow.queueOpens, []);
  workflow.render(); await workflow.handlers.openBilling();
  assert.deepEqual(workflow.queueOpens, [{ periodId: 9, applicantIds: [7, 8] }]);
});

test('partial failures preserve draft/error and retry sends only failed rows, retaining earlier successes', async () => {
  let calls = 0;
  const workflow = harness({ fetch: () => response({ results: ++calls === 1
    ? [{ applicantId: 7, success: true, grant: grant(3500) }, { applicantId: 8, success: false, message: 'Synthetic retry required.', statusCode: 409 }]
    : [{ applicantId: 8, success: true, grant: grant(0) }] }) });
  workflow.seed(); await workflow.handlers.saveBatch();
  assert.deepEqual(plain(workflow.state.selection.ids), [8]); assert.equal(workflow.state.draftState.rows[8].tuition, '0');
  assert.match(workflow.state.draftState.rows[8].error, /retry/); assert.deepEqual(workflow.handoffs, [{ periodId: 9, applicantIds: [7] }]);
  workflow.render(); await workflow.handlers.saveBatch();
  assert.deepEqual(workflow.requests[1].body.entries.map(entry => entry.applicantId), [8]);
  assert.deepEqual(plain(workflow.state.saved.ids), [7, 8]); assert.deepEqual(workflow.handoffs, [{ periodId: 9, applicantIds: [7] }, { periodId: 9, applicantIds: [8] }]);
  assert.deepEqual(workflow.queueOpens, []);
});

test('all-invalid selected rows prevent a request; double clicks share one save action', async () => {
  const gate = deferred(), workflow = harness({ fetch: () => gate.promise }); workflow.seed();
  workflow.handlers.editTuition(record(8), '5000.01'); workflow.render();
  workflow.handlers.editTuition(record(7), ''); workflow.render();
  await workflow.handlers.saveBatch(); assert.equal(workflow.requests.length, 0); assert.ok(workflow.state.draftState.rows[8].error);
  assert.equal(workflow.state.statusFilter, 'needs-preparation');
  workflow.handlers.editTuition(record(8), '0'); workflow.render();
  workflow.handlers.editTuition(record(7), '3500'); workflow.render();
  const first = workflow.handlers.saveBatch(), duplicate = workflow.handlers.saveBatch(); await flush();
  assert.equal(workflow.requests.length, 1);
  gate.resolve(response({ results: [{ applicantId: 7, success: true, grant: grant(3500) }, { applicantId: 8, success: true, grant: grant(0) }] }));
  await Promise.all([first, duplicate]); assert.equal(workflow.handoffs.length, 1);
});

test('an HTTP or unconfirmed save preserves selections/drafts and never navigates', async () => {
  for (const body of [response({ message: 'Synthetic network rejection.' }, false), response({ results: [] })]) {
    const workflow = harness({ fetch: () => body }); workflow.seed(); await workflow.handlers.saveBatch();
    assert.deepEqual(plain(workflow.state.selection.ids), [7, 8]); assert.equal(workflow.state.draftState.rows[7].tuition, '3500');
    assert.deepEqual(plain(workflow.state.saved.ids), []); assert.deepEqual(workflow.handoffs, []);
    assert.equal(workflow.state.notice.tone, 'error');
  }
});

test('auth change and unmount suppress save completion/handoff while accepted server writes may persist', async () => {
  for (const phase of ['auth', 'unmount']) {
    const gate = deferred(), workflow = harness({ fetch: () => gate.promise }); workflow.seed(); const saving = workflow.handlers.saveBatch();
    if (phase === 'auth') workflow.render({ token: 'SYNTHETIC-NEW-TOKEN' }); else workflow.close();
    gate.resolve(response({ results: [{ applicantId: 7, success: true, grant: grant(3500) }, { applicantId: 8, success: true, grant: grant(0) }] }));
    await saving; assert.deepEqual(workflow.handoffs, []); assert.deepEqual(plain(workflow.state.saved.ids), []);
  }
});

test('refresh preserves failed input/base timestamp; explicit saved-values reset adopts new authoritative preparation', async () => {
  const updated = { ...record(7), tuitionFeeAssistance: 2000, grantPreparedAt: '2026-11-18T02:00:00.000Z', grantPrepared: true, billingEligibilityReasons: [] };
  const workflow = harness({ fetch: () => response({ scholars: [updated, record(8)], activePeriod: period, activePeriods: [period] }) });
  workflow.seed(); await workflow.handlers.loadRecords(); workflow.render();
  assert.equal(workflow.state.draftState.rows[7].tuition, '3500'); assert.equal(workflow.state.draftState.rows[7].preparedAt, null);
  workflow.handlers.resetDraft(updated);
  assert.equal(workflow.state.draftState.rows[7].tuition, '2000'); assert.equal(workflow.state.draftState.rows[7].preparedAt, updated.grantPreparedAt);
});

test('old loader results are ignored after period changes and real effect cleanup aborts delayed reads', async () => {
  const gate = deferred(), workflow = harness({ fetch: () => gate.promise }); workflow.seed(); workflow.startEffect();
  await flush(); assert.equal(workflow.requests.length, 1);
  workflow.handlers.changePeriod('10'); workflow.render(); workflow.close();
  assert.equal(workflow.requests[0].signal.aborted, true);
  gate.resolve(response({ scholars: [record(7)], activePeriod: period, activePeriods: [period] })); await flush();
  assert.equal(workflow.state.periodId, '10'); assert.equal(workflow.state.data.periodId, '9');
});

test('only valid selected rows are submitted while invalid drafts remain in Needs preparation', async () => {
  const workflow = harness({ fetch: () => response({ results: [{ applicantId: 7, success: true, grant: grant(3500) }] }) });
  workflow.seed(); workflow.handlers.editTuition(record(8), ''); workflow.render();
  assert.equal(workflow.handlers.view.readyCount, 1);
  await workflow.handlers.saveBatch();
  assert.deepEqual(workflow.requests[0].body.entries.map(row => row.applicantId), [7]);
  assert.deepEqual(plain(workflow.state.saved.ids), [7]); assert.deepEqual(plain(workflow.state.selection.ids), [8]);
  assert.equal(workflow.state.draftState.rows[8].tuition, ''); assert.ok(workflow.state.draftState.rows[8].error);
  assert.equal(workflow.state.statusFilter, 'needs-preparation'); assert.match(workflow.state.notice.text, /1 selected row\(s\) skipped/);
  assert.deepEqual(workflow.handoffs, [{ periodId: 9, applicantIds: [7] }]); assert.deepEqual(workflow.queueOpens, []);
  workflow.render(); workflow.handlers.editTuition(record(8), '0'); workflow.render();
  assert.equal(workflow.state.draftState.rows[8].error, '');
  assert.equal(workflow.state.draftState.rows[8].attention, true);
  assert.deepEqual(plain(workflow.handlers.view.filtered.map(row => row.applicantId)), [8]);
});

test('status worklist defaults to needs preparation and counts match the current school/search scope', () => {
  const workflow = harness();
  workflow.seed([record(7), { ...record(8), grantPrepared: true, billingEligibilityReasons: [] }, { ...record(9), billed: true }, { ...record(10), school: 'Other synthetic school' }], []);
  assert.deepEqual(plain(workflow.handlers.view.filtered.map(row => row.applicantId)), [7, 10]);
  assert.deepEqual(plain(workflow.handlers.view.statusCounts), { 'needs-preparation': 2, prepared: 1 });
  workflow.set('school', 'Synthetic Private School'); workflow.set('statusFilter', 'prepared'); workflow.render();
  assert.deepEqual(plain(workflow.handlers.view.filtered.map(row => row.applicantId)), [8]);
  assert.equal(workflow.handlers.view.statusCounts['needs-preparation'], 1);
  workflow.set('query', 'Scholar 7'); workflow.render(); assert.equal(workflow.handlers.view.statusCounts.prepared, 0);
});

test('receipt focus and Previous/Next follow visible rows; Enter and Tab move between editable amounts', () => {
  const workflow = harness(), focuses = [];
  workflow.seed();
  workflow.refs.at(-1).current[7] = { focus: () => focuses.push(7) };
  workflow.refs.at(-1).current[8] = { focus: () => focuses.push(8) };
  workflow.handlers.focusRecord(record(7)); workflow.render(); assert.equal(workflow.handlers.view.previewRecord.applicantId, 7);
  workflow.handlers.navigateReceipt(1); workflow.render(); assert.equal(workflow.handlers.view.previewRecord.applicantId, 8);
  workflow.handlers.navigateReceipt(-1); workflow.render(); assert.equal(workflow.handlers.view.previewRecord.applicantId, 7);
  let prevented = 0;
  workflow.handlers.handleAmountKey({ key: 'Enter', preventDefault: () => prevented++ }, record(7)); workflow.render();
  assert.equal(workflow.handlers.view.previewRecord.applicantId, 8);
  workflow.handlers.handleAmountKey({ key: 'Tab', shiftKey: true, preventDefault: () => prevented++ }, record(8)); workflow.render();
  assert.equal(workflow.handlers.view.previewRecord.applicantId, 7);
  workflow.handlers.handleAmountKey({ key: 'Enter', preventDefault: () => prevented++ }, record(8));
  workflow.handlers.handleAmountKey({ key: 'Tab', preventDefault: () => prevented++ }, record(8));
  assert.equal(prevented, 3); assert.deepEqual(focuses, [8, 7, 8, 7]); assert.equal(workflow.requests.length, 0);
});

test('explicit bulk amount/zero preserve versions and reject amounts exceeding any selected total', () => {
  const workflow = harness();
  workflow.seed([record(7), { ...record(8), totalGrant: 2000 }]);
  workflow.set('draftState', { periodId: '9', token, rows: { 7: { tuition: '3500', preparedAt: 'original-7', dirty: true, error: '' }, 8: { tuition: '1500', preparedAt: 'original-8', dirty: false, error: '' } } }); workflow.render();
  workflow.handlers.applyAmountToSelected('2500');
  assert.equal(workflow.state.draftState.rows[7].tuition, '3500'); assert.equal(workflow.state.draftState.rows[8].tuition, '1500');
  assert.equal(workflow.state.notice.tone, 'error');
  workflow.handlers.applyAmountToSelected('1500'); workflow.render();
  assert.equal(workflow.state.draftState.rows[7].tuition, '1500'); assert.equal(workflow.state.draftState.rows[8].tuition, '1500');
  assert.equal(workflow.state.draftState.rows[7].preparedAt, 'original-7'); assert.equal(workflow.state.draftState.rows[8].preparedAt, 'original-8');
  workflow.handlers.applyAmountToSelected('0'); workflow.render();
  assert.equal(workflow.state.draftState.rows[7].tuition, '0'); assert.equal(workflow.state.draftState.rows[8].tuition, '0');
  assert.equal(workflow.handlers.view.readyCount, 2); assert.equal(workflow.requests.length, 0);
});

test('saved records survive callback rejection and explicit queue-review failures without repeat saves', async () => {
  const workflow = harness({ onPreparedRows: () => false, onOpenBilling: () => { throw new Error('Synthetic queue rejection.'); }, fetch: () => response({ results: [{ applicantId: 7, success: true, grant: grant(3500) }, { applicantId: 8, success: true, grant: grant(0) }] }) });
  workflow.seed(); await workflow.handlers.saveBatch(); workflow.render();
  assert.deepEqual(plain(workflow.state.saved.ids), [7, 8]); assert.match(workflow.state.notice.text, /Saved records remain available/);
  assert.deepEqual(workflow.queueOpens, []); await workflow.handlers.openBilling();
  assert.deepEqual(plain(workflow.state.saved.ids), [7, 8]); assert.match(workflow.state.notice.text, /remain saved/);
  assert.equal(workflow.requests.length, 1); assert.equal(workflow.state.openingBilling, false);
});

test('hidden tabs disable new actions and period changes reset bulk/receipt scope', async () => {
  const workflow = harness(); workflow.seed();
  workflow.set('bulk', { periodId: '9', token, tuition: '1500' }); workflow.handlers.focusRecord(record(7)); workflow.render();
  workflow.render({ active: false });
  workflow.handlers.applyAmountToSelected('0'); await workflow.handlers.saveBatch(); await workflow.handlers.openBilling();
  assert.equal(workflow.requests.length, 0); assert.equal(workflow.state.draftState.rows[7].tuition, '3500');
  workflow.render({ active: true }); workflow.handlers.changePeriod('10'); workflow.render();
  assert.equal(workflow.handlers.view.previewRecord, null); assert.equal(workflow.handlers.view.bulkTuition, '');
  assert.equal(workflow.state.statusFilter, 'needs-preparation');
});

test('hiding aborts management reads and reopening refreshes list status while preserving changed draft versions', async () => {
  const delayed = deferred(); let calls = 0;
  const originalVersion = '2026-11-18T01:00:00.000Z', refreshedVersion = '2026-11-18T02:00:00.000Z';
  const workflow = harness({ fetch: () => ++calls === 1 ? delayed.promise : response({
    scholars: [{ ...record(7), billed: true, grantPrepared: true, tuitionFeeAssistance: 2500, grantPreparedAt: refreshedVersion }, { ...record(8), grantPrepared: true, tuitionFeeAssistance: 1000, grantPreparedAt: refreshedVersion, billingEligibilityReasons: [] }],
    activePeriod: period, activePeriods: [period],
  }) });
  workflow.seed(); workflow.set('draftState', { periodId: '9', token, rows: {
    7: { tuition: '3500', preparedAt: originalVersion, dirty: true, error: '', attention: false },
    8: { tuition: '0', preparedAt: originalVersion, dirty: false, error: '', attention: false },
  } }); workflow.render(); workflow.startEffect(); await flush();
  assert.equal(workflow.requests.length, 1);
  workflow.render({ active: false }); workflow.startEffect();
  assert.equal(workflow.requests[0].signal.aborted, true);
  await workflow.handlers.loadRecords(); assert.equal(workflow.requests.length, 1);
  delayed.resolve(response({ scholars: [record(7), record(8)], activePeriod: period, activePeriods: [period] })); await flush();
  assert.equal(workflow.state.data.records[0].billed, undefined);
  workflow.render({ active: true }); workflow.startEffect(); await flush(); workflow.render();
  assert.equal(workflow.requests.length, 2);
  assert.equal(workflow.state.data.records[0].billed, true);
  assert.equal(workflow.state.draftState.rows[7].tuition, '3500');
  assert.equal(workflow.state.draftState.rows[7].preparedAt, originalVersion);
  assert.equal(workflow.state.draftState.rows[8].tuition, '1000');
  assert.equal(workflow.state.draftState.rows[8].preparedAt, refreshedVersion);
  assert.deepEqual(plain(workflow.handlers.view.statusCounts), { 'needs-preparation': 0, prepared: 1 });
  workflow.close();
});
