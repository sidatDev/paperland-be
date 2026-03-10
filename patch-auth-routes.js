const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/routes/auth.routes.ts');
let content = fs.readFileSync(filePath, 'utf8');

// We want to add permissions after accountStatus in the schema.
// There are multiple occurrences: /admin/auth/login, /auth/login, /auth/me

// Regex to find accountStatus without a following permissions field in the same block
// This is a bit complex due to various nesting levels, so let's do it line by line.

const lines = content.split('\n');
const newLines = [];
let patchedCount = 0;

for (let i = 0; i < lines.length; i++) {
  newLines.push(lines[i]);
  if (lines[i].includes("accountStatus: { type: 'string' }") && !lines[i+1]?.includes('permissions:')) {
    // Determine indentation
    const indent = lines[i].match(/^\s*/)[0];
    newLines.push(`${indent}permissions: { type: 'array', items: { type: 'string' } },`);
    patchedCount++;
  }
}

if (patchedCount > 0) {
  fs.writeFileSync(filePath, newLines.join('\n'));
  console.log(`Successfully patched ${patchedCount} schema occurrences in auth.routes.ts.`);
} else {
  console.log('No patching needed (already exists or not found).');
}
