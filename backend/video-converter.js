/**
 * Video Converter Engine for BCL
 * Converts videos to H.264/MP4 format for browser compatibility
 * 
 * Usage: node video-converter.js [input-path] [output-dir]
 * 
 * @version 1.0.0
 * @author BCL Development Team
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

// Configuration
const CONFIG = {
    // FFmpeg paths - try multiple locations
    ffmpegPaths: [
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'ffmpeg', // System PATH
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg'
    ],
    ffprobePaths: [
        'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
        'C:\\ffmpeg\\bin\\ffprobe.exe',
        'ffprobe', // System PATH
        '/usr/bin/ffprobe',
        '/usr/local/bin/ffprobe'
    ],
    
    // Output settings
    outputDir: process.env.VIDEO_OUTPUT_DIR || 'Y:\\BCL-Converted-Videos',
    
    // Video encoding settings for Chrome/Edge/Firefox compatibility
    videoCodec: 'libx264',
    videoPreset: 'fast',       // Options: ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
    videoProfile: 'high',       // Options: baseline, main, high
    videoLevel: '4.1',          // H.264 level for compatibility
    pixelFormat: 'yuv420p',     // Required for browser compatibility
    
    // Audio encoding settings
    audioCodec: 'aac',
    audioBitrate: '128k',
    audioChannels: 2,
    audioSampleRate: 44100,
    
    // Quality settings
    crf: 23,                    // Constant Rate Factor (18-28 recommended, lower = better quality)
    maxBitrate: '5000k',        // Maximum bitrate
    bufferSize: '10000k',       // Buffer size
    
    // Processing options
    maxConcurrent: 2,           // Maximum concurrent conversions
    timeout: 3600000,           // 1 hour timeout per video
    
    // File extensions to convert
    supportedInputFormats: ['.avi', '.mov', '.wmv', '.mkv', '.flv', '.webm', '.m4v', '.3gp', '.mpeg', '.mpg', '.ts'],
    
    // Extensions that are already H.264 (skip or verify)
    alreadyCompatible: ['.mp4']
};

// State tracking
const conversionQueue = [];
const activeConversions = new Map();
const conversionResults = {
    success: [],
    failed: [],
    skipped: []
};

// Find FFmpeg and FFprobe binaries
function findBinary(pathList) {
    for (const binPath of pathList) {
        if (path.isAbsolute(binPath)) {
            if (fs.existsSync(binPath)) {
                console.log(`✅ Found binary: ${binPath}`);
                return binPath;
            }
        } else {
            // Try to find in PATH
            return binPath;
        }
    }
    return null;
}

const FFMPEG_BIN = findBinary(CONFIG.ffmpegPaths);
const FFPROBE_BIN = findBinary(CONFIG.ffprobePaths);

if (!FFMPEG_BIN) {
    console.error('❌ FFmpeg not found. Please install FFmpeg and add it to PATH.');
    console.error('   Download from: https://ffmpeg.org/download.html');
    console.error('   Or install via chocolatey: choco install ffmpeg');
    process.exit(1);
}

console.log(`🎬 Video Converter Engine v1.0.0`);
console.log(`   FFmpeg: ${FFMPEG_BIN}`);
console.log(`   FFprobe: ${FFPROBE_BIN || 'Not found (codec detection disabled)'}`);
console.log(`   Output Dir: ${CONFIG.outputDir}`);
console.log('');

/**
 * Check if video is already H.264 compatible
 */
