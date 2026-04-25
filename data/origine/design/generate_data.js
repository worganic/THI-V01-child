const fs = require('fs');
const path = require('path');

function generateData() {
  const data = {
    documents: [],
    sites: []
  };

  // Load codes mapping
  let codesMap = { documents: {}, sites: {} };
  if (fs.existsSync('codes.json')) {
    codesMap = JSON.parse(fs.readFileSync('codes.json', 'utf-8'));
  }

  // Scan design documents
  const docsPath = 'design documents';
  if (fs.existsSync(docsPath)) {
    const files = fs.readdirSync(docsPath);
    files.forEach(file => {
      if (file.endsWith('.jpg') || file.endsWith('.png')) {
        data.documents.push({
          name: file.replace(/^i_|_full\.(jpg|png)$/g, '').replace(/_/g, ' '),
          image: `design documents/${file}`,
          code: codesMap.documents[file] || null
        });
      }
    });
  }

  // Scan design sites
  const sitesPath = 'design sites';
  if (fs.existsSync(sitesPath)) {
    const categories = fs.readdirSync(sitesPath);
    categories.forEach(catName => {
      const catPath = path.join(sitesPath, catName);
      if (fs.statSync(catPath).isDirectory()) {
        const category = {
          name: catName,
          versions: []
        };

        const versions = fs.readdirSync(catPath);
        versions.forEach(verName => {
          const verPath = path.join(catPath, verName);
          if (fs.statSync(verPath).isDirectory()) {
            const version = {
              name: verName,
              screen: null,
              code: null,
              infos: null,
              uniqueCode: null
            };

            const files = fs.readdirSync(verPath);
            files.forEach(file => {
              if (file === 'screen.png') {
                version.screen = path.join(catPath, verName, file).replace(/\\/g, '/');
              } else if (file === 'code.html') {
                version.code = path.join(catPath, verName, file).replace(/\\/g, '/');
              } else if (file === 'infos.md') {
                try {
                  version.infos = fs.readFileSync(path.join(verPath, file), 'utf-8');
                } catch (e) {
                  version.infos = '';
                }
              }
            });

            // Get unique code from mapping
            const uniqueKey = `${catName}/${verName}`;
            version.uniqueCode = codesMap.sites[uniqueKey] || null;

            if (version.screen || version.code) {
              category.versions.push(version);
            }
          }
        });

        if (category.versions.length > 0) {
          data.sites.push(category);
        }
      }
    });
  }

  fs.writeFileSync('data.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log('Data generated successfully!');
  console.log(`Documents: ${data.documents.length}`);
  console.log(`Sites: ${data.sites.length}`);
}

generateData();
