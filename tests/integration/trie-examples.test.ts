/**
 * The Playground's Tries examples, run end-to-end (compile -> ExecutionEngine
 * with the real AnimationController, animations completed instantly), plus
 * the trie-as-real-code features they rely on (TrieProgramEngine): t.root,
 * GET_CHILD, HAS_CHILD, ADD_CHILD, REMOVE_CHILD, CHILD_COUNT, CHILD_AT,
 * node.isEnd / node.char / custom fields, WORD_COUNT, NODE_COUNT, PRINT t.
 *
 * After every run each trie is checked to be well formed: every node's parent
 * exists and is linked by exactly one edge, a node's letter is the last letter
 * of its prefix, children are drawn below their parent in alphabetical order.
 * General examples are re-run on other inputs against TypeScript references.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { TrieScripts } from '../../packages/demo/src/examples/TrieLibrary';
import { EXAMPLES } from '../../packages/demo/src/examples/registry';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

interface TrieState {
  /** Stored words, a to z */
  words: string[];
  /** Every prefix that has a node ("" = root) */
  prefixes: string[];
  fields: Record<string, Record<string, unknown>>;
}

interface RunResult {
  tries: Record<string, TrieState>;
  arrays: Record<string, unknown[]>;
  logs: string[];
  printed: string[];
  keywords: string[];
}

const prefixOf = (el: any): string => el.prefix ?? el.id.slice(el.id.indexOf(':', 3) + 1);

function collectTries(engine: ExecutionEngine): Record<string, TrieState> {
  const graph = engine.sceneManager.getSceneGraph() as any[];
  const byId = new Map(graph.map((el) => [el.id, el]));
  const names = new Set(graph.filter((el) => el.originalType === 'TRIE_NODE').map((el) => el.logicalParent));
  const out: Record<string, TrieState> = {};
  for (const name of names) {
    const nodes = graph.filter((el) => el.originalType === 'TRIE_NODE' && el.logicalParent === name);
    const edges = graph.filter((el) => el.type === 'edge' && el.logicalParent === name);
    const prefixes = nodes.map(prefixOf).sort();
    expect(new Set(prefixes).size, `${name} prefixes unique`).toBe(prefixes.length);
    expect(prefixes, `${name} has a root`).toContain('');
    for (const el of nodes) {
      const p = prefixOf(el);
      expect(el.id).toBe(`tn:${name}:${p}`);
      expect(el.scale.x, `${name} "${p}" full size`).toBeCloseTo(1, 5);
      if (p === '') {
        expect(edges.filter((e) => e.targetId === el.id)).toHaveLength(0);
        continue;
      }
      expect(el.value, `${name} "${p}" letter`).toBe(p[p.length - 1]);
      const incoming = edges.filter((e) => e.targetId === el.id);
      expect(incoming, `${name} "${p}" one parent edge`).toHaveLength(1);
      const parent = byId.get(incoming[0].sourceId);
      expect(parent && prefixOf(parent), `${name} "${p}" parent`).toBe(p.slice(0, -1));
      expect(el.position.y, `${name} "${p}" below its parent`).toBeLessThan(parent.position.y);
    }
    // Children left to right in alphabetical order
    for (const parent of nodes) {
      const kids = edges.filter((e) => e.sourceId === parent.id).map((e) => byId.get(e.targetId));
      const byX = [...kids].sort((a, b) => a.position.x - b.position.x).map((k) => k.value);
      expect(byX, `${name} "${prefixOf(parent)}" children order`).toEqual([...byX].sort());
    }
    // No word end without a node, no stray edges
    for (const e of edges) expect(byId.has(e.sourceId) && byId.has(e.targetId)).toBe(true);
    const words = nodes.filter((el) => el.isEndOfWord).map(prefixOf).sort();
    const fields: Record<string, Record<string, unknown>> = {};
    for (const el of nodes) if (Object.keys(el.fields ?? {}).length > 0) fields[prefixOf(el)] = el.fields;
    out[name] = { words, prefixes, fields };
  }
  return out;
}

