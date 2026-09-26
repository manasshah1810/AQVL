/**
 * AQVL Example Registry
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for all playground examples.
 *
 * To add a new example:
 *   1. Add its AQVL source to the appropriate Library file in this
 *      directory (or create a new one).
 *   2. Append an entry to the EXAMPLES array below.
 *
 * The Example Explorer reads exclusively from this registry.
 * ─────────────────────────────────────────────────────────────────
 */

import { SortingScripts }    from './SortingLibrary';
import { ArrayScripts }      from './ArrayLibrary';
import { LinkedListScripts } from './LinkedListLibrary';
import { SearchingScripts }  from './SearchingLibrary';
import { TreeScripts }       from './TreeLibrary';
import { LoopScripts }       from './LoopLibrary';
import { StackScripts }      from './StackLibrary';
import { QueueScripts }      from './QueueLibrary';
import { GraphScripts }      from './GraphLibrary';
import { HeapScripts }       from './HeapLibrary';
import { HashMapScripts }    from './HashMapLibrary';
import { TrieScripts }       from './TrieLibrary';
import { RecursionScripts }  from './RecursionLibrary';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ExampleCategory =
  | 'Arrays'
  | 'Sorting'
  | 'Linked Lists'
  | 'Trees'
  | 'Searching'
  | 'Loops & Control'
  | 'Stacks'
  | 'Queues'
  | 'Graphs'
  | 'Heaps'
  | 'Hash Maps'
  | 'Tries'
  | 'Recursion & Functions';

export interface Example {
  /** Unique, stable identifier (used as React key and for active-state tracking). */
  id: string;
  /** Human-readable name shown in the explorer list. */
  title: string;
  /** Category grouping for display in the explorer. */
  category: ExampleCategory;
  /** Short description of the algorithm or data structure. */
  description: string;
  /** Difficulty level of understanding the example. */
  difficulty: 'Easy' | 'Medium' | 'Hard';
  /** Full AQVL source code that will be loaded into the editor. */
  source: string;
}

// ── Registry ───────────────────────────────────────────────────────────────────

