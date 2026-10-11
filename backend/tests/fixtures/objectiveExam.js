const { defaultConfiguration } = require('../../services/onlineExamConfiguration');
// Synthetic keys and point allocation; never a production question-bank seed.
const objectiveConfiguration = () => {
  const config = defaultConfiguration();
  config.questions = config.questions.filter(({ type }) => type !== 'essay').map((q) => q.type === 'identification' ? { ...q, grading: 'answer', acceptedAnswers: [`test answer ${q.id}`] } : q);
  config.questions[1].points = 6;
  return config;
};
module.exports = { objectiveConfiguration };