function collectArrays(engine: ExecutionEngine): Record<string, unknown[]> {
  const byName: Record<string, any[]> = {};
  for (const el of engine.sceneManager.getSceneGraph() as any[]) {
    if (el.originalType !== 'ARRAY_ELEMENT' || el.animationLayer) continue;
    (byName[el.logicalParent] ??= []).push(el);
  }
  const out: Record<string, unknown[]> = {};
  for (const [name, els] of Object.entries(byName)) out[name] = els.sort((a, b) => a.logicalIndex - b.logicalIndex).map((el) => el.value);
  return out;
}

async function run(source: string): Promise<RunResult> {
  const engine = new ExecutionEngine({ headless: true });
  const logs: string[] = [];
  const keywords: string[] = [];
  const printed: string[] = [];
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => {
    logs.push(e.message);
    keywords.push(e.keyword);
    if (e.keyword === 'PRINT') printed.push(e.message);
  });
  engine.loadProgram(compile(source) as any);
  await engine.execute();
  return { tries: collectTries(engine), arrays: collectArrays(engine), logs, printed, keywords };
}

async function runError(source: string): Promise<string> {
  const engine = new ExecutionEngine({ headless: true });
  try {
    engine.loadProgram(compile(source) as any);
    await engine.execute();
  } catch (e: any) {
    return e.message;
  }
  throw new Error('expected the program to stop with an error');
}

const program = (declare: string, sequence: string) => `SCENE T\n\nDECLARE\n${declare}\n\nSEQUENCE\n${sequence}\nEND\n`;

/** The example with its first `ARRAY <name> = [...]` / `TRIE <name> = [...]` literal replaced. */
function withList(source: string, kind: 'ARRAY' | 'TRIE', name: string, values: (number | string)[]): string {
  const pattern = new RegExp(`${kind} ${name} = \\[[^\\]]*\\]`);
  expect(source).toMatch(pattern);
  const literal = values.map((v) => (typeof v === 'string' ? `"${v}"` : String(v))).join(', ');
  return source.replace(pattern, `${kind} ${name} = [${literal}]`);
}

/** The example with its first `<name> = "<text>"` assignment replaced. */
function withText(source: string, name: string, value: string): string {
  const pattern = new RegExp(`(\\n\\s*)${name} = "[^"]*"\\n`);
  expect(source).toMatch(pattern);
  return source.replace(pattern, `$1${name} = "${value}"\n`);
}

// ─── TypeScript references ────────────────────────────────────────────────────

const prefixesOf = (words: string[]) => {
  const set = new Set<string>(['']);
  for (const w of words) for (let i = 1; i <= w.length; i++) set.add(w.slice(0, i));
  return [...set].sort();
};
const sortedUnique = (words: string[]) => [...new Set(words)].sort();
function lcpRef(words: string[]): string {
  let p = words[0];
  for (const w of words) while (!w.startsWith(p)) p = p.slice(0, -1);
  return p;
}
function wordBreakRef(text: string, dict: string[]): boolean {
  const ok = [true];
  for (let i = 1; i <= text.length; i++) ok[i] = dict.some((w) => i >= w.length && ok[i - w.length] && text.slice(i - w.length, i) === w);
  return !!ok[text.length];
}
function maxXorRef(nums: number[]): number {
  let best = 0;
  for (const a of nums) for (const b of nums) best = Math.max(best, a ^ b);
  return best;
}
function distinctSubstringsRef(text: string): number {
  const set = new Set<string>();
  for (let a = 0; a < text.length; a++) for (let b = a + 1; b <= text.length; b++) set.add(text.slice(a, b));
  return set.size;
}
function wildcardRef(words: string[], pattern: string): boolean {
  return words.some((w) => w.length === pattern.length && [...pattern].every((c, i) => c === '.' || c === w[i]));
}
function longestBuiltRef(words: string[]): string {
  const set = new Set(words);
  let best = '';
  for (const w of [...words].sort()) {
    let ok = true;
    for (let i = 1; i <= w.length; i++) if (!set.has(w.slice(0, i))) ok = false;
    if (ok && w.length > best.length) best = w;
  }
  return best;
}
function uniquePrefixRef(words: string[], word: string): string {
  for (let i = 1; i <= word.length; i++) {
    const p = word.slice(0, i);
    if (words.filter((w) => w.startsWith(p)).length === 1) return p;
  }
  return word;
}

