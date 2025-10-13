#!/usr/bin/env node
// Simple validator for .augment/rules frontmatter
import fs from 'fs';
import path from 'path';

const rulesDir = path.resolve(process.cwd(), '.augment', 'rules');
try {
  const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
  let failed = false;
  for (const file of files) {
    const p = path.join(rulesDir, file);
    const txt = fs.readFileSync(p, 'utf8');
    const fmMatch = txt.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      console.error(`${file}: MISSING frontmatter block (--- ... ---)`);
      failed = true;
      continue;
    }
    const fm = fmMatch[1];
    const hasType = /\btype\s*:\s*"?[a-zA-Z_\-]+"?/i.test(fm);
    const hasDescription = /\bdescription\s*:\s*"?[\s\S]*?"?$/im.test(fm) || /\bdescription\s*:/i.test(fm);
    if (!hasType) {
      console.error(`${file}: missing required field 'type' in frontmatter`);
      failed = true;
    }
    if (!hasDescription) {
      console.error(`${file}: missing required field 'description' in frontmatter`);
      failed = true;
    }
    // Optional helpful hints
    const hasName = /\bname\s*:/i.test(fm);
    const hasPriority = /\bpriority\s*:/i.test(fm);
    if (!hasName) console.warn(`${file}: recommended to include 'name' in frontmatter`);
    if (!hasPriority) console.warn(`${file}: recommended to include 'priority' in frontmatter`);
  }
  if (failed) process.exitCode = 2;
  else console.log('All rule files passed frontmatter checks (required keys present).');
} catch (err) {
  console.error('Error running validator:', err.message);
  process.exitCode = 3;
}

