#!/usr/bin/env node

/**
 * PDF TOC Analysis CLI Tool
 * Usage: node scripts/analyze-pdf-toc.js [options] [pdf-file]
 */

const path = require('path');
const fs = require('fs');
const PdfTocExtractor = require('../utils/pdfTocExtractor');

const args = process.argv.slice(2);
const extractor = new PdfTocExtractor();

// CLI argument parsing
function parseArgs() {
    const options = {
        all: false,
        force: false,
        material: null,
        output: 'console',
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--all':
            case '-a':
                options.all = true;
                break;
            case '--force':
            case '-f':
                options.force = true;
                break;
            case '--material':
            case '-m':
                options.material = args[++i];
                break;
            case '--output':
            case '-o':
                options.output = args[++i] || 'console';
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                // If it doesn't start with -, assume it's a file path
                if (!arg.startsWith('-')) {
                    options.file = arg;
                }
                break;
        }
    }

    return options;
}

function printHelp() {
    console.log(`
📖 PDF TOC Analysis Tool

Usage: node scripts/analyze-pdf-toc.js [options] [pdf-file]

Options:
  -a, --all              Analyze all PDFs in materials folder
  -f, --force            Force refresh cached TOC data
  -m, --material <id>    Analyze specific material by ID
  -o, --output <type>    Output format: console, json, stats
  -h, --help             Show this help message

Examples:
  # Analyze single PDF file
  node scripts/analyze-pdf-toc.js "/path/to/document.pdf"

  # Analyze all PDFs in materials folder
  node scripts/analyze-pdf-toc.js --all

  # Force refresh TOC for specific material
  node scripts/analyze-pdf-toc.js --force --material bim-modul-01

  # Get cache statistics
  node scripts/analyze-pdf-toc.js --output stats

Files are expected to be in: BC-Learning-Main/elearning-assets/materials/
Cache is stored in: backend/data/pdf-toc-cache.json
`);
}

function formatTOCOutput(tocData) {
    const output = {
        materialId: tocData.materialId,
        totalPages: tocData.totalPages,
        chaptersFound: tocData.chapters.length,
        method: tocData.method,
        confidence: tocData.confidence,
        lastAnalyzed: tocData.lastAnalyzed,
        chapters: tocData.chapters.slice(0, 10), // Show first 10 chapters
        ...(tocData.chapters.length > 10 && { truncated: true, totalChapters: tocData.chapters.length })
    };

    return output;
}

function displayTOC(tocData) {
    console.log(`\n📖 TOC Analysis Results`);
    console.log(`═══════════════════════════════`);
    console.log(`Material ID: ${tocData.materialId}`);
    console.log(`Total Pages: ${tocData.totalPages}`);
    console.log(`Chapters Found: ${tocData.chapters.length}`);
    console.log(`Extraction Method: ${tocData.method}`);
    console.log(`Confidence: ${(tocData.confidence * 100).toFixed(1)}%`);
    console.log(`Last Analyzed: ${new Date(tocData.lastAnalyzed).toLocaleString()}`);

    if (tocData.error) {
        console.log(`❌ Error: ${tocData.error}`);
    }

    if (tocData.chapters.length > 0) {
        console.log(`\n📑 Chapters:`);
        tocData.chapters.slice(0, 15).forEach((chapter, index) => {
            const indent = '  '.repeat(chapter.level - 1);
            console.log(`${indent}${index + 1}. "${chapter.title}" → Page ${chapter.page}`);
        });

        if (tocData.chapters.length > 15) {
            console.log(`   ... and ${tocData.chapters.length - 15} more chapters`);
        }
    } else {
        console.log(`\n⚠️ No chapters detected`);
    }
}

function displayStats(stats) {
    console.log(`\n📊 TOC Cache Statistics`);
    console.log(`═══════════════════════════════`);
    console.log(`Total Materials: ${stats.totalMaterials}`);
    console.log(`Average Chapters per Material: ${stats.avgChapters}`);
    console.log(`Total Chapters: ${stats.totalChapters}`);

    if (Object.keys(stats.methods).length > 0) {
        console.log(`\n📈 Extraction Methods:`);
        Object.entries(stats.methods).forEach(([method, count]) => {
            console.log(`   ${method}: ${count} materials`);
        });
    }
}

async function main() {
    const options = parseArgs();

    if (options.help) {
        printHelp();
        return;
    }

    try {
        if (options.output === 'stats') {
            // Display cache statistics
            const stats = extractor.getCacheStats();
            displayStats(stats);
            return;
        }

        if (options.all) {
            // Analyze all PDFs in materials folder
            console.log('🔍 Starting analysis of all PDFs in materials folder...\n');

            const results = await extractor.analyzeAllMaterials();

            console.log(`\n📋 Analysis Summary:`);
            console.log(`═══════════════════════`);
            console.log(`Total PDFs: ${results.totalFiles}`);
            console.log(`Successful: ${results.successful}`);
            console.log(`Failed: ${results.failed}`);

            if (results.results.length > 0) {
                console.log(`\n📄 Detailed Results:`);
                results.results.forEach(result => {
                    const status = result.success ? '✅' : '❌';
                    const detail = result.success ?
                        `${result.chaptersFound} chapters (${result.method})` :
                        result.error;
                    console.log(`${status} ${result.file}: ${detail}`);
                });
            }

        } else if (options.material) {
            // Analyze specific material by ID
            const materialsPath = path.join(__dirname, '../../BC-Learning-Main/elearning-assets/materials');
            const materialFile = findMaterialFile(options.material, materialsPath);

            if (!materialFile) {
                console.error(`❌ Material "${options.material}" not found in materials folder`);
                process.exit(1);
            }

            const pdfPath = path.join(materialsPath, materialFile);
            console.log(`🔍 Analyzing material: ${options.material} (${materialFile})`);

            const tocData = await extractor.extractTOC(pdfPath, options.material, {
                forceRefresh: options.force
            });

            displayTOC(tocData);

        } else if (options.file) {
            // Analyze specific file
            const pdfPath = path.resolve(options.file);

            if (!fs.existsSync(pdfPath)) {
                console.error(`❌ File not found: ${pdfPath}`);
                process.exit(1);
            }

            const materialId = extractor.generateMaterialId(path.basename(pdfPath));
            console.log(`🔍 Analyzing file: ${path.basename(pdfPath)}`);

            const tocData = await extractor.extractTOC(pdfPath, materialId, {
                forceRefresh: options.force
            });

            displayTOC(tocData);

        } else {
            // No specific action requested
            console.log('❓ No action specified. Use --help for usage information.');
            console.log('\nQuick examples:');
            console.log('  node scripts/analyze-pdf-toc.js --all');
            console.log('  node scripts/analyze-pdf-toc.js --material bim-modul-01');
            console.log('  node scripts/analyze-pdf-toc.js "/path/to/file.pdf"');
        }

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Helper function to find material file by ID
function findMaterialFile(materialId, materialsPath) {
    try {
        const files = fs.readdirSync(materialsPath);
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        // Look for exact match first
        let match = pdfFiles.find(file => {
            const fileId = extractor.generateMaterialId(file);
            return fileId === materialId;
        });

        if (match) return match;

        // Look for partial match
        match = pdfFiles.find(file => {
            const fileId = extractor.generateMaterialId(file);
            return fileId.includes(materialId) || materialId.includes(fileId);
        });

        return match;
    } catch (error) {
        return null;
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

// Run the main function
main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
});