// ─── The examples ─────────────────────────────────────────────────────────────

describe('Trie examples produce correct results', () => {
  it('Insert Words by Hand: new nodes per word, shared prefixes reused', async () => {
    const { printed, tries } = await run(TrieScripts.InsertWordsByHand);
    expect(printed.slice(0, 8)).toEqual([
      'car: 3 new node(s), 0 letter(s) reused from earlier words',
      'cat: 1 new node(s), 2 letter(s) reused from earlier words',
      'cart: 1 new node(s), 3 letter(s) reused from earlier words',
      'care: 1 new node(s), 3 letter(s) reused from earlier words',
      'dog: 3 new node(s), 0 letter(s) reused from earlier words',
      'do: 0 new node(s), 2 letter(s) reused from earlier words',
      'Stored words: [car, care, cart, cat, do, dog]',
      'The words have 19 letters in total, but the trie needs only 9 nodes (plus the root)',
    ]);
    const words = ['car', 'cat', 'cart', 'care', 'dog', 'do'];
    expect(tries.dictionary.words).toEqual(sortedUnique(words));
    expect(tries.dictionary.prefixes).toEqual(prefixesOf(words));
  });

  it('Insert Words by Hand on other words builds exactly their prefixes', async () => {
    const words = ['tea', 'ten', 'inn', 'i', 'in', 'tea'];
    const { tries } = await run(withList(TrieScripts.InsertWordsByHand, 'ARRAY', 'words', words));
    expect(tries.dictionary.words).toEqual(sortedUnique(words));
    expect(tries.dictionary.prefixes).toEqual(prefixesOf(words));
  });

  it('Search for a Whole Word', async () => {
    const { printed, logs } = await run(TrieScripts.SearchWholeWord);
    expect(printed.slice(0, 7)).toEqual([
      'cat: FOUND',
      'ca: not in the dictionary',
      'cart: FOUND',
      'cow: not in the dictionary',
      'do: FOUND',
      'dot: not in the dictionary',
      '3 of 6 queries are stored words',
    ]);
    expect(logs).toContain('node = GET_CHILD(node, CHAR_AT(word, i))   ⟹   node is NULL: node "c" has no child \'o\'');
    expect(logs).toContain('node.isEnd   ⟹   no word ends at node "ca" (it is only the beginning of longer words) → FALSE');
  });

  it('Starts With a Prefix', async () => {
    const { printed } = await run(TrieScripts.StartsWithPrefix);
    expect(printed.slice(0, 6)).toEqual([
      "'la': some product starts with it",
      "'lamp': a full product name (so also a prefix)",
      "'pho': some product starts with it",
      "'lap': some product starts with it",
      "'pen': no product starts with it",
      "'laptops': no product starts with it",
    ]);
  });

  it('Count Words, Nodes and Leaves agrees with WORD_COUNT / NODE_COUNT', async () => {
    const { printed } = await run(TrieScripts.CountWordsAndNodes);
    expect(printed).toEqual([
      'Words counted by recursion: 7 (WORD_COUNT says 7)',
      'Nodes counted by recursion: 10 (NODE_COUNT says 10)',
      'Longest word: 4 letters',
      'Leaves: 4, so 3 word(s) end in the middle of a longer word (like in / inn, ten / tent)',
    ]);
    const words = ['apple', 'app', 'bee', 'b', 'banana', 'band'];
    const other = await run(withList(TrieScripts.CountWordsAndNodes, 'TRIE', 't', words));
    expect(other.printed[0]).toBe(`Words counted by recursion: ${words.length} (WORD_COUNT says ${words.length})`);
    const nodes = prefixesOf(words).length;
    expect(other.printed[1]).toBe(`Nodes counted by recursion: ${nodes} (NODE_COUNT says ${nodes})`);
    expect(other.printed[2]).toBe('Longest word: 6 letters');
  });

  it('Trie Sort writes the words in dictionary order', async () => {
    const { arrays } = await run(TrieScripts.DictionaryInOrder);
    expect(arrays.sorted).toEqual(['app', 'apple', 'apricot', 'ball', 'banana', 'bat', 'cherry']);
    const words = ['zoo', 'a', 'zebra', 'mango', 'man', 'apple', 'm'];
    const other = await run(withList(TrieScripts.DictionaryInOrder, 'ARRAY', 'input', words));
    expect(other.arrays.sorted).toEqual(sortedUnique(words));
  });

  it('Autocomplete Suggestions', async () => {
    const { printed, arrays } = await run(TrieScripts.AutocompleteSuggestions);
    expect(printed.slice(0, 4)).toEqual([
      "'car' (at most 4 suggestions) -> [car, card, care, career]",
      "'ca' (at most 4 suggestions) -> [car, card, care, career]",
      "'do' (at most 4 suggestions) -> [dog, door]",
      "'x': no suggestions",
    ]);
    // the last round ('x') cleared the list and found nothing
    expect(arrays.suggestions ?? []).toEqual([]);
  });

  it('Delete a Word with Pruning removes only nodes nobody needs', async () => {
    const { printed, tries } = await run(TrieScripts.DeleteWordWithPruning);
    expect(printed.slice(0, 6)).toEqual([
      'Before: [bad, ban, bat, batch, bath]',
      'Deleted batch: [bad, ban, bat, bath]',
      'Deleted bat: [bad, ban, bath]',
      'Deleted bad: [ban, bath]',
      'cow is not stored, nothing to delete',
      '6 nodes left for 2 words',
    ]);
    expect(tries.t.prefixes).toEqual(prefixesOf(['ban', 'bath']));
  });

  it('Delete on other words leaves exactly the prefixes of the remaining words', async () => {
    const start = ['a', 'ab', 'abc', 'abd', 'b'];
    const remove = ['abc', 'a', 'b', 'zz'];
    let source = withList(TrieScripts.DeleteWordWithPruning, 'TRIE', 't', start);
    source = withList(source, 'ARRAY', 'toDelete', remove);
    const { tries } = await run(source);
    const left = start.filter((w) => !remove.includes(w));
    expect(tries.t.words).toEqual(left.sort());
    expect(tries.t.prefixes).toEqual(prefixesOf(left));
  });

  it('Count Names by Prefix', async () => {
    const { printed, tries } = await run(TrieScripts.PrefixCounter);
    expect(printed.slice(0, 6)).toEqual([
      "Usernames starting with 'sa': 5",
      "Usernames starting with 'sar': 2",
      "Usernames starting with 's': 5",
      "Usernames starting with 't': 2",
      "Usernames starting with 'ti': 1",
      "Usernames starting with 'z': 0",
    ]);
    expect(tries.usernames.fields.sa).toEqual({ count: 5 });
  });

  it('Word Frequency Counter', async () => {
    const { printed } = await run(TrieScripts.WordFrequencyCounter);
    expect(printed).toEqual(['Word counts:', '  and: 2', '  bird: 1', '  cat: 1', '  dog: 1', '  the: 3', '5 different words; the most frequent appears 3 times']);
    const other = await run(withText(TrieScripts.WordFrequencyCounter, 'sentence', ' to be or  not to be '));
    expect(other.printed).toEqual(['Word counts:', '  be: 2', '  not: 1', '  or: 1', '  to: 2', '4 different words; the most frequent appears 2 times']);
  });

  it('Longest Common Prefix', async () => {
    const { printed } = await run(TrieScripts.LongestCommonPrefix);
    expect(printed[0]).toBe("Longest common prefix: 'fl'");
    for (const words of [['interview', 'internet', 'interval'], ['dog', 'racecar'], ['abc', 'ab', 'abcd']]) {
      const other = await run(withList(TrieScripts.LongestCommonPrefix, 'ARRAY', 'words', words));
      const ref = lcpRef(words);
      expect(other.printed[0], words.join()).toBe(ref === '' ? 'The words have no common prefix' : `Longest common prefix: '${ref}'`);
    }
  });

  it('Shortest Unique Prefix', async () => {
    const words = ['zebra', 'dog', 'duck', 'dove', 'dot'];
    const { printed } = await run(TrieScripts.ShortestUniquePrefix);
    expect(printed.slice(0, 5)).toEqual(words.map((w) => `${w} -> ${uniquePrefixRef(words, w)}`));
    const other = ['bearcat', 'bert', 'car', 'cart', 'x'];
    const r = await run(withList(TrieScripts.ShortestUniquePrefix, 'ARRAY', 'words', other));
    expect(r.printed.slice(0, 5)).toEqual(other.map((w) => `${w} -> ${uniquePrefixRef(other, w)}`));
  });

  it('Replace Words with Their Roots', async () => {
    const { printed } = await run(TrieScripts.ReplaceWordsWithRoots);
    expect(printed).toContain('After:  the ca was rat by the bat');
    expect(printed.slice(0, 3)).toEqual(['cattle -> ca', 'rattled -> rat', 'battery -> bat']);
  });

  it('Word Break', async () => {
    const { printed } = await run(TrieScripts.WordBreak);
    expect(printed[printed.length - 1]).toBe("'pineapplepenapple' CAN be split into dictionary words");
    const dict = ['apple', 'pen', 'pine', 'pineapple', 'app', 'le'];
    for (const text of ['applepenapple', 'catsandog', 'pineapp', 'penpenx']) {
      const r = await run(withText(TrieScripts.WordBreak, 'text', text));
      const ok = wordBreakRef(text, dict);
      expect(r.printed[r.printed.length - 1], text).toBe(`'${text}' ${ok ? 'CAN' : 'can NOT'} be split into dictionary words`);
    }
  });

  it('Longest Word Built Step by Step', async () => {
    const { printed } = await run(TrieScripts.LongestWordBuiltStepByStep);
    expect(printed[0]).toBe('Longest word built step by step: apple');
    const words = ['b', 'ba', 'ban', 'bana', 'c', 'ca', 'cat', 'cats', 'd', 'do', 'dog'];
    const r = await run(withList(TrieScripts.LongestWordBuiltStepByStep, 'TRIE', 't', words));
    expect(r.printed[0]).toBe(`Longest word built step by step: ${longestBuiltRef(words)}`);
  });

  it('Count Distinct Substrings', async () => {
    const { printed } = await run(TrieScripts.CountDistinctSubstrings);
    expect(printed).toContain("'banana' has 15 different substrings (NODE_COUNT - 1 = 15)");
    for (const text of ['aaaa', 'abcab', 'mississippi']) {
      const r = await run(withText(TrieScripts.CountDistinctSubstrings, 'text', text));
      const n = distinctSubstringsRef(text);
      expect(r.printed, text).toContain(`'${text}' has ${n} different substrings (NODE_COUNT - 1 = ${n})`);
    }
  });

  it('Wildcard Search', async () => {
    const words = ['bad', 'dad', 'mad', 'pad', 'bed', 'bat'];
    const patterns = ['pad', '.ad', 'b..', '..x', 'm.d', '....'];
    const { printed } = await run(TrieScripts.WildcardSearch);
    expect(printed).toEqual(patterns.map((p) => `${p}: ${wildcardRef(words, p) ? 'matches a stored word' : 'no match'}`));
    const more = ['...', 'd.d', '.e.', 'ba', '.a.'];
    const r = await run(withList(TrieScripts.WildcardSearch, 'ARRAY', 'patterns', more));
    expect(r.printed).toEqual(more.map((p) => `${p}: ${wildcardRef(words, p) ? 'matches a stored word' : 'no match'}`));
  });

  it('Contact Search as You Type', async () => {
    const { printed } = await run(TrieScripts.ContactSearchAsYouType);
    expect(printed).toEqual([
      "typed 'a': 4 match(es) [alan, albert, alice, alicia]",
      "typed 'al': 4 match(es) [alan, albert, alice, alicia]",
      "typed 'ali': 2 match(es) [alice, alicia]",
      "typed 'alic': 2 match(es) [alice, alicia]",
    ]);
    const r = await run(withText(TrieScripts.ContactSearchAsYouType, 'typing', 'bez'));
    expect(r.printed).toEqual(["typed 'b': 2 match(es) [bella, bob]", "typed 'be': 1 match(es) [bella]", "typed 'bez': no contact matches"]);
  });

  it('Maximum XOR of Two Numbers', async () => {
    const { printed } = await run(TrieScripts.MaximumXorPair);
    expect(printed).toContain('Maximum XOR of two numbers: 28');
    for (const nums of [[14, 70, 53, 83, 49, 91, 36, 80, 92, 51, 66, 70], [1, 2], [7, 7, 7], [0, 1023, 512]]) {
      const r = await run(withList(TrieScripts.MaximumXorPair, 'ARRAY', 'nums', nums));
      expect(r.printed, nums.join()).toContain(`Maximum XOR of two numbers: ${maxXorRef(nums)}`);
    }
  });
});

