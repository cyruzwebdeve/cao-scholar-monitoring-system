const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadParser() {
  try { return require('@babel/parser'); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
  const temporaryRoots = [process.env.TEMP, process.env.TMP].filter(Boolean);
  const candidates = temporaryRoots.map(root => path.join(root, 'cao-intake-syntax', 'babel-parser.cjs'));
  const npmCache = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
  if (npmCache && fs.existsSync(npmCache)) {
    for (const entry of fs.readdirSync(npmCache, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(path.join(npmCache, entry.name, 'node_modules', '@babel', 'parser'));
    }
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return require(candidate);
  }
  throw new Error('The workflow tests need the installed or cached Babel parser; no dependencies are installed by this test.');
}

// Execute the actual component handlers, retaining refs across synthetic renders.
// React and the browser are mocked; the tests do not duplicate the workflow logic.
const source = fs.readFileSync(path.join(__dirname, '../src/ScholarsManagement.jsx'), 'utf8');
const ast = loadParser().parse(source, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration' && node.declaration.id?.name === 'ScholarsManagement').declaration;
const declarations = component.body.body.filter(node => node.type === 'VariableDeclaration');
const bindingNames = declaration => declaration.id.type === 'ArrayPattern'
  ? declaration.id.elements.filter(Boolean).map(element => element.name)
  : [declaration.id.name];
const relevant = declarations.filter(node => node.declarations.some(declaration => bindingNames(declaration).some(name => /certificate|certification|individualHistory|historyRequestRef/i.test(name))));
const hookStates = relevant.flatMap(node => node.declarations.filter(declaration => declaration.init?.callee?.name === 'useState').map(declaration => bindingNames(declaration)[0]));
const scopeEffect = component.body.body.find(node => node.type === 'ExpressionStatement'
  && node.expression.callee?.name === 'useLayoutEffect' && source.slice(node.start, node.end).includes('certificateScopeRef'));
const historyEffect = component.body.body.find(node => node.type === 'ExpressionStatement'
  && node.expression.callee?.name === 'useEffect' && source.slice(node.start, node.end).includes('loadIndividualCertifications'));
const handlerNames = relevant.flatMap(node => node.declarations.filter(declaration => declaration.id.type === 'Identifier'
  && (['ArrowFunctionExpression', 'FunctionExpression'].includes(declaration.init?.type) || declaration.init?.callee?.name === 'useCallback')).map(declaration => declaration.id.name));
const extracted = [...relevant, scopeEffect, historyEffect].filter(Boolean).sort((left, right) => left.start - right.start).map(node => source.slice(node.start, node.end)).join('\n');

const scholar = { id: 'scholar-34', applicantId: 34, academicPeriodId: 9, schoolType: 'Private', name: 'Synthetic Scholar' };
const snapshot = { reference: 'PGCEAP-CERT#0034', name: scholar.name, academicPeriodId: 9, schoolYear: '2026-2027', semester: '1st Semester' };
const certification = { id: 101, applicantId: 34, academicPeriodId: 9, reference: snapshot.reference, fileName: `${snapshot.reference}.pdf`, snapshot, generatedAt: '2026-11-17T09:00:00.000Z' };
const prepared = { snapshot, generatedAt: certification.generatedAt, generationToken: 'SYNTHETIC-TICKET', existingCertification: null };
const generatedPdf = { fileData: 'data:application/pdf;base64,JVBERi1TWU5USEVUSUM=', fileName: certification.fileName };
const response = (body, ok = true) => ({ ok, json: async () => body, blob: async () => ({ size: 100, type: 'application/pdf', source: 'saved-server-artifact' }) });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const plain = value => JSON.parse(JSON.stringify(value));
const sameDependencies = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));

function harness({ fetch: fetchOverride, build: buildOverride } = {}) {
  const events = [], states = [], refs = [], callbacks = [], downloads = [];
  let stateIndex = 0, refIndex = 0, callbackIndex = 0, effectCleanup, layoutDependencies;
  let historyCallback, historyCleanup, historyDependencies, historyTracking = false;
  const context = {
    env: { selected: { ...scholar }, token: 'SYNTHETIC-AUTH', billingPeriodLoading: false },
    API_BASE: '/api', certificateHeader: 'synthetic-header.png', AbortController, canUploadScholarRequirements: true,
    authHeaders: token => ({ Authorization: `Bearer ${token}` }),
    useState: initial => {
      const index = stateIndex++;
      if (!states[index]) states[index] = { value: initial };
      return [states[index].value, next => { states[index].value = typeof next === 'function' ? next(states[index].value) : next; }];
    },
    useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useCallback: (callback, dependencies) => {
      const index = callbackIndex++;
      if (!sameDependencies(callbacks[index]?.dependencies, dependencies)) callbacks[index] = { callback, dependencies };
      return callbacks[index].callback;
    },
    useLayoutEffect: (callback, dependencies) => {
      if (!sameDependencies(layoutDependencies, dependencies)) { effectCleanup?.(); effectCleanup = callback(); layoutDependencies = dependencies; }
    },
    useEffect: (callback, dependencies) => {
      historyCallback = callback;
      if (historyTracking && !sameDependencies(historyDependencies, dependencies)) { historyCleanup?.(); historyCleanup = callback(); }
      historyDependencies = dependencies;
    },
    imageUrlToDataUrl: async () => { events.push('header'); return 'data:image/png;base64,U1lOVEhFVElD'; },
    buildIndividualScholarCertificationPdf: async args => { events.push('build'); return buildOverride ? buildOverride(args) : generatedPdf; },
    fetch: async (url, options = {}) => {
      const method = options.method || 'GET';
      events.push({ url, method, body: options.body ? JSON.parse(options.body) : null });
      if (fetchOverride) return fetchOverride(url, options);
      if (url.endsWith('/prepare')) return response(prepared);
      if (method === 'POST') return response({ certification });
      if (url.endsWith('/file')) return response({});
      return response({ certifications: [certification] });
    },
    URL: {
      createObjectURL: blob => { events.push('create-url'); return `blob:${blob.source}`; },
      revokeObjectURL: url => { events.push({ revoke: url }); },
    },
    document: {
      createElement: tag => {
        assert.equal(tag, 'a');
        return { click() { downloads.push({ href: this.href, fileName: this.download }); events.push('download'); }, remove() {} };
      },
      body: { appendChild() {} },
    },
    setTimeout: callback => { callback(); return 1; },
    window: { setTimeout: callback => { callback(); return 1; } },
    console,
  };
  vm.createContext(context);
  const factory = vm.runInContext(`(function () { const { selected, token, billingPeriodLoading } = env; ${extracted}\nreturn { ${handlerNames.join(', ')} }; })`, context);
  const render = patch => {
    Object.assign(context.env, patch);
    stateIndex = 0; refIndex = 0; callbackIndex = 0;
    return factory();
  };
  let handlers = render();
  return {
    events, downloads, refs,
    get handlers() { return handlers; },
    get state() { return Object.fromEntries(hookStates.map((name, index) => [name, states[index].value])); },
    render(patch = {}) { handlers = render(patch); return handlers; },
    startHistoryTracking() { historyTracking = true; historyCleanup = historyCallback(); },
    close() { effectCleanup?.(); historyCleanup?.(); },
  };
}

const requests = workflow => workflow.events.filter(event => event && typeof event === 'object' && event.url);
const saving = event => event.method === 'POST' && !event.url.endsWith('/prepare');

test('new generation saves the exact server snapshot PDF before downloading the persisted artifact', async () => {
  let workflow;
  workflow = harness({
    build: args => {
      assert.deepEqual(plain(args), { snapshot, generatedAt: prepared.generatedAt, headerDataUrl: 'data:image/png;base64,U1lOVEhFVElD' });
      assert.equal(workflow.downloads.length, 0);
      return generatedPdf;
    },
    fetch: (url, options) => {
      if (url.endsWith('/prepare')) return response(prepared);
      if (options.method === 'POST') {
        assert.equal(workflow.downloads.length, 0);
        assert.deepEqual(JSON.parse(options.body), { academicPeriodId: 9, generationToken: prepared.generationToken, fileData: generatedPdf.fileData });
        return response({ certification });
      }
      if (url.endsWith('/file')) assert.equal(workflow.state.individualHistory.records[0].id, certification.id);
      return response({ certifications: [certification] });
    },
  });
  await workflow.handlers.downloadPrivateCertificate();
  await flush();
  const calls = requests(workflow);
  assert.equal(calls[0].url, '/api/scholars/34/certifications/prepare');
  assert.ok(workflow.events.indexOf('build') < workflow.events.indexOf(calls.find(saving)));
  assert.ok(workflow.events.indexOf(calls.find(saving)) < workflow.events.indexOf(calls.find(event => event.url.endsWith('/file'))));
  assert.deepEqual(workflow.downloads, [{ href: 'blob:saved-server-artifact', fileName: certification.fileName }]);
  assert.deepEqual(plain(workflow.state.individualHistory.records), [certification]);
  assert.equal(workflow.state.certificateNotice.tone, 'success');
  assert.equal(workflow.state.certificateDownloading, false);
  assert.equal(calls.every(event => event.url.includes('/scholars/34/')), true);
});

test('unchanged generation reuses the saved PDF without rebuilding or posting a new certification', async () => {
  const workflow = harness({ fetch: url => url.endsWith('/prepare')
    ? response({ ...prepared, existingCertification: certification }) : response({ certifications: [certification] }) });
  await workflow.handlers.downloadPrivateCertificate();
  await flush();
  assert.equal(workflow.events.includes('build'), false);
  assert.equal(workflow.events.includes('header'), false);
  assert.equal(requests(workflow).filter(saving).length, 0);
  assert.equal(workflow.downloads.length, 1);
  assert.deepEqual(plain(workflow.state.individualHistory.records), [certification]);
});

test('a rejected save never starts a download or reports success', async () => {
  const workflow = harness({ fetch: (url, options) => url.endsWith('/prepare') ? response(prepared)
    : options.method === 'POST' ? response({ message: 'Synthetic save rejected.' }, false) : assert.fail('Failed saving must not fetch a PDF or refresh history.') });
  await workflow.handlers.downloadPrivateCertificate();
  assert.equal(workflow.downloads.length, 0);
  assert.equal(workflow.events.includes('create-url'), false);
  assert.equal(workflow.state.certificateNotice.tone, 'error');
  assert.equal(workflow.state.certificateNotice.message, 'Synthetic save rejected.');
  assert.equal(workflow.state.individualHistory.records.length, 0);
  assert.equal(workflow.state.certificateDownloading, false);
});

test('a saved certificate remains in history when both its download and history reload fail', async () => {
  const workflow = harness({ fetch: (url, options) => {
    if (url.endsWith('/prepare')) return response(prepared);
    if (options.method === 'POST') return response({ certification });
    return response({ message: 'Synthetic temporary file failure.' }, false);
  } });
  await workflow.handlers.downloadPrivateCertificate();
  await flush();
  assert.deepEqual(plain(workflow.state.individualHistory.records), [certification]);
  assert.equal(workflow.downloads.length, 0);
  assert.equal(workflow.state.certificateNotice.tone, 'error');
  assert.match(workflow.state.certificateNotice.title, /saved; download failed/i);
  assert.match(workflow.state.certificateNotice.message, /remains in Certification History/);
  assert.equal(workflow.state.individualHistory.loading, false);
  assert.match(workflow.state.individualHistory.error, /temporary file failure/);
});

test('synchronous duplicate generation clicks create only one preparation, save, and download', async () => {
  const gate = deferred();
  const workflow = harness({ fetch: (url, options) => url.endsWith('/prepare') ? gate.promise
    : options.method === 'POST' ? response({ certification }) : response({ certifications: [certification] }) });
  const first = workflow.handlers.downloadPrivateCertificate();
  const duplicate = workflow.handlers.downloadPrivateCertificate();
  await flush();
  assert.equal(requests(workflow).length, 1);
  gate.resolve(response(prepared));
  await Promise.all([first, duplicate]);
  assert.equal(requests(workflow).filter(event => event.url.endsWith('/prepare')).length, 1);
  assert.equal(requests(workflow).filter(saving).length, 1);
  assert.equal(workflow.downloads.length, 1);
});

test('selection or academic-period changes during preparation, PDF building, or saving suppress stale follow-up work', async t => {
  for (const phase of ['prepare', 'build', 'save']) {
    for (const change of ['scholar', 'academic period']) await t.test(`${change} changed during ${phase}`, async () => {
      const gate = deferred();
      const workflow = harness({
        build: () => phase === 'build' ? gate.promise : generatedPdf,
        fetch: (url, options) => {
          if (url.endsWith('/prepare')) return phase === 'prepare' ? gate.promise : response(prepared);
          if (options.method === 'POST') return phase === 'save' ? gate.promise : response({ certification });
          return response({ certifications: [certification] });
        },
      });
      const action = workflow.handlers.downloadPrivateCertificate();
      await flush();
      workflow.render({ selected: change === 'scholar'
        ? { ...scholar, id: 'scholar-44', applicantId: 44 }
        : { ...scholar, academicPeriodId: 10 } });
      gate.resolve(phase === 'build' ? generatedPdf : response(phase === 'prepare' ? prepared : { certification }));
      await action;
      await flush();
      assert.equal(workflow.downloads.length, 0);
      assert.equal(workflow.state.certificateNotice, null);
      assert.equal(requests(workflow).some(event => event.url.endsWith('/file')), false);
      assert.equal(workflow.state.individualHistory.records.length, 0);
      assert.equal(requests(workflow).filter(saving).length, phase === 'save' ? 1 : 0);
      assert.equal(workflow.state.certificateDownloading, false);
    });
  }
});

test('a history response started before saving cannot overwrite the newly merged certification', async () => {
  const oldRead = deferred();
  let historyReads = 0;
  const workflow = harness({ fetch: (url, options) => {
    if (url.endsWith('/prepare')) return response(prepared);
    if (options.method === 'POST') return response({ certification });
    if (url.endsWith('/file')) return response({});
    historyReads++;
    return historyReads === 1 ? oldRead.promise : response({ certifications: [certification] });
  } });
  const read = workflow.handlers.loadIndividualCertifications();
  await workflow.handlers.downloadPrivateCertificate();
  await flush();
  oldRead.resolve(response({ certifications: [] }));
  await read;
  assert.equal(historyReads, 2);
  assert.deepEqual(plain(workflow.state.individualHistory.records), [certification]);
});

test('history re-download retrieves the original artifact without preparing, building, or saving', async () => {
  const workflow = harness();
  await workflow.handlers.downloadHistoryCertification(certification);
  assert.equal(requests(workflow).length, 1);
  assert.equal(requests(workflow)[0].url, '/api/scholars/34/certifications/101/file');
  assert.equal(requests(workflow)[0].method, 'GET');
  assert.equal(workflow.events.includes('build'), false);
  assert.equal(workflow.downloads.length, 1);
  assert.equal(workflow.state.individualHistory.records.length, 0);
  assert.equal(workflow.state.certificateNotice.tone, 'success');
});

test('changing selection while fetching a saved history PDF prevents its stale browser download', async () => {
  const gate = deferred();
  const workflow = harness({ fetch: () => gate.promise });
  const action = workflow.handlers.downloadHistoryCertification(certification);
  workflow.render({ selected: { ...scholar, id: 'scholar-44', applicantId: 44 } });
  gate.resolve(response({}));
  await action;
  assert.equal(workflow.downloads.length, 0);
  assert.equal(workflow.state.certificateNotice, null);
  assert.equal(workflow.events.includes('create-url'), false);
});

test('saving preserves previously loaded versions while history refresh is loading and when it fails', async () => {
  const older = { ...certification, id: 88, generatedAt: '2026-11-15T09:00:00.000Z' };
  const refresh = deferred();
  let historyReads = 0;
  const workflow = harness({ fetch: (url, options) => {
    if (url.endsWith('/prepare')) return response(prepared);
    if (options.method === 'POST') return response({ certification });
    if (url.endsWith('/file')) return response({});
    return ++historyReads === 1 ? response({ certifications: [older] }) : refresh.promise;
  } });
  await workflow.handlers.loadIndividualCertifications();
  await workflow.handlers.downloadPrivateCertificate();
  assert.equal(workflow.state.individualHistory.loading, true);
  assert.deepEqual(plain(workflow.state.individualHistory.records), [certification, older]);
  refresh.resolve(response({ message: 'Synthetic refresh unavailable.' }, false));
  await flush();
  assert.deepEqual(plain(workflow.state.individualHistory.records), [certification, older]);
  assert.equal(workflow.state.individualHistory.loading, false);
  assert.equal(workflow.state.individualHistory.error, 'Synthetic refresh unavailable.');
});

test('the real history-effect cleanup aborts stale reads after selecting another scholar', async () => {
  const oldRead = deferred();
  const other = { ...certification, id: 144, applicantId: 44 };
  let oldSignal;
  const workflow = harness({ fetch: (url, options) => {
    if (url.includes('/scholars/34/')) { oldSignal = options.signal; return oldRead.promise; }
    return response({ certifications: [other] });
  } });
  workflow.startHistoryTracking();
  workflow.render({ selected: { ...scholar, id: 'scholar-44', applicantId: 44 } });
  await flush();
  assert.equal(oldSignal.aborted, true);
  oldRead.resolve(response({ certifications: [certification] }));
  await flush();
  assert.equal(workflow.state.individualHistory.applicantId, 44);
  assert.deepEqual(plain(workflow.state.individualHistory.records), [other]);
});

test('unmounting the real history effect prevents a delayed read from replacing state', async () => {
  const oldRead = deferred();
  let signal;
  const workflow = harness({ fetch: (_url, options) => { signal = options.signal; return oldRead.promise; } });
  workflow.startHistoryTracking();
  const priorState = plain(workflow.state.individualHistory);
  workflow.close();
  assert.equal(signal.aborted, true);
  oldRead.resolve(response({ certifications: [certification] }));
  await flush();
  assert.deepEqual(plain(workflow.state.individualHistory), priorState);
});

test('generation blocks a concurrent history re-download until its current action finishes', async () => {
  const prepare = deferred();
  const workflow = harness({ fetch: (url, options) => url.endsWith('/prepare') ? prepare.promise
    : options.method === 'POST' ? response({ certification }) : response({ certifications: [certification] }) });
  const generation = workflow.handlers.downloadPrivateCertificate();
  await workflow.handlers.downloadHistoryCertification(certification);
  assert.equal(requests(workflow).length, 1);
  prepare.resolve(response(prepared));
  await generation;
  assert.equal(workflow.downloads.length, 1);
});

test('an unrelated render retains the active scope and lets its saved PDF download complete', async () => {
  const build = deferred();
  const workflow = harness({ build: () => build.promise });
  const generation = workflow.handlers.downloadPrivateCertificate();
  await flush();
  workflow.render({ selected: { ...scholar, name: 'Later directory display name' } });
  build.resolve(generatedPdf);
  await generation;
  assert.equal(workflow.downloads.length, 1);
  assert.equal(requests(workflow).filter(saving).length, 1);
  assert.equal(workflow.state.certificateNotice.tone, 'success');
});
