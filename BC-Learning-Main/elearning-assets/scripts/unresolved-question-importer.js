const fs = require('fs');
const path = require('path');
const ImageMappingTool = require('./image-mapping-tool');

const IMPORT_CONFIG = {
    'SOAL BASIC, INTERMEDIATE, ADVANCE PERMODELAN.docx': {
        answerFile: 'JAWABAN SOAL BASIC, INTERMEDIATE, ADVANCE PERMODELAN.txt',
        levelKey: 'BIM Coordinator',
        categoryKey: 'intermediate-modeling',
        idPrefix: 'int-mod',
        difficulty: 'Intermediate',
        timeToComplete: 120
    },
    'SOAL POST TEST SESI 1&2 REVIT BASIC BRIDGE.docx': {
        answerFile: 'JAWABAN SOAL POST TEST SESI 1&2 REVIT BASIC BRIDGE.txt',
        levelKey: 'BIM Modeller',
        categoryKey: 'revit-fundamentals',
        idPrefix: 'revit-fund',
        difficulty: 'Beginner',
        timeToComplete: 60
    }
};

class UnresolvedQuestionImporter {
    constructor() {
        this.tool = new ImageMappingTool();
    }

    sanitizeText(text) {
        return (text || '')
            .replace(/â€¦|…/g, '...')
            .replace(/â†’|→/g, '->')
            .replace(/â€“|–|—/g, '-')
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    parseAnswerFile(answerFileName) {
        const answerPath = path.join(this.tool.docxDir, answerFileName);
        const lines = fs.readFileSync(answerPath, 'utf8')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        const ordered = [];
        const numbered = new Map();

        lines.forEach(line => {
            const match = line.match(/^(\d+)\.\s*([A-D])$/i);
            if (!match) {
                return;
            }

            const questionNumber = Number(match[1]);
            const letter = match[2].toUpperCase();

            ordered.push(letter);
            if (!numbered.has(questionNumber)) {
                numbered.set(questionNumber, []);
            }
            numbered.get(questionNumber).push(letter);
        });

        return {
            getAnswerLetter(questionIndex) {
                const direct = numbered.get(questionIndex);
                if (direct && direct.length === 1) {
                    return direct[0];
                }
                return ordered[questionIndex - 1] || null;
            }
        };
    }

    getExistingQuestionMaps() {
        const allQuestions = this.tool.getAllQuestions();
        const bySignature = new Map();

        allQuestions.forEach(question => {
            bySignature.set(this.getQuestionSignature(question.question, question.options), question);
        });

        return {
            allQuestions,
            bySignature
        };
    }

    getQuestionSignature(questionText, options) {
        const normalizedQuestion = this.tool.normalizeText(questionText);
        const normalizedOptions = (options || [])
            .map(option => this.tool.normalizeText(option))
            .join('|');

        return `${normalizedQuestion}::${normalizedOptions}`;
    }

    getNextNumericId(questions, idPrefix) {
        const regex = new RegExp(`^${idPrefix}-(\\d+)$`);
        let maxId = 0;

        questions.forEach(question => {
            const match = question.id.match(regex);
            if (match) {
                maxId = Math.max(maxId, Number(match[1]));
            }
        });

        return maxId + 1;
    }

    formatQuestionId(idPrefix, numericId) {
        return `${idPrefix}-${String(numericId).padStart(3, '0')}`;
    }

    letterToIndex(letter) {
        return ['A', 'B', 'C', 'D'].indexOf(letter);
    }

    createLearningObjective(questionText, config) {
        const text = questionText.toLowerCase();

        if (config.categoryKey === 'revit-fundamentals') {
            if (text.includes('icon') || text.includes('tools') || text.includes('elemen')) {
                return 'Identify Revit interface icons, tools, and UI elements from visual references';
            }
            return 'Understand Revit interface behavior and core navigation tools';
        }

        if (text.includes('door')) {
            return 'Apply family placement workflows and verify model counts in a practical Revit scenario';
        }
        if (text.includes('foundation') || text.includes('pondasi')) {
            return 'Place structural foundations correctly and validate model quantities';
        }
        if (text.includes('column') || text.includes('kolom')) {
            return 'Model structural columns correctly and calculate resulting quantities';
        }
        if (text.includes('dinding')) {
            return 'Modify wall constraints and evaluate resulting model properties';
        }

        return 'Apply intermediate Revit modeling steps and validate the resulting model output';
    }

    createRelatedTopics(questionText, config) {
        const text = questionText.toLowerCase();

        if (config.categoryKey === 'revit-fundamentals') {
            if (text.includes('icon')) {
                return ['Revit Interface', 'Icon Recognition', 'View Controls'];
            }
            if (text.includes('tools')) {
                return ['Revit Tools', 'Modify Panel', 'UI Navigation'];
            }
            return ['Revit Interface', 'Visual Navigation', 'Workspace Familiarity'];
        }

        if (text.includes('door')) {
            return ['Doors', 'Family Placement', 'Element Counting'];
        }
        if (text.includes('foundation') || text.includes('pondasi')) {
            return ['Foundations', 'Structural Modeling', 'Quantity Checks'];
        }
        if (text.includes('column') || text.includes('kolom')) {
            return ['Structural Columns', 'Levels', 'Volume Calculation'];
        }
        if (text.includes('dinding')) {
            return ['Walls', 'Constraints', 'Area Calculation'];
        }

        return ['Revit Modeling', 'Practical Exercises', 'Model Verification'];
    }

    createExplanation(question, correctOption, config) {
        if (config.categoryKey === 'revit-fundamentals') {
            return `Jawaban yang benar adalah "${correctOption}". Soal ini menguji identifikasi fungsi ikon, tools, atau elemen antarmuka Revit berdasarkan referensi visual yang ditampilkan.`;
        }

        return `Jawaban yang benar adalah "${correctOption}". Nilai tersebut diperoleh setelah mengikuti langkah kerja pada model Revit sesuai instruksi soal dan memverifikasi hasil akhirnya pada elemen yang diminta.`;
    }

    createQuestionObject(questionId, unresolvedQuestion, correctAnswerIndex, config) {
        const options = unresolvedQuestion.options.map(option => this.sanitizeText(option));
        const correctOption = options[correctAnswerIndex];

        const questionObject = {
            id: questionId,
            question: this.sanitizeText(unresolvedQuestion.stem),
            type: 'multiple-choice',
            options,
            correctAnswer: correctAnswerIndex,
            explanation: this.createExplanation(unresolvedQuestion, correctOption, config),
            learningObjective: this.createLearningObjective(unresolvedQuestion.stem, config),
            relatedTopics: this.createRelatedTopics(unresolvedQuestion.stem, config),
            difficulty: config.difficulty,
            timeToComplete: config.timeToComplete,
            importMetadata: {
                sourceDocx: config.docxName,
                importedFromUnresolved: true,
                sourceQuestionIndex: unresolvedQuestion.index
            }
        };

        if (config.categoryKey === 'intermediate-modeling') {
            questionObject.practicalScenario = 'Ikuti workflow pada model Revit, lakukan perubahan sesuai instruksi, lalu verifikasi hasil akhirnya pada elemen yang ditanyakan.';
        }

        return questionObject;
    }

    async extractImagesForImportedQuestions(docxContext, docxName, imports) {
        const matchLikePayload = imports.map(item => ({
            docxQuestion: item.unresolvedQuestion,
            bankQuestion: { id: item.question.id }
        }));

        await this.tool.extractMappedImages(docxContext, docxName, matchLikePayload);

        matchLikePayload.forEach((payload, index) => {
            if (!payload.imageUrls || !payload.imageUrls.length) {
                return;
            }

            imports[index].question.imageUrl = payload.imageUrls[0];
            imports[index].question.imageUrls = payload.imageUrls;
        });
    }

    async importForDocument(docxFile, state) {
        const config = IMPORT_CONFIG[docxFile.name];
        if (!config) {
            return [];
        }

        config.docxName = docxFile.name;
        const answers = this.parseAnswerFile(config.answerFile);
        const docxContext = await this.tool.loadDocxContext(docxFile.path);
        const parsedQuestions = this.tool.buildQuestionBlocks(docxContext.paragraphs);
        const matching = this.tool.matchDocxQuestionsToBank(parsedQuestions, state.allQuestions, docxFile.name);
        const categoryQuestions = this.tool.questionsData[config.levelKey].categories[config.categoryKey].questions;
        let nextIdNumber = this.getNextNumericId(categoryQuestions, config.idPrefix);

        const imports = [];

        for (const unresolvedQuestion of matching.unresolvedImageQuestions) {
            const signature = this.getQuestionSignature(unresolvedQuestion.stem, unresolvedQuestion.options);
            if (state.bySignature.has(signature)) {
                continue;
            }

            const answerLetter = answers.getAnswerLetter(unresolvedQuestion.index);
            const correctAnswerIndex = this.letterToIndex(answerLetter);

            if (correctAnswerIndex < 0) {
                console.warn(`Skipping unresolved question ${unresolvedQuestion.index} from ${docxFile.name}: no valid answer key`);
                continue;
            }

            const questionId = this.formatQuestionId(config.idPrefix, nextIdNumber++);
            const questionObject = this.createQuestionObject(questionId, unresolvedQuestion, correctAnswerIndex, config);

            categoryQuestions.push(questionObject);
            state.allQuestions.push({
                id: questionObject.id,
                question: questionObject.question,
                options: questionObject.options,
                level: config.levelKey,
                category: config.categoryKey,
                categoryTitle: this.tool.questionsData[config.levelKey].categories[config.categoryKey].title,
                order: categoryQuestions.length - 1
            });
            state.bySignature.set(signature, {
                id: questionObject.id,
                question: questionObject.question
            });

            imports.push({
                unresolvedQuestion,
                question: questionObject
            });
        }

        await this.extractImagesForImportedQuestions(docxContext, docxFile.name, imports);
        return imports;
    }

    async run() {
        this.tool.initDirectories();

        if (!await this.tool.loadQuestionsData()) {
            throw new Error('Unable to load question data');
        }

        const state = this.getExistingQuestionMaps();
        const docxFiles = fs.readdirSync(this.tool.docxDir)
            .filter(file => file.toLowerCase().endsWith('.docx'))
            .map(file => ({
                name: file,
                path: path.join(this.tool.docxDir, file)
            }));

        const importedQuestions = [];

        for (const docxFile of docxFiles) {
            const imports = await this.importForDocument(docxFile, state);
            importedQuestions.push(...imports.map(item => item.question.id));
        }

        fs.writeFileSync(
            this.tool.updatedQuestionsPath,
            this.tool.generateJSFile(this.tool.questionsData)
        );

        console.log(`Imported ${importedQuestions.length} unresolved questions into ${path.basename(this.tool.updatedQuestionsPath)}`);
        if (importedQuestions.length) {
            console.log(importedQuestions.join('\n'));
        }
    }
}

if (require.main === module) {
    const importer = new UnresolvedQuestionImporter();
    importer.run().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}

module.exports = UnresolvedQuestionImporter;