// ─── The engine ───────────────────────────────────────────────────────────────

describe('A TRIE driven by real code', () => {
  it('TRIE t on its own is an empty trie with just the root', async () => {
    const { printed, tries } = await run(program('  TRIE t', '  PRINT WORD_COUNT(t) + " " + NODE_COUNT(t) + " " + CHILD_COUNT(t.root)\n  PRINT t'));
    expect(printed).toEqual(['0 1 0', '[]']);
    expect(tries.t.prefixes).toEqual(['']);
  });

  it('declared words build the same trie as code does, with the same node ids', async () => {
    const { printed } = await run(program('  TRIE t = ["cat", "car"]', '  n = GET_CHILD(GET_CHILD(t.root, "c"), "a")\n  PRINT n\n  PRINT CHILD_AT(n, 0).char + CHILD_AT(n, 1).char\n  PRINT GET_CHILD(n, "t").isEnd'));
    expect(printed).toEqual(['Node("ca")', 'rt', 'TRUE']);
  });

  it('digits given as numbers are one-character edges (a bit trie)', async () => {
    const { tries } = await run(program('  TRIE b', '  n = b.root\n  ADD_CHILD n 1\n  n = GET_CHILD(n, "1")\n  ADD_CHILD n 0\n  n = GET_CHILD(n, 0)\n  n.isEnd = TRUE'));
    expect(tries.b.words).toEqual(['10']);
  });

  it('custom fields keep their values and show under the node', async () => {
    const { tries, logs } = await run(program('  TRIE t = ["ab"]', '  n = GET_CHILD(t.root, "a")\n  n.count = 2\n  n.count = n.count + 1'));
    expect(tries.t.fields.a).toEqual({ count: 3 });
    expect(logs).toContain('n.count = n.count + 1   ⟹   node "a": count = 3 (was 2)');
  });

  it('REMOVE_CHILD of a word-end leaf removes that word', async () => {
    const { tries, logs } = await run(program('  TRIE t = ["ab", "a"]', '  n = GET_CHILD(t.root, "a")\n  REMOVE_CHILD n "b"'));
    expect(tries.t.words).toEqual(['a']);
    expect(logs.some((l) => l.includes('it was the end of "ab", so that word is gone too'))).toBe(true);
  });

  it('pointer moves, checks and recursion are animated steps', async () => {
    const { keywords } = await run(TrieScripts.CountWordsAndNodes);
    expect(keywords).toContain('CALL');
    expect(keywords).toContain('RETURN');
    expect(keywords).toContain('CHECK');
  });
});