async function isH264Compatible(inputPath) {
    if (!FFPROBE_BIN) {
        console.log(`⚠️ FFprobe not available, assuming video needs conversion`);
        return false;
    }

    return new Promise((resolve) => {
        const args = [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name,profile',
            '-of', 'json',
            inputPath
        ];

        execFile(FFPROBE_BIN, args, { timeout: 30000, windowsHide: true }, (error, stdout) => {
            if (error) {
                console.warn(`⚠️ FFprobe error for ${path.basename(inputPath)}:`, error.message);
                resolve(false);
                return;
            }

            try {
                const data = JSON.parse(stdout);
                const stream = data.streams && data.streams[0];
                
                if (stream) {
                    const codec = (stream.codec_name || '').toLowerCase();
                    const profile = (stream.profile || '').toLowerCase();
                    
                    const isH264 = codec === 'h264' || codec === 'avc';
                    const isCompatibleProfile = ['baseline', 'main', 'high', 'constrained baseline'].some(p => 
                        profile.includes(p)
                    );
                    
                    console.log(`   Codec: ${codec}, Profile: ${profile}, H.264: ${isH264}, Compatible: ${isCompatibleProfile}`);
                    
                    resolve(isH264 && isCompatibleProfile);
                } else {
                    resolve(false);
                }
            } catch (parseError) {
                console.warn(`⚠️ Error parsing FFprobe output:`, parseError.message);
                resolve(false);
            }
        });
    });
}

/**
 * Get video duration in seconds
 */
async function getVideoDuration(inputPath) {
    if (!FFPROBE_BIN) {
        return null;
    }

    return new Promise((resolve) => {
        const args = [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'json',
            inputPath
        ];

        execFile(FFPROBE_BIN, args, { timeout: 30000, windowsHide: true }, (error, stdout) => {
            if (error) {
                resolve(null);
                return;
            }

            try {
                const data = JSON.parse(stdout);
                const duration = parseFloat(data.format?.duration);
                resolve(isNaN(duration) ? null : duration);
            } catch {
                resolve(null);
            }
        });
    });
}

/**
 * Generate output path for converted video
 */
function getOutputPath(inputPath, outputDir) {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const safeName = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '_');
    return path.join(outputDir, `${safeName}_h264.mp4`);
}

/**
 * Convert video to H.264/MP4 format
 */
