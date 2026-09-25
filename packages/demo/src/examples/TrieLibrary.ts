export const TrieScripts = {
  TrieFoundation: `SCENE TrieFoundation

DECLARE
  TRIE t = ["cat", "car", "card"]

SEQUENCE
  // Insert a new word, sharing prefix nodes with existing ones
  TRIE_INSERT t care
  WAIT

  // A full word lookup only succeeds at an end-of-word marker
  TRIE_SEARCH t car
  WAIT

  TRIE_SEARCH t ca
END
`,

  AutocompleteSuggestions: `SCENE AutocompleteSuggestions

DECLARE
  TRIE t = ["app", "apple", "application", "apply", "banana"]

SEQUENCE
  // List every stored word that begins with the given prefix
  TRIE_AUTOCOMPLETE t app
END
`,

  PrefixSearch: `SCENE PrefixSearch

DECLARE
  TRIE t = ["dog", "door", "dorm", "cat"]

SEQUENCE
  // Check whether any word shares this prefix, without
  // requiring the prefix itself to be a complete word
  TRIE_STARTSWITH t do
  WAIT

  TRIE_STARTSWITH t xyz
END
`,

  DeleteWordFromTrie: `SCENE DeleteWordFromTrie

DECLARE
  TRIE t = ["bat", "batman", "batch"]

SEQUENCE
  // Deleting "bat" prunes only the nodes not shared by other words
  TRIE_SEARCH t bat
  WAIT

  TRIE_DELETE t bat
  WAIT

  // "batman" and "batch" remain intact
  TRIE_SEARCH t batman
  TRIE_SEARCH t bat
END
`,

  ContactBookLookup: `SCENE ContactBookLookup

DECLARE
  TRIE contacts = ["alice", "alicia", "alan", "bob"]

SEQUENCE
  // Type-ahead search as a user types "al..."
  TRIE_STARTSWITH contacts al
  WAIT

  TRIE_AUTOCOMPLETE contacts al
  WAIT

  TRIE_SEARCH contacts alice
END
`
};