describe('Trie errors are reported clearly', () => {
  it('a field read on NULL', async () => {
    expect(await runError(program('  TRIE t', '  n = GET_CHILD(t.root, "z")\n  x = n.isEnd'))).toMatch(/NULL pointer dereference: cannot read n.isEnd because n is NULL/);
  });
  it('ADD_CHILD twice for the same character', async () => {
    expect(await runError(program('  TRIE t', '  r = t.root\n  ADD_CHILD r "a"\n  ADD_CHILD r "a"'))).toMatch(/node root already has a child 'a'/);
  });
  it('a two-letter edge', async () => {
    expect(await runError(program('  TRIE t', '  r = t.root\n  ADD_CHILD r "ab"'))).toMatch(/"ab" has 2 characters, but each trie edge holds exactly one/);
  });
  it('REMOVE_CHILD of a node that still has children', async () => {
    expect(await runError(program('  TRIE t = ["abc"]', '  r = t.root\n  REMOVE_CHILD r "a"'))).toMatch(/node "a" still has children \(b\)/);
  });
  it('REMOVE_CHILD of a missing child', async () => {
    expect(await runError(program('  TRIE t = ["ab"]', '  r = t.root\n  REMOVE_CHILD r "x"'))).toMatch(/node root has no child 'x' to remove \(its children are a\)/);
  });
  it('CHILD_AT out of range, and at a leaf', async () => {
    expect(await runError(program('  TRIE t = ["a"]', '  x = CHILD_AT(t.root, 1)'))).toMatch(/valid indexes are 0 to 0, not 1/);
    expect(await runError(program('  TRIE t = ["a"]', '  x = CHILD_AT(GET_CHILD(t.root, "a"), 0)'))).toMatch(/has no children \(CHILD_COUNT is 0\)/);
  });
  it('an unset field', async () => {
    expect(await runError(program('  TRIE t = ["a"]', '  x = t.root.count'))).toMatch(/\.count has not been set yet/);
  });
  it('isEnd must be TRUE or FALSE, and the root cannot end a word', async () => {
    expect(await runError(program('  TRIE t = ["a"]', '  n = GET_CHILD(t.root, "a")\n  n.isEnd = 1'))).toMatch(/must be TRUE or FALSE/);
    expect(await runError(program('  TRIE t', '  n = t.root\n  n.isEnd = TRUE'))).toMatch(/the root stands for the empty word/);
  });
  it('the trie itself where a node is needed', async () => {
    expect(await runError(program('  TRIE t', '  x = HAS_CHILD(t, "a")'))).toMatch(/HAS_CHILD needs a trie node, not the trie itself/);
    expect(await runError(program('  TRIE t', '  ADD_CHILD t "a"'))).toMatch(/ADD_CHILD needs a trie node, not the trie itself/);
  });
  it('LENGTH and array-style statements on a trie', async () => {
    expect(await runError(program('  TRIE t', '  x = LENGTH(t)'))).toMatch(/LENGTH\(t\) is not defined for a TRIE: use WORD_COUNT\(t\)/);
    expect(await runError(program('  TRIE t', '  INSERT t "cat"'))).toMatch(/INSERT t is not a trie statement/);
  });
  it('WORD_COUNT on something that is not a trie', async () => {
    expect(await runError(program('  ARRAY a = [1]', '  x = WORD_COUNT(a)'))).toMatch(/WORD_COUNT needs a declared TRIE/);
  });
});

