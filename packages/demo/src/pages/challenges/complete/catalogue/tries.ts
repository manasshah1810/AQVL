import type { Kernel } from '../types';
import { str, strs, triePrefixes, words } from './ref';

export const TRIE_KERNELS: Kernel[] = [
  {
    id: 'trie-insert',
    title: 'Trie insert',
    topic: 'Tries',
    difficulty: 'Medium',
    goal: 'Insert word into the trie t letter by letter, adding only the nodes that are missing, and mark where it ends.',
    source: `SCENE TrieInsert

DECLARE
  TRIE t = {{words}}

  FUNCTION insert(word)
    node = t.root
    i = 0
    WHILE i < TEXT_LENGTH(word)
      ch = CHAR_AT(word, i)
      IF HAS_CHILD(node, ch) == [[FALSE]]
        ADD_CHILD node ch
      END
      node = [[GET_CHILD(node, ch)]]
      i = i + 1
    END
    node.isEnd = [[TRUE]]
  END

SEQUENCE
  insert({{word}})
  stored = WORD_COUNT(t)
END`,
    blanks: [
      ['TRUE', 'node.isEnd'],
      ['t.root', 'node'],
      ['FALSE', 'HAS_CHILD(node, ch)'],
    ],
    bug: {
      find: 'i = i + 1',
      replace: 'i = i + 2',
      fixes: ['i = 1', 'i = TEXT_LENGTH(word)'],
      why: 'Stepping two letters at a time skipped every other letter, so the wrong word was stored.',
    },
    core: { first: 'node = t.root', last: 'node.isEnd = TRUE' },
    hints: [
      'Start at the root. For each letter, follow its edge, creating it first if it is missing. The node you end on marks the end of the word.',
      'IF HAS_CHILD(node, ch) == FALSE, ADD_CHILD node ch; then node = GET_CHILD(node, ch).',
    ],
    inputNote: 'words are stored before the program starts.',
    visible: [
      { words: ['car', 'cat'], word: 'cart' },
      { words: ['do', 'dog'], word: 'den' },
      { words: ['tea'], word: 'ten' },
    ],
    hidden: [
      { category: 'edge case: empty trie', input: { words: [], word: 'hi' } },
      { category: 'edge case: the word is a prefix of a stored word', input: { words: ['cart'], word: 'car' } },
    ],
    preview: { words: ['ab'], word: 'ac' },
    expect: (input) => {
      const all = [...strs(input, 'words'), str(input, 'word')];
      return [
        { kind: 'trie', name: 't', value: triePrefixes(all) },
        { kind: 'var', name: 'stored', value: words(all).length },
      ];
    },
  },
  {
    id: 'trie-search',
    title: 'Trie search',
    topic: 'Tries',
    difficulty: 'Easy',
    goal: 'Leave TRUE in found when word is stored in the trie t as a whole word (not just a prefix), FALSE otherwise.',
    source: `SCENE TrieSearch

DECLARE
  TRIE t = {{words}}

  FUNCTION search(word)
    node = t.root
    i = 0
    WHILE i < TEXT_LENGTH(word)
      node = GET_CHILD(node, CHAR_AT(word, i))
      IF node [[==]] NULL
        RETURN FALSE
      END
      i = i + 1
    END
    RETURN [[node.isEnd]]
  END

SEQUENCE
  found = search({{word}})
END`,
    blanks: [
      ['!=', '== t.root'],
      ['TRUE', 'node != NULL'],
    ],
    bug: {
      find: 'RETURN FALSE',
      replace: 'RETURN TRUE',
      fixes: ['RETURN node', 'RETURN i'],
      why: 'Falling off the trie means the word is missing, but it was reported as found.',
    },
    core: { first: 'node = t.root', last: 'RETURN node.isEnd' },
    hints: ['Follow one edge per letter from the root. A missing edge means the word is not there; reaching the last letter still needs that node to be marked as a word end.', 'RETURN node.isEnd after the loop.'],
    visible: [
      { words: ['car', 'cart', 'cat'], word: 'cat' },
      { words: ['car', 'cart', 'cat'], word: 'ca' },
      { words: ['do', 'dog'], word: 'dot' },
    ],
    hidden: [
      { category: 'edge case: empty trie', input: { words: [], word: 'a' } },
      { category: 'edge case: a longer word than any stored', input: { words: ['go'], word: 'gone' } },
    ],
    preview: { words: ['hi'], word: 'hi' },
    expect: (input) => [{ kind: 'var', name: 'found', value: strs(input, 'words').includes(str(input, 'word')) }],
  },
  {
    id: 'trie-count-prefix',
    title: 'Count words with a prefix',
    topic: 'Tries',
    difficulty: 'Hard',
    goal: 'Leave in count how many stored words start with prefix: walk to the prefix’s node, then count the word ends below it recursively.',
    source: `SCENE CountPrefix

DECLARE
  TRIE t = {{words}}

  FUNCTION countWords(node)
    total = 0
    IF node.isEnd == TRUE
      total = 1
    END
    k = 0
    WHILE k < CHILD_COUNT(node)
      total = total + [[countWords(CHILD_AT(node, k))]]
      k = k + 1
    END
    RETURN total
  END

SEQUENCE
  prefix = {{prefix}}
  node = t.root
  i = 0
  WHILE i < TEXT_LENGTH(prefix) AND node != NULL
    node = GET_CHILD(node, CHAR_AT(prefix, i))
    i = i + 1
  END
  count = 0
  IF [[node != NULL]]
    count = countWords(node)
  END
END`,
    blanks: [
      ['1', 'CHILD_COUNT(node)'],
      ['node == NULL', 'i < TEXT_LENGTH(prefix)'],
    ],
    bug: {
      find: 'total = 1',
      replace: 'total = 0',
      fixes: ['total = k', 'total = CHILD_COUNT(node)'],
      why: 'A node that ends a word added nothing, so no word was ever counted.',
    },
    core: { first: 'total = 0', last: 'RETURN total' },
    hints: ['The words below a node are: one if the node itself ends a word, plus the words below each of its children.', 'total = total + countWords(CHILD_AT(node, k)) for every child k.'],
    visible: [
      { words: ['car', 'cart', 'cat', 'dog'], prefix: 'ca' },
      { words: ['apple', 'app', 'apt', 'bat'], prefix: 'app' },
      { words: ['sun', 'sea'], prefix: 'x' },
    ],
    hidden: [
      { category: 'edge case: empty prefix (every word)', input: { words: ['a', 'ab', 'b'], prefix: '' } },
      { category: 'edge case: the prefix is a whole word', input: { words: ['go', 'gone', 'good'], prefix: 'go' } },
    ],
    preview: { words: ['ab', 'ac'], prefix: 'a' },
    expect: (input) => [{ kind: 'var', name: 'count', value: words(strs(input, 'words')).filter((w) => w.startsWith(str(input, 'prefix'))).length }],
  },
];
