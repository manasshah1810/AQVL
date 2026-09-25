#!/usr/bin/env node
/**
 * CLI tool: compiles a `.aqvl` file and prints its compiled AQIR (objects +
 * instructions) in a readable, one-line-per-entry format — for manually
 * spot-checking geometry opcode output (SET_LAYOUT_STRATEGY, SET_POSITION,
 * COMPUTE_LAYOUT, SET_CAMERA, SET_ROTATION, SET_SCALE — see
 * docs/design/aqir-geometry-spec.md) without wading through compile()'s
 * full token/AST/AQIR JSON dump.
 *
 * Usage:
 *   npx tsx scripts/inspect-aqir.ts <path-to-file.aqvl>
 *   npx tsx scripts/inspect-aqir.ts <path-to-file.aqvl> --json   (raw AQIRProgram JSON instead)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from '../packages/compiler/src';

const GEOMETRY_ACTIONS = new Set([
  'SET_LAYOUT_STRATEGY', 'SET_POSITION', 'COMPUTE_LAYOUT', 'SET_CAMERA', 'SET_ROTATION', 'SET_SCALE',
]);

function formatObject(obj: any, index: number): string {
  const { id, type, logicalParent, logicalIndex, value, label, ...rest } = obj;
  let desc = `${id}  ${type}`;
  if (logicalParent !== undefined) {
    desc += `  ${logicalParent}${logicalIndex !== undefined ? `[${logicalIndex}]` : ''}`;
  }
  if (value !== undefined) desc += `  = ${JSON.stringify(value)}`;
  if (label !== undefined) desc += `  "${label}"`;
  const extras = Object.entries(rest).filter(([, v]) => v !== undefined);
  if (extras.length > 0) {
    desc += '  ' + extras.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
  }
  return `  [${String(index).padStart(3, ' ')}] ${desc}`;
}

function formatInstruction(instr: any, index: number): string {
  const label = instr.action ?? instr.opcode ?? 'UNKNOWN';
  const { action, opcode, lineNumber, sourceLocation, ...rest } = instr;
  const fields = Object.entries(rest)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('  ');
  const marker = GEOMETRY_ACTIONS.has(label) ? '*' : ' ';
  return `${marker} [${String(index).padStart(3, ' ')}] ${label}${fields ? '   ' + fields : ''}`;
}

function main(): void {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith('--'));
  const asJson = args.includes('--json');

  if (!filePath) {
    console.error('Usage: inspect-aqir <path-to-file.aqvl> [--json]');
    process.exit(1);
  }

  const absolutePath = resolve(process.cwd(), filePath);
  const source = readFileSync(absolutePath, 'utf-8');

  // compile() logs a full token/AST/AQIR JSON dump internally — silence it
  // so this tool's own, more targeted output is all that prints.
  const originalLog = console.log;
  console.log = () => {};

  let aqir;
  try {
    aqir = compile(source);
  } catch (e: any) {
    console.log = originalLog;
    console.error(`Compilation failed: ${e.name ?? 'Error'}: ${e.message}`);
    if (typeof e.lineNumber === 'number') {
      console.error(`  at line ${e.lineNumber}${typeof e.column === 'number' ? `, column ${e.column}` : ''}`);
    }
    if (e.suggestion) console.error(`  ${e.suggestion}`);
    process.exit(1);
  }
  console.log = originalLog;

  if (asJson) {
    console.log(JSON.stringify(aqir, null, 2));
    return;
  }

  console.log(`AQIR Program: ${aqir.scene}  (version ${aqir.version})`);
  console.log('='.repeat(70));

  console.log(`\nObjects (${aqir.objects.length}):`);
  aqir.objects.forEach((obj, i) => console.log(formatObject(obj, i)));

  console.log(`\nInstructions (${aqir.instructions.length})  ["*" marks a geometry opcode]:`);
  aqir.instructions.forEach((instr, i) => console.log(formatInstruction(instr, i)));

  const geometryCount = aqir.instructions.filter((i: any) => GEOMETRY_ACTIONS.has(i.action)).length;
  console.log(`\n${geometryCount} geometry instruction(s) out of ${aqir.instructions.length} total.`);
}

main();
