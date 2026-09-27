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

  // Insert one word, one character at a time, starting at the root.
  // For each character: if the edge for it is missing, create the child
  // node; then step down into that child. The node reached after the last
  // character is marked as the end of a word.
  // Returns how many NEW nodes the word needed.
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

  // Walk down one edge per character. If an edge is missing (GET_CHILD
  // gives NULL) the word cannot be in the trie. If the whole walk succeeds
  // the word is only stored when a word ENDS at the last node: "ca" has a
  // path (inside "car" and "cat") but no word ends there.
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

  // A prefix check is a search WITHOUT the final isEnd test: it only asks
  // whether the path exists, i.e. whether at least one stored word begins
  // with these letters.
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

  // The same walk, but the full word must end at the last node
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

  // Recursion visits every node exactly once: count this node, then add
  // what each child's subtree contains. CHILD_AT lists children a to z.
  // (WHILE, not LOOP: a leaf has 0 children, and LOOP 0 TO -1 would count down.)
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

  // The deepest node is the last letter of the longest word
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

  // A leaf (no children) is always the end of a word
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

  // Depth-first walk that visits children from a to z. 'prefix' is the
  // text spelled by the path so far. A word is written out BEFORE its
  // children are visited, so "app" comes before "apple": exactly
  // dictionary order.
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

  // Step 1: walk down to the node of the typed prefix (NULL if no word starts with it)
  FUNCTION findNode(prefix)
    node = searches.root
    i = 0
    WHILE i < TEXT_LENGTH(prefix) AND node != NULL
      node = GET_CHILD(node, CHAR_AT(prefix, i))
      i = i + 1
    END
    RETURN node
  END

  // Step 2: every word below that node starts with the prefix. Collect
  // them depth-first, a to z, stopping once 'limit' suggestions are found.
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

    // Clear last round's suggestions
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

  // Remove 'word' below 'node', where 'depth' letters are already matched.
  // Returns TRUE when 'node' itself is no longer needed, so the caller can
  // unlink it: it is not the end of another word and has no children left.
  FUNCTION removeWord(node, word, depth)
    IF depth == TEXT_LENGTH(word)
      // The word ends here: unmark it (its letters may still be used by longer words)
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

  // Every node keeps a count: how many stored words pass through it,
  // which is how many words start with that node's prefix.
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

  // One walk down the prefix, then the answer is stored right there
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

  // Count one word: walk / build its path, and keep the number of times it
  // appeared in the node where it ends.
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

  // Print every word with its count (a to z), and return the highest count
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

  // Split the sentence into words by hand: collect letters until a space
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

  // The common prefix is the path from the root on which nobody branches
  // off: keep walking while the node has exactly one child and no word
  // ends there (a word ending means it is as long as the prefix can get).
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

  // count = how many words pass through a node
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

  // Walk the word until a node that only this word passes through
  // (count 1): the letters so far already tell it apart from every other word.
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
    // Every letter is shared: the word is a prefix of another word
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

  // The shortest root that begins 'word', or the word itself if none does.
  // Walk the word's letters and stop at the FIRST node where a root ends.
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
  // Split the sentence by hand. A space added at the end makes the last
  // word end with a space too, so every word is handled in the same place.
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

  // reachable[p] = 1 when the first p letters can be split into dictionary words
  LOOP p FROM 0 TO n
    INSERT reachable[p] 0
  END
  reachable[0] = 1

  // From every reachable position, walk the trie along the text. Each time
  // a word ends, the position right after it becomes reachable too. The
  // walk stops as soon as no dictionary word continues with the next letter.
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

  // Longest word that can be built one letter at a time, where every
  // step on the way is itself a word (a, ap, app, appl, apple).
  // Only follow children that end a word: a gap breaks the chain
  // ("banana" is skipped because "b" is not a word).
  // Children are visited a to z and only a strictly longer word replaces
  // the best, so on a tie the alphabetically first word wins.
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

  // Every substring is the beginning of some suffix. Put every suffix
  // (banana, anana, nana, ana, na, a) into a trie: each node, except the
  // root, is then exactly one different substring, even when it appears
  // many times in the text ("ana" twice, "a" three times).
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

  // Does some stored word match 'pattern' from letter 'i' on, starting at
  // 'node'? A "." matches any single letter, so it tries every child;
  // any other character follows just its own edge.
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

  // Search as you type: keep the node of what has been typed so far and
  // take ONE step for each new letter, instead of starting over at the
  // root every time.
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

  // The bit of x worth 'place' (1, 2, 4, 8, ...): drop the lower bits,
  // shift them away by dividing, and keep the last binary digit
  FUNCTION bitOf(x, place)
    RETURN ((x - x % place) / place) % 2
  END

  // Store x as a path of 0 / 1 edges, most significant bit first
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

  // The largest x XOR y for a stored y: at every bit, go the OPPOSITE way
  // when possible (bits that differ give 1 in the XOR), starting with the
  // bit worth the most.
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
  // How many bits do the numbers need? 'top' is the highest bit's value.
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
