const crypto = require('node:crypto');
const { EXAM_QUESTIONS } = require('./examQuestions');

const PARTS = {
  'multiple-choice': ['I', 'PART I: Multiple Choice'],
  identification: ['II', 'PART II: Identification'],
  'true-false': ['III', 'PART III: True or False'],
  essay: ['IV', 'PART IV: Essay'],
};
const defaultConfiguration = () => ({
  id: 0,
  title: 'PGCEAP Qualifying Examination',
  instructions: 'Read each question carefully. Review your answers before submitting.',
  passingScore: 14,
  questions: EXAM_QUESTIONS.map((question) => ({
    ...question,
    ...(question.options ? { options: [...question.options] } : {}),
    points: question.type === 'essay' ? 5 : 1,
    grading: ['essay', 'identification'].includes(question.type) ? 'completion' : 'answer',
  })),
});

const serializeConfiguration = (record) => record ? ({
  id: record.id, title: record.title, instructions: record.instructions,
  passingScore: record.passing_score, questions: record.questions,
}) : defaultConfiguration();

const loadConfiguration = async (client, id) => {
  if (id === 0) return defaultConfiguration();
  const record = id === undefined
    ? await client.online_exam_configurations.findFirst({ orderBy: { id: 'desc' } })
    : await client.online_exam_configurations.findUnique({ where: { id } });
  if (id !== undefined && !record) throw new Error('The examination question version is unavailable.');
  return serializeConfiguration(record);
};

const boundedText = (value, label, max, optional = false) => {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max) {
    throw new TypeError(`${label} must ${optional ? '' : 'not be empty and must '}contain at most ${max} characters.`);
  }
  return value.trim();
};

const validateConfiguration = (input) => {
  if (!input || !Number.isInteger(input.baseVersion) || input.baseVersion < 0) throw new TypeError('Reload the saved question version before editing.');
  const title = boundedText(input.title, 'Examination title', 150);
  const instructions = boundedText(input.instructions, 'Instructions', 3000, true);
  if (!Number.isInteger(input.passingScore) || input.passingScore < 1 || input.passingScore > 20) throw new TypeError('Passing score must be a whole number from 1 to 20.');
  if (!Array.isArray(input.questions) || !input.questions.length || input.questions.length > 20) throw new TypeError('Provide between 1 and 20 questions.');
  const ids = new Set();
  let essays = 0;
  const questions = input.questions.map((raw) => {
    if (!raw || !Object.hasOwn(PARTS, raw.type)) throw new TypeError('Select a supported question type.');
    if (!Number.isSafeInteger(raw.id) || raw.id < 1 || ids.has(raw.id)) throw new TypeError('Question IDs must be unique positive integers.');
    ids.add(raw.id);
    if (!Number.isInteger(raw.points) || raw.points < 1 || raw.points > 20) throw new TypeError('Question points must be a whole number from 1 to 20.');
    const [part, partLabel] = PARTS[raw.type];
    const question = { id: raw.id, type: raw.type, text: boundedText(raw.text, 'Question', 3000), part, partLabel, points: raw.points, grading: 'answer' };
    if (raw.type === 'multiple-choice') {
      if (!Array.isArray(raw.options) || raw.options.length !== 4) throw new TypeError('Multiple-choice questions require four options.');
      question.options = raw.options.map((option) => boundedText(option, 'Option', 500));
      if (!Number.isInteger(raw.answer) || raw.answer < 0 || raw.answer > 3) throw new TypeError('Select the correct multiple-choice answer.');
      question.answer = raw.answer;
    } else if (raw.type === 'true-false') {
      if (!['TRUE', 'FALSE'].includes(raw.answer)) throw new TypeError('Select TRUE or FALSE as the answer key.');
      question.answer = raw.answer;
    } else if (raw.type === 'identification') {
      // Existing completion-credit items remain explicit; staff can replace them with an exact answer key.
      if (raw.grading === 'completion') question.grading = 'completion';
      else {
        if (!Array.isArray(raw.acceptedAnswers) || !raw.acceptedAnswers.length || raw.acceptedAnswers.length > 10) throw new TypeError('Identification questions require 1 to 10 accepted answers.');
        question.acceptedAnswers = raw.acceptedAnswers.map((answer) => boundedText(answer, 'Accepted answer', 500));
      }
    } else {
      essays += 1;
      if (essays > 1) throw new TypeError('Only one essay is supported by the current examination page.');
      if (raw.grading !== 'completion') throw new TypeError('Essay scoring currently supports completion credit only, not manual grading.');
      question.grading = 'completion';
      question.essayPrompt = boundedText(raw.essayPrompt || raw.text, 'Essay prompt', 3000);
    }
    return question;
  });
  if (questions.reduce((sum, question) => sum + question.points, 0) !== 20) throw new TypeError('Question points must total 20 to match existing result and re-evaluation records.');
  questions.sort((left, right) => Object.keys(PARTS).indexOf(left.type) - Object.keys(PARTS).indexOf(right.type));
  return { title, instructions, passing_score: input.passingScore, questions, previous_id: input.baseVersion };
};