async function convertVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`\n🔄 Converting: ${path.basename(inputPath)}`);
        console.log(`   Input: ${inputPath}`);
        console.log(`   Output: ${outputPath}`);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`   Created output directory: ${outputDir}`);
        }

        const args = [
            '-y',                                    // Overwrite output
            '-i', inputPath,                         // Input file
            '-c:v', CONFIG.videoCodec,               // Video codec
            '-preset', CONFIG.videoPreset,           // Encoding preset
            '-profile:v', CONFIG.videoProfile,       // H.264 profile
            '-level', CONFIG.videoLevel,             // H.264 level
            '-pix_fmt', CONFIG.pixelFormat,          // Pixel format for browser compatibility
            '-crf', String(CONFIG.crf),              // Quality
            '-maxrate', CONFIG.maxBitrate,           // Max bitrate
            '-bufsize', CONFIG.bufferSize,           // Buffer size
            '-c:a', CONFIG.audioCodec,               // Audio codec
            '-b:a', CONFIG.audioBitrate,             // Audio bitrate
            '-ac', String(CONFIG.audioChannels),     // Audio channels
            '-ar', String(CONFIG.audioSampleRate),   // Audio sample rate
            '-movflags', '+faststart',               // Enable fast start for web streaming
            '-threads', '0',                         // Use all available CPU threads
            outputPath
        ];

        console.log(`   Running FFmpeg with ${args.length} arguments...`);

        const startTime = Date.now();
        const ffmpeg = spawn(FFMPEG_BIN, args, {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stderr = '';
        let progressInfo = '';

        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            stderr += line;

            // Parse progress information
            const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const seconds = parseInt(timeMatch[3]);
                const currentTime = hours * 3600 + minutes * 60 + seconds;
                progressInfo = `   Progress: ${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} processed`;
                process.stdout.write(`\r${progressInfo}                    `);
            }
        });

        ffmpeg.on('error', (error) => {
            console.error(`\n❌ FFmpeg spawn error:`, error.message);
            reject(error);
        });

        ffmpeg.on('close', (code) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (code === 0) {
                // Verify output file exists and has content
                if (fs.existsSync(outputPath)) {
                    const outputStats = fs.statSync(outputPath);
                    if (outputStats.size > 0) {
                        console.log(`\n✅ Conversion successful!`);
                        console.log(`   Duration: ${duration}s`);
                        console.log(`   Output size: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
                        resolve({
                            success: true,
                            inputPath,
                            outputPath,
                            duration: parseFloat(duration),
                            outputSize: outputStats.size
                        });
                        return;
                    }
                }
                reject(new Error('Output file is empty or missing'));
            } else {
                console.error(`\n❌ FFmpeg exited with code ${code}`);
                console.error(`   Last 500 chars of stderr: ${stderr.slice(-500)}`);
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        // Set timeout
        setTimeout(() => {
            if (ffmpeg.exitCode === null) {
                console.warn(`\n⚠️ Conversion timeout, killing FFmpeg process...`);
                ffmpeg.kill('SIGKILL');
                reject(new Error('Conversion timeout'));
            }
        }, CONFIG.timeout);
    });
}

/**
 * Process a single video file
 */
async function processVideo(inputPath, outputDir) {
    const fileName = path.basename(inputPath);
    const ext = path.extname(inputPath).toLowerCase();

    console.log(`\n📹 Processing: ${fileName}`);

    // Check if file exists
    if (!fs.existsSync(inputPath)) {
        console.error(`   ❌ File not found: ${inputPath}`);
        return { status: 'failed', reason: 'File not found', inputPath };
    }

    // Get file stats
    const stats = fs.statSync(inputPath);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Generate output path
    const outputPath = getOutputPath(inputPath, outputDir);

    // Check if output already exists
    if (fs.existsSync(outputPath)) {
        const outputStats = fs.statSync(outputPath);
        if (outputStats.size > 0) {
            console.log(`   ⏭️ Output already exists: ${outputPath}`);
            return { status: 'skipped', reason: 'Already converted', inputPath, outputPath };
        }
    }

    // Check if already H.264 compatible (for .mp4 files)
    if (CONFIG.alreadyCompatible.includes(ext)) {
        const isCompatible = await isH264Compatible(inputPath);
        if (isCompatible) {
            console.log(`   ⏭️ Already H.264 compatible, copying...`);
            
            // Just copy the file if already compatible
            try {
                fs.copyFileSync(inputPath, outputPath);
                console.log(`   ✅ Copied to: ${outputPath}`);
                return { status: 'skipped', reason: 'Already H.264 compatible (copied)', inputPath, outputPath };
            } catch (copyError) {
                console.warn(`   ⚠️ Copy failed, will convert instead:`, copyError.message);
            }
        }
    }

    // Check if format needs conversion
    if (!CONFIG.supportedInputFormats.includes(ext) && !CONFIG.alreadyCompatible.includes(ext)) {
        console.log(`   ⏭️ Unsupported format: ${ext}`);
        return { status: 'skipped', reason: `Unsupported format: ${ext}`, inputPath };
    }

    // Get video duration for progress estimation
    const duration = await getVideoDuration(inputPath);
    if (duration) {
        console.log(`   Duration: ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`);
    }

    // Perform conversion
    try {
        const result = await convertVideo(inputPath, outputPath);
        return { status: 'success', ...result };
    } catch (error) {
        console.error(`   ❌ Conversion failed:`, error.message);
        return { status: 'failed', reason: error.message, inputPath };
    }
}

/**
 * Find all video files in a directory recursively
 */
function findVideoFiles(directory, maxDepth = 10, currentDepth = 0) {
    const videoFiles = [];
    
    if (currentDepth >= maxDepth) {
        return videoFiles;
    }

    try {
        const items = fs.readdirSync(directory, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(directory, item.name);

            if (item.isDirectory()) {
                // Skip system/hidden folders
                if (item.name.startsWith('.') || item.name.startsWith('$')) {
                    continue;
                }
                videoFiles.push(...findVideoFiles(fullPath, maxDepth, currentDepth + 1));
            } else {
                const ext = path.extname(item.name).toLowerCase();
                if (CONFIG.supportedInputFormats.includes(ext) || CONFIG.alreadyCompatible.includes(ext)) {
                    videoFiles.push(fullPath);
                }
            }
        }
    } catch (error) {
        console.warn(`⚠️ Error scanning directory ${directory}:`, error.message);
    }

    return videoFiles;
}

/**
 * Process all videos in a directory
 */
async function processDirectory(inputDir, outputDir) {
    console.log(`\n📂 Scanning directory: ${inputDir}`);
    
    if (!fs.existsSync(inputDir)) {
        console.error(`❌ Input directory not found: ${inputDir}`);
        return;
    }

    const videoFiles = findVideoFiles(inputDir);
    console.log(`   Found ${videoFiles.length} video files`);

    if (videoFiles.length === 0) {
        console.log('   No videos to process.');
        return;
    }

    // Process videos with concurrency limit
    const results = [];
    
    for (let i = 0; i < videoFiles.length; i++) {
        const videoPath = videoFiles[i];
        console.log(`\n[${i + 1}/${videoFiles.length}]`);
        
        const result = await processVideo(videoPath, outputDir);
        results.push(result);

        // Categorize result
        if (result.status === 'success') {
            conversionResults.success.push(result);
        } else if (result.status === 'skipped') {
            conversionResults.skipped.push(result);
        } else {
            conversionResults.failed.push(result);
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CONVERSION SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Total processed: ${videoFiles.length}`);
    console.log(`   ✅ Success: ${conversionResults.success.length}`);
    console.log(`   ⏭️ Skipped: ${conversionResults.skipped.length}`);
    console.log(`   ❌ Failed: ${conversionResults.failed.length}`);
    
    if (conversionResults.failed.length > 0) {
        console.log('\n   Failed files:');
        conversionResults.failed.forEach(f => {
            console.log(`     - ${path.basename(f.inputPath)}: ${f.reason}`);
        });
    }

    console.log('='.repeat(60));
}

/**
 * Main entry point
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        // Show help
        console.log(`
Usage: node video-converter.js <input-path> [output-dir]

Arguments:
  input-path    Path to a video file or directory containing videos
  output-dir    Output directory (default: ${CONFIG.outputDir})

Examples:
  node video-converter.js "G:\\Videos\\tutorial.avi"
  node video-converter.js "G:\\BIM CENTRAL LEARNING" "Y:\\Converted"
  node video-converter.js --check "G:\\video.mp4"

Options:
  --check       Only check if video is H.264 compatible (don't convert)
  --help        Show this help message
`);
        return;
    }

    const inputPath = args[0];
    const outputDir = args[1] || CONFIG.outputDir;

    // Handle --check option
    if (inputPath === '--check' && args[1]) {
        const filePath = args[1];
        console.log(`🔍 Checking codec compatibility: ${filePath}`);
        const isCompatible = await isH264Compatible(filePath);
        console.log(`   H.264 Compatible: ${isCompatible ? 'YES ✅' : 'NO ❌'}`);
        return;
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 Created output directory: ${outputDir}`);
    }

    // Check if input is file or directory
    const stats = fs.statSync(inputPath);
    
    if (stats.isDirectory()) {
        await processDirectory(inputPath, outputDir);
    } else {
        const result = await processVideo(inputPath, outputDir);
        
        if (result.status === 'success') {
            console.log(`\n✅ Conversion complete!`);
            console.log(`   Output: ${result.outputPath}`);
        } else if (result.status === 'skipped') {
            console.log(`\n⏭️ ${result.reason}`);
        } else {
            console.log(`\n❌ Conversion failed: ${result.reason}`);
            process.exit(1);
        }
    }
}

// Export for use as module
module.exports = {
    convertVideo,
    processVideo,
    processDirectory,
    isH264Compatible,
    getVideoDuration,
    getOutputPath,
    findVideoFiles,
    CONFIG
};

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
