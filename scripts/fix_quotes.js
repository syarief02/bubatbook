/* eslint-disable */
import fs from 'fs/promises';

async function fixQuotes() {
  const content = await fs.readFile('eslint_targets.txt', 'utf8');
  const lines = content.split('\n').filter(Boolean);

  const fileEdits = new Map();

  for (const line of lines) {
    if (!line.includes('react/no-unescaped-entities')) continue;

    // Format: C:\path\to\file.jsx:line:message
    const parts = line.split(':');
    // First two parts are C: and path (Windows path)
    if (parts.length < 4) continue;

    const filePath = parts[0] + ':' + parts[1];
    const lineNum = parseInt(parts[2], 10) - 1; // 0-indexed for array

    if (!fileEdits.has(filePath)) {
      const fileContent = await fs.readFile(filePath, 'utf8');
      fileEdits.set(filePath, fileContent.split('\n'));
    }

    const fileLines = fileEdits.get(filePath);
    if (!fileLines || lineNum >= fileLines.length) continue;

    let textLine = fileLines[lineNum];

    // very naive text replacement for JSX unescaped text quotes:
    // replacing any stray ' and " outside of JSX attributes is hard generically,
    // but typically these are in text nodes.
    // For now, let's just run ESLint --fix for quotes if possible, or replace known ones.

    // Actually, ESLint won't auto-fix this rule safely in all cases.
    // Let's replace ' with &apos; and " with &quot; conditionally.
    textLine = textLine.replace(/([a-zA-Z])'([a-zA-Z])/g, '$1&apos;$2');
    textLine = textLine.replace(/"([^"]*)"(?=[^<>]*>)/g, '&quot;$1&quot;'); // roughly replacing " inside text

    // Better yet, just use a more targeted replacement
    textLine = textLine.replace(/'/g, '&apos;').replace(/"/g, '&quot;');

    // The naive replace might break JSX attributes like className="flex".
    // Let's be extremely careful and only replace ' inside text.
  }

  // Instead of a risky script, let's just let the user know we can fix these manually or use a smarter regex tool.
}

fixQuotes().catch(console.error);
