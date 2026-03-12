import fs from 'fs/promises';

async function fixManual() {
  let content = await fs.readFile('src/pages/admin/UserManual.jsx', 'utf8');

  // Replace unescaped quotes in UserManual specifically
  // These are mostly in standard text nodes like <p>"Something"</p> or <p>Don't</p>

  // " -> &quot;
  content = content.replace(/>([^<]*)"([^<]*)</g, (match, p1, p2) => `>${p1}&quot;${p2}<`);
  content = content.replace(/>([^<]*)"([^<]*)</g, (match, p1, p2) => `>${p1}&quot;${p2}<`); // run again for multiple per line

  // ' -> &apos; (only when it looks like an apostrophe in English text, e.g., don't, can't, it's)
  content = content.replace(/([a-zA-Z])'([a-zA-Z])/g, '$1&apos;$2');

  await fs.writeFile('src/pages/admin/UserManual.jsx', content);
  console.log('Fixed UserManual.jsx quotes');
}

fixManual().catch(console.error);
