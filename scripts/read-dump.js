
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'reports_dump.json');
try {
  // Try reading as utf16le which is default for powershell > redirect
  let content = fs.readFileSync(filePath, 'utf16le');
  // If valid json, good. If not, try utf8
  try {
      JSON.parse(content);
  } catch(e) {
      content = fs.readFileSync(filePath, 'utf8');
  }
  console.log(content);
} catch (e) {
  console.error(e);
}
