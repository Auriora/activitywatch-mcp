#!/usr/bin/env node
/**
 * Lightweight docs link checker
 * - Scans all Markdown files under docs/
 * - Extracts markdown links [text](target)
 * - Validates local relative links (file existence)
 * - Ignores external http(s) links
 * - Reports broken links with file:line and target
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docsDir = path.join(root, 'docs');

/** Recursively list files under a directory */
async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) return listFiles(res);
    return res;
  }));
  return files.flat();
}

/** Extract markdown links of the form [text](target) ignoring images ![]() */
function extractLinks(markdown) {
  const links = [];
  const lines = markdown.split(/\r?\n/);
  const linkRe = /(?<!\!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g; // skip images
  lines.forEach((line, idx) => {
    let m;
    while ((m = linkRe.exec(line)) !== null) {
      const target = m[1];
      links.push({ target, line: idx + 1 });
    }
  });
  return links;
}

/** Determine if a link is external */
function isExternalLink(target) {
  return /^https?:\/\//i.test(target);
}

/** Determine if a link is an anchor-only link */
function isAnchor(target) {
  return /^#/.test(target);
}

/** Normalize a relative link target from a file */
function resolveTarget(fromFile, target) {
  // Strip any anchor (#section) for file existence check
  const [filePart] = target.split('#');
  if (!filePart || filePart === '') return null;
  // If absolute path (starts with /docs/), map to root
  if (filePart.startsWith('/')) {
    const abs = path.join(root, filePart.replace(/^\/+/, ''));
    return abs;
  }
  // Otherwise, resolve relative to the fromFile directory
  return path.resolve(path.dirname(fromFile), filePart);
}

async function main() {
  const files = (await listFiles(docsDir)).filter(f => f.endsWith('.md'));
  const broken = [];
  let linkCount = 0;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const links = extractLinks(content);
    linkCount += links.length;
    for (const { target, line } of links) {
      if (isExternalLink(target) || isAnchor(target)) continue;
      // mailto:, tel:, etc. skip
      if (/^(mailto:|tel:)/i.test(target)) continue;
      const resolved = resolveTarget(file, target);
      if (!resolved) continue;
      try {
        const stat = await fs.stat(resolved);
        // If target appears to point to a directory without explicit file, allow index.md fallback
        if (stat.isDirectory()) {
          const idx = path.join(resolved, 'index.md');
          await fs.access(idx);
        }
      } catch (e) {
        broken.push({ file, line, target, resolved });
      }
    }
  }

  const relDocs = path.relative(root, docsDir) || 'docs';
  if (broken.length) {
    console.error(`\nBroken links found (${broken.length}) in ${files.length} files (${linkCount} links scanned) under ${relDocs}/:`);
    for (const b of broken) {
      const relFile = path.relative(root, b.file);
      const relResolved = path.relative(root, b.resolved);
      console.error(`- ${relFile}:${b.line} → '${b.target}' (resolved: ${relResolved})`);
    }
    process.exitCode = 1;
  } else {
    console.log(`No broken local links found under ${relDocs}/. Scanned ${files.length} files and ${linkCount} links.`);
  }
}

main().catch((err) => {
  console.error('Link check failed with error:', err);
  process.exit(2);
});
