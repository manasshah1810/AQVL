# Phase 2.1 corpus re-audit (post-primitive AQIR)

Re-run of `scripts/audit-examples.ts` against the primitive-based AQIR (commit 1981d69 and later).
Result: identical to `phase1-example-corpus-audit.md`: same 218 examples, all pass, no status differences.
Primitive spec: `docs/design/aqir-primitives-spec.md`.

---

# Example Corpus Audit

Produced by `scripts/audit-examples.ts`. Every example in `packages/demo/src/examples/registry.ts` is compiled and run to completion through a headless `ExecutionEngine` (max 100000 iterations). No example source, registry, compiler, or runtime code was modified to produce this run.

Total examples: 218
- pass: 218
- compile-error: 0
- runtime-error: 0
- iteration-limit: 0

## Results

| id | title | category | status | error |
|---|---|---|---|---|
| arrays-foundation | Array Foundation | Arrays | pass |  |
| arrays-reverse | Reverse Array | Arrays | pass |  |
| arrays-sliding-window | Sliding Window | Arrays | pass |  |
| arrays-two-pointer | Two Pointer Pair Sum | Arrays | pass |  |
| arrays-max-min | Find Maximum & Minimum | Arrays | pass |  |
| arrays-rotate | Rotate Array | Arrays | pass |  |
| arrays-find-duplicate | Find Duplicate | Arrays | pass |  |
| arrays-merge-sorted | Merge Two Sorted Arrays | Arrays | pass |  |
| arrays-prefix-sum | Prefix Sum Array | Arrays | pass |  |
| arrays-move-zeroes | Move Zeroes to End | Arrays | pass |  |
| arrays-dutch-flag | Dutch National Flag Sort | Arrays | pass |  |
| sorting-bubble-sort | Bubble Sort | Sorting | pass |  |
| sorting-selection-sort | Selection Sort | Sorting | pass |  |
| sorting-insertion-sort | Insertion Sort | Sorting | pass |  |
| sorting-cocktail-shaker-sort | Cocktail Shaker Sort | Sorting | pass |  |
| sorting-quick-sort | Quick Sort | Sorting | pass |  |
| sorting-merge-sort | Merge Sort | Sorting | pass |  |
| sorting-heap-sort | Heap Sort | Sorting | pass |  |
| sorting-shell-sort | Shell Sort | Sorting | pass |  |
| sorting-counting-sort | Counting Sort | Sorting | pass |  |
| sorting-radix-sort | Radix Sort | Sorting | pass |  |
| sorting-cycle-sort | Cycle Sort | Sorting | pass |  |
| sorting-pancake-sort | Pancake Sort | Sorting | pass |  |
| sorting-exam-rank-list | Exam Rank List | Sorting | pass |  |
| sorting-leaderboard-insert | Game Leaderboard | Sorting | pass |  |
| sorting-count-inversions | Count Inversions | Sorting | pass |  |
| sorting-quickselect-median | Median with Quickselect | Sorting | pass |  |
| sorting-stable-sort-check | Sorted Check & Stability | Sorting | pass |  |
| linked-list-singly | Singly Linked List | Linked Lists | pass |  |
| linked-list-doubly | Doubly Linked List | Linked Lists | pass |  |
| linked-list-circular | Circular Linked List | Linked Lists | pass |  |
| linked-list-reverse | Reverse a Singly Linked List | Linked Lists | pass |  |
| linked-list-reverse-doubly | Reverse a Doubly Linked List | Linked Lists | pass |  |
| linked-list-reverse-circular | Reverse a Circular Linked List | Linked Lists | pass |  |
| linked-list-middle | Find the Middle Node | Linked Lists | pass |  |
| linked-list-detect-cycle | Detect & Remove a Cycle (Floyd) | Linked Lists | pass |  |
| linked-list-merge-sorted | Merge Two Sorted Lists | Linked Lists | pass |  |
| linked-list-remove-nth | Remove Nth Node From End | Linked Lists | pass |  |
| linked-list-palindrome | Palindrome Linked List | Linked Lists | pass |  |
| linked-list-remove-duplicates | Remove Duplicates (Sorted List) | Linked Lists | pass |  |
| tree-basics | Binary Tree Basics | Trees | pass |  |
| tree-traversals | Preorder, Inorder & Postorder | Trees | pass |  |
| tree-level-order | Level Order Traversal (BFS) | Trees | pass |  |
| tree-iterative-inorder | Iterative Inorder with a Stack | Trees | pass |  |
| tree-height-size | Height, Size & Leaf Count | Trees | pass |  |
| tree-bst-insert-search | BST Search & Insert | Trees | pass |  |
| tree-bst-delete | BST Delete (All Three Cases) | Trees | pass |  |
| tree-validate-bst | Validate a BST | Trees | pass |  |
| tree-lca | Lowest Common Ancestor (BST) | Trees | pass |  |
| tree-mirror | Mirror (Invert) a Binary Tree | Trees | pass |  |
| tree-views | Left & Right Views | Trees | pass |  |
| tree-path-sum | Root-to-Leaf Path Sum | Trees | pass |  |
| searching-linear | Linear Search | Searching | pass |  |
| searching-all-occurrences | All Occurrences | Searching | pass |  |
| searching-sentinel | Sentinel Linear Search | Searching | pass |  |
| searching-binary | Binary Search | Searching | pass |  |
| searching-binary-recursive | Recursive Binary Search | Searching | pass |  |
| searching-first-last | First & Last Occurrence | Searching | pass |  |
| searching-insert-position | Search Insert Position | Searching | pass |  |
| searching-jump | Jump Search | Searching | pass |  |
| searching-exponential | Exponential Search | Searching | pass |  |
| searching-ternary | Ternary Search | Searching | pass |  |
| searching-interpolation | Interpolation Search | Searching | pass |  |
| searching-rotated | Search a Rotated Sorted Array | Searching | pass |  |
| searching-peak | Peak of a Trail | Searching | pass |  |
| searching-sqrt | Square Root by Binary Search | Searching | pass |  |
| searching-matrix | Search a Sorted Seat Map | Searching | pass |  |
| searching-missing-roll | Find the Missing Roll Number | Searching | pass |  |
| searching-ship-capacity | Delivery Truck Capacity | Searching | pass |  |
| searching-contacts | Contact Book Search | Searching | pass |  |
| searching-bst | BST Search Path | Searching | pass |  |
| searching-maze-dfs | Maze Exit with DFS | Searching | pass |  |
| searching-nearest-bfs | Nearest Hospital with BFS | Searching | pass |  |
| loops-for-basics | For Loop Basics | Loops & Control | pass |  |
| loops-while-digits | While Loop: Digits of a Number | Loops & Control | pass |  |
| loops-countdown-reverse | Counting Down & Reversing | Loops & Control | pass |  |
| loops-grade-calculator | IF / ELSE IF / ELSE: Grade Calculator | Loops & Control | pass |  |
| loops-leap-year | Nested IFs & AND / OR: Leap Years | Loops & Control | pass |  |
| loops-weekly-expenses | Accumulator: Weekly Expenses | Loops & Control | pass |  |
| loops-hottest-coldest | Best So Far: Hottest & Coldest Day | Loops & Control | pass |  |
| loops-second-largest | Second Largest in One Pass | Loops & Control | pass |  |
| loops-stopping-early | Stopping Early (break with a flag) | Loops & Control | pass |  |
| loops-skipping-items | Skipping Items (continue with IF / ELSE) | Loops & Control | pass |  |
| loops-do-while-atm | Do-While: PIN Attempts & ATM | Loops & Control | pass |  |
| loops-fizzbuzz | FizzBuzz | Loops & Control | pass |  |
| loops-multiplication-table | Nested Loops: Multiplication Table | Loops & Control | pass |  |
| loops-star-patterns | Nested Loops: Star & Number Patterns | Loops & Control | pass |  |
| loops-gift-pairs | All Pairs: Gifts Within Budget | Loops & Control | pass |  |
| loops-counting-vowels | Counting Vowels in a Sentence | Loops & Control | pass |  |
| loops-fibonacci | Fibonacci Series | Loops & Control | pass |  |
| loops-prime-check | Prime Check with Early RETURN | Loops & Control | pass |  |
| loops-sieve | Sieve of Eratosthenes | Loops & Control | pass |  |
| loops-gcd-lcm | Euclid's GCD & LCM | Loops & Control | pass |  |
| loops-decimal-to-binary | Decimal to Binary and Back | Loops & Control | pass |  |
| loops-palindrome-armstrong | Palindrome & Armstrong Numbers | Loops & Control | pass |  |
| loops-collatz | Collatz Sequence (3n + 1) | Loops & Control | pass |  |
| stacks-foundation | Stack Foundation | Stacks | pass |  |
| stacks-using-array | Stack Using an Array | Stacks | pass |  |
| stacks-reverse-array | Reverse an Array | Stacks | pass |  |
| stacks-reverse-string | Reverse a String | Stacks | pass |  |
| stacks-palindrome | Palindrome Check | Stacks | pass |  |
| stacks-balanced-parens | Balanced Parentheses | Stacks | pass |  |
| stacks-postfix-evaluation | Evaluate Postfix Expression | Stacks | pass |  |
| stacks-infix-to-postfix | Infix to Postfix | Stacks | pass |  |
| stacks-next-greater-element | Next Greater Element | Stacks | pass |  |
| stacks-stock-span | Stock Span | Stacks | pass |  |
| stacks-min-stack | Min Stack | Stacks | pass |  |
| stacks-sort-stack | Sort a Stack | Stacks | pass |  |
| stacks-decimal-to-binary | Decimal to Binary | Stacks | pass |  |
| stacks-undo-redo | Undo / Redo | Stacks | pass |  |
| stacks-factorial | Recursion as a Stack | Stacks | pass |  |
| queues-foundation | Queue Foundation | Queues | pass |  |
| queues-using-array | Queue Using an Array | Queues | pass |  |
| queues-circular | Circular Queue | Queues | pass |  |
| queues-bank-teller | Bank Teller Simulation | Queues | pass |  |
| queues-round-robin | Round Robin CPU Scheduling | Queues | pass |  |
| queues-generate-binary | Generate Binary Numbers | Queues | pass |  |
| queues-reverse-with-stack | Reverse a Queue | Queues | pass |  |
| queues-reverse-first-k | Reverse the First K Elements | Queues | pass |  |
| queues-interleave | Interleave Two Halves | Queues | pass |  |
| queues-using-two-stacks | Queue Using Two Stacks | Queues | pass |  |
| queues-hot-potato | Hot Potato (Josephus) | Queues | pass |  |
| queues-moving-average | Moving Average of a Sensor | Queues | pass |  |
| queues-first-non-repeating | First Non-Repeating Character | Queues | pass |  |
| graphs-basics | Graph Basics: Friends Network | Graphs | pass |  |
| graphs-directed-weighted | Directed & Weighted: Flight Routes | Graphs | pass |  |
| graphs-adjacency-matrix | Adjacency Matrix vs List | Graphs | pass |  |
| graphs-bfs | Breadth-First Search: Degrees of Separation | Graphs | pass |  |
| graphs-bfs-shortest-path | Fewest Metro Stops (BFS Path) | Graphs | pass |  |
| graphs-dfs | Depth-First Search: Maze Explorer | Graphs | pass |  |
| graphs-dfs-recursive | Recursive DFS: Web Crawler | Graphs | pass |  |
| graphs-components | Connected Components: Office LAN | Graphs | pass |  |
| graphs-cycle-undirected | Cycle Detection (Undirected) | Graphs | pass |  |
| graphs-cycle-directed | Cycle Detection (Directed): Course Prerequisites | Graphs | pass |  |
| graphs-bipartite | Bipartite Check: Two Teams | Graphs | pass |  |
| graphs-topo-kahn | Topological Sort (Kahn's): Course Schedule | Graphs | pass |  |
| graphs-topo-dfs | Topological Sort (DFS): Getting Dressed | Graphs | pass |  |
| graphs-dijkstra | Dijkstra's Shortest Path: Delivery Route | Graphs | pass |  |
| graphs-bellman-ford | Bellman-Ford: Drone Battery (Negative Weights) | Graphs | pass |  |
| graphs-prim | Prim's MST: Fibre Between Offices | Graphs | pass |  |
| graphs-kruskal | Kruskal's MST: Village Roads | Graphs | pass |  |
| graphs-all-paths | All Routes: Backtracking | Graphs | pass |  |
| graphs-coloring | Greedy Colouring: Exam Timetable | Graphs | pass |  |
| heaps-index-map | Heap Index Map | Heaps | pass |  |
| heaps-is-valid | Is It a Min-Heap? | Heaps | pass |  |
| heaps-insert | Insert and Sift Up | Heaps | pass |  |
| heaps-extract-min | Extract Minimum | Heaps | pass |  |
| heaps-max-heap-auction | Max-Heap: Auction Bids | Heaps | pass |  |
| heaps-build-bottom-up | Build Heap Bottom-Up (Floyd) | Heaps | pass |  |
| heaps-heapify-recursive | Heapify (Recursive) | Heaps | pass |  |
| heaps-decrease-key | Decrease Key | Heaps | pass |  |
| heaps-delete-at-index | Delete at Any Index | Heaps | pass |  |
| heaps-heap-sort | Heap Sort (In Place) | Heaps | pass |  |
| heaps-emergency-room | Emergency Room Triage | Heaps | pass |  |
| heaps-top-k-scores | Top K Scores | Heaps | pass |  |
| heaps-kth-smallest | Kth Smallest Delivery Time | Heaps | pass |  |
| heaps-connect-ropes | Connect Ropes at Minimum Cost | Heaps | pass |  |
| heaps-last-stone | Last Stone Weight | Heaps | pass |  |
| heaps-running-median | Running Median (Two Heaps) | Heaps | pass |  |
| hashmaps-hash-function | Hash Function by Hand | Hash Maps | pass |  |
| hashmaps-phone-book | Phone Book: Store, Update, Look Up, Delete | Hash Maps | pass |  |
| hashmaps-collisions | Collisions and Chaining | Hash Maps | pass |  |
| hashmaps-load-factor | Load Factor and Resizing | Hash Maps | pass |  |
| hashmaps-shopping-cart | Shopping Cart Totals | Hash Maps | pass |  |
| hashmaps-open-addressing | Open Addressing by Hand | Hash Maps | pass |  |
| hashmaps-word-frequency | Word Frequency Counter | Hash Maps | pass |  |
| hashmaps-first-unique | First Non-Repeating Character | Hash Maps | pass |  |
| hashmaps-valid-anagram | Valid Anagram | Hash Maps | pass |  |
| hashmaps-two-sum | Two Sum in One Pass | Hash Maps | pass |  |
| hashmaps-first-duplicate | First Reused Ticket | Hash Maps | pass |  |
| hashmaps-longest-consecutive | Longest Consecutive Run | Hash Maps | pass |  |
| hashmaps-subarray-sum | Subarrays That Add Up to K | Hash Maps | pass |  |
| hashmaps-longest-substring | Longest Substring Without Repeats | Hash Maps | pass |  |
| hashmaps-election | Election Tally | Hash Maps | pass |  |
| hashmaps-ransom-note | Ransom Note | Hash Maps | pass |  |
| hashmaps-memo-fibonacci | Memoized Fibonacci | Hash Maps | pass |  |
| tries-insert-by-hand | Insert Words by Hand | Tries | pass |  |
| tries-search-word | Search for a Whole Word | Tries | pass |  |
| tries-starts-with | Starts With a Prefix | Tries | pass |  |
| tries-count-words-nodes | Count Words, Nodes and Leaves | Tries | pass |  |
| tries-dictionary-order | Trie Sort: Dictionary Order | Tries | pass |  |
| tries-autocomplete | Autocomplete Suggestions | Tries | pass |  |
| tries-delete-word | Delete a Word with Pruning | Tries | pass |  |
| tries-prefix-counter | Count Names by Prefix | Tries | pass |  |
| tries-word-frequency | Word Frequency Counter | Tries | pass |  |
| tries-longest-common-prefix | Longest Common Prefix | Tries | pass |  |
| tries-shortest-unique-prefix | Shortest Unique Prefix | Tries | pass |  |
| tries-replace-with-roots | Replace Words with Their Roots | Tries | pass |  |
| tries-word-break | Word Break | Tries | pass |  |
| tries-longest-built-word | Longest Word Built Step by Step | Tries | pass |  |
| tries-distinct-substrings | Count Distinct Substrings | Tries | pass |  |
| tries-wildcard-search | Wildcard Search with "." | Tries | pass |  |
| tries-search-as-you-type | Contact Search as You Type | Tries | pass |  |
| tries-maximum-xor | Maximum XOR of Two Numbers | Tries | pass |  |
| fn-basics | Functions: Canteen Bill | Recursion & Functions | pass |  |
| fn-grade-calculator | Grade Calculator | Recursion & Functions | pass |  |
| fn-parameters-are-copies | Parameters Are Copies | Recursion & Functions | pass |  |
| fn-local-global-scope | Local & Global Scope | Recursion & Functions | pass |  |
| fn-prime-toolkit | Prime Toolkit | Recursion & Functions | pass |  |
| fn-class-report | Class Report with Helpers | Recursion & Functions | pass |  |
| fn-atm-withdrawal | ATM Withdrawal (Guard Clauses) | Recursion & Functions | pass |  |
| recursion-factorial | Factorial (Recursive) | Recursion & Functions | pass |  |
| recursion-head-vs-tail | Before vs After the Call | Recursion & Functions | pass |  |
| recursion-digits | Digits by Recursion | Recursion & Functions | pass |  |
| recursion-power | Slow vs Fast Power | Recursion & Functions | pass |  |
| recursion-gcd-lcm | GCD & LCM (Euclid) | Recursion & Functions | pass |  |
| recursion-fibonacci | Fibonacci Three Ways | Recursion & Functions | pass |  |
| recursion-array | Recursion on an Array | Recursion & Functions | pass |  |
| recursion-reverse-array | Reverse an Array Recursively | Recursion & Functions | pass |  |
| recursion-palindrome | Palindrome Words | Recursion & Functions | pass |  |
| recursion-number-bases | Binary, Octal & Hex | Recursion & Functions | pass |  |
| recursion-mutual | Mutual Recursion | Recursion & Functions | pass |  |
| recursion-hanoi | Tower of Hanoi | Recursion & Functions | pass |  |
| recursion-subsets | Subsets Within a Budget | Recursion & Functions | pass |  |
| recursion-permutations | Seating Permutations | Recursion & Functions | pass |  |
| recursion-n-queens | N-Queens | Recursion & Functions | pass |  |
| recursion-climbing-stairs | Climbing Stairs | Recursion & Functions | pass |  |
| recursion-coin-change | Coin Change | Recursion & Functions | pass |  |
