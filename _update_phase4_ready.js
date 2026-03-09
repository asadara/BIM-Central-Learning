const fs = require('fs');
const path = 'C:/BCL/BC-Learning-Main/elearning-assets/phase4-dashboard.html';
let content = fs.readFileSync(path, 'utf8');
const oldLine = "document.addEventListener('DOMContentLoaded', initializeDashboard);";
const newLine = "if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeDashboard); } else { initializeDashboard(); }";
content = content.replace(oldLine, newLine);
fs.writeFileSync(path, content, 'utf8');