describe('Tries library, registry and docs', () => {
  const trieExamples = EXAMPLES.filter((e) => e.category === 'Tries');

  it('lists all 18 examples, each written as real code', () => {
    expect(trieExamples).toHaveLength(18);
    expect(new Set(trieExamples.map((e) => e.source))).toEqual(new Set(Object.values(TrieScripts)));
    expect(new Set(trieExamples.map((e) => e.id)).size).toBe(18);
    for (const example of trieExamples) {
      expect(example.source, example.id).not.toMatch(/\bTRIE_(INSERT|SEARCH|DELETE|AUTOCOMPLETE|STARTSWITH)\b/);
      expect(example.source, example.id).toMatch(/\b(WHILE|LOOP)\b/);
      expect(example.source, example.id).toMatch(/\bIF\b/);
    }
  });

  it('every example runs without an error and leaves a well-formed trie', async () => {
    for (const example of trieExamples) {
      await expect(run(example.source), example.id).resolves.toBeDefined();
    }
  });

  it("the Docs page's trie programs run and print what the page says", async () => {
    const docs = readFileSync(resolve(__dirname, '../../packages/demo/src/pages/Docs.tsx'), 'utf8').replace(/\r\n/g, '\n');
    const docProgram = (sceneName: string) => {
      const match = docs.match(new RegExp('code=\\{`(SCENE ' + sceneName + '\\n[\\s\\S]*?)`\\}'));
      expect(match, sceneName).not.toBeNull();
      return match![1];
    };
    expect((await run(docProgram('TrieIntro'))).printed).toEqual(['Words: [car, cart, cat]', 'cat is stored', 'ca is only a prefix', 'Nodes: 6']);
    expect((await run(docProgram('TrieAutocomplete'))).printed).toEqual(['Words starting with car:', '  car', '  card', '  care']);
    expect((await run(docProgram('PrefixCount'))).printed).toEqual(['Names starting with sa: 3']);
    const del = await run(docProgram('TrieDelete'));
    expect(del.printed).toEqual(['Words: [bad, bat]', 'Nodes: 5']);
  });
});
