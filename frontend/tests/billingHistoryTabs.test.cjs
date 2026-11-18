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
  throw new Error('A Babel parser is required for the actual JSX tab checks.');
})();
const source = fs.readFileSync(path.join(__dirname, '../src/BillingPayrollManagement.jsx'), 'utf8');
const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
const component = name => ast.program.body.map(node => node.type === 'ExportDefaultDeclaration' ? node.declaration : node)
  .find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
const evaluate = (node, context) => vm.runInNewContext(`(${source.slice(node.start, node.end)})`, context);
const attr = (element, name) => element.openingElement.attributes.find(node => node.name?.name === name)?.value;
const expression = (element, name) => attr(element, name)?.expression;
const tag = node => node.openingElement.name.name;
function allNodes(root) {
  const nodes = [];
  const visit = (node, parents = []) => {
    if (!node || typeof node !== 'object' || !node.type) return;
    nodes.push({ node, parents });
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(child => visit(child, [...parents, node]));
      else if (value?.type) visit(value, [...parents, node]);
    }
  };
  visit(root); return nodes;
}
const elements = name => allNodes(component(name)).filter(item => item.node.type === 'JSXElement');
const button = (name, label) => elements(name).find(({ node }) => tag(node) === 'button'
  && node.children.filter(child => child.type === 'JSXText').map(child => child.value).join('').trim() === label).node;
function tabContext(section = 'lists', queueBusy = false) {
  const state = { section, schedulesOpened: false };
  return { state, section, queueBusy, setSection: value => { state.section = value; }, setSchedulesOpened: value => { state.schedulesOpened = value; } };
}

test('Billing and Payroll history buttons select their own history view, use existing focusable button controls and respect busy operations', () => {
  for (const [name, label] of [['BillingPreparationWorkspace', 'Billing history'], ['BillingPayrollManagement', 'Payroll history']]) {
    const history = button(name, label), context = tabContext();
    evaluate(expression(history, 'onClick'), context)();
    assert.equal(context.state.section, 'history');
    assert.equal(attr(history, 'type').value, 'button');
    assert.equal(evaluate(expression(history, 'aria-pressed'), { section: 'history' }), true);
    assert.equal(evaluate(expression(history, 'disabled'), { queueBusy: true }), true);
  }
  const context = tabContext();
  evaluate(expression(button('BillingPayrollManagement', 'Payout schedules'), 'onClick'), context)();
  assert.equal(context.state.section, 'schedules'); assert.equal(context.state.schedulesOpened, true);
});

test('queue and history views share one unkeyed retained workspace instead of mounting independent queues or issuing duplicate reads', () => {
  for (const name of ['BillingPreparationWorkspace', 'BillingPayrollManagement']) {
    const instances = elements(name).filter(({ node }) => tag(node) === 'BillingPayrollWorkspace');
    assert.equal(instances.length, 1);
    const { node, parents } = instances[0];
    assert.equal(attr(node, 'key'), undefined);
    const wrapper = parents.findLast(parent => parent.type === 'JSXElement');
    for (const section of ['lists', 'history']) {
      assert.equal(evaluate(expression(wrapper, 'hidden'), { section }), false);
      assert.equal(evaluate(expression(node, 'view'), { section }), section);
    }
    assert.equal(evaluate(expression(wrapper, 'hidden'), { section: name === 'BillingPreparationWorkspace' ? 'preparation' : 'schedules' }), true);
  }
  const loader = component('BillingPayrollWorkspace').body.body.find(node => node.type === 'VariableDeclaration' && node.declarations[0].id.name === 'loadRecords');
  const dependencies = loader.declarations[0].init.arguments[1].elements;
  assert.equal(dependencies.some(node => node.name === 'view'), false);
});

test('queue metrics/filters/transfer controls and saved history appear only in their respective native-hidden panels', () => {
  const panels = [
    ['billing-metrics', 'lists'], ['billing-filter-panel', 'lists'], ['billing-transfer-board', 'lists'], ['billing-certification-history', 'history'],
  ];
  for (const [className, activeView] of panels) {
    const item = elements('BillingPayrollWorkspace').find(({ node }) => attr(node, 'className')?.value === className);
    const wrapper = item.parents.findLast(node => node.type === 'JSXElement' && expression(node, 'hidden'));
    assert.ok(wrapper);
    assert.equal(evaluate(expression(wrapper, 'hidden'), { view: activeView }), false);
    assert.equal(evaluate(expression(wrapper, 'hidden'), { view: activeView === 'lists' ? 'history' : 'lists' }), true);
  }
});

test('history shows loading without a misleading empty state and leaves shared error/download notices visible', () => {
  const workspace = elements('BillingPayrollWorkspace');
  const item = workspace.find(({ node }) => attr(node, 'className')?.value === 'billing-certification-history');
  const condition = item.parents.findLast(node => node.type === 'LogicalExpression' && node.right === item.node).left;
  assert.equal(evaluate(condition, { loadError: '', loading: true, records: [] }), false);
  assert.equal(evaluate(condition, { loadError: '', loading: false, records: [] }), true);
  assert.equal(evaluate(condition, { loadError: 'Synthetic error', loading: false, records: [] }), false);
  for (const item of workspace.filter(({ node }) => tag(node) === 'Notification' || attr(node, 'className')?.value === 'billing-alert')) {
    assert.equal(item.parents.some(node => node.type === 'JSXElement' && expression(node, 'hidden')), false);
  }
});
