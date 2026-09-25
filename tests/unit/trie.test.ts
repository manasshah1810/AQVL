/**
 * Unit tests for Trie (packages/runtime/src/data-structures/Trie.ts) — the
 * prefix tree backing TRIE declarations and the TRIE_INSERT / TRIE_SEARCH /
 * TRIE_DELETE / TRIE_AUTOCOMPLETE runtime ops (see
 * ../../packages/runtime/src/core/algorithms/TrieVisualizer).
 */
import { describe, expect, it } from 'vitest';
import { Trie } from '../../packages/runtime/src/data-structures/Trie';

describe('Trie', () => {
  it('insert("cat") then search("cat") is true', () => {
    const trie = new Trie();
    trie.insert('cat');
    expect(trie.search('cat')).toBe(true);
  });

  it('insert("car", "card", "care") all become searchable', () => {
    const trie = new Trie();
    ['car', 'card', 'care'].forEach((w) => trie.insert(w));
    expect(trie.search('car')).toBe(true);
    expect(trie.search('card')).toBe(true);
    expect(trie.search('care')).toBe(true);
  });

  it('search returns false for a prefix that was never itself inserted as a word', () => {
    const trie = new Trie();
    trie.insert('car');
    expect(trie.search('car')).toBe(true);
    expect(trie.search('ca')).toBe(false);
  });

  it('startsWith is true for any prefix of an inserted word, even if not itself a word', () => {
    const trie = new Trie();
    trie.insert('car');
    expect(trie.startsWith('ca')).toBe(true);
    expect(trie.startsWith('c')).toBe(true);
    expect(trie.startsWith('car')).toBe(true);
    expect(trie.startsWith('cart')).toBe(false);
  });

  it('autocomplete("ca") returns every word sharing that prefix, sorted', () => {
    const trie = new Trie();
    ['cat', 'car', 'card', 'care'].forEach((w) => trie.insert(w));
    expect(trie.autocomplete('ca')).toEqual(['car', 'card', 'care', 'cat']);
  });

  it('delete("car") removes it while leaving longer words with the same prefix intact', () => {
    const trie = new Trie();
    ['car', 'card', 'care'].forEach((w) => trie.insert(w));
    expect(trie.delete('car')).toBe(true);
    expect(trie.search('car')).toBe(false);
    expect(trie.search('card')).toBe(true);
    expect(trie.search('care')).toBe(true);
    expect(trie.startsWith('car')).toBe(true); // "card"/"care" still share the "car" path
  });

  it('delete prunes now-unused nodes all the way back to the last shared ancestor', () => {
    const trie = new Trie();
    trie.insert('cat');
    expect(trie.delete('cat')).toBe(true);
    expect(trie.root.children.size).toBe(0);
  });

  it('delete does not prune a node still needed by another word', () => {
    const trie = new Trie();
    trie.insert('cat');
    trie.insert('car');
    trie.delete('cat');
    expect(trie.search('car')).toBe(true);
    expect(trie.root.children.get('c')?.children.get('a')?.children.has('t')).toBe(false);
    expect(trie.root.children.get('c')?.children.get('a')?.children.has('r')).toBe(true);
  });

  it('delete on a nonexistent word returns false and changes nothing', () => {
    const trie = new Trie();
    trie.insert('cat');
    expect(trie.delete('dog')).toBe(false);
    expect(trie.search('cat')).toBe(true);
  });

  it('is case-sensitive: "Cat" and "cat" are different words', () => {
    const trie = new Trie();
    trie.insert('Cat');
    expect(trie.search('Cat')).toBe(true);
    expect(trie.search('cat')).toBe(false);
    trie.insert('cat');
    expect(trie.search('cat')).toBe(true);
    expect(trie.autocomplete('C')).toEqual(['Cat']);
    expect(trie.autocomplete('c')).toEqual(['cat']);
  });

  it('edge case: an empty trie finds nothing and autocompletes to nothing', () => {
    const trie = new Trie();
    expect(trie.search('anything')).toBe(false);
    expect(trie.startsWith('a')).toBe(false);
    expect(trie.autocomplete('')).toEqual([]);
    expect(trie.autocomplete('a')).toEqual([]);
  });

  it('edge case: a single-character word behaves correctly', () => {
    const trie = new Trie();
    trie.insert('a');
    expect(trie.search('a')).toBe(true);
    expect(trie.startsWith('a')).toBe(true);
    expect(trie.autocomplete('a')).toEqual(['a']);
  });

  it('edge case: a prefix with no inserted word at all returns empty autocomplete and false search', () => {
    const trie = new Trie();
    trie.insert('dog');
    expect(trie.autocomplete('ca')).toEqual([]);
    expect(trie.search('ca')).toBe(false);
    expect(trie.startsWith('ca')).toBe(false);
  });

  it('inserting an empty string is a no-op', () => {
    const trie = new Trie();
    trie.insert('');
    expect(trie.search('')).toBe(false);
    expect(trie.root.children.size).toBe(0);
  });

  it('inserting the same word twice does not duplicate it or break deletion', () => {
    const trie = new Trie();
    trie.insert('cat');
    trie.insert('cat');
    expect(trie.autocomplete('cat')).toEqual(['cat']);
    expect(trie.delete('cat')).toBe(true);
    expect(trie.search('cat')).toBe(false);
  });

  it('autocomplete("") on a non-empty trie returns every word in lexicographic order', () => {
    const trie = new Trie();
    ['banana', 'apple', 'apricot', 'band'].forEach((w) => trie.insert(w));
    expect(trie.autocomplete('')).toEqual(['apple', 'apricot', 'banana', 'band']);
  });

  it('getWordsWithPrefix DFS helper is directly callable from an arbitrary node', () => {
    const trie = new Trie();
    trie.insert('cat');
    trie.insert('car');
    const node = trie.root.children.get('c')!.children.get('a')!;
    expect(trie.getWordsWithPrefix(node, 'ca').sort()).toEqual(['car', 'cat']);
  });

  it('handles a larger realistic dictionary correctly end to end', () => {
    const words = ['apple', 'app', 'application', 'apply', 'banana', 'band', 'bandana', 'can', 'cannot'];
    const trie = new Trie();
    words.forEach((w) => trie.insert(w));

    words.forEach((w) => expect(trie.search(w)).toBe(true));
    expect(trie.autocomplete('app').sort()).toEqual(['app', 'apple', 'application', 'apply'].sort());
    expect(trie.autocomplete('ban').sort()).toEqual(['banana', 'band', 'bandana'].sort());
    expect(trie.autocomplete('can').sort()).toEqual(['can', 'cannot'].sort());

    trie.delete('app');
    expect(trie.search('app')).toBe(false);
    expect(trie.search('apple')).toBe(true);
    expect(trie.autocomplete('app').sort()).toEqual(['apple', 'application', 'apply'].sort());
  });
});
