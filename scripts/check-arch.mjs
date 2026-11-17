#!/usr/bin/env node
// BaSa3D architectural/business-invariant gate — `npm run check:arch`.
// Rules live in .harness/arch-rules.json (declarative regex, WHAT/WHY/FIX output for agents).
// Zero dependencies. Exit 0 = all rules pass, 1 = violations, 2 = bad config.
// Suppress a single justified hit by putting `arch-allow:<rule-id>` on the same line, with a reason.
import process from 'node:process';
import console from 'node:console';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const RULES_FILE = join(ROOT, '.harness/arch-rules.json');
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.next-test', '.next-e2e', 'test-results', '.vercel']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function toPosix(p) {
  return p.split(sep).join('/');
}

let config;
try {
  config = JSON.parse(readFileSync(RULES_FILE, 'utf8'));
} catch (err) {
  console.error(`check:arch — cannot read ${relative(ROOT, RULES_FILE)}: ${err.message}`);
  process.exit(2);
}

const violations = [];

for (const rule of config.rules) {
  let forbid;
  let gate;
  try {
    forbid = new RegExp(rule.forbid, 'gim');
    gate = rule.scope.onlyIfFileMatches ? new RegExp(rule.scope.onlyIfFileMatches, 'm') : null;
  } catch (err) {
    console.error(`check:arch — rule "${rule.id}" has an invalid regex: ${err.message}`);
    process.exit(2);
  }
  const exts = new Set(rule.scope.ext);
  const excludes = rule.scope.exclude ?? [];
  const files = rule.scope.dirs
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((f) => exts.has(extname(f)))
    .filter((f) => !excludes.some((ex) => toPosix(relative(ROOT, f)).startsWith(ex)));

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (gate && !gate.test(text)) continue;
    const lines = text.split('\n');
    forbid.lastIndex = 0;
    let m;
    while ((m = forbid.exec(text)) !== null) {
      const lineNo = text.slice(0, m.index).split('\n').length;
      const line = lines[lineNo - 1] ?? '';
      if (!line.includes(`arch-allow:${rule.id}`)) {
        violations.push({ rule, file: toPosix(relative(ROOT, file)), lineNo, snippet: line.trim().slice(0, 140) });
      }
      if (m[0].length === 0) forbid.lastIndex++;
    }
  }
}

// Built-in rule (not regex-on-content): no real env files tracked by git.
try {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  for (const f of tracked) {
    const base = f.split('/').pop() ?? '';
    if (/^\.env/.test(base) && !/\.example$/.test(base)) {
      violations.push({
        rule: {
          id: 'no-tracked-env',
          what: 'File .env* thật bị git theo dõi.',
          why: "AGENTS.md 'Do not store secrets in git'; repo PUBLIC.",
          fix: `git rm --cached ${f} và thêm vào .gitignore; xoay (rotate) mọi secret trong đó.`,
        },
        file: f,
        lineNo: 0,
        snippet: '',
      });
    }
  }
} catch {
  // Not a git checkout (e.g. exported tarball) — skip this rule.
}

const ruleCount = config.rules.length + 1;
if (violations.length === 0) {
  console.log(`check:arch ✅ ${ruleCount} rules passed`);
  process.exit(0);
}

console.error(`check:arch ❌ ${violations.length} violation(s)\n`);
for (const v of violations) {
  console.error(`[${v.rule.id}] ${v.file}${v.lineNo ? `:${v.lineNo}` : ''}`);
  if (v.snippet) console.error(`  > ${v.snippet}`);
  console.error(`  WHAT: ${v.rule.what}`);
  console.error(`  WHY:  ${v.rule.why}`);
  console.error(`  FIX:  ${v.rule.fix}\n`);
}
process.exit(1);
