const fs = require('fs');

// Read data.json
const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));

// Read template
let html = fs.readFileSync('index-standalone.html', 'utf-8');

// Find the data const declaration and replace it
const dataString = JSON.stringify(data, null, 12);

// Look for "const data = {" with various spacing
const dataStartPattern = /\s+const data = \{/;
const dataStartMatch = html.match(dataStartPattern);

if (dataStartMatch) {
  // Find the matching closing brace
  const startIndex = html.indexOf(dataStartMatch[0]);
  let braceCount = 0;
  let endIndex = startIndex + dataStartMatch[0].length - 1;

  for (let i = endIndex; i < html.length; i++) {
    if (html[i] === '{') braceCount++;
    if (html[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        endIndex = i;
        break;
      }
    }
  }

  // Check for closing semicolon
  if (html[endIndex + 1] === ';') {
    endIndex++;
  }

  const before = html.substring(0, startIndex);
  const after = html.substring(endIndex + 1);

  const newHtml = before + '\n        const data = ' + dataString + ';' + after;

  fs.writeFileSync('index-standalone.html', newHtml, 'utf-8');
  console.log('✅ index-standalone.html updated with codes!');
  console.log(`Documents: ${data.documents.length}`);
  console.log(`Sites: ${data.sites.length}`);
} else {
  console.error('❌ Could not find data variable in index-standalone.html');
}
