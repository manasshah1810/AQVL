/**
 * Trie (prefix tree) examples, each written as real code (LOOP, WHILE,
 * IF / ELSE and FUNCTIONs over trie nodes) rather than one-line built-ins.
 * A TRIE is drawn as a tree: every node stands for the prefix spelled by the
 * edges from the root down to it (shown under the node), children are kept in
 * alphabetical order, and a node where a stored word ends is green.
 *
 * node = t.root             the root (the empty prefix)
 * GET_CHILD(node, ch)       the child along the edge ch, or NULL if there is none
 * HAS_CHILD(node, ch)       TRUE / FALSE
 * ADD_CHILD node ch         create the child along ch (it must not exist yet)
 * REMOVE_CHILD node ch      remove a child that has no children of its own
 * node.isEnd                TRUE when a word ends at this node (set it with node.isEnd = TRUE)
 * node.char                 the character on the edge into the node ("" for the root)
 * node.count, node.freq ... any field the program stores on a node
 * CHILD_COUNT(node)         number of children
 * CHILD_AT(node, i)         the i-th child, in alphabetical order (0 <= i < CHILD_COUNT)
 * WORD_COUNT(t)             words stored        NODE_COUNT(t)   nodes, the root included
 * Text helpers: TEXT_LENGTH(s), CHAR_AT(s, i), CHAR_CODE(s, i)
 */
