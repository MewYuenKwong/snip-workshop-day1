import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const backendDir = path.join(repoRoot, 'backend');
const frontendDir = path.join(repoRoot, 'frontend');
const cliDir = path.join(repoRoot, 'cli');
const bundleDir = path.join(repoRoot, 'bundle');
const frontendBuildDir = path.join(frontendDir, 'dist', 'snip-frontend', 'browser');
const pushChanges = process.argv.includes('--push');

function formatCommand(command, args) {
  return [command, ...args].map((part) => (part.includes(' ') ? JSON.stringify(part) : part)).join(' ');
}

function run(command, args, options = {}) {
  console.log(`$ ${formatCommand(command, args)}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${formatCommand(command, args)}`);
  }
}

function gitQuiet(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
}

function ensureFile(filePath, message) {
  if (!existsSync(filePath)) {
    throw new Error(message);
  }
}

async function emptyDirectoryExceptGit(directory) {
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.name !== '.git')
      .map((entry) => rm(path.join(directory, entry.name), { recursive: true, force: true })),
  );
}

async function writeText(relativePath, contents) {
  await writeFile(path.join(bundleDir, relativePath), `${contents.trimEnd()}\n`, 'utf8');
}

function commitIfStaged(cwd, label, message) {
  const diff = gitQuiet(['diff', '--cached', '--quiet'], cwd);

  if (diff.status === 0) {
    console.log(`${label}: nothing to commit`);
    return false;
  }

  if (diff.status !== 1) {
    throw new Error(`${label}: unable to inspect staged diff`);
  }

  run('git', ['commit', '-m', message], { cwd });
  return true;
}

async function assembleBundle() {
  ensureFile(path.join(backendDir, 'server.js'), 'Missing backend/server.js after submodule update.');
  ensureFile(path.join(cliDir, 'cli.js'), 'Missing cli/cli.js after submodule update.');
  ensureFile(
    path.join(frontendBuildDir, 'index.html'),
    `Frontend build did not produce ${path.relative(repoRoot, path.join(frontendBuildDir, 'index.html'))}.`,
  );

  await emptyDirectoryExceptGit(bundleDir);
  await cp(path.join(backendDir, 'server.js'), path.join(bundleDir, 'server.js'));
  await cp(path.join(cliDir, 'cli.js'), path.join(bundleDir, 'cli.js'));
  await cp(frontendBuildDir, path.join(bundleDir, 'public'), { recursive: true });

  await writeText(
    'README.md',
    `# Snip Generated Bundle

This branch contains generated release output for the Snip workshop project.

Do not hand-edit files on this branch; regenerate it from the main superproject build script.`,
  );
  await writeText('.env', 'PUBLIC_DIR=./public');
  await writeText(
    'package.json',
    JSON.stringify(
      {
        name: 'snip-bundle',
        private: true,
        scripts: {
          start: 'bun server.js',
        },
      },
      null,
      2,
    ),
  );
  await writeText(
    'Dockerfile',
    `FROM oven/bun:1-alpine
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD bun server.js`,
  );
  await writeText(
    '.dockerignore',
    `.git
.gitmodules
node_modules
npm-debug.log*
.DS_Store`,
  );
  await writeText(
    'railway.json',
    JSON.stringify(
      {
        $schema: 'https://railway.com/railway.schema.json',
        build: {
          builder: 'DOCKERFILE',
        },
        deploy: {
          startCommand: 'bun server.js',
        },
      },
      null,
      2,
    ),
  );
}

run('git', ['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli']);
run('npm', ['install'], { cwd: frontendDir });
run('npm', ['exec', '--', 'ng', 'build'], { cwd: frontendDir });

await assembleBundle();

run('git', ['add', '-A'], { cwd: bundleDir });
commitIfStaged(bundleDir, 'bundle', 'Build generated release bundle');

if (pushChanges) {
  run('git', ['push', 'origin', 'HEAD:bundle'], { cwd: bundleDir });
}

run('git', ['add', '--', 'backend', 'frontend', 'cli', 'bundle']);
commitIfStaged(repoRoot, 'superproject', 'Bump generated bundle submodule pointers');

if (pushChanges) {
  run('git', ['push', 'origin', 'HEAD:main']);
}