const fs = require('fs');
const path = require('path');

// Generate code based on category letter and version number
function generateSiteCode(categoryName, versionName) {
  // Extract first letter from category (e.g., "A-tableau_de_bord" -> "A")
  const categoryLetter = categoryName.charAt(0).toUpperCase();

  // Extract version number (e.g., "v2 - Bleu nuit compact" or "V1 - ..." -> "2" or "1")
  const versionMatch = versionName.match(/[vV](\d+)/);
  const versionNumber = versionMatch ? versionMatch[1] : '0';

  return `${categoryLetter}${versionNumber}`;
}

// Read existing codes
let codesMap = {};
if (fs.existsSync('codes.json')) {
  const existing = JSON.parse(fs.readFileSync('codes.json', 'utf-8'));
  codesMap = existing;
}

// Initialize sites codes if not exist
if (!codesMap.sites) {
  codesMap.sites = {};
}

// Process design sites
const sitesPath = 'design sites';
if (fs.existsSync(sitesPath)) {
  const categories = fs.readdirSync(sitesPath);

  categories.forEach(catName => {
    const catPath = path.join(sitesPath, catName);
    if (fs.statSync(catPath).isDirectory()) {
      const versions = fs.readdirSync(catPath);

      versions.forEach(verName => {
        const verPath = path.join(catPath, verName);
        if (fs.statSync(verPath).isDirectory()) {
          const infosPath = path.join(verPath, 'infos.md');
          const uniqueKey = `${catName}/${verName}`;

          if (fs.existsSync(infosPath)) {
            let content = fs.readFileSync(infosPath, 'utf-8');

            // Generate code based on category and version
            const code = generateSiteCode(catName, verName);
            codesMap.sites[uniqueKey] = code;

            // Remove old code if it exists
            content = content.replace(/\n\nCode:\s*\S+\s*$/, '');

            // Add new code at the end
            content = content.trim() + `\n\nCode: ${code}`;
            fs.writeFileSync(infosPath, content, 'utf-8');
            console.log(`✅ Updated: ${catName}/${verName} - Code: ${code}`);
          }
        }
      });
    }
  });
}

// Save all codes back to codes.json
fs.writeFileSync('codes.json', JSON.stringify(codesMap, null, 2), 'utf-8');
console.log('\n✅ All codes saved to codes.json');
console.log(`Total sites: ${Object.keys(codesMap.sites).length}`);
console.log(`Total documents: ${Object.keys(codesMap.documents || {}).length}`);
