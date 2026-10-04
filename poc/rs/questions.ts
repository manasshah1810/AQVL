import { QuestionId, Option } from "./score";

export interface QuestionData {
  id: QuestionId;
  text: string;
  options: Record<Option, string>;
}

export const RS1_QUESTIONS: QuestionData[] = [
  {
    id: "Q1",
    text: "You are building an application that frequently inserts new items at the very beginning of a collection of 1,000,000 items, but rarely reads them randomly. Which of the following statements is true about using a standard contiguous array for this task?",
    options: {
      A: "It is ideal because arrays provide O(1) random access to any element.",
      B: "It is inefficient because inserting at the beginning requires shifting all existing elements, taking O(N) time.",
      C: "It is inefficient because arrays must be fully sorted before any insertion can occur, taking O(N log N) time.",
      D: "It is ideal because inserting an element at the beginning of an array is an O(1) operation."
    }
  },
  {
    id: "Q2",
    text: "Consider a recursive function that calculates the Nth Fibonacci number directly without memoization. Which of the following best describes its space complexity and why?",
    options: {
      A: "O(1), because the function only stores a few local variables in memory at any given time.",
      B: "O(N), because the maximum depth of the recursive call stack reaches N.",
      C: "O(2^N), because the total number of recursive calls made grows exponentially.",
      D: "O(log N), because the recursion divides the problem in half during each step."
    }
  },
  {
    id: "Q3",
    text: "In a standard Binary Search Tree (BST) without self-balancing properties, what is the worst-case time complexity of searching for an element, and what causes it?",
    options: {
      A: "O(1), because the tree uses a deterministic hashing function to locate the node.",
      B: "O(log N), because at each step the search space is divided in half.",
      C: "O(N), which occurs when elements are inserted in sorted order, causing the tree to degenerate into a linked list.",
      D: "O(N log N), because the entire tree must be traversed and sorted during the search."
    }
  },
  {
    id: "Q4",
    text: "You need to find the shortest path between a starting node and a destination node in an unweighted, undirected graph. Which traversal algorithm is most appropriate?",
    options: {
      A: "Depth-First Search (DFS), because it explores paths as deeply as possible to find the destination quickly.",
      B: "Breadth-First Search (BFS), because it explores all nodes at the present depth before moving deeper, guaranteeing the first path found is the shortest.",
      C: "Dijkstra's Algorithm, because it also guarantees shortest paths, even though the graph is unweighted.",
      D: "Pre-order Traversal, because it processes the root node before moving to its adjacent children."
    }
  },
  {
    id: "Q5",
    text: "Which of the following statements is true regarding collisions in a hash table?",
    options: {
      A: "Collisions are mathematically impossible if the hash table is implemented correctly and is large enough.",
      B: "Collisions occur when two different keys hash to the same index, and can be resolved using techniques like chaining or open addressing.",
      C: "Collisions happen when the table runs out of memory and must be resized, requiring all keys to be re-hashed.",
      D: "Collisions are intentionally designed to cluster data together, improving cache locality and retrieval speed."
    }
  }
];
