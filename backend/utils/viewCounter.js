// backend/utils/viewCounter.js
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '../videoViews.json');

function getViewCount(videoId) {
    if (!fs.existsSync(DB_PATH)) return 0;
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    return data[videoId] || 0;
}

function incrementViewCount(videoId) {
    // Skip if videoId is undefined, null, or empty
    if (!videoId || videoId === 'undefined' || videoId.trim() === '') {
        console.error('❌ Invalid videoId for view counting:', videoId);
        return;
    }

    const data = fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) : {};
    data[videoId] = (data[videoId] || 0) + 1;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ View count incremented for video: ${videoId} = ${data[videoId]}`);
}

module.exports = { getViewCount, incrementViewCount };