export const EXAMPLES: Example[] = [
  // ── Arrays ───────────────────────────────────────────────────────────────────
  {
    id: 'arrays-foundation',
    title: 'Array Foundation',
    category: 'Arrays',
    description: 'Core array operations: traversal, insertion, deletion, update, swap, and a linear search.',
    difficulty: 'Easy',
    source: ArrayScripts.ArrayFoundation,
  },
  {
    id: 'arrays-reverse',
    title: 'Reverse Array',
    category: 'Arrays',
    description: 'Reversing an array in-place using two pointers starting at opposite ends and swapping inwards.',
    difficulty: 'Easy',
    source: ArrayScripts.ArrayReverse,
  },
  {
    id: 'arrays-sliding-window',
    title: 'Sliding Window',
    category: 'Arrays',
    description: 'Finding the largest sum of k consecutive elements by sliding a window: add the entering element, subtract the leaving one.',
    difficulty: 'Medium',
    source: ArrayScripts.SlidingWindow,
  },
  {
    id: 'arrays-two-pointer',
    title: 'Two Pointer Pair Sum',
    category: 'Arrays',
    description: 'Finding a pair in a sorted array that sums to a target, moving whichever pointer brings the sum closer.',
    difficulty: 'Easy',
    source: ArrayScripts.TwoPointerPairSum,
  },
  {
    id: 'arrays-max-min',
    title: 'Find Maximum & Minimum',
    category: 'Arrays',
    description: 'Finding the largest and smallest elements in a single pass by tracking the best values seen so far.',
    difficulty: 'Easy',
    source: ArrayScripts.FindMaxMin,
  },
  {
    id: 'arrays-rotate',
    title: 'Rotate Array',
    category: 'Arrays',
    description: 'Rotating an array right by k places: save the last element, shift the rest right, place it at the front.',
    difficulty: 'Easy',
    source: ArrayScripts.RotateArrayRight,
  },
  {
    id: 'arrays-find-duplicate',
    title: 'Find Duplicate',
    category: 'Arrays',
    description: 'Detecting a duplicate value by comparing each element with every element after it, stopping at the first match.',
    difficulty: 'Easy',
    source: ArrayScripts.FindDuplicateInArray,
  },
  {
    id: 'arrays-merge-sorted',
    title: 'Merge Two Sorted Arrays',
    category: 'Arrays',
    description: 'Merging two sorted arrays into one by repeatedly taking the smaller front element, then copying the leftovers.',
    difficulty: 'Medium',
    source: ArrayScripts.MergeTwoSortedArrays,
  },
  {
    id: 'arrays-prefix-sum',
    title: 'Prefix Sum Array',
    category: 'Arrays',
    description: 'Building prefix[i] = prefix[i-1] + arr[i], then answering a range-sum query with a single subtraction.',
    difficulty: 'Easy',
    source: ArrayScripts.PrefixSumArray,
  },
  {
    id: 'arrays-move-zeroes',
    title: 'Move Zeroes to End',
    category: 'Arrays',
    description: 'Moving all zero elements to the end of an array while preserving the order of non-zero elements.',
    difficulty: 'Medium',
    source: ArrayScripts.MoveZeroesToEnd,
  },
  {
    id: 'arrays-dutch-flag',
    title: 'Dutch National Flag Sort',
    category: 'Arrays',
    description: 'Partitioning an array of 0s, 1s, and 2s into three groups in a single pass using three pointers.',
    difficulty: 'Hard',
    source: ArrayScripts.DutchNationalFlagSort,
  },

  // ── Sorting ──────────────────────────────────────────────────────────────────
  {
    id: 'sorting-bubble-sort',
    title: 'Bubble Sort',
    category: 'Sorting',
    description: 'Compare neighbours and swap when out of order; the largest value bubbles to the end each pass. Stops early when a pass makes no swap.',
    difficulty: 'Easy',
    source: SortingScripts.BubbleSort,
  },
  {
    id: 'sorting-selection-sort',
    title: 'Selection Sort',
    category: 'Sorting',
    description: 'Scan the unsorted part for its smallest value and swap it into place — one swap per pass, at most n - 1 swaps in total.',
    difficulty: 'Easy',
    source: SortingScripts.SelectionSort,
  },
  {
    id: 'sorting-insertion-sort',
    title: 'Insertion Sort',
    category: 'Sorting',
    description: 'Like sorting cards in your hand: pick up the next key, shift larger values right with a WHILE loop, drop the key into the gap.',
    difficulty: 'Easy',
    source: SortingScripts.InsertionSort,
  },
  {
    id: 'sorting-cocktail-shaker-sort',
    title: 'Cocktail Shaker Sort',
    category: 'Sorting',
    description: 'Bubble sort in both directions: forward passes push the largest value right, backward passes push the smallest value left.',
    difficulty: 'Easy',
    source: SortingScripts.CocktailShakerSort,
  },
  {
    id: 'sorting-quick-sort',
    title: 'Quick Sort',
    category: 'Sorting',
    description: 'Recursive divide and conquer: a Lomuto partition FUNCTION fixes the pivot in its final place, then each side is sorted recursively.',
    difficulty: 'Medium',
    source: SortingScripts.QuickSort,
  },
  {
    id: 'sorting-merge-sort',
    title: 'Merge Sort',
    category: 'Sorting',
    description: 'Recursively split the array in half, sort each half, then merge the two sorted halves through a temp array.',
    difficulty: 'Medium',
    source: SortingScripts.MergeSort,
  },
  {
    id: 'sorting-heap-sort',
    title: 'Heap Sort',
    category: 'Sorting',
    description: 'Build a max-heap inside the array with a siftDown FUNCTION, then repeatedly move the largest value to the end and repair the heap.',
    difficulty: 'Hard',
    source: SortingScripts.HeapSort,
  },
  {
    id: 'sorting-shell-sort',
    title: 'Shell Sort',
    category: 'Sorting',
    description: 'Insertion sort on elements a gap apart, halving the gap each round, so small values jump far left early.',
    difficulty: 'Medium',
    source: SortingScripts.ShellSort,
  },
  {
    id: 'sorting-counting-sort',
    title: 'Counting Sort',
    category: 'Sorting',
    description: 'No comparisons: tally every value in a counts array, then write each value back as many times as it was counted.',
    difficulty: 'Medium',
    source: SortingScripts.CountingSort,
  },
  {
    id: 'sorting-radix-sort',
    title: 'Radix Sort',
    category: 'Sorting',
    description: 'Sort by the ones digit, then the tens, then the hundreds — each round a stable counting sort on one digit.',
    difficulty: 'Hard',
    source: SortingScripts.RadixSort,
  },
  {
    id: 'sorting-cycle-sort',
    title: 'Cycle Sort',
    category: 'Sorting',
    description: 'Write every value straight into its final position (how many values are smaller), following each cycle round — the fewest possible writes.',
    difficulty: 'Hard',
    source: SortingScripts.CycleSort,
  },
  {
    id: 'sorting-pancake-sort',
    title: 'Pancake Sort',
    category: 'Sorting',
    description: 'The only move allowed is flipping the top of the stack: flip the biggest pancake to the top, then down to the bottom.',
    difficulty: 'Medium',
    source: SortingScripts.PancakeSort,
  },
  {
    id: 'sorting-exam-rank-list',
    title: 'Exam Rank List',
    category: 'Sorting',
    description: 'Sort marks highest-first while keeping roll numbers paired (parallel arrays), then print ranks with ties sharing a rank.',
    difficulty: 'Easy',
    source: SortingScripts.ExamRankList,
  },
  {
    id: 'sorting-leaderboard-insert',
    title: 'Game Leaderboard',
    category: 'Sorting',
    description: 'Keep a top-5 score board sorted as new scores arrive: one insertion step per score, and the lowest score drops off.',
    difficulty: 'Easy',
    source: SortingScripts.LeaderboardInsert,
  },
  {
    id: 'sorting-count-inversions',
    title: 'Count Inversions',
    category: 'Sorting',
    description: 'How unsorted is a ranking? Merge sort counts the out-of-order pairs while it sorts, in O(n log n).',
    difficulty: 'Hard',
    source: SortingScripts.CountInversions,
  },
  {
    id: 'sorting-quickselect-median',
    title: 'Median with Quickselect',
    category: 'Sorting',
    description: 'Find the k-th smallest value (the median delivery time) by partitioning only the side that can hold the answer.',
    difficulty: 'Hard',
    source: SortingScripts.QuickSelectKth,
  },
  {
    id: 'sorting-stable-sort-check',
    title: 'Sorted Check & Stability',
    category: 'Sorting',
    description: 'Check whether an array is already sorted, then sort products by price with a stable insertion sort — equal prices keep their order.',
    difficulty: 'Medium',
    source: SortingScripts.SortCheckAndStability,
  },

  // ── Linked Lists ──────────────────────────────────────────────────────────────
  {
    id: 'linked-list-singly',
    title: 'Singly Linked List',
    category: 'Linked Lists',
    description: 'Traverse with a curr pointer, insert at the head and tail, and delete a node by making its predecessor skip it — then FREE its memory.',
    difficulty: 'Easy',
    source: LinkedListScripts.SinglyLinkedList,
  },
  {
    id: 'linked-list-doubly',
    title: 'Doubly Linked List',
    category: 'Linked Lists',
    description: 'Walk forward with next and backward with prev, insert between two nodes (four pointer updates) and unlink a node in both directions.',
    difficulty: 'Easy',
    source: LinkedListScripts.DoublyLinkedList,
  },
  {
    id: 'linked-list-circular',
    title: 'Circular Linked List',
    category: 'Linked Lists',
    description: 'The tail points back to the head: loop once around the circle, append a node and delete the head while keeping the circle closed.',
    difficulty: 'Easy',
    source: LinkedListScripts.CircularLinkedList,
  },
  {
    id: 'linked-list-reverse',
    title: 'Reverse a Singly Linked List',
    category: 'Linked Lists',
    description: 'The classic in-place reversal: prev, curr and next pointers flip every arrow in one pass, O(n) time and O(1) space.',
    difficulty: 'Medium',
    source: LinkedListScripts.ReverseSinglyLinkedList,
  },
  {
    id: 'linked-list-reverse-doubly',
    title: 'Reverse a Doubly Linked List',
    category: 'Linked Lists',
    description: 'Reverse a doubly linked list by swapping every node\'s prev and next pointers, then verify it in both directions.',
    difficulty: 'Medium',
    source: LinkedListScripts.ReverseDoublyLinkedList,
  },
  {
    id: 'linked-list-reverse-circular',
    title: 'Reverse a Circular Linked List',
    category: 'Linked Lists',
    description: 'Flip every arrow of a circular list, stopping when the walk returns to the first node, then re-close the circle.',
    difficulty: 'Medium',
    source: LinkedListScripts.ReverseCircularLinkedList,
  },
  {
    id: 'linked-list-middle',
    title: 'Find the Middle Node',
    category: 'Linked Lists',
    description: 'Slow and fast pointers: fast moves two nodes for every one slow moves, so slow lands on the middle in a single pass.',
    difficulty: 'Easy',
    source: LinkedListScripts.FindMiddleNode,
  },
  {
    id: 'linked-list-detect-cycle',
    title: 'Detect & Remove a Cycle (Floyd)',
    category: 'Linked Lists',
    description: 'Floyd\'s tortoise and hare detects the cycle, finds the node where it starts, and breaks it.',
    difficulty: 'Hard',
    source: LinkedListScripts.DetectCycleFloyd,
  },
  {
    id: 'linked-list-merge-sorted',
    title: 'Merge Two Sorted Lists',
    category: 'Linked Lists',
    description: 'Walk two sorted lists side by side, always taking the smaller front value, to build one sorted list.',
    difficulty: 'Medium',
    source: LinkedListScripts.MergeTwoSortedLists,
  },
  {
    id: 'linked-list-remove-nth',
    title: 'Remove Nth Node From End',
    category: 'Linked Lists',
    description: 'Two pointers n nodes apart (plus a dummy node) find the nth node from the end in one pass; it is unlinked and freed.',
    difficulty: 'Medium',
    source: LinkedListScripts.RemoveNthFromEnd,
  },
  {
    id: 'linked-list-palindrome',
    title: 'Palindrome Linked List',
    category: 'Linked Lists',
    description: 'Find the middle, reverse the second half in place, compare the halves from both ends, then restore the list.',
    difficulty: 'Hard',
    source: LinkedListScripts.PalindromeLinkedList,
  },
  {
    id: 'linked-list-remove-duplicates',
    title: 'Remove Duplicates (Sorted List)',
    category: 'Linked Lists',
    description: 'Compare each node with its successor; duplicates are unlinked with one pointer write and freed.',
    difficulty: 'Easy',
    source: LinkedListScripts.RemoveDuplicates,
  },

  // ── Trees ─────────────────────────────────────────────────────────────────────
  {
    id: 'tree-basics',
    title: 'Binary Tree Basics',
    category: 'Trees',
    description: 'Build a binary tree node by node with NEW_NODE and left/right pointers, walk its leftmost and rightmost paths with a WHILE loop, then unlink and FREE a leaf.',
    difficulty: 'Easy',
    source: TreeScripts.BinaryTreeBasics,
  },
  {
    id: 'tree-traversals',
    title: 'Preorder, Inorder & Postorder',
    category: 'Trees',
    description: 'Three recursive traversal functions side by side: every call, return and visit is shown, with the call stack growing and shrinking beside the tree.',
    difficulty: 'Easy',
    source: TreeScripts.Traversals,
  },
  {
    id: 'tree-level-order',
    title: 'Level Order Traversal (BFS)',
    category: 'Trees',
    description: 'Breadth-first traversal with a real queue of node pointers: dequeue a node, enqueue its children, and print every level with its sum.',
    difficulty: 'Medium',
    source: TreeScripts.LevelOrder,
  },
  {
    id: 'tree-iterative-inorder',
    title: 'Iterative Inorder with a Stack',
    category: 'Trees',
    description: 'Inorder traversal without recursion: push the left spine onto a stack, pop, visit, go right. On a BST it lists the keys in sorted order.',
    difficulty: 'Medium',
    source: TreeScripts.IterativeInorder,
  },
  {
    id: 'tree-height-size',
    title: 'Height, Size & Leaf Count',
    category: 'Trees',
    description: 'Recursive functions that return values: the height, number of nodes and number of leaves, each computed from the answers of the two subtrees.',
    difficulty: 'Easy',
    source: TreeScripts.HeightSizeLeaves,
  },
  {
    id: 'tree-bst-insert-search',
    title: 'BST Search & Insert',
    category: 'Trees',
    description: 'Search a binary search tree by comparing and going left or right, and insert new keys by walking down with a parent pointer and linking a new node.',
    difficulty: 'Medium',
    source: TreeScripts.BSTSearchInsert,
  },
  {
    id: 'tree-bst-delete',
    title: 'BST Delete (All Three Cases)',
    category: 'Trees',
    description: 'Delete a leaf, a node with one child, and a node with two children (via its inorder successor) with real pointer relinking and FREE.',
    difficulty: 'Hard',
    source: TreeScripts.BSTDelete,
  },
  {
    id: 'tree-validate-bst',
    title: 'Validate a BST',
    category: 'Trees',
    description: 'Check whether a binary tree is a valid BST by passing a (low, high) range down the recursion — and see why comparing only parent and child is not enough.',
    difficulty: 'Medium',
    source: TreeScripts.ValidateBST,
  },
  {
    id: 'tree-lca',
    title: 'Lowest Common Ancestor (BST)',
    category: 'Trees',
    description: 'Find the lowest common ancestor of two keys by walking down from the root until they split to different sides.',
    difficulty: 'Medium',
    source: TreeScripts.LowestCommonAncestor,
  },
  {
    id: 'tree-mirror',
    title: 'Mirror (Invert) a Binary Tree',
    category: 'Trees',
    description: 'Recursively swap the left and right pointers of every node using a temp pointer, and watch the tree flip into its mirror image.',
    difficulty: 'Easy',
    source: TreeScripts.MirrorTree,
  },
  {
    id: 'tree-views',
    title: 'Left & Right Views',
    category: 'Trees',
    description: 'A level-by-level BFS that records the first and last node of every level: what you see looking at the tree from the left and from the right.',
    difficulty: 'Medium',
    source: TreeScripts.TreeViews,
  },
  {
    id: 'tree-path-sum',
    title: 'Root-to-Leaf Path Sum',
    category: 'Trees',
    description: 'Recursively search for a root-to-leaf path whose values add up to a target, subtracting as it goes and highlighting the path it finds.',
    difficulty: 'Medium',
    source: TreeScripts.PathSum,
  },

  // ── Searching ─────────────────────────────────────────────────────────────────
  {
    id: 'searching-linear',
    title: 'Linear Search',
    category: 'Searching',
    description: 'A simple search algorithm that checks every element in the list sequentially until a match is found.',
    difficulty: 'Easy',
    source: SearchingScripts.LinearSearch,
  },
  {
    id: 'searching-binary',
    title: 'Binary Search',
    category: 'Searching',
    description: 'An efficient search algorithm that finds the position of a target value within a sorted array by repeatedly dividing the search interval in half.',
    difficulty: 'Medium',
    source: SearchingScripts.BinarySearch,
  },
  {
    id: 'searching-dfs',
    title: 'Depth-First Search',
    category: 'Searching',
    description: 'An algorithm for traversing or searching tree or graph data structures by exploring as far as possible along each branch before backtracking.',
    difficulty: 'Medium',
    source: SearchingScripts.DFS,
  },
  {
    id: 'searching-bfs',
    title: 'Breadth-First Search',
    category: 'Searching',
    description: 'An algorithm for traversing or searching tree or graph data structures by exploring all neighbor nodes at the present depth prior to moving on to the next depth level.',
    difficulty: 'Medium',
    source: SearchingScripts.BFS,
  },
  {
    id: 'searching-jump',
    title: 'Jump Search',
    category: 'Searching',
    description: 'Searching a sorted array by jumping ahead in fixed-size blocks, then scanning linearly within the right block.',
    difficulty: 'Medium',
    source: SearchingScripts.JumpSearch,
  },
  {
    id: 'searching-exponential',
    title: 'Exponential Search',
    category: 'Searching',
    description: 'Finding a search range by doubling the bound each step, then binary searching within that range.',
    difficulty: 'Medium',
    source: SearchingScripts.ExponentialSearch,
  },
  {
    id: 'searching-ternary',
    title: 'Ternary Search',
    category: 'Searching',
    description: 'Splitting a sorted range into thirds with two midpoints, discarding two-thirds of the range each step.',
    difficulty: 'Hard',
    source: SearchingScripts.TernarySearch,
  },
  {
    id: 'searching-interpolation',
    title: 'Interpolation Search',
    category: 'Searching',
    description: 'Estimating a probe position proportionally to the target value for uniformly-distributed sorted data.',
    difficulty: 'Hard',
    source: SearchingScripts.InterpolationSearch,
  },

  // ── Loops & Control ───────────────────────────────────────────────────────────
  {
    id: 'loops-for',
    title: 'For Loop',
    category: 'Loops & Control',
    description: 'A control flow statement for specifying iteration, which allows code to be executed repeatedly.',
    difficulty: 'Easy',
    source: LoopScripts.ForLoopTest,
  },
  {
    id: 'loops-nested',
    title: 'Nested Loops',
    category: 'Loops & Control',
    description: 'A loop inside another loop, often used to traverse multi-dimensional structures.',
    difficulty: 'Medium',
    source: LoopScripts.NestedLoopTest,
  },
  {
    id: 'loops-sum',
    title: 'Sum of Array Elements',
    category: 'Loops & Control',
    description: 'Accumulating a running total in a scalar variable while looping over an array.',
    difficulty: 'Easy',
    source: LoopScripts.SumOfArrayElements,
  },
  {
    id: 'loops-find-max',
    title: 'Find Maximum in Array',
    category: 'Loops & Control',
    description: 'Tracking the largest value seen so far as a loop scans forward through an array.',
    difficulty: 'Easy',
    source: LoopScripts.FindMaximumInArray,
  },
  {
    id: 'loops-countdown',
    title: 'Countdown Loop',
    category: 'Loops & Control',
    description: 'Visiting array elements in reverse order by indexing from the end inside a forward-counting loop.',
    difficulty: 'Easy',
    source: LoopScripts.CountdownLoop,
  },
  {
    id: 'loops-conditional-filter',
    title: 'Conditional Loop Filtering',
    category: 'Loops & Control',
    description: 'Combining LOOP with IF to act only on the array elements that pass a condition.',
    difficulty: 'Easy',
    source: LoopScripts.ConditionalLoopFiltering,
  },

  // ── Stacks ────────────────────────────────────────────────────────────────────
  {
    id: 'stacks-foundation',
    title: 'Stack Foundation',
    category: 'Stacks',
    description: 'PUSH, POP, PEEK, LENGTH and IS_EMPTY in a loop: values come back out in last-in-first-out order, and a safe pop checks for underflow first.',
    difficulty: 'Easy',
    source: StackScripts.StackFoundation,
  },
  {
    id: 'stacks-using-array',
    title: 'Stack Using an Array',
    category: 'Stacks',
    description: 'How a stack is really built: a fixed-size array plus a top index, with explicit STACK OVERFLOW and STACK UNDERFLOW checks.',
    difficulty: 'Easy',
    source: StackScripts.StackUsingArray,
  },
  {
    id: 'stacks-reverse-array',
    title: 'Reverse an Array',
    category: 'Stacks',
    description: 'Push every element, then pop them back into the array from index 0 — the array ends up reversed in place.',
    difficulty: 'Easy',
    source: StackScripts.ReverseArrayWithStack,
  },
  {
    id: 'stacks-reverse-string',
    title: 'Reverse a String',
    category: 'Stacks',
    description: 'Push each character of a word, then pop them one by one to build the word backwards.',
    difficulty: 'Easy',
    source: StackScripts.ReverseStringWithStack,
  },
  {
    id: 'stacks-palindrome',
    title: 'Palindrome Check',
    category: 'Stacks',
    description: 'Popping reads a word backwards: compare each popped character with the word read forwards, stopping at the first mismatch.',
    difficulty: 'Easy',
    source: StackScripts.PalindromeCheck,
  },
  {
    id: 'stacks-balanced-parens',
    title: 'Balanced Parentheses',
    category: 'Stacks',
    description: 'Push every opening bracket; every closing bracket must match the top. Detects mismatches, stray closers and unclosed brackets.',
    difficulty: 'Medium',
    source: StackScripts.BalancedParentheses,
  },
  {
    id: 'stacks-postfix-evaluation',
    title: 'Evaluate Postfix Expression',
    category: 'Stacks',
    description: 'A calculator’s stack: push numbers, and on each operator pop two operands, compute, and push the result. Rejects invalid expressions.',
    difficulty: 'Medium',
    source: StackScripts.EvaluatePostfixExpression,
  },
  {
    id: 'stacks-infix-to-postfix',
    title: 'Infix to Postfix',
    category: 'Stacks',
    description: 'The Shunting-Yard algorithm: an operator stack plus a precedence function turns A * ( B + C ) - D / E into A B C + * D E / -.',
    difficulty: 'Hard',
    source: StackScripts.InfixToPostfix,
  },
  {
    id: 'stacks-next-greater-element',
    title: 'Next Greater Element',
    category: 'Stacks',
    description: 'The monotonic-stack pattern: a stack of waiting indexes answers every element’s next greater value in O(n).',
    difficulty: 'Hard',
    source: StackScripts.NextGreaterElement,
  },
  {
    id: 'stacks-stock-span',
    title: 'Stock Span',
    category: 'Stacks',
    description: 'For each day, how many consecutive days had a price no higher than today — computed with a stack of higher-price days.',
    difficulty: 'Hard',
    source: StackScripts.StockSpan,
  },
  {
    id: 'stacks-min-stack',
    title: 'Min Stack',
    category: 'Stacks',
    description: 'A second stack keeps the current minimum on its top, so the minimum is known in O(1) after every push and pop.',
    difficulty: 'Medium',
    source: StackScripts.MinStack,
  },
  {
    id: 'stacks-sort-stack',
    title: 'Sort a Stack',
    category: 'Stacks',
    description: 'Sort using only one extra stack: bigger values are moved back out of the way so the sorted stack stays in order.',
    difficulty: 'Medium',
    source: StackScripts.SortStack,
  },
  {
    id: 'stacks-decimal-to-binary',
    title: 'Decimal to Binary',
    category: 'Stacks',
    description: 'Repeated division by 2 gives the digits last-first; a stack puts them back in the right order. Works for any base 2–10.',
    difficulty: 'Easy',
    source: StackScripts.DecimalToBinary,
  },
  {
    id: 'stacks-undo-redo',
    title: 'Undo / Redo',
    category: 'Stacks',
    description: 'How a text editor’s Undo and Redo buttons work: two stacks, and a new edit clears the redo history.',
    difficulty: 'Medium',
    source: StackScripts.UndoRedo,
  },
  {
    id: 'stacks-factorial',
    title: 'Recursion as a Stack',
    category: 'Stacks',
    description: 'Factorial computed the way the call stack does it: push the waiting calls, then pop them and multiply as each one returns.',
    difficulty: 'Medium',
    source: StackScripts.FactorialWithStack,
  },

  // ── Queues ────────────────────────────────────────────────────────────────────
  {
    id: 'queues-foundation',
    title: 'Queue Foundation',
    category: 'Queues',
    description: 'FIFO in action: enqueue a batch at the rear, read FRONT and REAR, dequeue until empty, and guard against QUEUE UNDERFLOW with IS_EMPTY.',
    difficulty: 'Easy',
    source: QueueScripts.QueueFoundation,
  },
  {
    id: 'queues-using-array',
    title: 'Queue Using an Array',
    category: 'Queues',
    description: 'How a linear queue is really built: a fixed array with front and rear indexes, explicit OVERFLOW / UNDERFLOW checks — and the wasted slots it leaves behind.',
    difficulty: 'Easy',
    source: QueueScripts.QueueUsingArray,
  },
  {
    id: 'queues-circular',
    title: 'Circular Queue',
    category: 'Queues',
    description: 'The fix for the linear queue: front and rear wrap around with (index + 1) % capacity, so freed slots are reused.',
    difficulty: 'Medium',
    source: QueueScripts.CircularQueue,
  },
  {
    id: 'queues-bank-teller',
    title: 'Bank Teller Simulation',
    category: 'Queues',
    description: 'Customers arrive minute by minute and wait in line for one teller; computes every customer’s waiting time and the average.',
    difficulty: 'Medium',
    source: QueueScripts.BankTellerSimulation,
  },
  {
    id: 'queues-round-robin',
    title: 'Round Robin CPU Scheduling',
    category: 'Queues',
    description: 'An operating system’s ready queue: each process runs for one time quantum and goes back to the rear until done. Computes completion and waiting times.',
    difficulty: 'Medium',
    source: QueueScripts.RoundRobinScheduling,
  },
  {
    id: 'queues-generate-binary',
    title: 'Generate Binary Numbers',
    category: 'Queues',
    description: 'Dequeue a number, enqueue it with "0" and "1" appended: the queue produces 1, 10, 11, 100, … in increasing order.',
    difficulty: 'Easy',
    source: QueueScripts.GenerateBinaryNumbers,
  },
  {
    id: 'queues-reverse-with-stack',
    title: 'Reverse a Queue',
    category: 'Queues',
    description: 'FIFO in, LIFO out: draining a queue through a stack and back reverses its order.',
    difficulty: 'Easy',
    source: QueueScripts.ReverseQueueWithStack,
  },
  {
    id: 'queues-reverse-first-k',
    title: 'Reverse the First K Elements',
    category: 'Queues',
    description: 'Reverse only the first k elements with a stack, then rotate the rest behind them. Rejects an invalid k.',
    difficulty: 'Medium',
    source: QueueScripts.ReverseFirstK,
  },
  {
    id: 'queues-interleave',
    title: 'Interleave Two Halves',
    category: 'Queues',
    description: 'Shuffle like a deck of cards: move the first half to a second queue, then take one element from each in turn.',
    difficulty: 'Medium',
    source: QueueScripts.InterleaveHalves,
  },
  {
    id: 'queues-using-two-stacks',
    title: 'Queue Using Two Stacks',
    category: 'Queues',
    description: 'A FIFO queue from two LIFO stacks, driven by a list of operations: the outbox is refilled from the inbox only when it runs dry.',
    difficulty: 'Hard',
    source: QueueScripts.QueueUsingTwoStacks,
  },
  {
    id: 'queues-hot-potato',
    title: 'Hot Potato (Josephus)',
    category: 'Queues',
    description: 'Players in a circle pass a potato: rotate the queue k times and eliminate whoever holds it, until one winner is left.',
    difficulty: 'Medium',
    source: QueueScripts.HotPotato,
  },
  {
    id: 'queues-moving-average',
    title: 'Moving Average of a Sensor',
    category: 'Queues',
    description: 'A sliding window of the last k readings: enqueue the newest, dequeue the oldest, and keep a running sum for O(1) averages.',
    difficulty: 'Medium',
    source: QueueScripts.MovingAverage,
  },
  {
    id: 'queues-first-non-repeating',
    title: 'First Non-Repeating Character',
    category: 'Queues',
    description: 'For a stream of characters, report the first one seen only once after every arrival; repeated candidates leave the queue’s front.',
    difficulty: 'Hard',
    source: QueueScripts.FirstNonRepeating,
  },

  // ── Graphs ────────────────────────────────────────────────────────────────────
  {
    id: 'graphs-basics',
    title: 'Graph Basics: Friends Network',
    category: 'Graphs',
    description: 'Vertices, edges and adjacency lists. Loop over every person with VERTEX_AT and over their friends with NEIGHBOR, find the most connected one, test HAS_EDGE, then change the graph with ADD_EDGE / ADD_VERTEX / REMOVE_EDGE and check the handshake lemma.',
    difficulty: 'Easy',
    source: GraphScripts.GraphBasics,
  },
  {
    id: 'graphs-directed-weighted',
    title: 'Directed & Weighted: Flight Routes',
    category: 'Graphs',
    description: 'One-way flights with durations as edge weights: departures per airport, in-degree vs out-degree, the busiest airport, why HAS_EDGE depends on direction, and a walk over the edge list with EDGE_AT.',
    difficulty: 'Easy',
    source: GraphScripts.DirectedWeighted,
  },
  {
    id: 'graphs-adjacency-matrix',
    title: 'Adjacency Matrix vs List',
    category: 'Graphs',
    description: 'Build the V x V adjacency matrix of a graph row by row with two nested loops and HAS_EDGE, and compare its size with the adjacency list.',
    difficulty: 'Easy',
    source: GraphScripts.AdjacencyMatrix,
  },
  {
    id: 'graphs-bfs',
    title: 'Breadth-First Search: Degrees of Separation',
    category: 'Graphs',
    description: 'BFS with a real queue of vertices and visited marks. Every person gets a dist (steps from the start) and a parent, the network is printed ring by ring, and unreachable people are reported.',
    difficulty: 'Medium',
    source: GraphScripts.BreadthFirstSearch,
  },
  {
    id: 'graphs-bfs-shortest-path',
    title: 'Fewest Metro Stops (BFS Path)',
    category: 'Graphs',
    description: 'BFS stops as soon as it reaches the goal station; the route is rebuilt by following parent fields back and reversed with a stack.',
    difficulty: 'Medium',
    source: GraphScripts.ShortestPathBFS,
  },
  {
    id: 'graphs-dfs',
    title: 'Depth-First Search: Maze Explorer',
    category: 'Graphs',
    description: 'Iterative DFS with an explicit stack: rooms are explored one corridor at a time, neighbours pushed in reverse so they are visited in list order.',
    difficulty: 'Medium',
    source: GraphScripts.DepthFirstSearch,
  },
  {
    id: 'graphs-dfs-recursive',
    title: 'Recursive DFS: Web Crawler',
    category: 'Graphs',
    description: 'A recursive crawl over a directed graph of web pages. Every call and return is a step, waiting calls show in purple, the function RETURNS how many pages it found, and orphan pages are detected.',
    difficulty: 'Medium',
    source: GraphScripts.RecursiveDFS,
  },
  {
    id: 'graphs-components',
    title: 'Connected Components: Office LAN',
    category: 'Graphs',
    description: 'Loop over all vertices and start a stack-based DFS from each unvisited one; every network of computers gets its own group number and colour.',
    difficulty: 'Medium',
    source: GraphScripts.ConnectedComponents,
  },
  {
    id: 'graphs-cycle-undirected',
    title: 'Cycle Detection (Undirected)',
    category: 'Graphs',
    description: 'A recursive DFS that remembers where it came from finds a loop in a pipe network — first none (the network is a tree with V - 1 edges), then one after ADD_EDGE.',
    difficulty: 'Medium',
    source: GraphScripts.UndirectedCycle,
  },
  {
    id: 'graphs-cycle-directed',
    title: 'Cycle Detection (Directed): Course Prerequisites',
    category: 'Graphs',
    description: 'WHITE / GRAY / BLACK colouring with recursion finds a circular prerequisite chain and prints the exact cycle by following parent fields.',
    difficulty: 'Hard',
    source: GraphScripts.DirectedCycle,
  },
  {
    id: 'graphs-bipartite',
    title: 'Bipartite Check: Two Teams',
    category: 'Graphs',
    description: 'BFS 2-colouring splits rivals into two teams; after a new rivalry forms a triangle (an odd cycle) the same function reports the conflict.',
    difficulty: 'Hard',
    source: GraphScripts.BipartiteCheck,
  },
  {
    id: 'graphs-topo-kahn',
    title: 'Topological Sort (Kahn\'s): Course Schedule',
    category: 'Graphs',
    description: 'Kahn\'s algorithm with IN_DEGREE counts and a queue of courses whose prerequisites are all done; also checks for a cycle.',
    difficulty: 'Medium',
    source: GraphScripts.TopologicalSortKahn,
  },
  {
    id: 'graphs-topo-dfs',
    title: 'Topological Sort (DFS): Getting Dressed',
    category: 'Graphs',
    description: 'Recursive DFS pushes each item on a stack when it finishes; popping the stack gives a valid dressing order.',
    difficulty: 'Medium',
    source: GraphScripts.TopologicalSortDFS,
  },
  {
    id: 'graphs-dijkstra',
    title: 'Dijkstra\'s Shortest Path: Delivery Route',
    category: 'Graphs',
    description: 'Dijkstra\'s algorithm written out: dist = INFINITY, a loop that picks the closest unfinished place, edge relaxation with WEIGHT, and the route rebuilt from parent fields.',
    difficulty: 'Hard',
    source: GraphScripts.DijkstraShortestPath,
  },
  {
    id: 'graphs-bellman-ford',
    title: 'Bellman-Ford: Drone Battery (Negative Weights)',
    category: 'Graphs',
    description: 'Relax every edge (EDGE_AT) in rounds and watch the distances improve, with a negative-weight edge; an extra round checks for a negative cycle.',
    difficulty: 'Hard',
    source: GraphScripts.BellmanFordAlgorithm,
  },
  {
    id: 'graphs-prim',
    title: 'Prim\'s MST: Fibre Between Offices',
    category: 'Graphs',
    description: 'Prim\'s algorithm with key and parent fields grows the minimum spanning tree from one office; tree edges turn green as they are chosen.',
    difficulty: 'Hard',
    source: GraphScripts.PrimsMST,
  },
  {
    id: 'graphs-kruskal',
    title: 'Kruskal\'s MST: Village Roads',
    category: 'Graphs',
    description: 'Kruskal\'s algorithm takes roads cheapest-first and uses union-find (leader pointers and a findLeader function) to reject roads that would close a cycle.',
    difficulty: 'Hard',
    source: GraphScripts.KruskalsMST,
  },
  {
    id: 'graphs-all-paths',
    title: 'All Routes: Backtracking',
    category: 'Graphs',
    description: 'A recursive search lists every route from Home to School without revisiting a place, marking and un-marking vertices as it backtracks.',
    difficulty: 'Hard',
    source: GraphScripts.CountAllPaths,
  },
  {
    id: 'graphs-coloring',
    title: 'Greedy Colouring: Exam Timetable',
    category: 'Graphs',
    description: 'Give each exam the lowest time slot none of its conflicting exams uses; each slot is painted its own colour.',
    difficulty: 'Medium',
    source: GraphScripts.GreedyColoring,
  },

  // ── Heaps ─────────────────────────────────────────────────────────────────────
  {
    id: 'heaps-insertion',
    title: 'Heap Insertion',
    category: 'Heaps',
    description: 'Inserting a value into a min-heap and sifting it upward to restore the heap property.',
    difficulty: 'Medium',
    source: HeapScripts.HeapInsertion,
  },
  {
    id: 'heaps-extract-min',
    title: 'Extract Minimum',
    category: 'Heaps',
    description: 'Removing the root (minimum) of a min-heap and sifting the replacement value back down.',
    difficulty: 'Medium',
    source: HeapScripts.HeapExtractMin,
  },
  {
    id: 'heaps-decrease-key',
    title: 'Decrease Key',
    category: 'Heaps',
    description: 'Lowering a value at a given heap index and sifting it upward, the primitive behind Dijkstra’s algorithm.',
    difficulty: 'Medium',
    source: HeapScripts.HeapDecreaseKey,
  },
  {
    id: 'heaps-build-heap',
    title: 'Build Heap from Array',
    category: 'Heaps',
    description: 'Converting an arbitrary array into a valid heap in-place by heapifying every non-leaf node bottom-up.',
    difficulty: 'Hard',
    source: HeapScripts.BuildHeapFromArray,
  },
  {
    id: 'heaps-heapify',
    title: 'Heapify a Node',
    category: 'Heaps',
    description: 'Restoring the heap property downward from a given node, the core primitive of heap operations.',
    difficulty: 'Medium',
    source: HeapScripts.HeapifySingleNode,
  },

  // ── Hash Maps ─────────────────────────────────────────────────────────────────
  {
    id: 'hashmaps-foundation',
    title: 'Hash Map Foundation',
    category: 'Hash Maps',
    description: 'Core hash map operations: insert, lookup, and delete key/value pairs.',
    difficulty: 'Easy',
    source: HashMapScripts.HashMapFoundation,
  },
  {
    id: 'hashmaps-word-frequency',
    title: 'Word Frequency Counter',
    category: 'Hash Maps',
    description: 'Counting occurrences of words in a sentence using a hash map keyed by word.',
    difficulty: 'Easy',
    source: HashMapScripts.WordFrequencyCounter,
  },
  {
    id: 'hashmaps-two-sum',
    title: 'Two Sum Using a Hash Map',
    category: 'Hash Maps',
    description: 'Finding a pair of numbers that sum to a target in one pass by remembering complements in a hash map.',
    difficulty: 'Medium',
    source: HashMapScripts.TwoSumUsingHashMap,
  },
  {
    id: 'hashmaps-duplicate-detection',
    title: 'Duplicate Detection',
    category: 'Hash Maps',
    description: 'Detecting a duplicate value in an array in one pass using a hash map as a seen-set.',
    difficulty: 'Easy',
    source: HashMapScripts.DuplicateDetection,
  },

  // ── Tries ─────────────────────────────────────────────────────────────────────
  {
    id: 'tries-foundation',
    title: 'Trie Foundation',
    category: 'Tries',
    description: 'Core trie operations: inserting words and searching for exact matches along shared prefix paths.',
    difficulty: 'Medium',
    source: TrieScripts.TrieFoundation,
  },
  {
    id: 'tries-autocomplete',
    title: 'Autocomplete Suggestions',
    category: 'Tries',
    description: 'Listing every stored word that begins with a given prefix, the classic trie autocomplete use case.',
    difficulty: 'Medium',
    source: TrieScripts.AutocompleteSuggestions,
  },
  {
    id: 'tries-prefix-search',
    title: 'Prefix Search',
    category: 'Tries',
    description: 'Checking whether any stored word shares a given prefix, without requiring the prefix to be a full word.',
    difficulty: 'Easy',
    source: TrieScripts.PrefixSearch,
  },
  {
    id: 'tries-delete-word',
    title: 'Delete Word from Trie',
    category: 'Tries',
    description: 'Removing a word from a trie while pruning only the nodes not shared by other stored words.',
    difficulty: 'Medium',
    source: TrieScripts.DeleteWordFromTrie,
  },
  {
    id: 'tries-contact-book',
    title: 'Contact Book Lookup',
    category: 'Tries',
    description: 'Simulating type-ahead contact search by combining prefix checks and autocomplete on a trie.',
    difficulty: 'Medium',
    source: TrieScripts.ContactBookLookup,
  },

  // ── Recursion & Functions ─────────────────────────────────────────────────────
  {
    id: 'recursion-factorial',
    title: 'Factorial (Recursive)',
    category: 'Recursion & Functions',
    description: 'Computing a factorial by having a function call itself with a smaller input until a base case is reached.',
    difficulty: 'Easy',
    source: RecursionScripts.FactorialRecursion,
  },
  {
    id: 'recursion-fibonacci',
    title: 'Fibonacci (Recursive)',
    category: 'Recursion & Functions',
    description: 'Computing a Fibonacci number via the classic exponential double-recursion.',
    difficulty: 'Medium',
    source: RecursionScripts.FibonacciRecursion,
  },
  {
    id: 'recursion-array-sum',
    title: 'Recursive Array Sum',
    category: 'Recursion & Functions',
    description: 'Summing every element of an array using a function that recurses one index at a time.',
    difficulty: 'Easy',
    source: RecursionScripts.RecursiveArraySum,
  },
  {
    id: 'recursion-power',
    title: 'Power by Recursion',
    category: 'Recursion & Functions',
    description: 'Computing an exponent by repeated recursive multiplication.',
    difficulty: 'Easy',
    source: RecursionScripts.PowerByRecursion,
  },
  {
    id: 'recursion-gcd',
    title: 'GCD by Recursion',
    category: 'Recursion & Functions',
    description: 'Computing the greatest common divisor using the subtraction-based Euclidean algorithm.',
    difficulty: 'Medium',
    source: RecursionScripts.GCDByRecursion,
  },
  {
    id: 'recursion-palindrome-check',
    title: 'Palindrome Check (Recursive)',
    category: 'Recursion & Functions',
    description: 'Checking whether a sequence is a palindrome by recursively comparing its outer elements inward.',
    difficulty: 'Medium',
    source: RecursionScripts.PalindromeCheckRecursion,
  },
  {
    id: 'recursion-linear-search',
    title: 'Recursive Linear Search',
    category: 'Recursion & Functions',
    description: 'Searching an array for a target value using a function that recurses one index at a time.',
    difficulty: 'Easy',
    source: RecursionScripts.RecursiveLinearSearch,
  },
];

// ── Derived helpers ────────────────────────────────────────────────────────────

/** Ordered list of all distinct categories (preserves insertion order). */
export const EXAMPLE_CATEGORIES: ExampleCategory[] = [
  ...new Set(EXAMPLES.map(e => e.category)),
] as ExampleCategory[];

/** Look up a single example by its stable id. */
export function getExampleById(id: string): Example | undefined {
  return EXAMPLES.find(e => e.id === id);
}

/** All examples belonging to a given category. */
export function getExamplesByCategory(category: ExampleCategory): Example[] {
  return EXAMPLES.filter(e => e.category === category);
}
