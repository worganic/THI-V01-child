const fs = require('fs');
const path = require('path');

// Read codes mapping
const codes = JSON.parse(fs.readFileSync('codes.json', 'utf-8'));

const docsPath = 'design documents';

if (fs.existsSync(docsPath)) {
  const files = fs.readdirSync(docsPath);

  files.forEach(file => {
    if (file.endsWith('.jpg') || file.endsWith('.png')) {
      // Get the code for this file
      const code = codes.documents[file];

      if (code) {
        // Create new filename with code prefix
        const newFilename = `${code}-${file}`;
        const oldPath = path.join(docsPath, file);
        const newPath = path.join(docsPath, newFilename);

        // Rename the file
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Renamed: ${file} → ${newFilename}`);
      } else {
        console.log(`⚠️  No code found for: ${file}`);
      }
    }
  });

  console.log('\n✅ All documents renamed successfully!');
} else {
  console.error('❌ design documents folder not found');
}
