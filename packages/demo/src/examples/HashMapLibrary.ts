/**
 * Hash map examples, each written as real code (LOOP, WHILE, IF / ELSE and
 * FUNCTIONs over m[key]) rather than one-line built-ins. A HASH_MAP is drawn
 * as a row of buckets; every key hangs in a chain under the bucket its hash
 * picks:
 *   number key: key % capacity
 *   text key:   (sum of its character codes) % capacity
 * The map starts with 8 buckets and doubles (rehashing every key) when a new
 * key would push size / capacity above 0.75.
 *
 * m[key] = v     insert or overwrite        m[key]            read (missing key = error)
 * CONTAINS(m, k) TRUE / FALSE               DELETE m[key]     remove
 * LENGTH(m)      number of keys             KEY_AT(m, i)      i-th key, bucket by bucket
 * BUCKET_OF(m,k) bucket index of k          CAPACITY(m)       number of buckets
 * Text helpers: TEXT_LENGTH(s), CHAR_AT(s, i), CHAR_CODE(s, i)
 */
export const HashMapScripts = {
  HashFunctionByHand: `SCENE HashFunctionByHand

DECLARE
  HASH_MAP shelf
  ARRAY words = ["cat", "dog", "act", "bird", "fish", "god"]

  // The map's hash function for text, written out by hand:
  // add up the character code of every letter, then keep the remainder
  // after dividing by the number of buckets. The remainder is always
  // between 0 and buckets - 1, so it is a valid bucket index.
  FUNCTION hashOf(word, buckets)
    total = 0
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      total = total + CHAR_CODE(word, i)
    END
    RETURN total % buckets
  END

SEQUENCE
  buckets = CAPACITY(shelf)
  PRINT "The map has " + buckets + " buckets, numbered 0 to " + (buckets - 1)

  LOOP k FROM 0 TO LENGTH(words) - 1
    word = words[k]
    HIGHLIGHT words[k] 'MARKED'
    myBucket = hashOf(word, buckets)
    PRINT word + " -> bucket " + myBucket

    // Our hand-written hash must agree with the one the map uses
    IF myBucket != BUCKET_OF(shelf, word)
      PRINT "  our hash disagrees with the map!"
    END

    // Is some word already waiting in that bucket? Then this is a collision.
    // (WHILE, not LOOP: the map starts empty, and LOOP 0 TO -1 would count down.)
    j = 0
    WHILE j < LENGTH(shelf)
      other = KEY_AT(shelf, j)
      IF BUCKET_OF(shelf, other) == myBucket
        PRINT "  collision: " + other + " is already in bucket " + myBucket
      END
      j = j + 1
    END

    // Store the word with its number of letters as the value
    shelf[word] = TEXT_LENGTH(word)
    HIGHLIGHT words[k] 'NEUTRAL'
  END

  PRINT "Stored:" shelf
  PRINT "Anagrams (cat / act, dog / god) have the same letters, so the same sum and the same bucket"
END
`,

  PhoneBook: `SCENE PhoneBook

DECLARE
  HASH_MAP phone = {asha: 5550101, ben: 5550102}
  ARRAY askFor = ["ben", "eli", "chen", "asha"]

SEQUENCE
  // Store: map[key] = value. A new key is added to the bucket its hash picks.
  phone["chen"] = 5550103
  phone["dia"] = 5550104
  PRINT "Phone book:" phone
  PRINT "It holds " + LENGTH(phone) + " contacts"

  // Same key again: nothing new is added, only the value is replaced
  PRINT "Ben's old number: " + phone["ben"]
  phone["ben"] = 5550199
  PRINT "Ben's new number: " + phone["ben"]
  PRINT "Still " + LENGTH(phone) + " contacts: keys are unique"

  // Reading a key that is not there stops the program, so check first
  LOOP i FROM 0 TO LENGTH(askFor) - 1
    name = askFor[i]
    HIGHLIGHT askFor[i] 'MARKED'
    IF CONTAINS(phone, name)
      PRINT name + ": " + phone[name]
    ELSE
      PRINT name + ": not in the phone book"
    END
  END

  // Chen moved away: remove the key and its value together
  IF CONTAINS(phone, "chen")
    DELETE phone["chen"]
    PRINT "Removed chen"
  END

  IF CONTAINS(phone, "chen")
    PRINT "chen is still there?"
  ELSE
    PRINT "chen is gone; " + LENGTH(phone) + " contacts left:" phone
  END
END
`,

  CollisionsAndChaining: `SCENE CollisionsAndChaining

DECLARE
  HASH_MAP lockers
  // Locker numbers 5, 13, 21 and 29 all leave remainder 5 when divided by 8
  ARRAY numbers = [5, 13, 2, 21, 10, 29]
  ARRAY owners = ["Asha", "Ben", "Chen", "Dia", "Eli", "Farah"]

  // How many keys does a lookup of 'key' compare before it finds it?
  // It only looks inside the key's own bucket, walking the chain in the
  // order the keys were added (KEY_AT lists every bucket's chain in order).
  FUNCTION comparisonsFor(key)
    bucket = BUCKET_OF(lockers, key)
    count = 0
    found = 0
    j = 0
    WHILE found == 0 AND j < LENGTH(lockers)
      other = KEY_AT(lockers, j)
      IF BUCKET_OF(lockers, other) == bucket
        count = count + 1
        IF other == key
          found = 1
        END
      END
      j = j + 1
    END
    RETURN count
  END

SEQUENCE
  // Separate chaining: every bucket holds a small list (a chain) of the
  // keys that hash to it, so two keys in one bucket never overwrite each other.
  LOOP i FROM 0 TO LENGTH(numbers) - 1
    lockers[numbers[i]] = owners[i]
    PRINT "Locker " + numbers[i] + " (" + owners[i] + ") -> bucket " + BUCKET_OF(lockers, numbers[i])
  END

  // The longer the chain, the more comparisons a lookup needs
  LOOP i FROM 0 TO LENGTH(numbers) - 1
    key = numbers[i]
    steps = comparisonsFor(key)
    PRINT "Finding locker " + key + " takes " + steps + " comparison(s)"
  END

  // Read one from the end of the long chain, with its lookup animated
  owner = lockers[29]
  PRINT "Locker 29 belongs to " + owner
  PRINT "Bucket 5 holds 4 keys: when many keys collide, a lookup slows from O(1) towards O(n)"
END
`,

  LoadFactorAndResize: `SCENE LoadFactorAndResize

DECLARE
  HASH_MAP roll
  ARRAY ids = [101, 205, 309, 412, 518, 623, 707, 811, 916, 1020, 1125, 1231, 1337]

SEQUENCE
  // load factor = keys stored / number of buckets. This map keeps it at
  // or below 0.75: when one more key would pass it, the bucket row
  // doubles and EVERY key is hashed again (its bucket can change,
  // because key % capacity changes when capacity changes).
  watched = ids[0]
  LOOP i FROM 0 TO LENGTH(ids) - 1
    before = CAPACITY(roll)
    watchedBefore = -1
    IF LENGTH(roll) > 0
      watchedBefore = BUCKET_OF(roll, watched)
    END

    roll[ids[i]] = "student " + (i + 1)

    after = CAPACITY(roll)
    load = LENGTH(roll) / after
    PRINT "Stored " + ids[i] + ": " + LENGTH(roll) + " keys / " + after + " buckets = load factor " + load

    IF after != before
      PRINT "  RESIZE: " + before + " -> " + after + " buckets, every key rehashed"
      IF watchedBefore != BUCKET_OF(roll, watched)
        PRINT "  key " + watched + " moved from bucket " + watchedBefore + " to bucket " + BUCKET_OF(roll, watched)
      ELSE
        PRINT "  key " + watched + " stayed in bucket " + watchedBefore
      END
    END
  END

  PRINT "Final: " + LENGTH(roll) + " keys in " + CAPACITY(roll) + " buckets"
  PRINT "Resizing is O(n), but it happens rarely, so each insert is still O(1) on average"
END
`,

  ShoppingCartTotals: `SCENE ShoppingCartTotals

DECLARE
  HASH_MAP price = {apple: 30, bread: 40, milk: 60, eggs: 90, rice: 120}
  HASH_MAP cart = {apple: 6, milk: 2, rice: 3}
  ARRAY adding = ["bread", "apple", "eggs"]
  ARRAY amounts = [1, 4, 2]

SEQUENCE
  // Add more to the cart: an existing item gets its quantity increased
  LOOP i FROM 0 TO LENGTH(adding) - 1
    item = adding[i]
    IF CONTAINS(cart, item)
      cart[item] = cart[item] + amounts[i]
    ELSE
      cart[item] = amounts[i]
    END
  END
  PRINT "Cart:" cart

  // Walk every key of the cart with KEY_AT(cart, 0 .. LENGTH(cart) - 1)
  subtotal = 0
  biggestItem = ""
  biggestCost = 0
  LOOP k FROM 0 TO LENGTH(cart) - 1
    item = KEY_AT(cart, k)
    HIGHLIGHT cart[item] 'MARKED'
    lineCost = cart[item] * price[item]
    PRINT item + ": " + cart[item] + " x " + price[item] + " = " + lineCost
    subtotal = subtotal + lineCost
    IF lineCost > biggestCost
      biggestCost = lineCost
      biggestItem = item
    END
    HIGHLIGHT cart[item] 'NEUTRAL'
  END

  PRINT "Subtotal: " + subtotal
  PRINT "Most spent on: " + biggestItem + " (" + biggestCost + ")"

  IF subtotal >= 1000
    discount = subtotal / 10
    PRINT "10% off for orders of 1000 or more: -" + discount
    PRINT "Total to pay: " + (subtotal - discount)
  ELSE
    PRINT "Total to pay: " + subtotal
  END
END
`,

  OpenAddressingByHand: `SCENE OpenAddressingByHand

DECLARE
  // A hash table built by hand from two plain arrays, no HASH_MAP at all.
  // -1 marks an empty slot. Collisions are solved by LINEAR PROBING: if a
  // slot is taken, try the next one (wrapping around at the end).
  ARRAY keys = [-1, -1, -1, -1, -1, -1, -1]
  ARRAY vals = [0, 0, 0, 0, 0, 0, 0]
  ARRAY incoming = [50, 700, 76, 85, 92, 73, 101]
  ARRAY searches = [101, 85, 64]

  FUNCTION insertKey(key, value)
    size = LENGTH(keys)
    slot = key % size
    probes = 0
    WHILE keys[slot] != -1 AND keys[slot] != key AND probes < size
      slot = (slot + 1) % size
      probes = probes + 1
    END
    IF probes == size
      RETURN -1
    END
    keys[slot] = key
    vals[slot] = value
    HIGHLIGHT keys[slot] 'SUCCESS'
    RETURN slot
  END

  // Follows the same probe sequence as insertKey. An empty slot means the
  // key was never stored (it would have been placed there).
  FUNCTION findSlot(key)
    size = LENGTH(keys)
    slot = key % size
    steps = 0
    WHILE steps < size AND keys[slot] != -1
      IF keys[slot] == key
        RETURN slot
      END
      slot = (slot + 1) % size
      steps = steps + 1
    END
    RETURN -1
  END

SEQUENCE
  LOOP i FROM 0 TO LENGTH(incoming) - 1
    key = incoming[i]
    home = key % LENGTH(keys)
    placed = insertKey(key, i + 1)
    IF placed == home
      PRINT key + " % 7 = " + home + ": placed in its home slot " + placed
    ELSE
      PRINT key + " % 7 = " + home + ": taken, probed forward to slot " + placed
    END
  END
  PRINT "Table:" keys

  LOOP i FROM 0 TO LENGTH(searches) - 1
    slot = findSlot(searches[i])
    IF slot == -1
      PRINT "Search " + searches[i] + ": not in the table"
    ELSE
      PRINT "Search " + searches[i] + ": found in slot " + slot + " with value " + vals[slot]
    END
  END
  PRINT "Clusters of taken slots make probing slow: that is why tables are kept well below full"
END
`,

  WordFrequencyCounter: `SCENE WordFrequencyCounter

DECLARE
  HASH_MAP freq

  // Adds one to word's count (first time seen: the count starts at 1)
  FUNCTION countWord(word)
    IF CONTAINS(freq, word)
      freq[word] = freq[word] + 1
    ELSE
      freq[word] = 1
    END
  END

SEQUENCE
  sentence = "the cat sat on the mat and the cat ran"

  // Split the sentence into words ourselves: collect letters until a space
  word = ""
  LOOP i FROM 0 TO TEXT_LENGTH(sentence) - 1
    letter = CHAR_AT(sentence, i)
    IF letter == " "
      IF word != ""
        countWord(word)
      END
      word = ""
    ELSE
      word = word + letter
    END
  END
  // The last word has no space after it
  IF word != ""
    countWord(word)
  END

  PRINT "Counts:" freq
  PRINT LENGTH(freq) + " different words"

  // Find the most frequent word by walking every key
  bestWord = ""
  bestCount = 0
  LOOP k FROM 0 TO LENGTH(freq) - 1
    w = KEY_AT(freq, k)
    IF freq[w] > bestCount
      bestCount = freq[w]
      bestWord = w
    END
  END
  HIGHLIGHT freq[bestWord] 'SUCCESS'
  PRINT "Most frequent: " + bestWord + " (" + bestCount + " times)"
END
`,

  FirstUniqueCharacter: `SCENE FirstUniqueCharacter

DECLARE
  HASH_MAP count

SEQUENCE
  text = "swiss cheese is tasty"

  // Pass 1: count every character (spaces are skipped)
  LOOP i FROM 0 TO TEXT_LENGTH(text) - 1
    letter = CHAR_AT(text, i)
    IF letter != " "
      IF CONTAINS(count, letter)
        count[letter] = count[letter] + 1
      ELSE
        count[letter] = 1
      END
    END
  END
  PRINT "Counts:" count

  // Pass 2: walk the text in order; the first letter counted once wins.
  // (Walking the map would not work: it is ordered by bucket, not by text.)
  answer = -1
  i = 0
  WHILE answer == -1 AND i < TEXT_LENGTH(text)
    letter = CHAR_AT(text, i)
    IF letter != " "
      IF count[letter] == 1
        answer = i
      END
    END
    i = i + 1
  END

  IF answer == -1
    PRINT "Every character repeats"
  ELSE
    HIGHLIGHT count[CHAR_AT(text, answer)] 'SUCCESS'
    PRINT "First character that appears only once: " + CHAR_AT(text, answer) + " at position " + answer
  END
END
`,

  ValidAnagram: `SCENE ValidAnagram

DECLARE
  HASH_MAP balance
  ARRAY firstWords = ["listen", "triangle", "rat", "aab"]
  ARRAY secondWords = ["silent", "integral", "car", "abb"]

  // Empties the map by deleting its first key until none are left
  FUNCTION clearBalance()
    WHILE LENGTH(balance) > 0
      DELETE balance[KEY_AT(balance, 0)]
    END
  END

  // +1 for every letter of a, -1 for every letter of b.
  // They are anagrams exactly when every letter ends at 0.
  FUNCTION isAnagram(a, b)
    IF TEXT_LENGTH(a) != TEXT_LENGTH(b)
      RETURN FALSE
    END
    clearBalance()
    LOOP i FROM 0 TO TEXT_LENGTH(a) - 1
      up = CHAR_AT(a, i)
      IF CONTAINS(balance, up)
        balance[up] = balance[up] + 1
      ELSE
        balance[up] = 1
      END
      down = CHAR_AT(b, i)
      IF CONTAINS(balance, down)
        balance[down] = balance[down] - 1
      ELSE
        balance[down] = -1
      END
    END
    LOOP k FROM 0 TO LENGTH(balance) - 1
      IF balance[KEY_AT(balance, k)] != 0
        RETURN FALSE
      END
    END
    RETURN TRUE
  END

SEQUENCE
  LOOP p FROM 0 TO LENGTH(firstWords) - 1
    HIGHLIGHT firstWords[p] 'MARKED'
    HIGHLIGHT secondWords[p] 'MARKED'
    IF isAnagram(firstWords[p], secondWords[p])
      PRINT firstWords[p] + " / " + secondWords[p] + ": anagrams"
      HIGHLIGHT firstWords[p] 'SUCCESS'
      HIGHLIGHT secondWords[p] 'SUCCESS'
    ELSE
      PRINT firstWords[p] + " / " + secondWords[p] + ": not anagrams, letters left over:" balance
      HIGHLIGHT firstWords[p] 'DISCARDED'
      HIGHLIGHT secondWords[p] 'DISCARDED'
    END
  END
END
`,

  TwoSum: `SCENE TwoSum

DECLARE
  ARRAY nums = [4, 9, 12, 2, 15, 7]
  // seen[value] = the index where that value was met
  HASH_MAP seen

SEQUENCE
  target = 22
  PRINT "Looking for two numbers that add up to " + target

  // For each number, the partner it needs is target - number. If that
  // partner was seen earlier, we are done: one pass, O(n) instead of
  // checking every pair, O(n^2).
  found = 0
  i = 0
  WHILE found == 0 AND i < LENGTH(nums)
    HIGHLIGHT nums[i] 'MARKED'
    need = target - nums[i]
    IF CONTAINS(seen, need)
      j = seen[need]
      PRINT "nums[" + j + "] + nums[" + i + "] = " + need + " + " + nums[i] + " = " + target
      HIGHLIGHT nums[j] 'SUCCESS'
      HIGHLIGHT nums[i] 'SUCCESS'
      found = 1
    ELSE
      PRINT nums[i] + " needs " + need + ": not seen yet, remember " + nums[i] + " at index " + i
      seen[nums[i]] = i
      HIGHLIGHT nums[i] 'NEUTRAL'
    END
    i = i + 1
  END

  IF found == 0
    PRINT "No two numbers add up to " + target
  END
END
`,

  FirstDuplicate: `SCENE FirstDuplicate

DECLARE
  // Ticket numbers scanned at a stadium gate
  ARRAY tickets = [4471, 1093, 8820, 5512, 1093, 7004, 8820]
  // firstSeen[ticket] = the position where the ticket was first scanned
  HASH_MAP firstSeen

SEQUENCE
  duplicate = -1
  i = 0
  WHILE duplicate == -1 AND i < LENGTH(tickets)
    HIGHLIGHT tickets[i] 'MARKED'
    ticket = tickets[i]
    IF CONTAINS(firstSeen, ticket)
      duplicate = ticket
      PRINT "Ticket " + ticket + " scanned again at position " + i + " (first at position " + firstSeen[ticket] + ")"
      HIGHLIGHT tickets[i] 'DISCARDED'
      HIGHLIGHT tickets[firstSeen[ticket]] 'DISCARDED'
    ELSE
      firstSeen[ticket] = i
      PRINT "Ticket " + ticket + " is new"
      HIGHLIGHT tickets[i] 'SUCCESS'
    END
    i = i + 1
  END

  IF duplicate == -1
    PRINT "Every ticket is different"
  ELSE
    PRINT "Stopped at the first reused ticket: " + duplicate
  END
END
`,

  LongestConsecutiveRun: `SCENE LongestConsecutiveRun

DECLARE
  ARRAY nums = [100, 4, 200, 1, 3, 2, 101, 102, 5, 103]
  // Used as a set: only the keys matter
  HASH_MAP present

SEQUENCE
  LOOP i FROM 0 TO LENGTH(nums) - 1
    present[nums[i]] = TRUE
  END

  // A run starts at x only when x - 1 is missing. From each start, count
  // x, x + 1, x + 2, ... while they are present. Every number is counted
  // inside one run only, so this is O(n) even without sorting.
  bestStart = 0
  bestLength = 0
  LOOP i FROM 0 TO LENGTH(nums) - 1
    x = nums[i]
    IF CONTAINS(present, x - 1)
      PRINT x + ": " + (x - 1) + " is present, so a run does not start here"
    ELSE
      runLength = 1
      WHILE CONTAINS(present, x + runLength)
        runLength = runLength + 1
      END
      PRINT x + ": a run starts here: " + x + " to " + (x + runLength - 1) + ", length " + runLength
      IF runLength > bestLength
        bestLength = runLength
        bestStart = x
      END
    END
  END

  PRINT "Longest run: " + bestStart + " to " + (bestStart + bestLength - 1) + ", length " + bestLength
END
`,

  SubarraySumEqualsK: `SCENE SubarraySumEqualsK

DECLARE
  ARRAY nums = [3, 4, 7, 2, -3, 1, 4, 2]
  // prefixCount[s] = how many prefixes (nums[0] + ... + nums[j]) add up to s.
  // The empty prefix adds up to 0, once.
  HASH_MAP prefixCount = {0: 1}

SEQUENCE
  k = 7
  // A subarray nums[a..i] adds up to k exactly when
  //   prefix(i) - prefix(a - 1) = k, that is prefix(a - 1) = prefix(i) - k.
  // So at every i, the number of good subarrays ending at i is the number
  // of earlier prefixes equal to runningSum - k.
  runningSum = 0
  total = 0
  LOOP i FROM 0 TO LENGTH(nums) - 1
    HIGHLIGHT nums[i] 'MARKED'
    runningSum = runningSum + nums[i]
    wanted = runningSum - k
    IF CONTAINS(prefixCount, wanted)
      total = total + prefixCount[wanted]
      PRINT "i = " + i + ": sum so far " + runningSum + ", " + prefixCount[wanted] + " subarray(s) ending here add up to " + k
    ELSE
      PRINT "i = " + i + ": sum so far " + runningSum + ", none ending here"
    END

    IF CONTAINS(prefixCount, runningSum)
      prefixCount[runningSum] = prefixCount[runningSum] + 1
    ELSE
      prefixCount[runningSum] = 1
    END
    HIGHLIGHT nums[i] 'NEUTRAL'
  END

  PRINT "Subarrays adding up to " + k + ": " + total
END
`,

  LongestSubstringWithoutRepeats: `SCENE LongestSubstringWithoutRepeats

DECLARE
  // lastSeen[letter] = the last position where that letter appeared
  HASH_MAP lastSeen

SEQUENCE
  text = "geeksforgeeks"

  // Sliding window text[start..i] with no repeated letter. When the letter
  // at i was already seen INSIDE the window, the window must start just
  // after that earlier copy.
  start = 0
  bestStart = 0
  bestLength = 0
  LOOP i FROM 0 TO TEXT_LENGTH(text) - 1
    letter = CHAR_AT(text, i)
    IF CONTAINS(lastSeen, letter) AND lastSeen[letter] >= start
      start = lastSeen[letter] + 1
      PRINT letter + " repeats: window now starts at " + start
    END
    lastSeen[letter] = i

    windowLength = i - start + 1
    IF windowLength > bestLength
      bestLength = windowLength
      bestStart = start
    END
  END

  best = ""
  LOOP i FROM bestStart TO bestStart + bestLength - 1
    best = best + CHAR_AT(text, i)
  END
  PRINT "Longest part with no repeated letter: " + best + " (" + bestLength + " letters, from position " + bestStart + ")"
END
`,

  ElectionTally: `SCENE ElectionTally

DECLARE
  ARRAY ballots = ["Asha", "Ben", "Asha", "Chen", "Ben", "Asha", "Dia", "Ben", "Chen", "Ben"]
  HASH_MAP votes

SEQUENCE
  // Count the ballots one by one
  LOOP i FROM 0 TO LENGTH(ballots) - 1
    name = ballots[i]
    IF CONTAINS(votes, name)
      votes[name] = votes[name] + 1
    ELSE
      votes[name] = 1
    END
  END
  PRINT "Votes:" votes

  // Find the highest count, and how many candidates share it
  topVotes = 0
  winner = ""
  tied = 0
  LOOP k FROM 0 TO LENGTH(votes) - 1
    name = KEY_AT(votes, k)
    IF votes[name] > topVotes
      topVotes = votes[name]
      winner = name
      tied = 1
    ELSE
      IF votes[name] == topVotes
        tied = tied + 1
      END
    END
  END

  IF tied > 1
    PRINT "A tie: " + tied + " candidates have " + topVotes + " votes"
  ELSE
    HIGHLIGHT votes[winner] 'SUCCESS'
    PRINT "Winner: " + winner + " with " + topVotes + " of " + LENGTH(ballots) + " votes"
  END
END
`,

  RansomNote: `SCENE RansomNote

DECLARE
  HASH_MAP letters

SEQUENCE
  magazine = "a quick brown fox jumps over the lazy dog at dawn"
  note = "attack at dawn"

  // Count the letters the magazine offers (spaces are free)
  LOOP i FROM 0 TO TEXT_LENGTH(magazine) - 1
    letter = CHAR_AT(magazine, i)
    IF letter != " "
      IF CONTAINS(letters, letter)
        letters[letter] = letters[letter] + 1
      ELSE
        letters[letter] = 1
      END
    END
  END
  PRINT "The magazine has " + LENGTH(letters) + " different letters"

  // Cut out each letter of the note; stop at the first one we run out of
  possible = TRUE
  missing = ""
  i = 0
  WHILE possible AND i < TEXT_LENGTH(note)
    letter = CHAR_AT(note, i)
    IF letter != " "
      IF CONTAINS(letters, letter)
        IF letters[letter] > 0
          letters[letter] = letters[letter] - 1
        ELSE
          possible = FALSE
          missing = letter
          PRINT "Ran out of " + letter + " at position " + i + " of the note"
        END
      ELSE
        possible = FALSE
        PRINT "The magazine has no " + letter + " at all"
      END
    END
    i = i + 1
  END

  IF possible
    PRINT "The note can be made from the magazine"
  ELSE
    // A letter we ran out of is in the map (with 0 left): mark it
    IF missing != ""
      HIGHLIGHT letters[missing] 'DISCARDED'
    END
    PRINT "The note cannot be made from the magazine"
  END
END
`,

  MemoizedFibonacci: `SCENE MemoizedFibonacci

DECLARE
  // memo[n] = fib(n), once it has been worked out
  HASH_MAP memo

  // Plain recursion recomputes the same values again and again:
  // fib(30) would make over a million calls. Remembering each answer in a
  // hash map means each fib(n) is computed once: O(n) calls.
  FUNCTION fib(n)
    IF CONTAINS(memo, n)
      RETURN memo[n]
    END
    // fib(0) = 0 and fib(1) = 1; every other value is the sum of the two before it
    result = n
    IF n > 1
      result = fib(n - 1) + fib(n - 2)
    END
    memo[n] = result
    RETURN result
  END

SEQUENCE
  answer = fib(12)
  PRINT "fib(12) = " + answer
  PRINT "Values remembered: " + LENGTH(memo)

  // Every value from fib(0) to fib(12) is now one lookup away
  LOOP n FROM 0 TO 12
    PRINT "fib(" + n + ") = " + memo[n]
  END

  // Asking again costs a single lookup, no new calls
  again = fib(12)
  PRINT "fib(12) again = " + again + ", still " + LENGTH(memo) + " values remembered"
END
`,
};
