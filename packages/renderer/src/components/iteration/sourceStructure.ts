/**
 * Static loop structure of an AQVL program, read straight off its source text:
 * for every line, which LOOP / WHILE blocks enclose it (outermost first). This is
 * what lets the iteration layer tell an inner loop's cursor from an outer one's
 * without the VM having to report nesting itself.
 *
 * Block grammar relied on (see the Loops & Control examples): LOOP, WHILE, IF,
 * FUNCTION and SEQUENCE open a block that END closes; ELSE / ELSE IF continue the
 * current IF rather than opening a new one.
 */

export interface EnclosingLoop {
  /** 1-based line of the loop header. */
  line: number;
  kind: 'LOOP' | 'WHILE';
  /** LOOP's counter (`LOOP i FROM ...` -> 'i'); for WHILE, the first name in its condition. */
  variable: string | null;
  /** The header's condition text for WHILE (`i < n AND found == -1`), or `FROM a TO b` for LOOP. */
  header: string;
}

export interface SourceStructure {
  /** Index = 1-based line number. Lines outside any loop map to []. */
  loopsAt(line: number): readonly EnclosingLoop[];
  /** The trimmed, comment-free text of a 1-based line ('' if out of range). */
  textAt(line: number): string;
}

function stripComment(line: string): string {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inString = !inString;
    if (!inString && c === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

export function parseSourceStructure(source: string): SourceStructure {
  const rawLines = source.split(/\r?\n/);
  const texts = rawLines.map((l) => stripComment(l).trim());
  const loopsByLine: EnclosingLoop[][] = [[]];
  // Every open block; loops carry their EnclosingLoop, other blocks null.
  const blocks: (EnclosingLoop | null)[] = [];
  const currentLoops = () => blocks.filter((b): b is EnclosingLoop => b !== null);

  texts.forEach((text, i) => {
    const line = i + 1;
    const upper = text.toUpperCase();
    const loopMatch = /^LOOP\s+([A-Za-z_]\w*)\s+(FROM\b.*)$/i.exec(text);
    const whileMatch = /^WHILE\s+(.*)$/i.exec(text);

    if (loopMatch) {
      const loop: EnclosingLoop = { line, kind: 'LOOP', variable: loopMatch[1], header: loopMatch[2] };
      blocks.push(loop);
      loopsByLine[line] = currentLoops();
      return;
    }
    if (whileMatch) {
      const firstName = /[A-Za-z_]\w*/.exec(whileMatch[1]);
      const loop: EnclosingLoop = { line, kind: 'WHILE', variable: firstName ? firstName[0] : null, header: whileMatch[1] };
      blocks.push(loop);
      loopsByLine[line] = currentLoops();
      return;
    }

    loopsByLine[line] = currentLoops();
    if (/^(IF|FUNCTION|SEQUENCE)\b/.test(upper)) {
      blocks.push(null);
    } else if (/^END\b/.test(upper)) {
      blocks.pop();
    }
  });

  return {
    loopsAt: (line) => loopsByLine[line] ?? [],
    textAt: (line) => texts[line - 1] ?? '',
  };
}
