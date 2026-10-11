const test = require('node:test');
const assert = require('node:assert/strict');
const { publicExamQuestions, scoreExamAnswers } = require('../services/examQuestions');

test('public examination questions never expose answer keys', () => {
  const questions = publicExamQuestions();
  assert.equal(questions.length, 16);
  assert.equal(questions.some((question) => Object.hasOwn(question, 'answer')), false);
});

test('legacy scoring entry point cannot bypass the strict grading policy', () => {
  assert.throws(() => scoreExamAnswers({ identification: { 9: 'anything' }, essay: 'x' }), /completion credit/);
  assert.throws(() => scoreExamAnswers(null), /answers must be provided/i);
});
