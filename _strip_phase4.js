const fs = require('fs');
const path = 'C:/BCL/BC-Learning-Main/elearning-assets/phase4-dashboard.html';
let html = fs.readFileSync(path, 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) {
  console.error('No script tag found');
  process.exit(1);
}
const script = match[1];

function stripLineComments(code) {
  let out = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  while (i < code.length) {
    const ch = code[i];
    const next = i + 1 < code.length ? code[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      i++;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inSingle) {
      out += ch;
      if (!escape && ch === "'") {
        inSingle = false;
      }
      escape = !escape && ch === '\\';
      i++;
      continue;
    }

    if (inDouble) {
      out += ch;
      if (!escape && ch === '"') {
        inDouble = false;
      }
      escape = !escape && ch === '\\';
      i++;
      continue;
    }

    if (inTemplate) {
      out += ch;
      if (!escape && ch === '`') {
        inTemplate = false;
      }
      escape = !escape && ch === '\\';
      i++;
      continue;
    }

    // not in string/comment
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      out += ch;
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

const stripped = stripLineComments(script);
const updated = html.replace(/<script>[\s\S]*?<\/script>/, '<script>' + stripped + '</script>');
fs.writeFileSync(path, updated, 'utf8');
