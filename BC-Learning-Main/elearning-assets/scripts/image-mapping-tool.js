// Image Mapping Tool for DOCX to Quiz Questions
// Extracts images from DOCX files and maps them to quiz questions

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { DOMParser } = require('xmldom');

class ImageMappingTool {
    constructor() {
        this.questionsData = null;
        this.imageMappings = new Map();
        this.outputDir = path.join(__dirname, '../images/questions');
        this.docxDir = path.join(__dirname, '../test'); // Directory containing DOCX files - BC-Learning-Main/elearning-assets/test
    }

    // Initialize directories
    initDirectories() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
            console.log(`✅ Created output directory: ${this.outputDir}`);
        }
    }

    // Load questions data
    async loadQuestionsData() {
        try {
            const questionsPath = path.join(__dirname, '../js/enhanced-practice-questions.js');
            const questionsContent = fs.readFileSync(questionsPath, 'utf8');

            // Extract the questions object from the JS file
            const match = questionsContent.match(/const enhancedPracticeQuestions = ({[\s\S]*?});/);
            if (match) {
                // Use eval in a safe context to parse the object
                const questionsData = eval(`(${match[1]})`);
                this.questionsData = questionsData;
                console.log(`✅ Loaded questions data with ${Object.keys(questionsData).length} levels`);
                return true;
            } else {
                console.error('❌ Could not parse questions data from file');
                return false;
            }
        } catch (error) {
            console.error('❌ Error loading questions data:', error.message);
            return false;
        }
    }

    // Extract images from DOCX file
    async extractImagesFromDocx(docxPath, docxName) {
        try {
            console.log(`🔄 Processing DOCX: ${docxName}`);

            const fileBuffer = fs.readFileSync(docxPath);
            const zip = await JSZip.loadAsync(fileBuffer);

            const images = [];
            const imageFiles = zip.filter((path) => path.startsWith('word/media/'));

            for (const imageFile of imageFiles) {
                try {
                    const imageBuffer = await imageFile.async('nodebuffer');
                    const extension = path.extname(imageFile.name).toLowerCase();

                    if (['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(extension)) {
                        // Generate unique filename
                        const timestamp = Date.now();
                        const randomId = Math.random().toString(36).substr(2, 9);
                        const newFilename = `${docxName}_${timestamp}_${randomId}${extension}`;
                        const outputPath = path.join(this.outputDir, newFilename);

                        // Save image
                        fs.writeFileSync(outputPath, imageBuffer);

                        // Get image metadata
                        const imageData = {
                            originalName: path.basename(imageFile.name),
                            docxName: docxName,
                            newFilename: newFilename,
                            url: `/elearning-assets/images/questions/${newFilename}`,
                            size: imageBuffer.length,
                            extension: extension
                        };

                        images.push(imageData);
                        console.log(`  📸 Extracted: ${imageData.originalName} → ${newFilename}`);
                    }
                } catch (error) {
                    console.warn(`  ⚠️ Failed to extract image ${imageFile.name}:`, error.message);
                }
            }

            console.log(`✅ Extracted ${images.length} images from ${docxName}`);
            return images;

        } catch (error) {
            console.error(`❌ Error processing DOCX ${docxName}:`, error.message);
            return [];
        }
    }

    // Create mapping between questions and images
    createQuestionImageMapping(images, docxName) {
        const mappings = [];

        console.log(`🔍 Creating image mappings for ${docxName}`);
        console.log(`   📸 Found ${images.length} images in ${docxName}`);

        // For now, create mappings based on image order in DOCX
        // This can be improved with more sophisticated matching later
        images.forEach((image, index) => {
            // Create a mapping entry for each image
            // The question association will be done manually or through better matching
            const mapping = {
                docxName: docxName,
                imageIndex: index,
                imageUrl: image.url,
                imageOriginalName: image.originalName,
                newFilename: image.newFilename,
                extractedAt: new Date().toISOString(),
                status: 'extracted', // Will be updated when mapped to questions
                questionId: null, // To be filled when mapping to questions
                confidence: 'auto-extracted'
            };

            mappings.push(mapping);
            console.log(`  📸 Image ${index + 1}: ${image.originalName} → ${image.newFilename}`);
        });

        return mappings;
    }

    // Get questions by DOCX filename
    getQuestionsByDocx(docxName) {
        const allQuestions = [];

        if (!this.questionsData) return allQuestions;

        // Extract questions from all levels and categories
        Object.keys(this.questionsData).forEach(levelKey => {
            const level = this.questionsData[levelKey];

            if (level.categories) {
                Object.keys(level.categories).forEach(categoryKey => {
                    const category = level.categories[categoryKey];
                    const questions = category.questions || [];

                    questions.forEach(question => {
                        // Check if question belongs to this DOCX (you can add more sophisticated matching)
                        allQuestions.push({
                            ...question,
                            level: levelKey,
                            category: categoryKey,
                            docxName: docxName
                        });
                    });
                });
            }
        });

        return allQuestions;
    }

    // Process all DOCX files in directory
    async processAllDocxFiles() {
        try {
            console.log('🚀 Starting batch image extraction and mapping...');
            console.log(`📂 Input directory: ${this.docxDir}`);
            console.log(`📂 Output directory: ${this.outputDir}`);

            this.initDirectories();

            // Load questions data first
            if (!await this.loadQuestionsData()) {
                console.error('❌ Cannot proceed without questions data');
                return false;
            }

            // Get all DOCX files
            const docxFiles = fs.readdirSync(this.docxDir)
                .filter(file => file.toLowerCase().endsWith('.docx'))
                .map(file => ({
                    name: file,
                    path: path.join(this.docxDir, file)
                }));

            console.log(`📋 Found ${docxFiles.length} DOCX files to process`);

            const allMappings = [];

            // Process each DOCX file
            for (const docxFile of docxFiles) {
                try {
                    // Extract images
                    const images = await this.extractImagesFromDocx(docxFile.path, docxFile.name);

                    // Create mappings
                    const mappings = this.createQuestionImageMapping(images, docxFile.name);

                    allMappings.push(...mappings);

                } catch (error) {
                    console.error(`❌ Failed to process ${docxFile.name}:`, error.message);
                }
            }

            // Save mappings
            const mappingsPath = path.join(__dirname, '../data/image-mappings.json');
            fs.writeFileSync(mappingsPath, JSON.stringify(allMappings, null, 2));

            console.log(`✅ Saved ${allMappings.length} image mappings to ${mappingsPath}`);

            // Generate mapping template for manual association
            await this.generateMappingTemplate(allMappings);

            console.log('🎉 Batch processing completed successfully!');
            console.log('\n📋 MANUAL STEP REQUIRED:');
            console.log('   1. Edit the generated image-mappings-template.json file');
            console.log('   2. Manually associate questionId with each image');
            console.log('   3. Run the tool again with --apply-mappings flag');
            console.log('   4. Or manually update questions with correct imageUrl');

            return true;

        } catch (error) {
            console.error('❌ Batch processing failed:', error.message);
            return false;
        }
    }

    // Generate updated questions file with image URLs
    async generateUpdatedQuestionsFile(mappings) {
        try {
            console.log('🔄 Generating updated questions file with images...');

            // Create a mapping lookup
            const imageLookup = {};
            mappings.forEach(mapping => {
                imageLookup[mapping.questionId] = mapping.imageUrl;
            });

            // Deep clone and update questions data
            const updatedQuestions = JSON.parse(JSON.stringify(this.questionsData));

            let updatedCount = 0;

            // Update each question with image URL if available
            Object.keys(updatedQuestions).forEach(levelKey => {
                const level = updatedQuestions[levelKey];

                if (level.categories) {
                    Object.keys(level.categories).forEach(categoryKey => {
                        const category = level.categories[categoryKey];
                        const questions = category.questions || [];

                        questions.forEach(question => {
                            if (imageLookup[question.id]) {
                                question.imageUrl = imageLookup[question.id];
                                updatedCount++;
                                console.log(`  📸 Added image to question: ${question.id}`);
                            }
                        });
                    });
                }
            });

            // Generate new JavaScript file
            const outputPath = path.join(__dirname, '../js/enhanced-practice-questions-updated.js');
            const jsContent = this.generateJSFile(updatedQuestions);

            fs.writeFileSync(outputPath, jsContent);

            console.log(`✅ Generated updated questions file: ${outputPath}`);
            console.log(`📊 Updated ${updatedCount} questions with images`);

            return true;

        } catch (error) {
            console.error('❌ Error generating updated questions file:', error.message);
            return false;
        }
    }

    // Generate JavaScript file content
    generateJSFile(questionsData) {
        return `// Enhanced Practice Questions Database - UPDATED WITH IMAGES
// Level-specific practice questions with detailed explanations and images

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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { enhancedPracticeQuestions, adaptiveDifficultySystem };
} else {
    window.enhancedPracticeQuestions = enhancedPracticeQuestions;
    window.adaptiveDifficultySystem = adaptiveDifficultySystem;
}
`;
    }

    // Generate mapping template for manual association
    async generateMappingTemplate(mappings) {
        try {
            console.log('📝 Generating mapping template for manual association...');

            // Get all available questions for reference
            const allQuestions = this.getAllQuestions();

            const template = {
                instructions: [
                    "This file contains extracted images from DOCX files.",
                    "Each image needs to be manually associated with a question ID.",
                    "Fill in the 'questionId' field for each image that should be associated with a question.",
                    "Leave 'questionId' as null for images that don't belong to any question.",
                    "After filling this file, run the tool again or manually update the questions."
                ],
                availableQuestions: allQuestions.map(q => ({
                    id: q.id,
                    preview: q.question.substring(0, 100) + '...',
                    category: q.category,
                    level: q.level
                })),
                mappings: mappings.map(mapping => ({
                    ...mapping,
                    instructions: "Fill 'questionId' with the ID of the question this image belongs to, or leave as null"
                })),
                generatedAt: new Date().toISOString(),
                totalImages: mappings.length,
                totalQuestions: allQuestions.length
            };

            const templatePath = path.join(__dirname, '../data/image-mappings-template.json');
            fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));

            console.log(`✅ Generated mapping template: ${templatePath}`);
            console.log(`📊 Template contains ${mappings.length} images to map to ${allQuestions.length} questions`);

            return template;

        } catch (error) {
            console.error('❌ Error generating mapping template:', error.message);
            return null;
        }
    }

    // Get all questions for reference
    getAllQuestions() {
        const allQuestions = [];

        if (!this.questionsData) return allQuestions;

        Object.keys(this.questionsData).forEach(levelKey => {
            const level = this.questionsData[levelKey];

            if (level.categories) {
                Object.keys(level.categories).forEach(categoryKey => {
                    const category = level.categories[categoryKey];
                    const questions = category.questions || [];

                    questions.forEach(question => {
                        allQuestions.push({
                            id: question.id,
                            question: question.question,
                            level: levelKey,
                            category: categoryKey
                        });
                    });
                });
            }
        });

        return allQuestions;
    }

    // Generate report
    generateReport(mappings, totalImages) {
        const report = {
            summary: {
                totalMappings: mappings.length,
                totalImages: totalImages,
                processedAt: new Date().toISOString()
            },
            mappings: mappings,
            recommendations: [
                "Review image mappings manually to ensure accuracy",
                "Test quiz with images to verify display",
                "Consider adding image alt text for accessibility",
                "Optimize image sizes for web performance"
            ]
        };

        const reportPath = path.join(__dirname, '../data/image-mapping-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`📊 Generated report: ${reportPath}`);
        return report;
    }

    // Main execution method
    async run() {
        console.log('🎨 Image Mapping Tool for DOCX to Quiz Questions');
        console.log('================================================');

        const success = await this.processAllDocxFiles();

        if (success) {
            console.log('\n🎉 SUCCESS: Images extracted and mapped to questions!');
            console.log('📋 Next steps:');
            console.log('   1. Review the generated mappings in image-mappings.json');
            console.log('   2. Test the quiz with images');
            console.log('   3. Replace the original questions file if satisfied');
        } else {
            console.log('\n❌ FAILED: Image mapping process encountered errors');
        }

        return success;
    }
}

// Export for use as module or direct execution
module.exports = ImageMappingTool;

// Allow direct execution
if (require.main === module) {
    const tool = new ImageMappingTool();
    tool.run().catch(console.error);
}
