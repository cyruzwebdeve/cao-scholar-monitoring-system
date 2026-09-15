const EXAM_QUESTIONS = Object.freeze([
  { id: 1, part: 'I', partLabel: 'PART I: Multiple Choice', type: 'multiple-choice', text: 'What is the capital municipality of Camarines Norte?', options: ['Labo', 'Daet', 'Vinzons', 'Paracale'], answer: 1 },
  { id: 2, part: 'I', partLabel: 'PART I: Multiple Choice', type: 'multiple-choice', text: 'Camarines Norte holds the distinction of erecting the very first monument honoring Dr. Jose Rizal in 1898. In which municipality is this monument located?', options: ['Jose Panganiban', 'Vinzons', 'Daet', 'Basud'], answer: 2 },
  { id: 3, part: 'I', partLabel: 'PART I: Multiple Choice', type: 'multiple-choice', text: 'Which municipality is famous for its world-class Calaguas Islands featuring powdery white sand beaches?', options: ['Mercedes', 'Vinzons', 'Talisay', 'Capalonga'], answer: 1 },
  { id: 4, part: 'I', partLabel: 'PART I: Multiple Choice', type: 'multiple-choice', text: 'Known as the "Gold Country of Camarines Norte," which town has been historical for gold mining and traditional jewelry making since the pre-Spanish period?', options: ['Paracale', 'Santa Elena', 'San Vicente', 'Basud'], answer: 0 },
  { id: 5, part: 'I', partLabel: 'PART I: Multiple Choice', type: 'multiple-choice', text: 'Which municipality in Camarines Norte is the largest in terms of total land area and most populous?', options: ['Daet', 'Labo', 'Jose Panganiban', 'Basud'], answer: 1 },
  { id: 6, part: 'I', partLabel: 'PART I: Multiple Choice', type: 'multiple-choice', text: "What major annual festival celebrated in Daet highlights the province's famous sweet Formosa pineapple?", options: ['Palong Festival', 'Rahugan Festival', 'Pinyasan Festival', 'Busig-On Festival'], answer: 2 },
  { id: 7, part: 'I', partLabel: 'PART I: Multiple Choice', type: 'multiple-choice', text: 'Wenceslao Q. Vinzons, a prominent native hero of Camarines Norte, was famous for leading which movement during World War II?', options: ['The Philippine Propaganda Movement', 'Local guerrilla resistance against Japanese forces', 'The Katipunan revolt against Spanish rule', 'The Peace Commission during the American era'], answer: 1 },
  { id: 8, part: 'I', partLabel: 'PART I: Multiple Choice', type: 'multiple-choice', text: 'Which island group located in the municipality of Mercedes is known for its major commercial fishing hub and cluster of seven islands?', options: ['Calaguas Group of Islands', 'Mercedes Group of Islands', 'Maculabo Islands', 'Quinapaguian Islands'], answer: 1 },
  { id: 9, part: 'II', partLabel: 'PART II: Identification', type: 'identification', text: 'The highest peak in Camarines Norte, standing at 1,544 meters above sea level.' },
  { id: 10, part: 'II', partLabel: 'PART II: Identification', type: 'identification', text: 'The historic Spanish-era province that merged both Camarines Norte and Camarines Sur before their final legislative division in March 1919.' },
  { id: 11, part: 'II', partLabel: 'PART II: Identification', type: 'identification', text: 'The municipality known for attracting thousands of pilgrims and tourists every May for the feast day of the Black Nazarene.' },
  { id: 12, part: 'II', partLabel: 'PART II: Identification', type: 'identification', text: 'The municipality formerly named Mambulao, which was renamed in honor of a Bicolano hero and patriot who contributed to the Propaganda Movement.' },
  { id: 13, part: 'III', partLabel: 'PART III: True or False', type: 'true-false', text: 'Camarines Norte is geographically bounded by Quezon Province to the west and Camarines Sur to the south.', answer: 'TRUE' },
  { id: 14, part: 'III', partLabel: 'PART III: True or False', type: 'true-false', text: 'The coastal town of Bagasbas in Daet is widely recognized as a popular destination for surfing.', answer: 'TRUE' },
  { id: 15, part: 'III', partLabel: 'PART III: True or False', type: 'true-false', text: 'There are a total of 16 municipalities in the province of Camarines Norte.', answer: 'FALSE' },
  { id: 16, part: 'IV', partLabel: 'PART IV: Essay', type: 'essay', text: 'Essay Question (5 Points)', essayPrompt: 'Explain why Camarines Norte is called the "Gateway to Bicolandia." Discuss how its geographic location, history, and cultural influences shape its unique identity compared to other provinces in the Bicol Region.' },
]);

const publicExamQuestions = () => EXAM_QUESTIONS.map(({ answer, ...question }) => ({ ...question }));

const scoreExamAnswers = (answers) => {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new TypeError('Examination answers must be provided.');
  }
  const multipleChoice = answers.multipleChoice && typeof answers.multipleChoice === 'object' ? answers.multipleChoice : {};
  const identification = answers.identification && typeof answers.identification === 'object' ? answers.identification : {};
  const trueFalse = answers.trueFalse && typeof answers.trueFalse === 'object' ? answers.trueFalse : {};
  const essay = typeof answers.essay === 'string' ? answers.essay.trim().slice(0, 10000) : '';
  return EXAM_QUESTIONS.reduce((score, question) => {
    if (question.type === 'multiple-choice') return score + (Number(multipleChoice[question.id]) === question.answer ? 1 : 0);
    if (question.type === 'true-false') return score + (String(trueFalse[question.id] || '').toUpperCase() === question.answer ? 1 : 0);
    if (question.type === 'identification') return score + (String(identification[question.id] || '').trim().slice(0, 500) ? 1 : 0);
    return score + (essay ? 5 : 0);
  }, 0);
};

module.exports = { EXAM_QUESTIONS, publicExamQuestions, scoreExamAnswers };
