#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

class ReleaseError extends Error {}

function projectRoot() {
  return fileURLToPath(new URL('..', import.meta.url));
}

function packageJsonPath(root) {
  return resolve(root, 'package.json');
}

function packageLockPath(root) {
  return resolve(root, 'package-lock.json');
}

async function readPackageVersion(pkgPath) {
  const text = await readFile(pkgPath, 'utf8');
  try {
    const data = JSON.parse(text);
    if (!data.version) {
      throw new ReleaseError(`Version field missing in ${pkgPath}.`);
    }
    return data.version.trim();
  } catch (error) {
    throw new ReleaseError(`Unable to parse ${pkgPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function bumpSemver(version, part) {
  const pieces = version.split('.').map(Number);
  if (pieces.length !== 3 || pieces.some(Number.isNaN)) {
    throw new ReleaseError(`Unsupported version format: ${version}`);
  }
  let [major, minor, patch] = pieces;
  if (part === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (part === 'minor') {
    minor += 1;
    patch = 0;
  } else if (part === 'patch') {
    patch += 1;
  } else {
    throw new ReleaseError(`Unsupported bump part: ${part}`);
  }
  return `${major}.${minor}.${patch}`;
}

async function updatePackageJson(pkgPath, newVersion) {
  const data = JSON.parse(await readFile(pkgPath, 'utf8'));
  data.version = newVersion;
  await writeFile(pkgPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function updatePackageLock(lockPath, newVersion) {
  if (!existsSync(lockPath)) {
    return;
  }
  const data = JSON.parse(await readFile(lockPath, 'utf8'));
  data.version = newVersion;
  if (data.packages && data.packages['']) {
    data.packages[''].version = newVersion;
  }
  await writeFile(lockPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function gitTagExists(tagName, cwd) {
  const result = spawnSync('git', ['tag', '--list', tagName], { cwd, encoding: 'utf8' });
  if (result.error) {
    throw new ReleaseError(`git tag --list failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new ReleaseError(result.stderr.trim() || 'git tag --list failed');
  }
  return result.stdout.split(/\r?\n/).filter(Boolean).includes(tagName);
}

function runGit(args, cwd, dryRun) {
  if (dryRun) {
    console.log(`[DRY-RUN] git ${args.join(' ')}`);
    return;
  }
  const result = spawnSync('git', args, { cwd, stdio: 'inherit' });
  if (result.error) {
    throw new ReleaseError(`git ${args.join(' ')} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new ReleaseError(`git ${args.join(' ')} exited with code ${result.status}`);
  }
}

function createGitTag(tagName, message, cwd, dryRun) {
  if (gitTagExists(tagName, cwd)) {
    throw new ReleaseError(`Git tag '${tagName}' already exists.`);
  }
  runGit(['tag', '-a', tagName, '-m', message], cwd, dryRun);
}

function parseArgs(argv) {
  const options = {
    bump: 'patch',
    setVersion: null,
    tagFormat: 'v{version}',
    skipTag: false,
    apply: false,
  };

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    switch (arg) {
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      case '--bump':
        options.bump = requireValue(arg, args);
        break;
      case '--set-version':
        options.setVersion = requireValue(arg, args);
        break;
      case '--tag-format':
        options.tagFormat = requireValue(arg, args);
        break;
      case '--skip-tag':
        options.skipTag = true;
        break;
      case '--apply':
        options.apply = true;
        break;
      default:
        throw new ReleaseError(`Unknown argument: ${arg}`);
    }
  }

  if (options.setVersion && !/^\d+\.\d+\.\d+$/.test(options.setVersion)) {
    throw new ReleaseError(`Invalid version format: ${options.setVersion}`);
  }
  if (!['major', 'minor', 'patch'].includes(options.bump)) {
    throw new ReleaseError(`Unsupported bump value: ${options.bump}`);
  }
  return options;
}

function requireValue(flag, args) {
  if (args.length === 0) {
    throw new ReleaseError(`Missing value for ${flag}`);
  }
  return args.shift();
}

function printUsage() {
  console.log(`Usage: node scripts/release.mjs [options]\n\n` +
    'Manage release versioning and git tagging. By default runs in dry-run mode.\n\n' +
    'Options:\n' +
    '  --bump <major|minor|patch>  Semantic version component to bump (default: patch)\n' +
    '  --set-version <version>     Explicit version instead of bumping\n' +
    '  --tag-format <pattern>      Template for git tag (default: v{version})\n' +
    '  --skip-tag                  Skip creating git tag when applying\n' +
    '  --apply                     Apply changes (default: dry-run)\n' +
    '  -h, --help                  Show this help message\n');
}

function ensureCleanWorkingTree(cwd) {
  const result = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
  if (result.error) {
    throw new ReleaseError(`git status failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new ReleaseError(result.stderr.trim() || 'git status failed');
  }
  const output = result.stdout.trim();
  if (output) {
    throw new ReleaseError('Working tree is dirty. Commit or stash changes before applying release.');
  }
}

async function releaseMain(argv) {
  const options = parseArgs(argv);
  const root = projectRoot();
  const pkgPath = packageJsonPath(root);
  const lockPath = packageLockPath(root);
  const currentVersion = await readPackageVersion(pkgPath);

  const targetVersion = options.setVersion ? options.setVersion : bumpSemver(currentVersion, options.bump);
  const tagName = formatTag(options.tagFormat, targetVersion);
  const dryRun = !options.apply;

  console.log(`Current version: ${currentVersion}`);
  console.log(`Target version:  ${targetVersion}`);
  console.log(`Git tag:         ${tagName}`);
  console.log(`Mode:            ${dryRun ? 'DRY-RUN' : 'APPLY'}`);

  if (options.setVersion && targetVersion === currentVersion) {
    console.log('Requested version matches current version; nothing to do.');
    return 0;
  }

  if (dryRun) {
    console.log('Dry run complete. Re-run with --apply to make changes.');
    return 0;
  }

  ensureCleanWorkingTree(root);
  if (!options.skipTag && gitTagExists(tagName, root)) {
    throw new ReleaseError(`Git tag '${tagName}' already exists.`);
  }
  await updatePackageJson(pkgPath, targetVersion);
  console.log(`Updated ${relativeToRoot(pkgPath, root)} to version ${targetVersion}.`);

  await updatePackageLock(lockPath, targetVersion);
  if (existsSync(lockPath)) {
    console.log(`Updated ${relativeToRoot(lockPath, root)} to version ${targetVersion}.`);
  }

  if (options.skipTag) {
    console.log('Skipping git tag creation by request.');
  } else {
    createGitTag(tagName, `Release ${targetVersion}`, root, dryRun);
    console.log(`Created git tag ${tagName}.`);
  }

  return 0;
}

function formatTag(tagFormat, version) {
  if (!tagFormat.includes('{version}')) {
    throw new ReleaseError(`Tag format '${tagFormat}' must include '{version}'.`);
  }
  return tagFormat.replaceAll('{version}', version);
}

function relativeToRoot(path, root) {
  return relative(root, path);
}

(async () => {
  try {
    const code = await releaseMain(process.argv.slice(2));
    process.exitCode = code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`release error: ${message}`);
    process.exitCode = 1;
  }
})();
