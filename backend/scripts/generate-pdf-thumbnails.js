/**
 * PDF Thumbnail Generator
 * Generates thumbnails from the first page of PDF files
 * Uses pdf-poppler for conversion (requires poppler-utils installed)
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { pathToFileURL } = require('url');
let canvasLib;
let pdfjsLib;
let pdfjsLibPromise;
let canvasLoadError = null;
let pdfjsCjsLoadError = null;
let pdfjsEsmLoadError = null;
let pdfjsGenericLoadError = null;
let dependencyNoticeLogged = false;
const VERBOSE_PDF_THUMBNAIL_LOG =
    process.env.BCL_VERBOSE_STARTUP === '1' ||
    process.env.BCL_PDF_THUMBNAIL_VERBOSE === '1';

function logDependencyNoticeOnce() {
    if (dependencyNoticeLogged) return;

    const reasons = [];
    if (canvasLoadError) reasons.push(`canvas unavailable: ${canvasLoadError.message}`);
    if (pdfjsCjsLoadError) reasons.push(`pdfjs legacy CJS unavailable: ${pdfjsCjsLoadError.message}`);
    if (pdfjsEsmLoadError) reasons.push(`pdfjs legacy ESM unavailable: ${pdfjsEsmLoadError.message}`);
    if (pdfjsGenericLoadError) reasons.push(`pdfjs generic load failed: ${pdfjsGenericLoadError.message}`);

    if (reasons.length > 0) {
        console.warn(`⚠️ PDF thumbnail generation fallback active (${reasons.join(' | ')})`);
        dependencyNoticeLogged = true;
    }
}

try {
    canvasLib = require('canvas');
} catch (e) {
    canvasLoadError = e;
    if (VERBOSE_PDF_THUMBNAIL_LOG) {
        console.warn('canvas library not found or failed to load. PDF.js generation will be disabled.', e.message);
    }
}

try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (e) {
    pdfjsCjsLoadError = e;
    if (VERBOSE_PDF_THUMBNAIL_LOG) {
        console.warn('pdfjs-dist/legacy (CJS) not found, will try ESM legacy build when needed.');
    }
}

// Configuration
const MATERIALS_FILE = path.join(__dirname, '../learning-materials.json');
const MATERIALS_DIR = path.join(__dirname, '../../BC-Learning-Main/elearning-assets/materials');
const THUMBNAILS_DIR = path.join(__dirname, '../public/thumbnails/pdf');
const STANDARD_FONTS_DIR = path.join(__dirname, '../node_modules/pdfjs-dist/standard_fonts/');

function getStandardFontsUrl() {
    let dir = STANDARD_FONTS_DIR;
    if (!dir.endsWith(path.sep)) {
        dir += path.sep;
    }
    try {
        return pathToFileURL(dir).href;
    } catch (error) {
        return dir;
    }
}

async function loadPdfJs() {
    if (pdfjsLib) return pdfjsLib;
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = (async () => {
            try {
                const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
                return mod;
            } catch (error) {
                pdfjsEsmLoadError = error;
                if (VERBOSE_PDF_THUMBNAIL_LOG) {
                    console.warn('pdfjs-dist/legacy ESM not found, trying standard build.');
                }
                try {
                    return require('pdfjs-dist');
                } catch (innerError) {
                    pdfjsGenericLoadError = innerError;
                    if (VERBOSE_PDF_THUMBNAIL_LOG) {
                        console.warn('pdfjs-dist not found or failed to load, JS generation will fail.');
                    }
                    return null;
                }
            }
        })();
    }
    pdfjsLib = await pdfjsLibPromise;
    return pdfjsLib;
}

// Create directories if they don't exist
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`);
    }
}

/**
 * Generate thumbnail using PDF.js (Node Canvas) - Primary Method
 * Does not require external binaries
 */
async function generatePDFThumbnailWithPdfJs(pdfPath, outputPath) {
    if (!canvasLib) {
        logDependencyNoticeOnce();
        return false;
    }
    const pdfjs = await loadPdfJs();
    if (!pdfjs) {
        logDependencyNoticeOnce();
        return false;
    }
    const { createCanvas } = canvasLib;

    class NodeCanvasFactory {
        constructor() {}
        create(width, height) {
            const canvas = createCanvas(width, height);
            const context = canvas.getContext('2d');
            return { canvas, context };
        }
        reset(canvasAndContext, width, height) {
            canvasAndContext.canvas.width = width;
            canvasAndContext.canvas.height = height;
        }
        destroy(canvasAndContext) {
            canvasAndContext.canvas.width = 0;
            canvasAndContext.canvas.height = 0;
            canvasAndContext.canvas = null;
            canvasAndContext.context = null;
        }
    }
    
    try {
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const loadingTask = pdfjs.getDocument({ 
            data,
            standardFontDataUrl: getStandardFontsUrl(),
            CanvasFactory: NodeCanvasFactory
        });
        const pdfDocument = await loadingTask.promise;
        const page = await pdfDocument.getPage(1);
        
        const viewport = page.getViewport({ scale: 1.0 });
        // Scale to width 400px
        const scale = 400 / viewport.width;
        const scaledViewport = page.getViewport({ scale });
        
        const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
        const context = canvas.getContext('2d');
        
        await page.render({
            canvasContext: context,
            viewport: scaledViewport
        }).promise;
        
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
        fs.writeFileSync(outputPath, buffer);
        console.log(`✅ Generated thumbnail with PDF.js: ${path.basename(outputPath)}`);
        return true;
    } catch (error) {
        console.warn(`⚠️ PDF.js generation failed for ${path.basename(pdfPath)}: ${error.message}`);
        return false;
    }
}

