import fs from 'fs/promises';

async function parseErrors() {
  // Read with utf16le since PowerShell `>` creates UTF-16LE files by default
  const fileContent = await fs.readFile('eslint_errors.json', 'utf16le');

  // Strip BOM if present
  const cleanedContent = fileContent.charCodeAt(0) === 0xfeff ? fileContent.slice(1) : fileContent;

  const data = JSON.parse(cleanedContent);
  const output = [];

  data.forEach((file) => {
    const filePath = file.filePath;
    file.messages.forEach((msg) => {
      // Focus on unescaped entities and unused variables
      if (['react/no-unescaped-entities', 'no-unused-vars', 'no-undef'].includes(msg.ruleId)) {
        output.push(`${filePath}:${msg.line}:${msg.message} (${msg.ruleId})`);
      }
    });
  });

  await fs.writeFile('eslint_targets.txt', output.join('\n'));
  console.log('Targets successfully written to eslint_targets.txt');
}

parseErrors().catch(console.error);
