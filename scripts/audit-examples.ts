#!/usr/bin/env node
/**
 * Corpus audit: for every example in packages/demo/src/examples/registry.ts,
 * compiles it and runs it to completion through a headless ExecutionEngine
 * (not just checking that it compiles). Records one of:
 *   pass | compile-error | runtime-error | iteration-limit
 *
 * This script does not modify any example, the registry, the compiler, or
 * the runtime — it only observes and reports.
 *
 * Usage:
 *   npx tsx scripts/audit-examples.ts
 *   npx tsx scripts/audit-examples.ts --out docs/design/phase1-example-corpus-audit.md
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from '../packages/compiler/src';
import { ExecutionEngine, MaxIterationsExceededError, DEFAULT_MAX_EXECUTION_ITERATIONS } from '../packages/runtime/src';
import { EXAMPLES } from '../packages/demo/src/examples/registry';

type Status = 'pass' | 'compile-error' | 'runtime-error' | 'iteration-limit';

interface Result {
  id: string;
  title: string;
  category: string;
  status: Status;
  error?: string;
}

async function runOne(id: string, title: string, category: string, source: string): Promise<Result> {
  let aqir;
  try {
    aqir = compile(source);
  } catch (e: any) {
    const msg = `${e?.name ?? 'Error'}: ${e?.message ?? String(e)}`;
    return { id, title, category, status: 'compile-error', error: msg };
  }

  const engine = new ExecutionEngine({ headless: true });
  try {
    engine.loadProgram(aqir as any);
    await engine.execute();
    return { id, title, category, status: 'pass' };
  } catch (e: any) {
    if (e instanceof MaxIterationsExceededError) {
      return { id, title, category, status: 'iteration-limit', error: e.message };
    }
    const msg = `${e?.name ?? 'Error'}: ${e?.message ?? String(e)}`;
    return { id, title, category, status: 'runtime-error', error: msg };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : null;

  // Both compile() and ExecutionEngine log verbosely; silence stdout/stderr
  // noise from the programs under test so only this script's own summary
  // prints, but keep results driven purely by thrown errors / return values.
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};

  const results: Result[] = [];
  for (const ex of EXAMPLES) {
    const r = await runOne(ex.id, ex.title, ex.category, ex.source);
    results.push(r);
  }

  console.log = originalLog;
  console.error = originalError;

  const total = results.length;
  const byStatus: Record<Status, Result[]> = {
    pass: [],
    'compile-error': [],
    'runtime-error': [],
    'iteration-limit': [],
  };
  for (const r of results) byStatus[r.status].push(r);

  for (const r of results) {
    const line = `${r.status.padEnd(15)} ${r.id}`;
    console.log(line);
  }
  console.log('');
  console.log(`Total: ${total}`);
  console.log(`  pass:            ${byStatus.pass.length}`);
  console.log(`  compile-error:   ${byStatus['compile-error'].length}`);
  console.log(`  runtime-error:   ${byStatus['runtime-error'].length}`);
  console.log(`  iteration-limit: ${byStatus['iteration-limit'].length}`);

  if (outPath) {
    const lines: string[] = [];
    lines.push('# Example Corpus Audit');
    lines.push('');
    lines.push(
      `Produced by \`scripts/audit-examples.ts\`. Every example in \`packages/demo/src/examples/registry.ts\` is compiled and run to completion through a headless \`ExecutionEngine\` (max ${DEFAULT_MAX_EXECUTION_ITERATIONS} iterations). No example source, registry, compiler, or runtime code was modified to produce this run.`
    );
    lines.push('');
    lines.push(`Total examples: ${total}`);
    lines.push(`- pass: ${byStatus.pass.length}`);
    lines.push(`- compile-error: ${byStatus['compile-error'].length}`);
    lines.push(`- runtime-error: ${byStatus['runtime-error'].length}`);
    lines.push(`- iteration-limit: ${byStatus['iteration-limit'].length}`);
    lines.push('');
    lines.push('## Results');
    lines.push('');
    lines.push('| id | title | category | status | error |');
    lines.push('|---|---|---|---|---|');
    for (const r of results) {
      const err = r.error ? r.error.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
      lines.push(`| ${r.id} | ${r.title} | ${r.category} | ${r.status} | ${err} |`);
    }
    lines.push('');
    writeFileSync(resolve(process.cwd(), outPath), lines.join('\n'), 'utf-8');
    console.log(`\nWrote ${outPath}`);
  }

  if (byStatus['compile-error'].length + byStatus['runtime-error'].length + byStatus['iteration-limit'].length > 0) {
    process.exitCode = 1;
  }
}

main();