export const TrieScripts = {
  InsertWordsByHand: `SCENE InsertWordsByHand

DECLARE
  TRIE dictionary
  ARRAY words = ["car", "cat", "cart", "care", "dog", "do"]

  FUNCTION insertWord(word)
    node = dictionary.root
    created = 0
    i = 0
    WHILE i < TEXT_LENGTH(word)
      ch = CHAR_AT(word, i)
      IF HAS_CHILD(node, ch) == FALSE
        ADD_CHILD node ch
        created = created + 1
      END
      node = GET_CHILD(node, ch)
      i = i + 1
    END
    node.isEnd = TRUE
    RETURN created
  END

SEQUENCE
  totalLetters = 0
  LOOP k FROM 0 TO LENGTH(words) - 1
    word = words[k]
    HIGHLIGHT words[k] 'MARKED'
    newNodes = insertWord(word)
    shared = TEXT_LENGTH(word) - newNodes
    totalLetters = totalLetters + TEXT_LENGTH(word)
    PRINT word + ": " + newNodes + " new node(s), " + shared + " letter(s) reused from earlier words"
    HIGHLIGHT words[k] 'NEUTRAL'
  END

  PRINT "Stored words:" dictionary
  PRINT "The words have " + totalLetters + " letters in total, but the trie needs only " + (NODE_COUNT(dictionary) - 1) + " nodes (plus the root)"
  PRINT "Words that share a beginning (car, cat, cart, care) share the nodes of that prefix"
  PRINT "'do' needed no new node at all: its path already existed inside 'dog', it only had to be marked as a word end"
END
`,

  SearchWholeWord: `SCENE SearchWholeWord

DECLARE
  TRIE dictionary = ["car", "cart", "cat", "do", "dog"]
  ARRAY queries = ["cat", "ca", "cart", "cow", "do", "dot"]

  FUNCTION search(word)
    node = dictionary.root
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      node = GET_CHILD(node, CHAR_AT(word, i))
      IF node == NULL
        RETURN FALSE
      END
    END
    RETURN node.isEnd
  END

SEQUENCE
  found = 0
  LOOP q FROM 0 TO LENGTH(queries) - 1
    word = queries[q]
    HIGHLIGHT queries[q] 'MARKED'
    IF search(word)
      PRINT word + ": FOUND"
      HIGHLIGHT queries[q] 'SUCCESS'
      found = found + 1
    ELSE
      PRINT word + ": not in the dictionary"
      HIGHLIGHT queries[q] 'DISCARDED'
    END
  END
  PRINT found + " of " + LENGTH(queries) + " queries are stored words"
  PRINT "A search looks at one node per letter: its cost depends on the word's length, not on how many words are stored"
END
`,

  StartsWithPrefix: `SCENE StartsWithPrefix

DECLARE
  TRIE products = ["laptop", "lamp", "lantern", "phone", "photo"]
  ARRAY typed = ["la", "lamp", "pho", "lap", "pen", "laptops"]

  FUNCTION startsWith(prefix)
    node = products.root
    i = 0
    WHILE i < TEXT_LENGTH(prefix)
      ch = CHAR_AT(prefix, i)
      IF HAS_CHILD(node, ch) == FALSE
        RETURN FALSE
      END
      node = GET_CHILD(node, ch)
      i = i + 1
    END
    RETURN TRUE
  END

  FUNCTION isWord(text)
    node = products.root
    i = 0
    WHILE i < TEXT_LENGTH(text)
      node = GET_CHILD(node, CHAR_AT(text, i))
      IF node == NULL
        RETURN FALSE
      END
      i = i + 1
    END
    RETURN node.isEnd
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(typed) - 1
    text = typed[k]
    HIGHLIGHT typed[k] 'MARKED'
    IF startsWith(text)
      IF isWord(text)
        PRINT "'" + text + "': a full product name (so also a prefix)"
      ELSE
        PRINT "'" + text + "': some product starts with it"
      END
      HIGHLIGHT typed[k] 'SUCCESS'
    ELSE
      PRINT "'" + text + "': no product starts with it"
      HIGHLIGHT typed[k] 'DISCARDED'
    END
  END
  PRINT "'lap' is a prefix (of laptop) but not a product; 'laptops' runs off the end of the path"
END
`,

  CountWordsAndNodes: `SCENE CountWordsAndNodes

DECLARE
  TRIE t = ["tea", "ten", "to", "inn", "in", "i", "tent"]

  FUNCTION countWords(node)
    total = 0
    IF node.isEnd
      total = 1
    END
    i = 0
    WHILE i < CHILD_COUNT(node)
      total = total + countWords(CHILD_AT(node, i))
      i = i + 1
    END
    RETURN total
  END

  FUNCTION countNodes(node)
    total = 1
    i = 0
    WHILE i < CHILD_COUNT(node)
      total = total + countNodes(CHILD_AT(node, i))
      i = i + 1
    END
    RETURN total
  END

  FUNCTION longestWord(node)
    deepest = 0
    i = 0
    WHILE i < CHILD_COUNT(node)
      depth = 1 + longestWord(CHILD_AT(node, i))
      IF depth > deepest
        deepest = depth
      END
      i = i + 1
    END
    RETURN deepest
  END

  FUNCTION countLeaves(node)
    IF CHILD_COUNT(node) == 0
      RETURN 1
    END
    total = 0
    i = 0
    WHILE i < CHILD_COUNT(node)
      total = total + countLeaves(CHILD_AT(node, i))
      i = i + 1
    END
    RETURN total
  END

SEQUENCE
  root = t.root
  words = countWords(root)
  nodes = countNodes(root)
  PRINT "Words counted by recursion: " + words + " (WORD_COUNT says " + WORD_COUNT(t) + ")"
  PRINT "Nodes counted by recursion: " + nodes + " (NODE_COUNT says " + NODE_COUNT(t) + ")"
  PRINT "Longest word: " + longestWord(root) + " letters"
  leaves = countLeaves(root)
  PRINT "Leaves: " + leaves + ", so " + (words - leaves) + " word(s) end in the middle of a longer word (like in / inn, ten / tent)"
END
`,

  DictionaryInOrder: `SCENE DictionaryInOrder

DECLARE
  TRIE t
  ARRAY input = ["banana", "apple", "cherry", "app", "bat", "ball", "apricot"]
  ARRAY sorted = []

  FUNCTION insertWord(word)
    node = t.root
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      ch = CHAR_AT(word, i)
      IF HAS_CHILD(node, ch) == FALSE
        ADD_CHILD node ch
      END
      node = GET_CHILD(node, ch)
    END
    node.isEnd = TRUE
  END

  FUNCTION collect(node, prefix)
    IF node.isEnd
      INSERT sorted[LENGTH(sorted)] prefix
    END
    i = 0
    WHILE i < CHILD_COUNT(node)
      child = CHILD_AT(node, i)
      collect(child, prefix + child.char)
      i = i + 1
    END
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(input) - 1
    insertWord(input[k])
  END
  collect(t.root, "")
  PRINT "Input: " input
  PRINT "Sorted:" sorted
  PRINT "Trie sort: insert every word, then read them back depth-first, children a to z"
END
`,

  AutocompleteSuggestions: `SCENE AutocompleteSuggestions

DECLARE
  TRIE searches = ["car", "card", "care", "career", "cart", "cat", "dog", "door"]
  ARRAY typed = ["car", "ca", "do", "x"]
  ARRAY suggestions = []

  FUNCTION findNode(prefix)
    node = searches.root
    i = 0
    WHILE i < TEXT_LENGTH(prefix) AND node != NULL
      node = GET_CHILD(node, CHAR_AT(prefix, i))
      i = i + 1
    END
    RETURN node
  END

  FUNCTION collect(node, text, limit)
    IF LENGTH(suggestions) >= limit
      RETURN 0
    END
    IF node.isEnd
      INSERT suggestions[LENGTH(suggestions)] text
    END
    i = 0
    WHILE i < CHILD_COUNT(node)
      child = CHILD_AT(node, i)
      collect(child, text + child.char, limit)
      i = i + 1
    END
    RETURN 0
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(typed) - 1
    prefix = typed[k]
    HIGHLIGHT typed[k] 'MARKED'

    WHILE LENGTH(suggestions) > 0
      DELETE suggestions[LENGTH(suggestions) - 1]
    END

    start = findNode(prefix)
    IF start == NULL
      PRINT "'" + prefix + "': no suggestions"
    ELSE
      collect(start, prefix, 4)
      PRINT "'" + prefix + "' (at most 4 suggestions) ->" suggestions
    END
    HIGHLIGHT typed[k] 'NEUTRAL'
  END
  PRINT "Only the subtree under the prefix is visited: the rest of the trie is never looked at"
END
`,

  DeleteWordWithPruning: `SCENE DeleteWordWithPruning

DECLARE
  TRIE t = ["bat", "batch", "bath", "bad", "ban"]
  ARRAY toDelete = ["batch", "bat", "bad", "cow"]

  FUNCTION contains(word)
    node = t.root
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      node = GET_CHILD(node, CHAR_AT(word, i))
      IF node == NULL
        RETURN FALSE
      END
    END
    RETURN node.isEnd
  END

  FUNCTION removeWord(node, word, depth)
    IF depth == TEXT_LENGTH(word)
      node.isEnd = FALSE
    ELSE
      ch = CHAR_AT(word, depth)
      child = GET_CHILD(node, ch)
      childUnused = removeWord(child, word, depth + 1)
      IF childUnused
        REMOVE_CHILD node ch
      END
    END
    RETURN node.isEnd == FALSE AND CHILD_COUNT(node) == 0
  END

SEQUENCE
  PRINT "Before:" t
  LOOP k FROM 0 TO LENGTH(toDelete) - 1
    word = toDelete[k]
    HIGHLIGHT toDelete[k] 'MARKED'
    IF contains(word)
      removeWord(t.root, word, 0)
      PRINT "Deleted " + word + ":" t
    ELSE
      PRINT word + " is not stored, nothing to delete"
    END
    HIGHLIGHT toDelete[k] 'NEUTRAL'
  END
  PRINT NODE_COUNT(t) + " nodes left for " + WORD_COUNT(t) + " words"
  PRINT "batch: only its own tail (c, h) was removed; bat: only unmarked, because bath still uses its nodes"
END
`,

  PrefixCounter: `SCENE PrefixCounter

DECLARE
  TRIE usernames
  ARRAY signups = ["sam", "sara", "sarah", "sandy", "tom", "tim", "sally"]
  ARRAY asks = ["sa", "sar", "s", "t", "ti", "z"]

  FUNCTION insertName(name)
    node = usernames.root
    LOOP i FROM 0 TO TEXT_LENGTH(name) - 1
      ch = CHAR_AT(name, i)
      IF HAS_CHILD(node, ch) == FALSE
        ADD_CHILD node ch
        child = GET_CHILD(node, ch)
        child.count = 0
      END
      node = GET_CHILD(node, ch)
      node.count = node.count + 1
    END
    node.isEnd = TRUE
  END

  FUNCTION countStartingWith(prefix)
    node = usernames.root
    i = 0
    WHILE i < TEXT_LENGTH(prefix)
      node = GET_CHILD(node, CHAR_AT(prefix, i))
      IF node == NULL
        RETURN 0
      END
      i = i + 1
    END
    RETURN node.count
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(signups) - 1
    insertName(signups[k])
  END
  LOOP k FROM 0 TO LENGTH(asks) - 1
    HIGHLIGHT asks[k] 'MARKED'
    PRINT "Usernames starting with '" + asks[k] + "': " + countStartingWith(asks[k])
    HIGHLIGHT asks[k] 'NEUTRAL'
  END
  PRINT "Each answer costs one walk of the prefix's length, however many usernames there are"
END
`,

  WordFrequencyCounter: `SCENE WordFrequencyCounter

DECLARE
  TRIE seen

  FUNCTION addWord(word)
    node = seen.root
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      ch = CHAR_AT(word, i)
      IF HAS_CHILD(node, ch) == FALSE
        ADD_CHILD node ch
      END
      node = GET_CHILD(node, ch)
    END
    IF node.isEnd == FALSE
      node.isEnd = TRUE
      node.freq = 0
    END
    node.freq = node.freq + 1
  END

  FUNCTION report(node, prefix)
    best = 0
    IF node.isEnd
      PRINT "  " + prefix + ": " + node.freq
      best = node.freq
    END
    i = 0
    WHILE i < CHILD_COUNT(node)
      child = CHILD_AT(node, i)
      below = report(child, prefix + child.char)
      IF below > best
        best = below
      END
      i = i + 1
    END
    RETURN best
  END

SEQUENCE
  sentence = "the cat and the dog and the bird"

  word = ""
  i = 0
  WHILE i < TEXT_LENGTH(sentence)
    ch = CHAR_AT(sentence, i)
    IF ch == " "
      IF word != ""
        addWord(word)
      END
      word = ""
    ELSE
      word = word + ch
    END
    i = i + 1
  END
  IF word != ""
    addWord(word)
  END

  PRINT "Word counts:"
  top = report(seen.root, "")
  PRINT WORD_COUNT(seen) + " different words; the most frequent appears " + top + " times"
END
`,

  LongestCommonPrefix: `SCENE LongestCommonPrefix

DECLARE
  TRIE t
  ARRAY words = ["flower", "flow", "flight", "flask"]

  FUNCTION insertWord(word)
    node = t.root
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      ch = CHAR_AT(word, i)
      IF HAS_CHILD(node, ch) == FALSE
        ADD_CHILD node ch
      END
      node = GET_CHILD(node, ch)
    END
    node.isEnd = TRUE
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(words) - 1
    insertWord(words[k])
  END

  node = t.root
  prefix = ""
  WHILE CHILD_COUNT(node) == 1 AND node.isEnd == FALSE
    node = CHILD_AT(node, 0)
    prefix = prefix + node.char
  END

  IF prefix == ""
    PRINT "The words have no common prefix"
  ELSE
    PRINT "Longest common prefix: '" + prefix + "'"
  END
  PRINT "The walk stopped at node '" + prefix + "', which has " + CHILD_COUNT(node) + " children: that is where the words branch apart"
END
`,

  ShortestUniquePrefix: `SCENE ShortestUniquePrefix

DECLARE
  TRIE t
  ARRAY words = ["zebra", "dog", "duck", "dove", "dot"]

  FUNCTION insertWord(word)
    node = t.root
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      ch = CHAR_AT(word, i)
      IF HAS_CHILD(node, ch) == FALSE
        ADD_CHILD node ch
        child = GET_CHILD(node, ch)
        child.count = 0
      END
      node = GET_CHILD(node, ch)
      node.count = node.count + 1
    END
    node.isEnd = TRUE
  END

  FUNCTION uniquePrefix(word)
    node = t.root
    prefix = ""
    i = 0
    WHILE i < TEXT_LENGTH(word)
      ch = CHAR_AT(word, i)
      node = GET_CHILD(node, ch)
      prefix = prefix + ch
      IF node.count == 1
        RETURN prefix
      END
      i = i + 1
    END
    RETURN word
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(words) - 1
    insertWord(words[k])
  END
  LOOP k FROM 0 TO LENGTH(words) - 1
    HIGHLIGHT words[k] 'MARKED'
    PRINT words[k] + " -> " + uniquePrefix(words[k])
    HIGHLIGHT words[k] 'NEUTRAL'
  END
  PRINT "Like typing just enough letters for a command-line tool to know which command you mean"
END
`,

  ReplaceWordsWithRoots: `SCENE ReplaceWordsWithRoots

DECLARE
  TRIE roots = ["cat", "bat", "rat", "ca"]

  FUNCTION shortestRoot(word)
    node = roots.root
    prefix = ""
    i = 0
    WHILE i < TEXT_LENGTH(word)
      ch = CHAR_AT(word, i)
      node = GET_CHILD(node, ch)
      IF node == NULL
        RETURN word
      END
      prefix = prefix + ch
      IF node.isEnd
        RETURN prefix
      END
      i = i + 1
    END
    RETURN word
  END

SEQUENCE
  sentence = "the cattle was rattled by the battery"
  text = sentence + " "
  result = ""
  word = ""
  i = 0
  WHILE i < TEXT_LENGTH(text)
    ch = CHAR_AT(text, i)
    IF ch == " "
      replaced = shortestRoot(word)
      IF result == ""
        result = replaced
      ELSE
        result = result + " " + replaced
      END
      IF replaced != word
        PRINT word + " -> " + replaced
      END
      word = ""
    ELSE
      word = word + ch
    END
    i = i + 1
  END
  PRINT "Before: " + sentence
  PRINT "After:  " + result
  PRINT "'cattle' became 'ca', not 'cat': the walk stops at the first root it meets"
END
`,

  WordBreak: `SCENE WordBreak

DECLARE
  TRIE dictionary = ["apple", "pen", "pine", "pineapple", "app", "le"]
  ARRAY reachable = []

SEQUENCE
  text = "pineapplepenapple"
  n = TEXT_LENGTH(text)

  LOOP p FROM 0 TO n
    INSERT reachable[p] 0
  END
  reachable[0] = 1

  LOOP start FROM 0 TO n - 1
    IF reachable[start] == 1
      node = dictionary.root
      j = start
      WHILE j < n AND node != NULL
        node = GET_CHILD(node, CHAR_AT(text, j))
        IF node != NULL
          IF node.isEnd
            IF reachable[j + 1] == 0
              PRINT "word ending at position " + (j + 1) + " (starting at " + start + ")"
            END
            reachable[j + 1] = 1
          END
        END
        j = j + 1
      END
    END
  END

  IF reachable[n] == 1
    PRINT "'" + text + "' CAN be split into dictionary words"
  ELSE
    PRINT "'" + text + "' can NOT be split into dictionary words"
  END
END
`,

  LongestWordBuiltStepByStep: `SCENE LongestWordBuiltStepByStep

DECLARE
  TRIE t = ["w", "wo", "wor", "worl", "world", "a", "ap", "app", "appl", "apply", "apple", "banana"]

  FUNCTION longestFrom(node, prefix)
    best = prefix
    i = 0
    WHILE i < CHILD_COUNT(node)
      child = CHILD_AT(node, i)
      IF child.isEnd
        candidate = longestFrom(child, prefix + child.char)
        IF TEXT_LENGTH(candidate) > TEXT_LENGTH(best)
          best = candidate
        END
      END
      i = i + 1
    END
    RETURN best
  END

SEQUENCE
  answer = longestFrom(t.root, "")
  PRINT "Longest word built step by step: " + answer
  PRINT "'world' is just as long, but 'apple' comes first alphabetically; 'apply' ties too"
END
`,

  CountDistinctSubstrings: `SCENE CountDistinctSubstrings

DECLARE
  TRIE suffixes

SEQUENCE
  text = "banana"
  n = TEXT_LENGTH(text)

  created = 0
  LOOP start FROM 0 TO n - 1
    node = suffixes.root
    LOOP i FROM start TO n - 1
      ch = CHAR_AT(text, i)
      IF HAS_CHILD(node, ch) == FALSE
        ADD_CHILD node ch
        created = created + 1
      END
      node = GET_CHILD(node, ch)
    END
    PRINT "suffix '" + text + "' from position " + start + ": " + created + " nodes so far"
  END

  PRINT "'" + text + "' has " + created + " different substrings (NODE_COUNT - 1 = " + (NODE_COUNT(suffixes) - 1) + ")"
  PRINT "Counting them by listing all n*(n+1)/2 = " + (n * (n + 1) / 2) + " substrings would count repeats"
END
`,

  WildcardSearch: `SCENE WildcardSearch

DECLARE
  TRIE words = ["bad", "dad", "mad", "pad", "bed", "bat"]
  ARRAY patterns = ["pad", ".ad", "b..", "..x", "m.d", "...."]

  FUNCTION matches(node, pattern, i)
    IF i == TEXT_LENGTH(pattern)
      RETURN node.isEnd
    END
    ch = CHAR_AT(pattern, i)
    IF ch == "."
      k = 0
      WHILE k < CHILD_COUNT(node)
        IF matches(CHILD_AT(node, k), pattern, i + 1)
          RETURN TRUE
        END
        k = k + 1
      END
      RETURN FALSE
    END
    next = GET_CHILD(node, ch)
    IF next == NULL
      RETURN FALSE
    END
    RETURN matches(next, pattern, i + 1)
  END

SEQUENCE
  LOOP p FROM 0 TO LENGTH(patterns) - 1
    HIGHLIGHT patterns[p] 'MARKED'
    IF matches(words.root, patterns[p], 0)
      PRINT patterns[p] + ": matches a stored word"
      HIGHLIGHT patterns[p] 'SUCCESS'
    ELSE
      PRINT patterns[p] + ": no match"
      HIGHLIGHT patterns[p] 'DISCARDED'
    END
  END
END
`,

  ContactSearchAsYouType: `SCENE ContactSearchAsYouType

DECLARE
  TRIE contacts = ["alice", "alicia", "alan", "albert", "bob", "bella"]
  ARRAY found = []

  FUNCTION collect(node, text)
    IF node.isEnd
      INSERT found[LENGTH(found)] text
    END
    i = 0
    WHILE i < CHILD_COUNT(node)
      child = CHILD_AT(node, i)
      collect(child, text + child.char)
      i = i + 1
    END
  END

SEQUENCE
  typing = "alic"

  node = contacts.root
  typed = ""
  i = 0
  WHILE i < TEXT_LENGTH(typing) AND node != NULL
    ch = CHAR_AT(typing, i)
    typed = typed + ch
    node = GET_CHILD(node, ch)
    IF node == NULL
      PRINT "typed '" + typed + "': no contact matches"
    ELSE
      WHILE LENGTH(found) > 0
        DELETE found[LENGTH(found) - 1]
      END
      collect(node, typed)
      PRINT "typed '" + typed + "': " + LENGTH(found) + " match(es)" found
    END
    i = i + 1
  END
END
`,

  MaximumXorPair: `SCENE MaximumXorPair

DECLARE
  TRIE bits
  ARRAY nums = [3, 10, 5, 25, 2, 8]

  FUNCTION bitOf(x, place)
    RETURN ((x - x % place) / place) % 2
  END

  FUNCTION insertNumber(x, top)
    node = bits.root
    place = top
    WHILE place >= 1
      b = bitOf(x, place)
      IF HAS_CHILD(node, b) == FALSE
        ADD_CHILD node b
      END
      node = GET_CHILD(node, b)
      place = place / 2
    END
    node.isEnd = TRUE
  END

  FUNCTION bestXor(x, top)
    node = bits.root
    place = top
    result = 0
    WHILE place >= 1
      b = bitOf(x, place)
      want = 1 - b
      IF HAS_CHILD(node, want)
        result = result + place
        node = GET_CHILD(node, want)
      ELSE
        node = GET_CHILD(node, b)
      END
      place = place / 2
    END
    RETURN result
  END

SEQUENCE
  largest = 0
  LOOP i FROM 0 TO LENGTH(nums) - 1
    largest = MAX(largest, nums[i])
  END
  top = 1
  WHILE top * 2 <= largest
    top = top * 2
  END

  LOOP i FROM 0 TO LENGTH(nums) - 1
    insertNumber(nums[i], top)
  END

  best = 0
  LOOP i FROM 0 TO LENGTH(nums) - 1
    HIGHLIGHT nums[i] 'MARKED'
    candidate = bestXor(nums[i], top)
    PRINT nums[i] + ": best partner gives XOR " + candidate
    IF candidate > best
      best = candidate
    END
    HIGHLIGHT nums[i] 'NEUTRAL'
  END
  PRINT "Maximum XOR of two numbers: " + best
  PRINT "Each number needed one walk down the trie (one step per bit) instead of an XOR with every other number"
END
`,
};
