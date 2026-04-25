const fs = require('fs');

// Read codes mapping
let codes = JSON.parse(fs.readFileSync('codes.json', 'utf-8'));

// Update document filenames to include code prefix
const oldToNewMapping = {
  "i_Business-Cafe-One-Pager_full.jpg": "10042-i_Business-Cafe-One-Pager_full.jpg",
  "i_Corporate-One-Pager_full.jpg": "20815-i_Corporate-One-Pager_full.jpg",
  "i_CPR-One-Pager_full.jpg": "31549-i_CPR-One-Pager_full.jpg",
  "i_Onboarding-One-Pager_full.jpg": "42076-i_Onboarding-One-Pager_full.jpg",
  "i_Professional-One-Pager_full.jpg": "53284-i_Professional-One-Pager_full.jpg",
  "i_Simple-One-Pager_full.jpg": "64591-i_Simple-One-Pager_full.jpg",
  "i_Tech-One-Pager_full.jpg": "75803-i_Tech-One-Pager_full.jpg"
};

// Update codes.documents to use new filenames
const newDocuments = {};
Object.entries(codes.documents).forEach(([oldName, code]) => {
  const newName = oldToNewMapping[oldName] || oldName;
  newDocuments[newName] = code;
});

codes.documents = newDocuments;

// Save updated codes.json
fs.writeFileSync('codes.json', JSON.stringify(codes, null, 2), 'utf-8');
console.log('✅ codes.json updated with new document filenames');

// Also update generate_data.js to look for the new filenames
console.log('✅ Document mapping updated successfully!');
