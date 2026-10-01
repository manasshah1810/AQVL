// PreToolUse guard for Claude Code. Blocks the ways an agent could fake progress:
// writing the ledger, editing the tracker's rules, or skipping the git hooks.
// Layer 1 of 3; the git pre-commit hook and CI re-check everything independently.
import { execFileSync } from 'node:child_process';

const raw = await new Promise((res) => {
  let d = '';
  process.stdin.on('data', (c) => (d += c));
  process.stdin.on('end', () => res(d || '{}'));
});
let input;
try {
  input = JSON.parse(raw);
} catch {
  console.error('Blocked: guard could not read the tool call, so it fails closed.');
  process.exit(2);
}
const tool = input.tool_name ?? '';
const args = input.tool_input ?? {};

const LEDGER = /tasks[\\/]ledger[\\/]/i;
const PROTECTED =
  /(scripts[\\/]task-ledger\.ts|pages[\\/]tasks[\\/](ledger|model|roadmapData|teamData|types)\.ts|\.husky[\\/]|\.github[\\/]|\.claude[\\/](settings(\.local)?\.json|hooks[\\/])|AGENTS\.md)/i;
const WRITES =
  /(>|\btee\b|\bsed\s+-i|\brm\b|\bmv\b|\bcp\b|\btruncate\b|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|\bdel\b|git\s+(checkout|restore|reset|stash|apply)|\bpython|\bnode\b|\btsx\b|writeFile|appendFile)/i;
const SKIP_HOOKS = /--no-verify|core\.hooksPath|HUSKY\s*=\s*0|SKIP_HOOKS|git\s+commit\s+(.*\s)?-[a-z]*n[a-z]*\s/i;

const git = (k) => {
  try {
    return execFileSync('git', ['config', k], { encoding: 'utf8' }).trim().toLowerCase();
  } catch {
    return '';
  }
};
const maintainer = git('user.email') === 'manasshah1210@gmail.com' || git('user.name') === 'manasshah1810';

const deny = (why) => {
  console.error(
    `Blocked: ${why}\nTask progress is recorded only by \`pnpm task start|done\`, which verifies the work against git. Do not edit the ledger or tracker, and do not bypass this. Tell the user the task cannot be marked complete until the work is genuinely done and committed.`,
  );
  process.exit(2);
};

if (['Edit', 'Write', 'NotebookEdit', 'MultiEdit'].includes(tool)) {
  const p = String(args.file_path ?? args.notebook_path ?? '');
  if (LEDGER.test(p)) deny('the task ledger is append-only and written only by the ledger CLI.');
  if (PROTECTED.test(p) && !maintainer) deny('this file defines how progress is tracked and is maintainer-only.');
}

if (tool === 'Bash' || tool === 'PowerShell') {
  const c = String(args.command ?? '');
  if (SKIP_HOOKS.test(c)) deny('skipping the git hooks is not allowed in this repo.');
  if (LEDGER.test(c) && WRITES.test(c) && !/^\s*pnpm\s+(run\s+)?task\b/.test(c)) deny('the task ledger cannot be modified directly.');
  if (PROTECTED.test(c) && WRITES.test(c) && !maintainer) deny('the tracker rules are maintainer-only.');
}
process.exit(0);
