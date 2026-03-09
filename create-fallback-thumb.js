/**
 * Buat fallback thumbnail placeholder image
 * File: BC-Learning-Main/img/fallback-thumb.png
 * Size: 450x340 pixel (gray background)
 */

const fs = require('fs');
const path = require('path');

// Pakai library bawaan untuk membuat image sederhana
// Kita buat PNG gray placeholder dengan base64 encoding

// 450x340 px gray PNG (solid gray color)
const grayPixel = Buffer.from([
    // PNG header
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    // IHDR chunk
    0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x01, 0xC2,  // width: 450
    0x00, 0x00, 0x01, 0x54,  // height: 340
    0x08, 0x02,              // bit depth: 8, color type: 2 (RGB)
    0x00, 0x00, 0x00,
    0x00, 0x4D, 0xEA, 0xB8, 0x43,
    // IDAT chunk (compressed gray data)
    0x00, 0x00, 0x00, 0x1D,
    0x49, 0x44, 0x41, 0x54,
    0x78, 0x9C, 0x62, 0xF8, 0xCF, 0xC0, 0x00, 0x00,
    0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x61, 0x74, 0x0B, 0xC0,
    0x84, 0x38, 0x62, 0x4F,
    // IEND chunk
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
]);

// Alternatif: buat image dengan canvas jika tersedia
const createFallbackImage = () => {
    try {
        const outputDir = path.join(__dirname, 'BC-Learning-Main', 'img');
        const outputPath = path.join(outputDir, 'fallback-thumb.png');

        // Ensure directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log('✅ Created directory:', outputDir);
        }

        // Write simple gray PNG
        fs.writeFileSync(outputPath, grayPixel);

        const stats = fs.statSync(outputPath);
        console.log('✅ Fallback thumbnail created:', outputPath);
        console.log('   Size:', stats.size, 'bytes');
        console.log('\n✅ Image URL: /img/fallback-thumb.png');

    } catch (error) {
        console.error('❌ Error creating fallback thumbnail:', error.message);

        // Fallback: create using Python if Node method fails
        console.log('\nTrying Python alternative...');
        const { execSync } = require('child_process');
        try {
            execSync(`python -c "from PIL import Image; Image.new('RGB', (450, 340), color='#CCCCCC').save('BC-Learning-Main/img/fallback-thumb.png')"`, {
                cwd: __dirname,
                stdio: 'inherit'
            });
            console.log('✅ Fallback image created with Python PIL');
        } catch (pyError) {
            console.error('❌ Python method also failed:', pyError.message);
            console.log('\n📝 Manual workaround: Use any 450x340 gray PNG image and save as BC-Learning-Main/img/fallback-thumb.png');
        }
    }
};

createFallbackImage();