/**
 * Generate thumbnail from PDF using pdf-poppler (pdftoppm)
 * Requires poppler-utils to be installed
 */
async function generatePDFThumbnailWithPoppler(pdfPath, outputPath) {
    return new Promise((resolve, reject) => {
        // Try using pdftoppm from poppler-utils
        const outputBase = outputPath.replace(/\.(jpg|png)$/i, '');
        const command = `pdftoppm -jpeg -f 1 -l 1 -scale-to 400 "${pdfPath}" "${outputBase}"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.warn(`⚠️ pdftoppm failed for ${path.basename(pdfPath)}: ${error.message}`);
                resolve(false);
                return;
            }
            
            // pdftoppm adds -1 suffix to output
            const generatedFile = `${outputBase}-1.jpg`;
            if (fs.existsSync(generatedFile)) {
                fs.renameSync(generatedFile, outputPath);
                console.log(`✅ Generated thumbnail: ${path.basename(outputPath)}`);
                resolve(true);
            } else {
                console.warn(`⚠️ Thumbnail file not created: ${generatedFile}`);
                resolve(false);
            }
        });
    });
}

/**
 * Generate a simple placeholder thumbnail with canvas
 */
function generatePlaceholderThumbnail(outputPath, title, category) {
    // Create a simple colored placeholder based on category
    const colors = {
        'autocad': '#007bff',
        'revit': '#28a745',
        'sketchup': '#ffc107',
        '3dsmax': '#dc3545',
        'general': '#6c757d'
    };
    
    const color = colors[category] || colors.general;
    
    // Create an SVG placeholder and convert to base64
    const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
                <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <text x="200" y="120" font-family="Arial, sans-serif" font-size="60" font-weight="bold" text-anchor="middle" fill="white" opacity="0.9">PDF</text>
        <text x="200" y="180" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="white" opacity="0.7">${category.toUpperCase()}</text>
        <text x="200" y="240" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="white" opacity="0.6">${title.substring(0, 30)}${title.length > 30 ? '...' : ''}</text>
    </svg>`;
    
    // Try to create a JPG placeholder with canvas (if available)
    // Also save SVG as reference in case JPG generation isn't available
    if (canvasLib) {
        try {
            const { createCanvas } = canvasLib;
            const canvas = createCanvas(400, 300);
            const ctx = canvas.getContext('2d');

            const gradient = ctx.createLinearGradient(0, 0, 400, 300);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, '#1a1a2e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 400, 300);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = 'bold 60px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PDF', 200, 120);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '16px Arial';
            ctx.fillText(category.toUpperCase(), 200, 180);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '14px Arial';
            const shortTitle = `${title.substring(0, 30)}${title.length > 30 ? '...' : ''}`;
            ctx.fillText(shortTitle, 200, 240);

            fs.writeFileSync(outputPath, canvas.toBuffer('image/jpeg', { quality: 0.8 }));
            console.log(`📄 Created placeholder JPG: ${path.basename(outputPath)}`);
        } catch (error) {
            console.warn(`⚠️ Placeholder JPG creation failed: ${error.message}`);
        }
    }

    const svgPath = outputPath.replace('.jpg', '.svg');
    fs.writeFileSync(svgPath, svg);
    console.log(`📝 Created placeholder SVG: ${path.basename(svgPath)}`);
    return false;
}

/**
 * Try to generate thumbnail using ImageMagick convert (another option)
 */
async function generatePDFThumbnailWithImageMagick(pdfPath, outputPath) {
    return new Promise((resolve, reject) => {
        // ImageMagick command to convert first page of PDF to JPG
        const command = `magick convert -density 150 "${pdfPath}[0]" -resize 400x300 -quality 85 "${outputPath}"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.warn(`⚠️ ImageMagick failed for ${path.basename(pdfPath)}: ${error.message}`);
                resolve(false);
                return;
            }
            
            if (fs.existsSync(outputPath)) {
                console.log(`✅ Generated thumbnail with ImageMagick: ${path.basename(outputPath)}`);
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

/**
 * Main function to generate thumbnails for all PDF materials
 */
async function generateAllThumbnails() {
    console.log('🖼️ PDF Thumbnail Generator Started');
    console.log('================================');
    
    // Ensure directories exist
    ensureDirectoryExists(THUMBNAILS_DIR);
    ensureDirectoryExists(MATERIALS_DIR);
    
    // Read materials file
    if (!fs.existsSync(MATERIALS_FILE)) {
        console.error('❌ Materials file not found:', MATERIALS_FILE);
        return;
    }
    
    const materialsData = JSON.parse(fs.readFileSync(MATERIALS_FILE, 'utf-8'));
    const materials = materialsData.materials || [];
    
    console.log(`📚 Found ${materials.length} materials to process`);
    
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    
    for (const material of materials) {
        console.log(`\n📄 Processing: ${material.title}`);
        
        // Construct file paths
        const pdfFilename = path.basename(material.filePath);
        const pdfPath = path.join(MATERIALS_DIR, pdfFilename);
        const thumbnailFilename = pdfFilename.replace(/\.pdf$/i, '.jpg');
        const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
        
        // Check if thumbnail already exists
        if (fs.existsSync(thumbnailPath)) {
            console.log(`⏭️ Thumbnail already exists: ${thumbnailFilename}`);
            skippedCount++;
            continue;
        }
        
        // Check if PDF exists
        if (!fs.existsSync(pdfPath)) {
            console.warn(`⚠️ PDF file not found: ${pdfPath}`);
            // Generate placeholder
            generatePlaceholderThumbnail(thumbnailPath, material.title, material.category);
            failCount++;
            continue;
        }
        
        // Try different methods to generate thumbnail
        let success = false;
        
        // Method 1: Try PDF.js (Node Canvas) - Most reliable cross-platform
        success = await generatePDFThumbnailWithPdfJs(pdfPath, thumbnailPath);

        // Method 2: Try pdftoppm (poppler-utils)
        if (!success) {
            success = await generatePDFThumbnailWithPoppler(pdfPath, thumbnailPath);
        }
        
        // Method 3: Try ImageMagick if others failed
        if (!success) {
            success = await generatePDFThumbnailWithImageMagick(pdfPath, thumbnailPath);
        }
        // Method 1: Try PDF.js (Node Canvas) - Most reliable cross-platform
        success = await generatePDFThumbnailWithPdfJs(pdfPath, thumbnailPath);

        // Method 2: Try pdftoppm (poppler-utils)
        if (!success) {
            success = await generatePDFThumbnailWithPoppler(pdfPath, thumbnailPath);
        }
        
        // Method 3: Try ImageMagick if others failed
        if (!success) {
            success = await generatePDFThumbnailWithImageMagick(pdfPath, thumbnailPath);
        }
        
        // Method 3: Generate placeholder if both failed
        if (!success) {
            generatePlaceholderThumbnail(thumbnailPath, material.title, material.category);
            failCount++;
        } else {
            successCount++;
        }
    }
    
    console.log('\n================================');
    console.log('📊 Summary:');
    console.log(`   ✅ Successfully generated: ${successCount}`);
    console.log(`   ⏭️ Skipped (already exist): ${skippedCount}`);
    console.log(`   ❌ Failed/Placeholder: ${failCount}`);
    console.log('================================');
}

/**
 * Generate thumbnail for a single PDF
 */
async function generateSingleThumbnail(materialId) {
    console.log(`🖼️ Generating thumbnail for material ID: ${materialId}`);
    
    ensureDirectoryExists(THUMBNAILS_DIR);
    
    if (!fs.existsSync(MATERIALS_FILE)) {
        console.error('❌ Materials file not found');
        return false;
    }
    
    const materialsData = JSON.parse(fs.readFileSync(MATERIALS_FILE, 'utf-8'));
    const material = materialsData.materials.find(m => m.id == materialId);
    
    if (!material) {
        console.error(`❌ Material with ID ${materialId} not found`);
        return false;
    }
    
    const pdfFilename = path.basename(material.filePath);
    const pdfPath = path.join(MATERIALS_DIR, pdfFilename);
    const thumbnailFilename = pdfFilename.replace(/\.pdf$/i, '.jpg');
    const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
    
    if (!fs.existsSync(pdfPath)) {
        console.warn(`⚠️ PDF file not found: ${pdfPath}`);
        generatePlaceholderThumbnail(thumbnailPath, material.title, material.category);
        return false;
    }
    
    let success = await generatePDFThumbnailWithPdfJs(pdfPath, thumbnailPath);

    if (!success) {
        success = await generatePDFThumbnailWithPoppler(pdfPath, thumbnailPath);
    }
    
    if (!success) {
        success = await generatePDFThumbnailWithImageMagick(pdfPath, thumbnailPath);
    }
    
    if (!success) {
        generatePlaceholderThumbnail(thumbnailPath, material.title, material.category);
    }
    
    return success;
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args[0] === '--single' && args[1]) {
        generateSingleThumbnail(args[1]).then(success => {
            process.exit(success ? 0 : 1);
        });
    } else {
        generateAllThumbnails().then(() => {
            console.log('🏁 PDF Thumbnail generation complete');
        }).catch(error => {
            console.error('❌ Error:', error);
            process.exit(1);
        });
    }
}

module.exports = {
    generateAllThumbnails,
    generateSingleThumbnail,
    generatePDFThumbnailWithPdfJs,
    generatePDFThumbnailWithPoppler,
    generatePDFThumbnailWithImageMagick
};
