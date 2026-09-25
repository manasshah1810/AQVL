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
import { BSTExamples }       from './BSTLibrary';
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
    description: 'A simple sorting algorithm that repeatedly steps through the list, compares adjacent elements and swaps them if they are in the wrong order.',
    difficulty: 'Easy',
    source: SortingScripts.BubbleSort,
  },
  {
    id: 'sorting-selection-sort',
    title: 'Selection Sort',
    category: 'Sorting',
    description: 'An in-place comparison sorting algorithm that divides the input list into two parts: a sorted sublist and an unsorted sublist.',
    difficulty: 'Easy',
    source: SortingScripts.SelectionSort,
  },
  {
    id: 'sorting-insertion-sort',
    title: 'Insertion Sort',
    category: 'Sorting',
    description: 'A simple sorting algorithm that builds the final sorted array one item at a time by inserting elements into their correct position.',
    difficulty: 'Medium',
    source: SortingScripts.InsertionSort,
  },
  {
    id: 'sorting-quick-sort',
    title: 'Quick Sort',
    category: 'Sorting',
    description: 'An efficient, divide-and-conquer sorting algorithm that selects a pivot and partitions the other elements into two sub-arrays.',
    difficulty: 'Hard',
    source: SortingScripts.QuickSort,
  },
  {
    id: 'sorting-merge-sort',
    title: 'Merge Sort',
    category: 'Sorting',
    description: 'A classic divide-and-conquer algorithm that recursively divides an array into halves, sorts them, and merges them back together.',
    difficulty: 'Medium',
    source: SortingScripts.MergeSort,
  },
  {
    id: 'sorting-bubble-sort-builtin',
    title: 'Bubble Sort (Built-in)',
    category: 'Sorting',
    description: 'Running bubble sort with the one-shot BUBBLE_SORT keyword, which animates the whole algorithm automatically.',
    difficulty: 'Easy',
    source: SortingScripts.BubbleSortBuiltin,
  },
  {
    id: 'sorting-selection-sort-builtin',
    title: 'Selection Sort (Built-in)',
    category: 'Sorting',
    description: 'Running selection sort with the one-shot SELECTION_SORT keyword.',
    difficulty: 'Easy',
    source: SortingScripts.SelectionSortBuiltin,
  },
  {
    id: 'sorting-insertion-sort-builtin',
    title: 'Insertion Sort (Built-in)',
    category: 'Sorting',
    description: 'Running insertion sort with the one-shot INSERTION_SORT keyword.',
    difficulty: 'Easy',
    source: SortingScripts.InsertionSortBuiltin,
  },
  {
    id: 'sorting-merge-sort-builtin',
    title: 'Merge Sort (Built-in)',
    category: 'Sorting',
    description: 'Running the true recursive merge sort with the one-shot MERGE_SORT keyword.',
    difficulty: 'Medium',
    source: SortingScripts.MergeSortBuiltin,
  },
  {
    id: 'sorting-quick-sort-builtin',
    title: 'Quick Sort (Built-in)',
    category: 'Sorting',
    description: 'Running the true recursive partition-based quicksort with the one-shot QUICK_SORT keyword.',
    difficulty: 'Medium',
    source: SortingScripts.QuickSortBuiltin,
  },
  {
    id: 'sorting-shell-sort',
    title: 'Shell Sort',
    category: 'Sorting',
    description: 'A generalized insertion sort that compares elements a shrinking "gap" apart to move them into place faster.',
    difficulty: 'Hard',
    source: SortingScripts.ShellSort,
  },
  {
    id: 'sorting-counting-sort',
    title: 'Counting Sort',
    category: 'Sorting',
    description: 'A non-comparison sort that tallies occurrences of each value in a counts array, then reads them back in order.',
    difficulty: 'Medium',
    source: SortingScripts.CountingSort,
  },
  {
    id: 'sorting-cycle-sort',
    title: 'Cycle Sort',
    category: 'Sorting',
    description: 'A write-minimizing sort that moves each element directly to its final sorted position in cycles of swaps.',
    difficulty: 'Hard',
    source: SortingScripts.CycleSort,
  },

  // ── Linked Lists ──────────────────────────────────────────────────────────────
  {
    id: 'linked-list-singly',
    title: 'Singly Linked List',
    category: 'Linked Lists',
    description: 'A linear data structure where elements are not stored in contiguous memory locations, but linked using pointers.',
    difficulty: 'Easy',
    source: LinkedListScripts.PointerArchitecture,
  },
  {
    id: 'linked-list-doubly',
    title: 'Doubly Linked List',
    category: 'Linked Lists',
    description: 'A linked list in which each node contains a pointer to the next node as well as the previous node.',
    difficulty: 'Medium',
    source: LinkedListScripts.DoublyLinkedList,
  },
  {
    id: 'linked-list-circular',
    title: 'Circular Linked List',
    category: 'Linked Lists',
    description: 'A linked list where all nodes are connected to form a circle, and the last node points back to the first node.',
    difficulty: 'Medium',
    source: LinkedListScripts.CircularLinkedList,
  },
  {
    id: 'linked-list-reverse',
    title: 'Reverse Linked List',
    category: 'Linked Lists',
    description: 'An iterative algorithm to reverse a singly linked list in place using prev, curr, and next pointers.',
    difficulty: 'Medium',
    source: LinkedListScripts.ReverseLinkedList,
  },
  {
    id: 'linked-list-reverse-singly-manual',
    title: 'Reverse Singly (Manual)',
    category: 'Linked Lists',
    description: 'Reverses a singly linked list the long way by manually moving nodes one-by-one.',
    difficulty: 'Medium',
    source: LinkedListScripts.ReverseSinglyManual,
  },
  {
    id: 'linked-list-reverse-doubly-manual',
    title: 'Reverse Doubly (Manual)',
    category: 'Linked Lists',
    description: 'Reverses a doubly linked list the long way by manually moving nodes one-by-one.',
    difficulty: 'Medium',
    source: LinkedListScripts.ReverseDoublyManual,
  },
  {
    id: 'linked-list-reverse-circular-manual',
    title: 'Reverse Circular (Manual)',
    category: 'Linked Lists',
    description: 'Reverses a circular linked list the long way by manually moving nodes one-by-one.',
    difficulty: 'Medium',
    source: LinkedListScripts.ReverseCircularManual,
  },
  {
    id: 'linked-list-middle',
    title: 'Find Middle Node',
    category: 'Linked Lists',
    description: 'Finds the middle of a linked list in one pass using the fast and slow pointer (tortoise and hare) technique.',
    difficulty: 'Easy',
    source: LinkedListScripts.FindMiddleNode,
  },
  {
    id: 'linked-list-detect-cycle',
    title: 'Detect Cycle (Floyd’s)',
    category: 'Linked Lists',
    description: 'Detecting a cycle in a linked list using Floyd’s tortoise-and-hare two-pointer technique.',
    difficulty: 'Medium',
    source: LinkedListScripts.DetectCycleFloyd,
  },
  {
    id: 'linked-list-merge-sorted',
    title: 'Merge Two Sorted Lists',
    category: 'Linked Lists',
    description: 'Merging two sorted linked lists into a single sorted list by always taking the smaller head.',
    difficulty: 'Medium',
    source: LinkedListScripts.MergeTwoSortedLinkedLists,
  },
  {
    id: 'linked-list-remove-nth',
    title: 'Remove Nth From End',
    category: 'Linked Lists',
    description: 'Locating the Nth node from the end of a list in one pass using two pointers spaced N apart.',
    difficulty: 'Medium',
    source: LinkedListScripts.RemoveNthFromEnd,
  },
  {
    id: 'linked-list-palindrome',
    title: 'Palindrome Linked List',
    category: 'Linked Lists',
    description: 'Checking whether a linked list reads the same forwards and backwards by comparing inward from both ends.',
    difficulty: 'Medium',
    source: LinkedListScripts.PalindromeLinkedList,
  },

  // ── Trees ─────────────────────────────────────────────────────────────────────
  {
    id: 'tree-basic-operations',
    title: 'General Trees',
    category: 'Trees',
    description: 'Core general tree operations including node creation, children assignment, traversals, and querying.',
    difficulty: 'Medium',
    source: TreeScripts.BasicTree,
  },
  {
    id: 'tree-binary-tree',
    title: 'Binary Trees',
    category: 'Trees',
    description: 'A hierarchical binary tree structure supporting left/right child relationships and tree traversals.',
    difficulty: 'Medium',
    source: TreeScripts.BinaryTree,
  },
  {
    id: 'tree-bst-insertion',
    title: 'BST Insertion',
    category: 'Trees',
    description: 'Step-by-step insertion of nodes into a Binary Search Tree, maintaining the left-less, right-greater property.',
    difficulty: 'Medium',
    source: TreeScripts.BinarySearchTreeInsertion,
  },
  {
    id: 'tree-lca',
    title: 'Lowest Common Ancestor',
    category: 'Trees',
    description: 'Find the Lowest Common Ancestor (LCA) of two nodes in a Binary Search Tree by traversing downwards.',
    difficulty: 'Hard',
    source: TreeScripts.LowestCommonAncestor,
  },
  {
    id: 'tree-bst-operations',
    title: 'BST Operations',
    category: 'Trees',
    description: 'Interactive Binary Search Tree operations including INSERT, DELETE (all 3 cases), SEARCH, and CLEAR with smooth 3D animations.',
    difficulty: 'Medium',
    source: BSTExamples.bst_operations,
  },
  {
    id: 'tree-bst-traversals',
    title: 'BST Traversals & Queries',
    category: 'Trees',
    description: 'Visualizes all standard Binary Search Tree traversals (Inorder, Preorder, Postorder, Levelorder) and query operations.',
    difficulty: 'Medium',
    source: BSTExamples.bst_traversals_and_queries,
  },
  {
    id: 'tree-mirror',
    title: 'Mirror Binary Tree',
    category: 'Trees',
    description: 'Recursively swapping the left and right children of every node to produce the mirror image of a tree.',
    difficulty: 'Medium',
    source: TreeScripts.MirrorBinaryTree,
  },
  {
    id: 'tree-views',
    title: 'Left & Right Tree Views',
    category: 'Trees',
    description: 'Visualizing which nodes are visible when looking at a binary tree from the left side and from the right side.',
    difficulty: 'Medium',
    source: TreeScripts.TreeViews,
  },
  {
    id: 'tree-boundary-vertical',
    title: 'Boundary & Vertical Traversal',
    category: 'Trees',
    description: 'Tracing the outer boundary of a tree and grouping its nodes by horizontal distance from the root.',
    difficulty: 'Hard',
    source: TreeScripts.BoundaryAndVerticalTraversal,
  },
  {
    id: 'tree-bst-deletion-cases',
    title: 'BST Deletion (All Cases)',
    category: 'Trees',
    description: 'Deleting a leaf node, a node with one child, and a node with two children from a Binary Search Tree.',
    difficulty: 'Hard',
    source: TreeScripts.BSTDeletionCases,
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
    description: 'Core stack operations: push, pop, and peek, demonstrating last-in-first-out (LIFO) order.',
    difficulty: 'Easy',
    source: StackScripts.StackFoundation,
  },
  {
    id: 'stacks-balanced-parens',
    title: 'Balanced Parentheses',
    category: 'Stacks',
    description: 'Checking whether brackets in an expression are balanced by pushing on opens and popping on closes.',
    difficulty: 'Easy',
    source: StackScripts.BalancedParentheses,
  },
  {
    id: 'stacks-reverse-string',
    title: 'Reverse a String',
    category: 'Stacks',
    description: 'Reversing a sequence of characters by pushing them all onto a stack, then popping them back off.',
    difficulty: 'Easy',
    source: StackScripts.ReverseStringWithStack,
  },
  {
    id: 'stacks-reverse-array',
    title: 'Reverse an Array',
    category: 'Stacks',
    description: 'Using a stack’s LIFO order to reverse the elements of an array.',
    difficulty: 'Easy',
    source: StackScripts.ReverseArrayWithStack,
  },
  {
    id: 'stacks-next-greater-element',
    title: 'Next Greater Element',
    category: 'Stacks',
    description: 'The classic monotonic-stack pattern for finding the next greater element for every array entry.',
    difficulty: 'Hard',
    source: StackScripts.NextGreaterElement,
  },
  {
    id: 'stacks-postfix-evaluation',
    title: 'Evaluate Postfix Expression',
    category: 'Stacks',
    description: 'Evaluating a postfix (Reverse Polish) arithmetic expression using a single operand stack.',
    difficulty: 'Medium',
    source: StackScripts.EvaluatePostfixExpression,
  },

  // ── Queues ────────────────────────────────────────────────────────────────────
  {
    id: 'queues-foundation',
    title: 'Queue Foundation',
    category: 'Queues',
    description: 'Core queue operations: enqueue, dequeue, front, and rear, demonstrating first-in-first-out (FIFO) order.',
    difficulty: 'Easy',
    source: QueueScripts.QueueFoundation,
  },
  {
    id: 'queues-circular',
    title: 'Circular Queue Simulation',
    category: 'Queues',
    description: 'Reusing freed slots at the front of a queue as new items are enqueued at the rear.',
    difficulty: 'Medium',
    source: QueueScripts.CircularQueueSimulation,
  },
  {
    id: 'queues-generate-binary',
    title: 'Generate Binary Numbers',
    category: 'Queues',
    description: 'Using a queue to generate binary representations of 1..n by appending 0 and 1 to each dequeued value.',
    difficulty: 'Medium',
    source: QueueScripts.GenerateBinaryNumbers,
  },
  {
    id: 'queues-reverse-with-stack',
    title: 'Reverse a Queue',
    category: 'Queues',
    description: 'Reversing the order of a queue’s elements by draining it through an auxiliary stack.',
    difficulty: 'Medium',
    source: QueueScripts.ReverseQueueWithStack,
  },
  {
    id: 'queues-round-robin',
    title: 'Round Robin Scheduling',
    category: 'Queues',
    description: 'Simulating round-robin CPU scheduling by cycling processes through a queue one time slice at a time.',
    difficulty: 'Medium',
    source: QueueScripts.RoundRobinScheduling,
  },
  {
    id: 'queues-using-two-stacks',
    title: 'Queue Using Two Stacks',
    category: 'Queues',
    description: 'Implementing FIFO queue behavior entirely out of two LIFO stacks.',
    difficulty: 'Hard',
    source: QueueScripts.QueueUsingTwoStacks,
  },

  // ── Graphs ────────────────────────────────────────────────────────────────────
  {
    id: 'graphs-dfs',
    title: 'Depth-First Search',
    category: 'Graphs',
    description: 'Traversing a graph by exploring as far as possible along each branch before backtracking.',
    difficulty: 'Medium',
    source: GraphScripts.DepthFirstSearch,
  },
  {
    id: 'graphs-bfs',
    title: 'Breadth-First Search',
    category: 'Graphs',
    description: 'Traversing a graph level by level, visiting all neighbors before moving further out.',
    difficulty: 'Medium',
    source: GraphScripts.BreadthFirstSearch,
  },
  {
    id: 'graphs-dijkstra',
    title: "Dijkstra's Shortest Path",
    category: 'Graphs',
    description: 'Finding the shortest path from a source vertex to every other vertex with non-negative edge weights.',
    difficulty: 'Hard',
    source: GraphScripts.DijkstraShortestPath,
  },
  {
    id: 'graphs-bellman-ford',
    title: 'Bellman-Ford Algorithm',
    category: 'Graphs',
    description: 'Computing shortest paths from a source vertex while tolerating negative edge weights and detecting negative cycles.',
    difficulty: 'Hard',
    source: GraphScripts.BellmanFordAlgorithm,
  },
  {
    id: 'graphs-astar',
    title: 'A* Search',
    category: 'Graphs',
    description: 'Heuristic-guided shortest path search from a start vertex to a specific goal vertex.',
    difficulty: 'Hard',
    source: GraphScripts.AStarSearch,
  },
  {
    id: 'graphs-prim',
    title: "Prim's Minimum Spanning Tree",
    category: 'Graphs',
    description: 'Growing a minimum spanning tree outward from a start vertex, always adding the cheapest connecting edge.',
    difficulty: 'Hard',
    source: GraphScripts.PrimsMST,
  },
  {
    id: 'graphs-kruskal',
    title: "Kruskal's Minimum Spanning Tree",
    category: 'Graphs',
    description: 'Building a minimum spanning tree by sorting all edges by weight and adding each unless it forms a cycle.',
    difficulty: 'Hard',
    source: GraphScripts.KruskalsMST,
  },
  {
    id: 'graphs-topo-sort',
    title: 'Topological Sort',
    category: 'Graphs',
    description: 'Producing a linear ordering of vertices in a directed graph that respects every edge’s direction.',
    difficulty: 'Medium',
    source: GraphScripts.TopologicalSort,
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
