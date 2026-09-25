export const HashMapScripts = {
  HashMapFoundation: `SCENE HashMapFoundation

DECLARE
  HASH_MAP contacts = {alice: 101, bob: 102}

SEQUENCE
  // Insert a new key/value pair
  HASHMAP_INSERT contacts carol 103
  WAIT

  // Look up an existing key
  HASHMAP_LOOKUP contacts alice
  WAIT

  // Overwrite an existing key's value
  HASHMAP_INSERT contacts bob 999
  WAIT

  // Delete a key
  HASHMAP_DELETE contacts bob
END
`,

  WordFrequencyCounter: `SCENE WordFrequencyCounter

DECLARE
  HASH_MAP freq

SEQUENCE
  // Counting occurrences of words in: "the cat sat on the mat"
  HASHMAP_INSERT freq the 1
  HASHMAP_INSERT freq cat 1
  HASHMAP_INSERT freq sat 1
  HASHMAP_INSERT freq on 1
  WAIT

  // "the" seen again -> bump its count
  HASHMAP_LOOKUP freq the
  HASHMAP_INSERT freq the 2
  WAIT

  HASHMAP_INSERT freq mat 1
  WAIT

  HASHMAP_LOOKUP freq the
END
`,

  TwoSumUsingHashMap: `SCENE TwoSumUsingHashMap

DECLARE
  ARRAY nums = [2, 7, 11, 15]
  HASH_MAP seen

SEQUENCE
  // Target sum: 9. For each number, check if its complement
  // was already seen; if not, remember this number's value.

  HIGHLIGHT nums[0]
  HASHMAP_LOOKUP seen 7
  // complement 7 not found yet -> remember 2
  HASHMAP_INSERT seen 2 0
  WAIT

  HIGHLIGHT nums[1]
  HASHMAP_LOOKUP seen 2
  // complement 2 found! nums[0] + nums[1] == 9
  HIGHLIGHT nums[0] 'SUCCESS'
  HIGHLIGHT nums[1] 'SUCCESS'
END
`,

  DuplicateDetection: `SCENE DuplicateDetection

DECLARE
  ARRAY nums = [4, 2, 9, 2, 5]
  HASH_MAP seen

SEQUENCE
  HIGHLIGHT nums[0]
  HASHMAP_INSERT seen 4 1
  WAIT

  HIGHLIGHT nums[1]
  HASHMAP_INSERT seen 2 1
  WAIT

  HIGHLIGHT nums[2]
  HASHMAP_INSERT seen 9 1
  WAIT

  HIGHLIGHT nums[3]
  HASHMAP_LOOKUP seen 2
  // Key already exists -> duplicate found
  HIGHLIGHT nums[3] 'SUCCESS'
  HIGHLIGHT nums[1] 'SUCCESS'
END
`
};