const publicConfiguration = (configuration) => ({
  title: configuration.title,
  instructions: configuration.instructions,
  questions: configuration.questions.map(({ id, type, text, part, partLabel, points, options, essayPrompt }) => ({ id, type, text, part, partLabel, points, ...(options ? { options } : {}), ...(essayPrompt ? { essayPrompt } : {}) })),
});

const normalizeAnswer = (value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const scoreConfiguredAnswers = (answers, configuration) => {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new TypeError('Examination answers must be provided.');
  return configuration.questions.reduce((score, question) => {
    let correct = false;
    if (question.type === 'multiple-choice') {
      const answer = answers.multipleChoice?.[question.id];
      correct = Number.isInteger(answer) && answer === question.answer;
    } else if (question.type === 'true-false') {
      correct = String(answers.trueFalse?.[question.id] || '').toUpperCase() === question.answer;
    } else {
      const answer = question.type === 'essay' ? answers.essay : answers.identification?.[question.id];
      if (typeof answer === 'string') {
        const normalized = normalizeAnswer(answer.slice(0, question.type === 'essay' ? 10000 : 500));
        correct = question.grading === 'completion' ? Boolean(normalized) : question.acceptedAnswers.some((key) => normalizeAnswer(key) === normalized);
      }
    }
    return score + (correct ? question.points : 0);
  }, 0);
};

// A domain-separated HMAC ticket is not an authentication JWT. It contains no answer keys.
const ticketSignature = (payload, secret) => {
  if (!secret) throw new Error('Examination ticket signing is not configured.');
  return crypto.createHmac('sha256', secret).update(`pgceap-online-exam-v1:${payload}`).digest();
};
const createExamTicket = ({ applicantId, examId, configurationId }, secret = process.env.JWT_SECRET, now = Date.now()) => {
  const payload = Buffer.from(JSON.stringify({ applicantId, examId, configurationId, expiresAt: now + 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${ticketSignature(payload, secret).toString('base64url')}`;
};
const verifyExamTicket = (ticket, { applicantId, examId }, secret = process.env.JWT_SECRET, now = Date.now()) => {
  try {
    if (typeof ticket !== 'string' || ticket.length > 2000) throw new Error();
    const [payload, signature, extra] = ticket.split('.');
    const actual = Buffer.from(signature || '', 'base64url');
    const expected = ticketSignature(payload, secret);
    if (extra || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error();
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.applicantId !== applicantId || data.examId !== examId || !Number.isFinite(data.expiresAt) || data.expiresAt <= now || !Number.isSafeInteger(data.configurationId) || data.configurationId < 0) throw new Error();
    return data.configurationId;
  } catch {
    throw new TypeError('Your examination session is invalid or expired. Reopen the examination from your dashboard.');
  }
};

module.exports = { defaultConfiguration, loadConfiguration, validateConfiguration, publicConfiguration, scoreConfiguredAnswers, createExamTicket, verifyExamTicket };
