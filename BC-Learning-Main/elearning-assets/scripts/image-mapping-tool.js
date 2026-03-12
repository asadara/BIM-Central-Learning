// Image Mapping Tool for DOCX to Quiz Questions
// Uses DOCX structure and question text similarity instead of raw image order.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const JSZip = require('jszip');
const { DOMParser } = require('xmldom');

class ImageMappingTool {
    constructor() {
        this.questionsData = null;
        this.outputDir = path.join(__dirname, '../images/questions');
        this.dataDir = path.join(__dirname, '../data');
        this.docxDir = path.join(__dirname, '../test');
        this.updatedQuestionsPath = path.join(__dirname, '../js/enhanced-practice-questions-updated.js');
        this.questionsPath = path.join(__dirname, '../js/enhanced-practice-questions.js');
        this.sourceQuestionsPath = null;
        this.matchThreshold = 0.62;
        this.highConfidenceThreshold = 0.88;
        this.mediumConfidenceThreshold = 0.75;
    }

    initDirectories() {
        for (const dir of [this.outputDir, this.dataDir]) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        }
    }

    async loadQuestionsData() {
        try {
            const sourcePath = fs.existsSync(this.updatedQuestionsPath)
                ? this.updatedQuestionsPath
                : this.questionsPath;
            const content = fs.readFileSync(sourcePath, 'utf8');
            const sandbox = {
                window: {},
                module: undefined,
                exports: undefined,
                console: { log() { }, warn() { }, error() { } }
            };

            vm.runInNewContext(`${content}\nthis.__questions = window.enhancedPracticeQuestions || enhancedPracticeQuestions;`, sandbox);

            if (!sandbox.__questions || typeof sandbox.__questions !== 'object') {
                throw new Error('questions object not found');
            }

            this.questionsData = sandbox.__questions;
            this.sourceQuestionsPath = sourcePath;
            console.log(`Loaded questions data with ${Object.keys(this.questionsData).length} levels from ${path.basename(sourcePath)}`);
            return true;
        } catch (error) {
            console.error(`Error loading questions data: ${error.message}`);
            return false;
        }
    }

    getAllQuestions() {
        const questions = [];

        if (!this.questionsData) {
            return questions;
        }

        Object.entries(this.questionsData).forEach(([levelKey, levelData]) => {
            Object.entries(levelData.categories || {}).forEach(([categoryKey, categoryData]) => {
                (categoryData.questions || []).forEach((question, index) => {
                    questions.push({
                        id: question.id,
                        question: question.question,
                        options: Array.isArray(question.options) ? question.options : [],
                        level: levelKey,
                        category: categoryKey,
                        categoryTitle: categoryData.title,
                        order: index
                    });
                });
            });
        });

        return questions;
    }

    normalizeText(text) {
        return (text || '')
            .replace(/â€¦|…/g, ' ')
            .replace(/â†’|→/g, ' ')
            .replace(/â€“|–|—/g, ' ')
            .replace(/[\u00A0\t\r\n]+/g, ' ')
            .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
            .replace(/\b\d{6,}\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    cleanDocxText(text) {
        return (text || '')
            .replace(/\b\d{6,}\b/g, ' ')
            .replace(/^\d{6,}/, '')
            .replace(/\d{6,}$/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    cleanOptionText(text) {
        return this.cleanDocxText((text || '').replace(/^[a-e][.)]\s*/i, ''));
    }

    slugify(text) {
        return (text || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'image';
    }

    tokenize(text) {
        return this.normalizeText(text)
            .split(' ')
            .map(token => token.trim())
            .filter(token => token.length > 1);
    }

    calculateTokenSimilarity(a, b) {
        const tokensA = new Set(this.tokenize(a));
        const tokensB = new Set(this.tokenize(b));

        if (!tokensA.size || !tokensB.size) {
            return 0;
        }

        let intersection = 0;
        for (const token of tokensA) {
            if (tokensB.has(token)) {
                intersection++;
            }
        }

        const precision = intersection / tokensA.size;
        const recall = intersection / tokensB.size;

        if (!precision || !recall) {
            return 0;
        }

        return (2 * precision * recall) / (precision + recall);
    }

    calculateOptionSimilarity(docxOptions, bankOptions) {
        if (!docxOptions.length || !bankOptions.length) {
            return 0;
        }

        const joinedDocx = docxOptions.map(option => this.cleanOptionText(option)).join(' ');
        const joinedBank = bankOptions.map(option => this.cleanOptionText(option)).join(' ');
        return this.calculateTokenSimilarity(joinedDocx, joinedBank);
    }

    classifyConfidence(score) {
        if (score >= this.highConfidenceThreshold) {
            return 'high';
        }
        if (score >= this.mediumConfidenceThreshold) {
            return 'medium';
        }
        if (score >= this.matchThreshold) {
            return 'low';
        }
        return 'none';
    }

    getTextContent(node) {
        if (!node) {
            return '';
        }

        let output = '';
        const stack = [node];

        while (stack.length) {
            const current = stack.pop();
            if (!current) {
                continue;
            }

            if (current.nodeType === 3) {
                output += current.nodeValue || '';
            }

            if (current.childNodes) {
                for (let i = current.childNodes.length - 1; i >= 0; i--) {
                    stack.push(current.childNodes[i]);
                }
            }
        }

        return this.cleanDocxText(output);
    }

    findImageRelationshipIds(node, ids = []) {
        if (!node) {
            return ids;
        }

        if (node.nodeType === 1 && node.tagName === 'a:blip') {
            const embedId = node.getAttribute('r:embed') || node.getAttribute('embed');
            if (embedId) {
                ids.push(embedId);
            }
        }

        if (node.childNodes) {
            for (let i = 0; i < node.childNodes.length; i++) {
                this.findImageRelationshipIds(node.childNodes[i], ids);
            }
        }

        return ids;
    }

    getParagraphNumbering(paragraphNode) {
        const numPr = paragraphNode.getElementsByTagName('w:numPr')[0];
        if (!numPr) {
            return { numId: '', ilvl: '' };
        }

        const numIdNode = numPr.getElementsByTagName('w:numId')[0];
        const ilvlNode = numPr.getElementsByTagName('w:ilvl')[0];

        return {
            numId: numIdNode ? (numIdNode.getAttribute('w:val') || numIdNode.getAttribute('val') || '') : '',
            ilvl: ilvlNode ? (ilvlNode.getAttribute('w:val') || ilvlNode.getAttribute('val') || '') : ''
        };
    }

    async loadDocxContext(docxPath) {
        const fileBuffer = fs.readFileSync(docxPath);
        const zip = await JSZip.loadAsync(fileBuffer);
        const documentXml = await zip.file('word/document.xml').async('string');
        const relationshipsXml = await zip.file('word/_rels/document.xml.rels').async('string');

        const documentDom = new DOMParser().parseFromString(documentXml, 'text/xml');
        const relationshipsDom = new DOMParser().parseFromString(relationshipsXml, 'text/xml');

        const relationshipMap = {};
        const relationshipNodes = Array.from(relationshipsDom.getElementsByTagName('Relationship'));
        relationshipNodes.forEach(node => {
            const id = node.getAttribute('Id');
            const target = node.getAttribute('Target');
            if (id && target) {
                relationshipMap[id] = target;
            }
        });

        return {
            zip,
            relationshipMap,
            paragraphs: this.extractParagraphs(documentDom)
        };
    }

    extractParagraphs(documentDom) {
        const paragraphNodes = Array.from(documentDom.getElementsByTagName('w:p'));

        return paragraphNodes.map((paragraphNode, index) => {
            const { numId, ilvl } = this.getParagraphNumbering(paragraphNode);
            const text = this.getTextContent(paragraphNode);
            const imageRelationshipIds = [...new Set(this.findImageRelationshipIds(paragraphNode, []))];

            return {
                index,
                text,
                numId,
                ilvl,
                imageRelationshipIds
            };
        }).filter(paragraph => paragraph.text || paragraph.imageRelationshipIds.length);
    }

    isQuestionStart(paragraph) {
        return paragraph.numId === '1' && paragraph.ilvl === '0';
    }

    isLikelyOptionParagraph(paragraph) {
        if (!paragraph.text) {
            return false;
        }

        return (
            /^[a-e][.)]\s+/i.test(paragraph.text) ||
            (!!paragraph.numId && !this.isQuestionStart(paragraph))
        );
    }

    finalizeQuestionBlock(block) {
        if (!block) {
            return null;
        }

        const stem = block.stemParts
            .map(part => this.cleanDocxText(part))
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        const options = block.options
            .map(option => this.cleanOptionText(option))
            .filter(Boolean);

        const hasMultipleChoiceShape = options.length >= 4;

        return {
            index: block.index,
            paragraphIndex: block.paragraphIndex,
            stem,
            options,
            imageRelationshipIds: [...new Set(block.imageRelationshipIds)],
            hasMultipleChoiceShape
        };
    }

    buildQuestionBlocks(paragraphs) {
        const blocks = [];
        let current = null;

        for (const paragraph of paragraphs) {
            if (this.isQuestionStart(paragraph)) {
                const finalized = this.finalizeQuestionBlock(current);
                if (finalized) {
                    blocks.push(finalized);
                }

                current = {
                    index: blocks.length + 1,
                    paragraphIndex: paragraph.index,
                    stemParts: [paragraph.text],
                    options: [],
                    imageRelationshipIds: [...paragraph.imageRelationshipIds]
                };
                continue;
            }

            if (!current) {
                continue;
            }

            if (paragraph.imageRelationshipIds.length) {
                current.imageRelationshipIds.push(...paragraph.imageRelationshipIds);
            }

            if (!current.options.length && paragraph.text && !this.isLikelyOptionParagraph(paragraph)) {
                current.stemParts.push(paragraph.text);
                continue;
            }

            if (this.isLikelyOptionParagraph(paragraph)) {
                current.options.push(paragraph.text);
                continue;
            }

            if (!current.options.length && paragraph.text) {
                current.stemParts.push(paragraph.text);
            }
        }

        const finalized = this.finalizeQuestionBlock(current);
        if (finalized) {
            blocks.push(finalized);
        }

        return blocks.filter(block => block.hasMultipleChoiceShape);
    }

    scoreQuestionPair(docxQuestion, bankQuestion, docxName) {
        const stemScore = this.calculateTokenSimilarity(docxQuestion.stem, bankQuestion.question);
        const optionScore = this.calculateOptionSimilarity(docxQuestion.options, bankQuestion.options);
        const docxBase = path.basename(docxName).toLowerCase();

        let score = (stemScore * 0.8) + (optionScore * 0.2);

        const normalizedDocxStem = this.normalizeText(docxQuestion.stem);
        const normalizedBankStem = this.normalizeText(bankQuestion.question);

        if (normalizedDocxStem && normalizedDocxStem === normalizedBankStem) {
            score += 0.08;
        } else if (normalizedDocxStem && normalizedBankStem && (
            normalizedDocxStem.includes(normalizedBankStem) ||
            normalizedBankStem.includes(normalizedDocxStem)
        )) {
            score += 0.04;
        }

        if (typeof bankQuestion.imageUrl === 'string' && bankQuestion.imageUrl.toLowerCase().includes(docxBase)) {
            score += 0.02;
        }

        return Math.min(score, 1);
    }

    matchDocxQuestionsToBank(docxQuestions, allQuestions, docxName) {
        const candidatePairs = [];

        docxQuestions.forEach(docxQuestion => {
            allQuestions.forEach(bankQuestion => {
                const score = this.scoreQuestionPair(docxQuestion, bankQuestion, docxName);
                if (score >= this.matchThreshold) {
                    candidatePairs.push({
                        docxQuestion,
                        bankQuestion,
                        score,
                        confidence: this.classifyConfidence(score)
                    });
                }
            });
        });

        candidatePairs.sort((left, right) => right.score - left.score);

        const usedDocxIndexes = new Set();
        const usedBankIds = new Set();
        const matches = [];

        for (const pair of candidatePairs) {
            if (usedDocxIndexes.has(pair.docxQuestion.index) || usedBankIds.has(pair.bankQuestion.id)) {
                continue;
            }

            usedDocxIndexes.add(pair.docxQuestion.index);
            usedBankIds.add(pair.bankQuestion.id);
            matches.push(pair);
        }

        const unmatchedDocxQuestions = docxQuestions.filter(question => !usedDocxIndexes.has(question.index));
        const unresolvedImageQuestions = unmatchedDocxQuestions.filter(question => question.imageRelationshipIds.length > 0);

        return {
            matches,
            unmatchedDocxQuestions,
            unresolvedImageQuestions
        };
    }

    async extractMappedImages(docxContext, docxName, matches) {
        const docxBaseName = path.parse(docxName).name;

        for (const match of matches) {
            const urls = [];

            for (let imageIndex = 0; imageIndex < match.docxQuestion.imageRelationshipIds.length; imageIndex++) {
                const relationshipId = match.docxQuestion.imageRelationshipIds[imageIndex];
                const target = docxContext.relationshipMap[relationshipId];

                if (!target) {
                    continue;
                }

                const docxInternalPath = target.startsWith('word/') ? target : `word/${target}`;
                const imageFile = docxContext.zip.file(docxInternalPath);

                if (!imageFile) {
                    continue;
                }

                const buffer = await imageFile.async('nodebuffer');
                const extension = path.extname(target).toLowerCase() || '.png';
                const stableName = `${this.slugify(docxBaseName)}__${this.slugify(match.bankQuestion.id)}__${imageIndex + 1}${extension}`;
                const outputPath = path.join(this.outputDir, stableName);

                fs.writeFileSync(outputPath, buffer);
                urls.push(`/elearning-assets/images/questions/${stableName}`);
            }

            match.imageUrls = urls;
            match.imageUrl = urls[0] || null;
        }
    }

    buildQuestionLookup(questionsData) {
        const lookup = new Map();

        Object.entries(questionsData).forEach(([levelKey, levelData]) => {
            Object.entries(levelData.categories || {}).forEach(([categoryKey, categoryData]) => {
                (categoryData.questions || []).forEach((question, index) => {
                    lookup.set(question.id, {
                        levelKey,
                        categoryKey,
                        categoryTitle: categoryData.title,
                        index,
                        question
                    });
                });
            });
        });

        return lookup;
    }

    selectBestMatches(results) {
        const selectedMatches = new Map();
        const duplicateMatches = [];

        results.forEach(result => {
            result.matches.forEach(match => {
                const existing = selectedMatches.get(match.bankQuestion.id);

                if (!existing) {
                    selectedMatches.set(match.bankQuestion.id, { ...match, docxName: result.docxName });
                    return;
                }

                const currentImageCount = (match.imageUrls || []).length;
                const existingImageCount = (existing.imageUrls || []).length;
                const shouldReplace =
                    match.score > existing.score ||
                    (match.score === existing.score && currentImageCount > existingImageCount);

                duplicateMatches.push({
                    questionId: match.bankQuestion.id,
                    keptDocx: shouldReplace ? result.docxName : existing.docxName,
                    skippedDocx: shouldReplace ? existing.docxName : result.docxName,
                    keptScore: Number((shouldReplace ? match.score : existing.score).toFixed(4)),
                    skippedScore: Number((shouldReplace ? existing.score : match.score).toFixed(4))
                });

                if (shouldReplace) {
                    selectedMatches.set(match.bankQuestion.id, { ...match, docxName: result.docxName });
                }
            });
        });

        return { selectedMatches, duplicateMatches };
    }

    async generateUpdatedQuestionsFile(results) {
        try {
            const updatedQuestions = JSON.parse(JSON.stringify(this.questionsData));
            const lookup = this.buildQuestionLookup(updatedQuestions);
            const { selectedMatches } = this.selectBestMatches(results);

            selectedMatches.forEach(match => {
                const entry = lookup.get(match.bankQuestion.id);
                if (!entry) {
                    return;
                }

                if (match.imageUrls && match.imageUrls.length) {
                    entry.question.imageUrl = match.imageUrls[0];
                    entry.question.imageUrls = match.imageUrls;
                } else if (typeof entry.question.imageUrl === 'string' && entry.question.imageUrl.toLowerCase().includes(path.basename(match.docxName).toLowerCase())) {
                    delete entry.question.imageUrl;
                    delete entry.question.imageUrls;
                }

                entry.question.imageMapping = {
                    sourceDocx: match.docxName,
                    confidence: match.confidence,
                    score: Number(match.score.toFixed(4)),
                    matchedDocxQuestionIndex: match.docxQuestion.index
                };
            });

            fs.writeFileSync(this.updatedQuestionsPath, this.generateJSFile(updatedQuestions));
            console.log(`Generated updated questions file: ${this.updatedQuestionsPath}`);
            return true;
        } catch (error) {
            console.error(`Error generating updated questions file: ${error.message}`);
            return false;
        }
    }

    generateJSFile(questionsData) {
        return `// Enhanced Practice Questions Database - UPDATED WITH IMAGES
// Generated by image-mapping-tool.js using DOCX structure-aware matching.

const enhancedPracticeQuestions = ${JSON.stringify(questionsData, null, 2)};

// Adaptive difficulty system
const adaptiveDifficultySystem = {
    adjustDifficulty: function (userPerformance, currentLevel) {
        const avgScore = userPerformance.reduce((a, b) => a + b, 0) / userPerformance.length;

        if (avgScore >= 90) {
            return this.increaseDifficulty(currentLevel);
        } else if (avgScore < 70) {
            return this.decreaseDifficulty(currentLevel);
        }
        return currentLevel;
    },

    increaseDifficulty: function (currentLevel) {
        const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
        const currentIndex = levels.indexOf(currentLevel);
        return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : currentLevel;
    },

    decreaseDifficulty: function (currentLevel) {
        const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
        const currentIndex = levels.indexOf(currentLevel);
        return currentIndex > 0 ? levels[currentIndex - 1] : currentLevel;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { enhancedPracticeQuestions, adaptiveDifficultySystem };
} else {
    window.enhancedPracticeQuestions = enhancedPracticeQuestions;
    window.adaptiveDifficultySystem = adaptiveDifficultySystem;
}
`;
    }

    generateMappingTemplate(results, allQuestions) {
        const template = {
            instructions: [
                'Auto-mapping now uses DOCX structure and text similarity.',
                'Review low-confidence or unmatched image questions first.',
                'If needed, copy a suggestedQuestionId into questionId and re-run manually.'
            ],
            availableQuestions: allQuestions.map(question => ({
                id: question.id,
                level: question.level,
                category: question.category,
                preview: question.question.slice(0, 120)
            })),
            documents: results.map(result => ({
                docxName: result.docxName,
                matchedQuestions: result.matches.map(match => ({
                    docxQuestionIndex: match.docxQuestion.index,
                    docxQuestion: match.docxQuestion.stem,
                    suggestedQuestionId: match.bankQuestion.id,
                    questionId: match.bankQuestion.id,
                    score: Number(match.score.toFixed(4)),
                    confidence: match.confidence,
                    imageUrls: match.imageUrls || []
                })),
                unmatchedDocxQuestions: result.unmatchedDocxQuestions.map(question => ({
                    docxQuestionIndex: question.index,
                    docxQuestion: question.stem,
                    imageCount: question.imageRelationshipIds.length,
                    questionId: null
                }))
            })),
            generatedAt: new Date().toISOString()
        };

        const templatePath = path.join(this.dataDir, 'image-mappings-template.json');
        fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
        console.log(`Generated mapping template: ${templatePath}`);
        return template;
    }

    generateReport(results) {
        const { duplicateMatches } = this.selectBestMatches(results);
        const report = {
            summary: {
                totalDocuments: results.length,
                totalMatchedQuestions: results.reduce((sum, result) => sum + result.matches.length, 0),
                totalExtractedImages: results.reduce((sum, result) => sum + result.matches.reduce((docSum, match) => docSum + (match.imageUrls ? match.imageUrls.length : 0), 0), 0),
                totalDuplicateQuestionAssignments: duplicateMatches.length,
                totalLowConfidenceMatches: results.reduce((sum, result) => sum + result.matches.filter(match => match.confidence === 'low').length, 0),
                totalUnmatchedQuestions: results.reduce((sum, result) => sum + result.unmatchedDocxQuestions.length, 0),
                totalUnresolvedImageQuestions: results.reduce((sum, result) => sum + result.unresolvedImageQuestions.length, 0),
                processedAt: new Date().toISOString()
            },
            duplicateMatches,
            documents: results.map(result => ({
                docxName: result.docxName,
                parsedQuestions: result.parsedQuestions.length,
                matchedQuestions: result.matches.length,
                imagesExtracted: result.matches.reduce((sum, match) => sum + (match.imageUrls ? match.imageUrls.length : 0), 0),
                lowConfidenceMatches: result.matches
                    .filter(match => match.confidence === 'low')
                    .map(match => ({
                        docxQuestionIndex: match.docxQuestion.index,
                        docxQuestion: match.docxQuestion.stem,
                        suggestedQuestionId: match.bankQuestion.id,
                        score: Number(match.score.toFixed(4))
                    })),
                unresolvedImageQuestions: result.unresolvedImageQuestions.map(question => ({
                    docxQuestionIndex: question.index,
                    docxQuestion: question.stem,
                    imageCount: question.imageRelationshipIds.length
                }))
            }))
        };

        const reportPath = path.join(this.dataDir, 'image-mapping-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`Generated report: ${reportPath}`);
        return report;
    }

    async processDocxFile(docxFile, allQuestions) {
        const docxContext = await this.loadDocxContext(docxFile.path);
        const parsedQuestions = this.buildQuestionBlocks(docxContext.paragraphs);
        const matching = this.matchDocxQuestionsToBank(parsedQuestions, allQuestions, docxFile.name);

        await this.extractMappedImages(docxContext, docxFile.name, matching.matches);

        console.log(`Processed ${docxFile.name}: ${parsedQuestions.length} parsed questions, ${matching.matches.length} matches`);

        return {
            docxName: docxFile.name,
            parsedQuestions,
            ...matching
        };
    }

    async processAllDocxFiles() {
        this.initDirectories();

        if (!await this.loadQuestionsData()) {
            return false;
        }

        const docxFiles = fs.readdirSync(this.docxDir)
            .filter(file => file.toLowerCase().endsWith('.docx'))
            .map(file => ({
                name: file,
                path: path.join(this.docxDir, file)
            }));

        console.log(`Found ${docxFiles.length} DOCX files to process`);

        const allQuestions = this.getAllQuestions();
        const results = [];

        for (const docxFile of docxFiles) {
            try {
                results.push(await this.processDocxFile(docxFile, allQuestions));
            } catch (error) {
                console.error(`Failed to process ${docxFile.name}: ${error.message}`);
            }
        }

        this.generateReport(results);
        this.generateMappingTemplate(results, allQuestions);
        await this.generateUpdatedQuestionsFile(results);

        return true;
    }

    async run() {
        console.log('Image Mapping Tool for DOCX to Quiz Questions');
        console.log('=============================================');

        const success = await this.processAllDocxFiles();

        if (success) {
            console.log('Completed DOCX structure-aware image mapping');
        } else {
            console.log('Image mapping failed');
        }

        return success;
    }
}

module.exports = ImageMappingTool;

if (require.main === module) {
    const tool = new ImageMappingTool();
    tool.run().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
