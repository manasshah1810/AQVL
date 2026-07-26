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

// ── Types ──────────────────────────────────────────────────────────────────────

export type ExampleCategory =
  | 'Arrays'
  | 'Sorting'
  | 'Linked Lists'
  | 'Trees'
  | 'Searching'
  | 'Loops & Control';

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
    description: 'Basic array operations including insertion, deletion, and searching to understand AQVL syntax.',
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
    description: 'Using a sliding window of fixed size across an array to process contiguous subarrays efficiently.',
    difficulty: 'Medium',
    source: ArrayScripts.SlidingWindow,
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
