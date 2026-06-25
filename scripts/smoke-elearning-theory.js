const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const baseUrl = process.env.BCL_BASE_URL || 'http://127.0.0.1:5052';

const theoryAreas = [
  {
    key: 'mindset',
    quizId: 'bim-mindset-quiz',
    examId: 'bim-mindset-theory-exam',
    practiceCategory: 'bim-mindset',
    bank: 'BC-Learning-Main/js/bim-mindset-question-bank-60.json',
    page: '/pages/bim-mindset.html'
  },
  {
    key: 'governance',
    quizId: 'bim-governance-quiz',
    examId: 'bim-governance-theory-exam',
    practiceCategory: 'bim-governance',
    bank: 'BC-Learning-Main/js/bim-governance-quiz-bank.json',
    page: '/pages/bim-governance-quiz.html'
  },
  {
    key: 'workflow',
    quizId: 'bim-delivery-workflow-quiz',
    examId: 'bim-delivery-workflow-theory-exam',
    practiceCategory: 'delivery-workflow',
    bank: 'BC-Learning-Main/js/bim-delivery-workflow-quiz-bank.json',
    page: '/pages/bim-delivery-workflow-quiz.html'
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function validateQuestionBank() {
  for (const area of theoryAreas) {
    const questions = readJson(area.bank);
    const ids = new Set();
    assert(questions.length >= 30, `${area.key}: expected at least 30 quiz questions`);

    questions.forEach((question, index) => {
      assert(question.id, `${area.key}: missing id at ${index}`);
      assert(!ids.has(question.id), `${area.key}: duplicate id ${question.id}`);
      ids.add(question.id);
      assert(question.prompt, `${area.key}: missing prompt for ${question.id}`);
      assert(Array.isArray(question.choices) && question.choices.length >= 4, `${area.key}: invalid choices for ${question.id}`);
      assert(Number.isInteger(question.answer_index), `${area.key}: invalid answer index for ${question.id}`);
      assert(question.answer_index >= 0 && question.answer_index < question.choices.length, `${area.key}: answer out of range for ${question.id}`);
      assert(question.explanation, `${area.key}: missing explanation for ${question.id}`);
    });
  }
}

function validatePracticeBank() {
  const practicePath = path.join(root, 'BC-Learning-Main/elearning-assets/js/enhanced-practice-questions-updated.js');
  const { enhancedPracticeQuestions } = require(practicePath);

  Object.entries(enhancedPracticeQuestions).forEach(([level, levelData]) => {
    for (const area of theoryAreas) {
      const category = levelData.categories?.[area.practiceCategory];
      assert(category, `${level}: missing practice category ${area.practiceCategory}`);
      assert(Array.isArray(category.questions) && category.questions.length >= 6, `${level}: ${area.practiceCategory} needs at least 6 practice questions`);

      const byDifficulty = category.questions.reduce((acc, question) => {
        acc[question.difficulty] = (acc[question.difficulty] || 0) + 1;
        return acc;
      }, {});

      assert(Object.values(byDifficulty).some(count => count >= 3), `${level}: ${area.practiceCategory} needs one difficulty group with at least 3 questions`);
    }
  });
}

function loadExamsModule() {
  const source = fs.readFileSync(path.join(root, 'BC-Learning-Main/elearning-assets/js/exams.js'), 'utf8');
  const context = {
    console,
    document: { addEventListener: () => {} },
    window: {},
    localStorage: { getItem: () => null, setItem: () => {} },
    URLSearchParams
  };
  return vm.runInNewContext(`${source}\n;({ examData, examQuestions });`, context);
}

function validateExamBank() {
  const { examData, examQuestions } = loadExamsModule();

  for (const area of theoryAreas) {
    const exam = examData.find(item => item.id === area.examId);
    assert(exam, `missing examData entry ${area.examId}`);
    assert(exam.category === area.practiceCategory, `${area.examId}: category mismatch`);
    assert(exam.questionCount === 10, `${area.examId}: expected 10 questions`);

    const questions = examQuestions[area.examId];
    assert(Array.isArray(questions), `${area.examId}: missing direct question bank`);
    assert(questions.length === exam.questionCount, `${area.examId}: direct question bank must match questionCount`);
    questions.forEach((question) => {
      assert(question.question, `${area.examId}: missing question text`);
      assert(Array.isArray(question.options) && question.options.length >= 4, `${area.examId}: invalid options for ${question.id}`);
      assert(Number.isInteger(question.correct) && question.correct >= 0 && question.correct < question.options.length, `${area.examId}: invalid correct index for ${question.id}`);
      assert(question.explanation, `${area.examId}: missing explanation for ${question.id}`);
    });
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    assert(response.ok, `${url} returned HTTP ${response.status}: ${body.slice(0, 160)}`);
    return JSON.parse(body);
  } finally {
    clearTimeout(timeout);
  }
}

async function validateApi() {
  const materials = await fetchJson(`${baseUrl}/api/exam-materials`);
  assert(materials.success === true, 'exam materials API should return success');
  assert(materials.count >= 3, 'exam materials API should expose theory exams');

  for (const area of theoryAreas) {
    const quiz = await fetchJson(`${baseUrl}/api/elearning/quiz/${area.quizId}`);
    assert(quiz.id === area.quizId, `${area.quizId}: quiz API id mismatch`);
  }
}

async function validateBrowser() {
  let puppeteer;
  try {
    puppeteer = require(path.join(root, 'backend/node_modules/puppeteer'));
  } catch (error) {
    console.warn('SKIP browser smoke: puppeteer is not installed');
    return;
  }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const area of theoryAreas) {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}${area.page}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.click('#start-quiz-btn');
      await page.waitForSelector('#quiz-content', { timeout: 10000 });

      const result = await page.evaluate(() => ({
        counter: document.querySelector('#question-counter')?.textContent || '',
        cards: document.querySelectorAll('.question-card').length,
        visible: getComputedStyle(document.querySelector('#quiz-content')).display !== 'none'
      }));

      assert(result.visible, `${area.key}: quiz content should be visible after start`);
      assert(result.cards === 10 || /1\s+dari\s+10/i.test(result.counter), `${area.key}: expected 10 rendered quiz questions`);
      await page.close();
    }

    const practicePage = await browser.newPage();
    await practicePage.evaluateOnNewDocument(() => {
      localStorage.setItem('user', JSON.stringify({ id: 'smoke-theory', name: 'Smoke Theory', level: 'BIM Coordinator', bimLevel: 'BIM Coordinator', practiceHistory: [] }));
    });
    await practicePage.goto(`${baseUrl}/elearning-assets/practice.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const practice = await practicePage.evaluate(() => ({
      skillCards: document.querySelectorAll('#practice-container .practice-set-card').length,
      readinessText: document.querySelector('#practice-readiness-grid')?.textContent || ''
    }));
    assert(practice.skillCards >= 3, 'practice page should render theory practice sets');
    assert(/BIM Mindset|BIM Governance|Delivery Workflow/i.test(practice.readinessText), 'practice readiness should include theory exams');
    await practicePage.close();

    const examsPage = await browser.newPage();
    await examsPage.evaluateOnNewDocument(() => {
      localStorage.setItem('user', JSON.stringify({ id: 'smoke-theory', name: 'Smoke Theory', level: 'BIM Coordinator', bimLevel: 'BIM Coordinator' }));
      localStorage.setItem('examHistory', JSON.stringify([]));
    });
    await examsPage.goto(`${baseUrl}/elearning-assets/exams.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const exams = await examsPage.evaluate(() => ({
      cards: Array.from(document.querySelectorAll('.exam-path-card h4')).map(item => item.textContent.trim()),
      materials: document.querySelector('.exam-materials-container')?.textContent || ''
    }));
    for (const area of theoryAreas) {
      assert(exams.cards.some(title => title.toLowerCase().includes(area.key === 'workflow' ? 'workflow' : area.key)), `exams page missing ${area.key} card`);
    }
    assert(!/Failed to load exam materials/i.test(exams.materials), 'exam materials should not show failure');
    await examsPage.close();
  } finally {
    await browser.close();
  }
}

(async () => {
  validateQuestionBank();
  validatePracticeBank();
  validateExamBank();
  await validateApi();
  await validateBrowser();
  console.log('OK smoke-elearning-theory passed');
})().catch((error) => {
  console.error(`FAIL smoke-elearning-theory: ${error.message}`);
  process.exit(1);
});
