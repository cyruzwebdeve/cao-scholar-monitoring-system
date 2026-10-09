const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { defaultConfiguration, validateConfiguration, publicConfiguration, scoreConfiguredAnswers, createExamTicket, verifyExamTicket, loadConfiguration } = require('../services/onlineExamConfiguration');
const draft = () => ({ ...defaultConfiguration(), baseVersion: 0 });

test('built-in questions remain a valid 20-point configuration with explicit legacy marking', () => {
  const validated = validateConfiguration(draft());
  assert.equal(validated.questions.length, 16);
  assert.equal(validated.passing_score, 14);
  assert.equal(validated.questions.find(({ type }) => type === 'essay').grading, 'completion');
});

test('public payload uses an allowlist and never exposes marking keys or grading metadata', () => {
  const config = draft();
  config.questions[0].privateNotes = 'Do not publish';
  config.questions[8].acceptedAnswers = ['private key'];
  for (const question of publicConfiguration(config).questions) {
    for (const key of ['answer', 'acceptedAnswers', 'grading', 'privateNotes']) assert.equal(Object.hasOwn(question, key), false);
  }
});

test('empty, null and non-numeric multiple-choice answers do not become option A', () => {
  const config = defaultConfiguration();
  for (const value of [null, '', false, undefined, '0', {}, []]) {
    assert.equal(scoreConfiguredAnswers({ multipleChoice: { 4: value } }, config), 0);
  }
  assert.equal(scoreConfiguredAnswers({ multipleChoice: { 4: 0 } }, config), 1);
  assert.throws(() => scoreConfiguredAnswers(null, config), /answers/i);
});

test('configured identification keys require a matching accepted answer', () => {
  const config = defaultConfiguration();
  config.questions[8] = { ...config.questions[8], grading: 'answer', acceptedAnswers: ['Example Mountain', 'Test Peak'] };
  assert.equal(scoreConfiguredAnswers({ identification: { 9: '  EXAMPLE   MOUNTAIN  ' } }, config), 1);
  assert.equal(scoreConfiguredAnswers({ identification: { 9: 'anything' } }, config), 0);
});

test('rejects malformed configuration, invalid points, missing keys, duplicate IDs and multiple essays', () => {
  const cases = [
    (value) => { value.baseVersion = -1; },
    (value) => { value.title = ''; },
    (value) => { value.passingScore = 21; },
    (value) => { value.passingScore = 1.5; },
    (value) => { value.questions = []; },
    (value) => { value.questions[0].type = '__proto__'; },
    (value) => { value.questions[0].points = 2; },
    (value) => { value.questions[0].points = 0; },
    (value) => { value.questions[0].answer = null; },
    (value) => { value.questions[0].options = ['only one']; },
    (value) => { value.questions[0].options[0] = ''; },
    (value) => { value.questions[1].id = value.questions[0].id; },
    (value) => { value.questions[8].grading = 'answer'; value.questions[8].acceptedAnswers = []; },
    (value) => { value.questions[12].answer = 'maybe'; },
    (value) => { value.questions[15].grading = 'manual'; },
    (value) => { value.questions.push({ ...value.questions[15], id: 30 }); },
  ];
  for (const mutate of cases) { const input = draft(); mutate(input); assert.throws(() => validateConfiguration(input), TypeError); }
});

test('tickets bind the marking version to the applicant and examination and expire', () => {
  const secret = randomBytes(32).toString('hex');
  const context = { applicantId: 7, examId: 3, configurationId: 2 };
  const now = 1000;
  const ticket = createExamTicket(context, secret, now);
  assert.equal(verifyExamTicket(ticket, context, secret, now), 2);
  assert.throws(() => verifyExamTicket(ticket, { ...context, applicantId: 8 }, secret, now));
  assert.throws(() => verifyExamTicket(ticket, { ...context, examId: 4 }, secret, now));
  assert.throws(() => verifyExamTicket(ticket, context, randomBytes(32).toString('hex'), now));
  assert.throws(() => verifyExamTicket(ticket, context, secret, now + 86400000));
  assert.throws(() => verifyExamTicket(`${ticket}.extra`, context, secret, now));
  assert.throws(() => verifyExamTicket(undefined, context, secret, now));
  const [payload, signature] = ticket.split('.');
  const altered = JSON.parse(Buffer.from(payload, 'base64url').toString());
  altered.configurationId = 1;
  assert.throws(() => verifyExamTicket(`${Buffer.from(JSON.stringify(altered)).toString('base64url')}.${signature}`, context, secret, now));
});

test('loading an older version does not use the latest marking key', async () => {
  const config = defaultConfiguration();
  const records = [
    { id: 1, title: config.title, instructions: '', passing_score: 14, questions: config.questions },
    { id: 2, title: config.title, instructions: '', passing_score: 15, questions: config.questions.map((question) => question.id === 1 ? { ...question, answer: 0 } : question) },
  ];
  const client = { online_exam_configurations: { findFirst: async () => records[1], findUnique: async ({ where }) => records.find(({ id }) => id === where.id) } };
  assert.equal((await loadConfiguration(client)).id, 2);
  assert.equal(scoreConfiguredAnswers({ multipleChoice: { 1: 1 } }, await loadConfiguration(client, 1)), 1);
  assert.equal(scoreConfiguredAnswers({ multipleChoice: { 1: 1 } }, await loadConfiguration(client, 2)), 0);
  await assert.rejects(loadConfiguration(client, 99), /unavailable/);
});
