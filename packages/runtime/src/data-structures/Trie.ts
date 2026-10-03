/**
 * Trie (prefix tree) — backs AQVL's TRIE declarations and the
 * TRIE_INSERT / TRIE_SEARCH / TRIE_DELETE / TRIE_AUTOCOMPLETE runtime ops
 * (see ../core/algorithms/TrieEngine.ts).
 *
 * Case-sensitive by design ("Cat" and "cat" are different words) — callers
 * that want case-insensitive behavior should lowercase before calling in.
 *
 * insert / search / startsWith / delete / autocomplete reset `steps` and
 * record what they did, one step per visualizable micro-action; TrieEngine
 * replays them. A node is named in a step by its prefix (the characters on
 * the path from the root, '' for the root).
 */
import type { StepPrimitives } from './steps';

export type TrieStep =
  /** insert walked through the existing node `prefix`. */
  | { type: 'PASS'; prefix: string }
  /** insert added the node `prefix` (reached by `char`) under the node `parent`. */
  | { type: 'CREATE'; prefix: string; parent: string; char: string }
  /** insert marked the node `prefix` as a word end; `already` when it was one. */
  | { type: 'MARK_END'; prefix: string; already: boolean }
  /** search / startsWith stepped down to the node `prefix`. */
  | { type: 'HOP'; prefix: string }
  /** search / startsWith found no child for the next character below the node `prefix`. */
  | { type: 'BREAK'; prefix: string }
  /** search / startsWith ended at the node `prefix`: a word end (or, for a prefix, an existing path) when `found`. */
  | { type: 'RESULT'; prefix: string; found: boolean }
  /** delete / autocomplete: the path for the word or prefix does not exist. */
  | { type: 'REJECT' }
  /** delete unmarked the word end `prefix`. */
  | { type: 'UNMARK'; prefix: string }
  /** delete removed the node `prefix` (no children left, not a word end). */
  | { type: 'PRUNE'; prefix: string }
  /** autocomplete starts from the node `prefix`. */
  | { type: 'PREFIX'; prefix: string }
  /** autocomplete matched `word` (its word-end node). */
  | { type: 'MATCH'; word: string }
  /** autocomplete is done with the node `prefix`. */
  | { type: 'RELEASE'; prefix: string };

/** The AQIR primitive each trie step realises (see ./steps.ts). */
export const TRIE_STEP_PRIMITIVES: StepPrimitives<TrieStep> = {
  PASS: { kind: 'ANNOTATE', verb: 'focus' },
  CREATE: { kind: 'MUTATE', verb: 'create' },
  MARK_END: { kind: 'MUTATE', verb: 'set' },
  HOP: { kind: 'ANNOTATE', verb: 'focus' },
  BREAK: { kind: 'ANNOTATE', verb: 'state' },
  RESULT: { kind: 'ANNOTATE', verb: 'state' },
  REJECT: { kind: 'ANNOTATE', verb: 'state' },
  UNMARK: { kind: 'MUTATE', verb: 'set' },
  PRUNE: { kind: 'MUTATE', verb: 'destroy' },
  PREFIX: { kind: 'ANNOTATE', verb: 'focus' },
  MATCH: { kind: 'ANNOTATE', verb: 'state' },
  RELEASE: { kind: 'ANNOTATE', verb: 'state' },
};

export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
}

export class Trie {
  root: TrieNode = new TrieNode();

  /** Steps recorded by the most recent insert / search / startsWith / delete / autocomplete call. */
  steps: TrieStep[] = [];

