/**
 * Trie (prefix tree) — backs AQVL's TRIE declarations and the
 * TRIE_INSERT / TRIE_SEARCH / TRIE_DELETE / TRIE_AUTOCOMPLETE runtime ops
 * (see ../core/algorithms/TrieVisualizer.ts).
 *
 * Case-sensitive by design ("Cat" and "cat" are different words) — callers
 * that want case-insensitive behavior should lowercase before calling in.
 */

export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
}

export class Trie {
  root: TrieNode = new TrieNode();

  /** Inserts `word`, creating any missing nodes along the path and marking the final node as a word end. Empty string is a no-op (no node represents "no characters"). */
  insert(word: string): void {
    if (word.length === 0) return;

    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEndOfWord = true;
  }

  /** Returns true only if `word` was inserted (the path exists AND the final node is marked as a word end). */
  search(word: string): boolean {
    if (word.length === 0) return false;
    const node = this.findNode(word);
    return node !== null && node.isEndOfWord;
  }

  /** Returns true if any inserted word starts with `prefix` (path exists; no end-of-word check). An empty prefix matches any non-empty trie. */
  startsWith(prefix: string): boolean {
    if (prefix.length === 0) return this.root.children.size > 0;
    return this.findNode(prefix) !== null;
  }

  /**
   * Removes `word` by unmarking its end-of-word flag, then prunes any nodes
   * left with no children and no other word ending there (walking back up
   * from the leaf). Returns whether `word` was actually present.
   */
  delete(word: string): boolean {
    if (word.length === 0) return false;
    if (!this.search(word)) return false;

    const path: { node: TrieNode; char: string }[] = [];
    let node = this.root;
    for (const char of word) {
      path.push({ node, char });
      node = node.children.get(char)!;
    }
    node.isEndOfWord = false;

    // Prune from the leaf back up: remove a node once it has no children and isn't itself a word end.
    let child = node;
    for (let i = path.length - 1; i >= 0; i--) {
      if (child.children.size > 0 || child.isEndOfWord) break;
      path[i].node.children.delete(path[i].char);
      child = path[i].node;
    }

    return true;
  }

  /** Returns every inserted word that starts with `prefix`, in lexicographic order (DFS visits children in sorted key order). */
  autocomplete(prefix: string): string[] {
    const startNode = prefix.length === 0 ? this.root : this.findNode(prefix);
    if (!startNode) return [];
    return this.getWordsWithPrefix(startNode, prefix);
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
