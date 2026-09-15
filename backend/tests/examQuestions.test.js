const test = require('node:test');
const assert = require('node:assert/strict');
const { publicExamQuestions, scoreExamAnswers } = require('../services/examQuestions');

test('public examination questions never expose answer keys', () => {
  const questions = publicExamQuestions();
  assert.equal(questions.length, 16);
  assert.equal(questions.some((question) => Object.hasOwn(question, 'answer')), false);
});

test('examination answers are scored only on the server', () => {
  assert.equal(scoreExamAnswers({
    multipleChoice: { 1: 1, 2: 2, 3: 1, 4: 0, 5: 1, 6: 2, 7: 1, 8: 1 },
    identification: { 9: 'answer', 10: 'answer', 11: 'answer', 12: 'answer' },
    trueFalse: { 13: 'TRUE', 14: 'TRUE', 15: 'FALSE' },
    essay: 'Answer',
  }), 20);
  assert.throws(() => scoreExamAnswers(null), /answers must be provided/i);
});
