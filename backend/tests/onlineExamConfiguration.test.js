const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { defaultConfiguration, validateConfiguration, publicConfiguration, scoreConfiguredAnswers, createExamTicket, verifyExamTicket, loadConfiguration } = require('../services/onlineExamConfiguration');
const { objectiveConfiguration } = require('./fixtures/objectiveExam');
const draft = () => ({ ...objectiveConfiguration(), baseVersion: 0 });

test('objective configurations retain the 20-point scale and threshold', () => {
  const validated = validateConfiguration(draft());
  assert.equal(validated.questions.length, 15);
  assert.equal(validated.passing_score, 14);
  assert.ok(validated.questions.every(({ grading }) => grading === 'answer'));
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
  const config = objectiveConfiguration();
  for (const value of [null, '', false, undefined, '0', {}, []]) {
    assert.equal(scoreConfiguredAnswers({ multipleChoice: { 4: value } }, config), 0);
  }
  assert.equal(scoreConfiguredAnswers({ multipleChoice: { 4: 0 } }, config), 1);
  assert.throws(() => scoreConfiguredAnswers(null, config), /answers/i);
});

test('configured identification keys require a matching accepted answer', () => {
  const config = objectiveConfiguration();
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
    (value) => { value.questions[8].grading = 'completion'; },
    (value) => { value.questions.push({ id: 30, type: 'essay', text: 'Essay', points: 5, grading: 'completion' }); },
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
  const config = objectiveConfiguration();
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


test('QA-02: arbitrary identification and one-character essay never receive completion points', () => {
  const answers = { identification: { 9: 'wrong', 10: 'wrong', 11: 'wrong', 12: 'wrong' }, essay: 'x' };
  assert.equal(scoreConfiguredAnswers(answers, objectiveConfiguration()), 0);
  assert.throws(() => scoreConfiguredAnswers(answers, defaultConfiguration()), /completion credit/);
  assert.throws(() => validateConfiguration({ ...defaultConfiguration(), baseVersion: 0 }), /completion credit/);
  const essayConfig = objectiveConfiguration();
  essayConfig.questions.push({ id: 99, type: 'essay', text: 'Essay', points: 5, grading: 'completion' });
  assert.throws(() => scoreConfiguredAnswers(answers, essayConfig), /essay completion credit/);
});

test('full objective answers score exactly 20 while keys remain normalized', () => {
  const config = objectiveConfiguration();
  const answers = { multipleChoice: {}, identification: {}, trueFalse: {} };
  for (const q of config.questions) {
    if (q.type === 'multiple-choice') answers.multipleChoice[q.id] = q.answer;
    else if (q.type === 'true-false') answers.trueFalse[q.id] = q.answer;
    else answers.identification[q.id] = `  TEST   ANSWER ${q.id}  `;
  }
  assert.equal(scoreConfiguredAnswers(answers, config), 20);
});