  /**
   * Inserts `word`, creating any missing nodes along the path and marking
   * the final node as a word end. Empty string is a no-op (no node
   * represents "no characters"). Records PASS / CREATE per character, then MARK_END.
   */
  insert(word: string): void {
    this.steps = [];
    if (word.length === 0) return;

    let node = this.root;
    let soFar = '';
    for (const char of word) {
      const parent = soFar;
      soFar += char;
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
        this.steps.push({ type: 'CREATE', prefix: soFar, parent, char });
      } else {
        this.steps.push({ type: 'PASS', prefix: soFar });
      }
      node = node.children.get(char)!;
    }
    this.steps.push({ type: 'MARK_END', prefix: word, already: node.isEndOfWord });
    node.isEndOfWord = true;
  }

  /**
   * Returns true only if `word` was inserted (the path exists AND the final
   * node is marked as a word end). Records a HOP per character walked, then
   * BREAK where the path ends early or RESULT at its last node.
   */
  search(word: string): boolean {
    this.steps = [];
    if (word.length === 0) return false;
    const node = this.walk(word);
    const found = node !== null && node.isEndOfWord;
    if (node) this.steps.push({ type: 'RESULT', prefix: word, found });
    return found;
  }

  /**
   * Returns true if any inserted word starts with `prefix` (path exists; no
   * end-of-word check). An empty prefix matches any non-empty trie. Records
   * the walk like `search`; RESULT is `found` when the whole path exists.
   */
  startsWith(prefix: string): boolean {
    this.steps = [];
    const node = this.walk(prefix);
    if (node) this.steps.push({ type: 'RESULT', prefix, found: true });
    if (prefix.length === 0) return this.root.children.size > 0;
    return node !== null;
  }

  /**
   * Removes `word` by unmarking its end-of-word flag, then prunes any nodes
   * left with no children and no other word ending there (walking back up
   * from the leaf). Returns whether `word` was actually present. Records
   * REJECT when the path does not exist, nothing when it ends on a node that
   * is not a word end, else UNMARK then one PRUNE per node removed.
   */
  delete(word: string): boolean {
    this.steps = [];
    if (word.length === 0) return false;
    const end = this.findNode(word);
    if (!end) {
      this.steps.push({ type: 'REJECT' });
      return false;
    }
    if (!end.isEndOfWord) return false;

    const path: { node: TrieNode; char: string }[] = [];
    let node = this.root;
    for (const char of word) {
      path.push({ node, char });
      node = node.children.get(char)!;
    }
    node.isEndOfWord = false;
    this.steps.push({ type: 'UNMARK', prefix: word });

    // Prune from the leaf back up: remove a node once it has no children and isn't itself a word end.
    let child = node;
    for (let i = path.length - 1; i >= 0; i--) {
      if (child.children.size > 0 || child.isEndOfWord) break;
      path[i].node.children.delete(path[i].char);
      this.steps.push({ type: 'PRUNE', prefix: word.slice(0, i + 1) });
      child = path[i].node;
    }

    return true;
  }

  /**
   * Returns every inserted word that starts with `prefix`, in lexicographic
   * order (DFS visits children in sorted key order). Records REJECT when the
   * prefix's path does not exist, else PREFIX, one MATCH per word, RELEASE.
   */
  autocomplete(prefix: string): string[] {
    this.steps = [];
    const startNode = prefix.length === 0 ? this.root : this.findNode(prefix);
    if (!startNode) {
      this.steps.push({ type: 'REJECT' });
      return [];
    }
    const words = this.getWordsWithPrefix(startNode, prefix);
    this.steps.push({ type: 'PREFIX', prefix });
    for (const word of words) this.steps.push({ type: 'MATCH', word });
    this.steps.push({ type: 'RELEASE', prefix });
    return words;
  }

  /** DFS helper: collects every word reachable from `node`, each prefixed with `prefix` (the path already walked to reach `node`). */
  getWordsWithPrefix(node: TrieNode, prefix: string): string[] {
    const words: string[] = [];
    if (node.isEndOfWord) words.push(prefix);

    const chars = [...node.children.keys()].sort();
    for (const char of chars) {
      words.push(...this.getWordsWithPrefix(node.children.get(char)!, prefix + char));
    }

    return words;
  }

  /** Walks `str` from the root recording a HOP per node reached; records BREAK and returns null where the path stops early. */
  private walk(str: string): TrieNode | null {
    let node = this.root;
    let soFar = '';
    for (const char of str) {
      const next = node.children.get(char);
      if (!next) {
        this.steps.push({ type: 'BREAK', prefix: soFar });
        return null;
      }
      soFar += char;
      this.steps.push({ type: 'HOP', prefix: soFar });
      node = next;
    }
    return node;
  }

  /** Walks `str` from the root, returning the node at the end of the path, or null if the path doesn't fully exist. */
  private findNode(str: string): TrieNode | null {
    let node = this.root;
    for (const char of str) {
      const next = node.children.get(char);
      if (!next) return null;
      node = next;
    }
    return node;
  }
}
