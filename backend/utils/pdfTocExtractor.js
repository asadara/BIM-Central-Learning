const fs = require('fs');
const path = require('path');
const PDFParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * PDF TOC Extractor - Automatically extracts Table of Contents from PDF files
 * Supports pattern recognition for common TOC formats
 */
class PdfTocExtractor {
    constructor() {
        this.tocCache = {};
        this.cacheFile = path.join(__dirname, '../data/pdf-toc-cache.json');
        this.loadCache();
    }

    /**
     * Load cached TOC data
     */
    loadCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const cacheData = fs.readFileSync(this.cacheFile, 'utf8');
                this.tocCache = JSON.parse(cacheData);
                console.log(`📚 Loaded TOC cache for ${Object.keys(this.tocCache).length} PDFs`);
            } else {
                this.tocCache = {};
                console.log('📚 No TOC cache found, starting fresh');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load TOC cache:', error.message);
            this.tocCache = {};
        }
    }

    /**
     * Save TOC cache to file
     */
    saveCache() {
        try {
            const cacheDir = path.dirname(this.cacheFile);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            fs.writeFileSync(this.cacheFile, JSON.stringify(this.tocCache, null, 2));
            console.log('💾 TOC cache saved');
        } catch (error) {
            console.error('❌ Failed to save TOC cache:', error.message);
        }
    }

    /**
     * Extract TOC from a PDF using robust pattern-based extraction for BIM documents
     * @param {string} filePath - Path to the PDF file
     * @param {string} materialId - Unique identifier for the material
     * @param {object} options - Extraction options
     * @returns {Promise<object>} TOC data
     */
    async extractTOC(filePath, materialId, options = {}) {
        const { forceRefresh = false } = options;

        // Check cache first (unless force refresh)
        if (!forceRefresh && this.tocCache[materialId]) {
            const cached = this.tocCache[materialId];
            const cacheAge = Date.now() - new Date(cached.lastAnalyzed).getTime();
            const cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours

            if (cacheAge < cacheMaxAge) {
                console.log(`📋 Using cached TOC for ${materialId} (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                return cached;
            }
        }

        console.log(`🔍 Extracting TOC for ${materialId} using BIM document pattern recognition`);

        try {
            // Extract text from PDF
            const pdfResult = await this.extractFromPDF(filePath);
            const { text: extractedText, totalPages } = pdfResult;

            console.log(`📖 PDF text extracted: ${extractedText.length} characters, ${totalPages} pages`);

            // Use robust BIM document pattern extraction
            const tocData = this.extractBIMDocumentTOC(extractedText, totalPages);

            // Cache and return result
            const result = {
                materialId,
                chapters: tocData.chapters,
                totalPages: totalPages,
                method: 'bim-pattern-recognition',
                lastAnalyzed: new Date().toISOString(),
                confidence: tocData.confidence,
                source: 'pdf'
            };

            this.tocCache[materialId] = result;
            this.saveCache();

            console.log(`✅ TOC extraction complete: ${tocData.chapters.length} chapters found`);
            return result;

        } catch (error) {
            console.error(`❌ TOC extraction failed for ${materialId}:`, error.message);

            // Return minimal fallback TOC
            const result = {
                materialId,
                chapters: this.createMinimalFallbackTOC(),
                totalPages: 1,
                method: 'error-fallback',
                lastAnalyzed: new Date().toISOString(),
                confidence: 0.1,
                error: error.message
            };

            return result;
        }
    }

    /**
     * Extract text content from DOCX file
     */
    async extractFromDOCX(docxPath) {
        console.log(`📄 Reading DOCX file: ${docxPath}`);

        const result = await mammoth.extractRawText({ path: docxPath });
        const text = result.value;

        // Estimate pages (rough approximation: ~3000 chars per page for DOCX)
        const estimatedPages = Math.max(1, Math.ceil(text.length / 3000));

        return {
            text: text,
            estimatedPages: estimatedPages
        };
    }

    /**
     * Extract text content from PDF file
     */
    async extractFromPDF(pdfPath) {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const parser = new PDFParse.PDFParse({ data: pdfBuffer });

        try {
            let info = null;
            let textResult = null;

            try {
                info = await parser.getInfo();
            } catch (error) {
                console.warn(`Failed to read PDF info for ${pdfPath}: ${error.message}`);
            }

            try {
                textResult = await parser.getText();
            } catch (error) {
                console.warn(`Failed to extract PDF text for ${pdfPath}: ${error.message}`);
            }

            const infoTotal = Number(info?.total);
            const textTotal = Number(textResult?.total);
            const totalPages = Number.isFinite(infoTotal) && infoTotal > 0
                ? infoTotal
                : (Number.isFinite(textTotal) && textTotal > 0 ? textTotal : 1);

            return {
                text: textResult?.text || '',
                totalPages: totalPages
            };
        } finally {
            await parser.destroy();
        }
    }

    /**
     * Extract text from a specific PDF page
     */
    async getPageText(pdfBuffer, pageNum) {
        // Use pdf-parse to extract all text and estimate page boundaries
        const parser = new PDFParse.PDFParse({ data: pdfBuffer });

        try {
            const textResult = await parser.getText();
            const text = textResult?.text || '';

            // Simple page estimation (approximate)
            const avgCharsPerPage = 2000;
            const startChar = (pageNum - 1) * avgCharsPerPage;
            const endChar = pageNum * avgCharsPerPage;

            return text.substring(startChar, endChar);
        } finally {
            await parser.destroy();
        }
    }

    /**
     * Robust BIM Document TOC Extraction - Single method for Indonesian BIM documents
     * Focuses on "BAB" patterns commonly used in BIM documentation
     */
    extractBIMDocumentTOC(text, totalPages) {
        const chapters = [];
        const lines = text.split('\n').filter(line => line.trim().length > 0);

        console.log(`🎯 Extracting BIM TOC from ${lines.length} lines, ${totalPages} pages`);
        console.log(`📝 First 20 lines of PDF text:`);
        for (let i = 0; i < Math.min(20, lines.length); i++) {
            console.log(`   ${i + 1}: "${lines[i]}"`);
        }

        // BIM document patterns (most common in Indonesian BIM docs)
        const bimPatterns = [
            // Main pattern: "BAB 1 - Chapter Title" or "BAB 1. Chapter Title"
            /^BAB\s+(\d+)\s*[-.–]\s*(.+)$/i,
            // Alternative: "BAB 1 Chapter Title" (space separator)
            /^BAB\s+(\d+)\s+(.+)$/i,
            // Numbered sections: "1. Chapter Title" or "2. Chapter Title"
            /^\d+\.\s*(.+)$/i,
            // Chapter keywords in any context
            /(?:BAB|Bab|bab)\s+(\d+)[\s:-]*(.+)$/i,
            // General chapter patterns (Indonesian and English)
            /(?:Chapter|Bab|Section|Bagian|Bab|Bagian)\s+(\d+)[\s:-]*(.+)$/i,
            // Indonesian specific patterns
            /(?:BAB|Bagian)\s+(\d+)[\s.:-]*(.+)$/i
        ];

        let foundChapters = 0;

        // Process each line
        for (let i = 0; i < lines.length && foundChapters < 20; i++) {
            const line = lines[i].trim();

            // Skip lines that are too short/long or contain unwanted content
            if (line.length < 3 || line.length > 100) continue;
            if (this.isUnwantedLine(line)) continue;

            // Try to match BIM patterns
            for (const pattern of bimPatterns) {
                const match = line.match(pattern);
                if (match) {
                    let chapterNum, title;

                    if (match.length >= 3) {
                        // Pattern with both number and title
                        chapterNum = parseInt(match[1]);
                        title = match[2].trim();
                    } else if (match.length >= 2) {
                        // Pattern with just title
                        chapterNum = foundChapters + 1;
                        title = match[1].trim();
                    } else {
                        // Fallback
                        chapterNum = foundChapters + 1;
                        title = line;
                    }

                    // Look for page number in nearby lines
                    const pageNum = this.extractPageFromNearbyLines(lines, i);

                    // Validate and add chapter
                    if (title && title.length > 2 && pageNum && pageNum > 0 && pageNum <= totalPages) {
                        // Clean title (remove extra page numbers, trailing dots, etc.)
                        const cleanTitle = title
                            .replace(/\d+\s*$/, '') // Remove trailing numbers
                            .replace(/\.\s*$/, '') // Remove trailing dots
                            .replace(/^\d+\.\s*/, '') // Remove leading numbers
                            .trim();

                        if (cleanTitle.length > 2) {
                            chapters.push({
                                title: cleanTitle,
                                page: pageNum,
                                level: 1
                            });

                            foundChapters++;
                            console.log(`📄 Found chapter ${chapterNum}: "${cleanTitle}" → Page ${pageNum}`);
                            break; // Stop checking other patterns for this line
                        }
                    }
                }
            }
        }

        // Sort by page number and remove duplicates
        chapters.sort((a, b) => a.page - b.page);
        const uniqueChapters = chapters.filter((chapter, index, self) =>
            index === self.findIndex(c => c.page === chapter.page)
        );

        console.log(`📊 TOC extraction summary: ${foundChapters} matches found, ${uniqueChapters.length} unique chapters`);

        // If no chapters found, create a more intelligent fallback based on document structure
        if (uniqueChapters.length === 0) {
            console.log('⚠️ No BIM patterns found, creating intelligent fallback based on document structure');

            // Look for any headings or numbered sections in the document
            const intelligentFallback = this.createIntelligentFallbackTOC(text, totalPages);

            if (intelligentFallback.chapters.length > 0) {
                console.log(`✅ Created ${intelligentFallback.chapters.length} intelligent fallback chapters`);
                return intelligentFallback;
            } else {
                console.log('⚠️ Using minimal fallback TOC');
                return {
                    chapters: this.createMinimalFallbackTOC(),
                    confidence: 0.1
                };
            }
        }

        console.log(`✅ BIM TOC extraction successful: ${uniqueChapters.length} chapters`);

        return {
            chapters: uniqueChapters,
            confidence: uniqueChapters.length > 2 ? 0.9 : 0.6
        };
    }

    /**
     * Check if a line contains unwanted content for TOC extraction
     */
    isUnwantedLine(line) {
        const unwantedPatterns = [
            /^\d+$/, // Just numbers
            /halaman/i, // Page references
            /gambar/i, // Image references
            /tabel/i, // Table references
            /daftar isi/i, // TOC headers (Indonesian)
            /table of contents/i, // TOC headers (English)
            /isi dokumen/i, // Document contents
            /daftar gambar/i, // Image list headers
            /daftar tabel/i, // Table list headers
            /daftar pustaka/i, // Bibliography headers
            /^\s*\d+\.\d+/, // Sub-chapters (1.1, 2.2, etc.)
            /^\s*\d+\.\d+\.\d+/, // Sub-sub-chapters
            /^\s*-+\s*$/, // Separator lines
            /^\s*=+\s*$/, // Separator lines
            /^\s*_+\s*$/, // Separator lines
        ];

        const lineLower = line.toLowerCase();
        return unwantedPatterns.some(pattern => pattern.test(lineLower));
    }

    /**
     * Create minimal fallback TOC when extraction fails
     */
    createMinimalFallbackTOC() {
        return [
            { title: 'Introduction', page: 1, level: 1 },
            { title: 'Main Content', page: 2, level: 1 },
            { title: 'Conclusion', page: 3, level: 1 }
        ];
    }

    /**
     * Extract TOC using pattern recognition - enhanced for Indonesian BIM documents
     */
    extractByPattern(text, totalPages) {
        const chapters = [];
        const lines = text.split('\n').filter(line => line.trim().length > 0);

        // Look for "Daftar Isi" or "Table of Contents" pages first
        const tocPageIndicators = ['daftar isi', 'table of contents', 'isi dokumen', 'konten'];
        let tocStartIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            if (tocPageIndicators.some(indicator => line.includes(indicator))) {
                tocStartIndex = i;
                console.log(`📑 Found TOC page indicator at line ${i}: "${lines[i]}"`);
                break;
            }
        }

        // If TOC page found, start extraction from there
        const startIndex = tocStartIndex >= 0 ? tocStartIndex : 0;

        // Focus on "BAB xx" patterns for Indonesian BIM documents (main chapters only)
        const tocPatterns = [
            // Primary pattern: "BAB 1 - Chapter Title" (most common in Indonesian BIM docs)
            /^BAB\s+(\d+)\s*[-–]\s*(.+)$/i,
            // Alternative: "BAB 1. Chapter Title"
            /^BAB\s+(\d+)\.\s*(.+)$/i,
            // Alternative: "BAB 1 Chapter Title" (no separator)
            /^BAB\s+(\d+)\s+(.+)$/i
        ];

        let currentChapter = null;

        // Process lines starting from TOC page
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip lines that are too short or too long
            if (line.length < 3 || line.length > 100) continue;

            // Skip header/footer lines and non-chapter content
            if (line.toLowerCase().includes('daftar isi') ||
                line.toLowerCase().includes('daftar gambar') ||
                line.toLowerCase().includes('daftar tabel') ||
                line.toLowerCase().includes('halaman') ||
                line.toLowerCase().includes('gambar') ||
                line.toLowerCase().includes('tabel') ||
                line.match(/^\d+$/)) {
                continue;
            }

            let matched = false;

            for (const pattern of tocPatterns) {
                const match = line.match(pattern);
                if (match) {
                    let title, pageNum, level = 1;

                    if (pattern.source.includes('BAB')) {
                        // BAB pattern - extract from line
                        title = match[2].trim();
                        // Look for page number in next few lines
                        pageNum = this.extractPageFromNearbyLines(lines, i);
                    } else if (match.length === 4) {
                        // Standard pattern with page number
                        title = match[2].trim();
                        pageNum = parseInt(match[3]);
                    } else if (match.length === 3 && match[1].includes('.')) {
                        // Subchapter pattern
                        title = match[2].trim();
                        pageNum = this.extractPageFromNearbyLines(lines, i);
                        level = 2;
                    }

                    if (title && pageNum && pageNum > 0 && pageNum <= totalPages) {
                        // Clean up title by removing trailing page numbers and extra spaces
                        const cleanTitle = title.replace(/\s*\d+\s*$/, '').trim();
                        chapters.push({
                            title: cleanTitle,
                            page: pageNum,
                            level: level
                        });
                        console.log(`📄 Extracted chapter: "${cleanTitle}" → Page ${pageNum}`);
                        matched = true;
                        break;
                    }
                }
            }

            // Only extract main BAB chapters, not sub-chapters or other content
            // Skip lines that look like sub-chapters (contain multiple dots like 1.1, 2.2.1)
            if (!matched && line.match(/^\d+\.\d+/)) {
                // Skip sub-chapters
                continue;
            }

            // Only extract if it looks like a main chapter title (contains keywords)
            if (!matched && this.isMainChapterTitle(line)) {
                const pageNum = this.extractPageFromNearbyLines(lines, i);
                if (pageNum && pageNum > 0 && pageNum <= totalPages) {
                    // Clean up the title (remove extra spaces and page numbers)
                    const cleanTitle = line.replace(/\s*\d+\s*$/, '').trim();
                    if (cleanTitle.length > 3 && cleanTitle.length < 80) {
                        chapters.push({
                            title: cleanTitle,
                            page: pageNum,
                            level: 1
                        });
                        console.log(`📄 Extracted main chapter: "${cleanTitle}" → Page ${pageNum}`);
                    }
                }
            }

            // Limit to reasonable number of chapters
            if (chapters.length >= 50) break;
        }

        // If no chapters found, try fallback method
        if (chapters.length === 0) {
            console.log('⚠️ No TOC patterns found, using fallback extraction');
            return this.extractByFallback(text, totalPages);
        }

        // Sort chapters by page number
        chapters.sort((a, b) => a.page - b.page);

        // Remove duplicates (same page)
        const uniqueChapters = chapters.filter((chapter, index, self) =>
            index === self.findIndex(c => c.page === chapter.page)
        );

        console.log(`✅ Extracted ${uniqueChapters.length} chapters from TOC`);

        return {
            chapters: uniqueChapters,
            method: 'toc-pattern-recognition',
            confidence: uniqueChapters.length > 0 ? 0.9 : 0.2
        };
    }

    /**
     * Extract page number from nearby lines (for TOC entries)
     */
    extractPageFromNearbyLines(lines, currentIndex) {
        // Look in current line and next few lines for page numbers
        for (let i = currentIndex; i < Math.min(currentIndex + 5, lines.length); i++) {
            const line = lines[i];

            // Look for page number at end of line
            const endMatch = line.match(/(\d+)\s*$/);
            if (endMatch) {
                const pageNum = parseInt(endMatch[1]);
                if (pageNum > 0 && pageNum < 1000) {
                    return pageNum;
                }
            }

            // Look for standalone numbers
            if (/^\d+$/.test(line.trim())) {
                const pageNum = parseInt(line.trim());
                if (pageNum > 0 && pageNum < 1000) {
                    return pageNum;
                }
            }
        }
        return null;
    }

    /**
     * Enhanced fallback extraction when TOC patterns fail
     */
    extractByFallback(text, totalPages) {
        const chapters = [];
        const lines = text.split('\n').filter(line => line.trim().length > 0);

        // Look for chapter-like content
        const chapterKeywords = ['bab', 'chapter', 'bagian', 'section', 'pendahuluan', 'kesimpulan'];
        const foundChapters = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase().trim();

            // Check if line contains chapter keywords
            if (chapterKeywords.some(keyword => line.includes(keyword))) {
                const pageNum = this.extractPageFromNearbyLines(lines, i);
                if (pageNum && pageNum > 0 && pageNum <= totalPages) {
                    // Get the original case title
                    const originalLine = lines[i].trim();
                    if (originalLine.length > 3 && originalLine.length < 80) {
                        foundChapters.push({
                            title: originalLine,
                            page: pageNum,
                            level: 1
                        });
                    }
                }
            }
        }

        // If still no chapters, create intelligent sections
        if (foundChapters.length === 0) {
            return this.createIntelligentFallbackTOC(totalPages);
        }

        // Sort and remove duplicates
        foundChapters.sort((a, b) => a.page - b.page);
        const uniqueChapters = foundChapters.filter((chapter, index, self) =>
            index === self.findIndex(c => c.page === chapter.page)
        );

        return {
            chapters: uniqueChapters,
            method: 'keyword-fallback',
            confidence: 0.6
        };
    }

    /**
     * Create intelligent fallback TOC based on document structure and content analysis
     */
    createIntelligentFallbackTOC(text, totalPages) {
        const chapters = [];
        const lines = text.split('\n').filter(line => line.trim().length > 0);

        // Look for structural indicators in the document
        const structuralKeywords = [
            { keyword: 'pendahuluan', title: 'Pendahuluan', weight: 10 },
            { keyword: 'latar belakang', title: 'Latar Belakang', weight: 8 },
            { keyword: 'tujuan', title: 'Tujuan', weight: 7 },
            { keyword: 'metode', title: 'Metode', weight: 9 },
            { keyword: 'hasil', title: 'Hasil', weight: 9 },
            { keyword: 'pembahasan', title: 'Pembahasan', weight: 8 },
            { keyword: 'kesimpulan', title: 'Kesimpulan', weight: 10 },
            { keyword: 'saran', title: 'Saran', weight: 6 },
            { keyword: 'daftar pustaka', title: 'Daftar Pustaka', weight: 8 },
            { keyword: 'lampiran', title: 'Lampiran', weight: 5 }
        ];

        // Scan document for structural elements
        const foundSections = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase().trim();

            for (const section of structuralKeywords) {
                if (line.includes(section.keyword) && line.length < 100) {
                    // Estimate page number based on position in document
                    const estimatedPage = Math.max(1, Math.floor((i / lines.length) * totalPages));

                    foundSections.push({
                        title: section.title,
                        page: estimatedPage,
                        weight: section.weight,
                        foundAt: i
                    });
                    break; // Only add each section type once
                }
            }

            if (foundSections.length >= 7) break; // Limit to reasonable number
        }

        // If we found structural elements, use them
        if (foundSections.length > 0) {
            // Sort by position in document
            foundSections.sort((a, b) => a.foundAt - b.foundAt);

            // Remove duplicates and create chapters
            const uniqueSections = foundSections.filter((section, index, self) =>
                index === self.findIndex(s => s.title === section.title)
            );

            uniqueSections.forEach(section => {
                chapters.push({
                    title: section.title,
                    page: section.page,
                    level: 1
                });
            });

            console.log(`📋 Created ${chapters.length} structural chapters from document analysis`);

            return {
                chapters,
                method: 'document-structure-analysis',
                confidence: Math.min(0.8, chapters.length * 0.1 + 0.3)
            };
        }

        // Final fallback: create evenly distributed chapters
        const fallbackTitles = [
            'Introduction',
            'Main Content',
            'Technical Details',
            'Implementation',
            'Results',
            'Conclusion'
        ];

        const pagesPerChapter = Math.max(3, Math.floor(totalPages / fallbackTitles.length));

        for (let i = 0; i < fallbackTitles.length && i * pagesPerChapter < totalPages; i++) {
            const pageNum = Math.min((i * pagesPerChapter) + 1, totalPages);
            chapters.push({
                title: fallbackTitles[i],
                page: pageNum,
                level: 1
            });
        }

        return {
            chapters,
            method: 'even-distribution-fallback',
            confidence: 0.2
        };
    }

    /**
     * Extract TOC from PDF outline/bookmarks
     */
    async extractByOutline(pdfBuffer, totalPages) {
        // This would require a more advanced PDF library like pdf-lib
        // For now, return empty result
        return {
            chapters: [],
            method: 'outline',
            confidence: 0.2
        };
    }

    /**
     * Create fallback TOC when extraction fails
     */
    createFallbackTOC(totalPages) {
        const chapters = [];
        const chapterInterval = Math.max(10, Math.floor(totalPages / 10)); // Every ~10% of document

        for (let i = 1; i <= totalPages; i += chapterInterval) {
            chapters.push({
                title: `Section ${Math.floor(i / chapterInterval) + 1}`,
                page: i,
                level: 1
            });
        }

        return {
            chapters,
            method: 'fallback',
            confidence: 0.1
        };
    }

    /**
     * Extract page number from surrounding context
     */
    extractPageFromContext(lines, currentIndex) {
        // Look in current line and next few lines for page numbers
        for (let i = currentIndex; i < Math.min(currentIndex + 3, lines.length); i++) {
            const line = lines[i];
            const pageMatch = line.match(/(\d+)\s*$/);
            if (pageMatch) {
                const pageNum = parseInt(pageMatch[1]);
                if (pageNum > 0 && pageNum < 1000) { // Reasonable page range
                    return pageNum;
                }
            }
        }
        return null;
    }

    /**
     * Check if a line looks like a main chapter title (not sub-chapter)
     */
    isMainChapterTitle(line) {
        // Must contain main chapter keywords and not be a sub-chapter
        const mainKeywords = ['pendahuluan', 'dasar teori', 'metodologi', 'hasil', 'pembahasan', 'kesimpulan', 'daftar pustaka', 'lampiran', 'bab'];
        const lineLower = line.toLowerCase();

        // Must contain at least one main keyword
        const hasMainKeyword = mainKeywords.some(keyword => lineLower.includes(keyword));

        // Must not be a sub-chapter (no multiple dots like 1.1, 2.2.1)
        const isNotSubChapter = !line.match(/^\d+\.\d+/);

        // Reasonable length
        const reasonableLength = line.length > 5 && line.length < 80;

        return hasMainKeyword && isNotSubChapter && reasonableLength;
    }

    /**
     * Check if a line looks like a chapter title (legacy function)
     */
    isLikelyChapterTitle(line) {
        // Check for common chapter title patterns
        const upperCaseWords = line.split(' ').filter(word => word === word.toUpperCase() && word.length > 2);
        const hasNumbers = /\d/.test(line);
        const reasonableLength = line.length > 5 && line.length < 80;

        return reasonableLength && (upperCaseWords.length > 0 || hasNumbers);
    }

    /**
     * Get TOC data for a material (from cache or extract)
     */
    async getTOC(materialId, pdfPath = null, forceRefresh = false) {
        const cached = this.tocCache[materialId];
        if (!forceRefresh && cached) {
            const hasValidPageCount = Number.isFinite(cached.totalPages) && cached.totalPages > 1;
            const hadError = cached.method && String(cached.method).includes('error');
            if (hasValidPageCount && !hadError) {
                return cached;
            }
        }

        if (!pdfPath) {
            throw new Error('PDF path required for TOC extraction');
        }

        return await this.extractTOC(pdfPath, materialId, { forceRefresh });
    }

    /**
     * Analyze all PDFs in materials folder
     */
    async analyzeAllMaterials(materialsPath = null) {
        if (!materialsPath) {
            materialsPath = path.join(__dirname, '../../BC-Learning-Main/materials');
        }

        console.log(`🔍 Analyzing all PDFs in ${materialsPath}`);

        const results = [];
        let processed = 0;
        let successful = 0;

        try {
            const files = fs.readdirSync(materialsPath);
            const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

            console.log(`📄 Found ${pdfFiles.length} PDF files to analyze`);

            for (const pdfFile of pdfFiles) {
                const pdfPath = path.join(materialsPath, pdfFile);
                const materialId = this.generateMaterialId(pdfFile);

                try {
                    console.log(`📖 Analyzing ${pdfFile}...`);
                    const tocData = await this.extractTOC(pdfPath, materialId);
                    results.push({
                        file: pdfFile,
                        materialId,
                        success: true,
                        chaptersFound: tocData.chapters.length,
                        method: tocData.method
                    });
                    successful++;
                } catch (error) {
                    console.error(`❌ Failed to analyze ${pdfFile}:`, error.message);
                    results.push({
                        file: pdfFile,
                        materialId,
                        success: false,
                        error: error.message
                    });
                }

                processed++;
            }

        } catch (error) {
            console.error('❌ Failed to analyze materials folder:', error.message);
            throw error;
        }

        console.log(`✅ Analysis complete: ${successful}/${processed} PDFs processed successfully`);

        return {
            totalFiles: processed,
            successful,
            failed: processed - successful,
            results
        };
    }

    /**
     * Generate material ID from filename
     */
    generateMaterialId(filename) {
        return filename
            .replace(/\.pdf$/i, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const stats = {
            totalMaterials: Object.keys(this.tocCache).length,
            methods: {},
            avgChapters: 0,
            totalChapters: 0
        };

        for (const [materialId, data] of Object.entries(this.tocCache)) {
            stats.methods[data.method] = (stats.methods[data.method] || 0) + 1;
            stats.totalChapters += data.chapters.length;
        }

        stats.avgChapters = stats.totalMaterials > 0 ?
            Math.round(stats.totalChapters / stats.totalMaterials * 10) / 10 : 0;

        return stats;
    }
}

module.exports = PdfTocExtractor;
