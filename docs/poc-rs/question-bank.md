# Recommendation System (RS) Proof-of-Concept: Diagnostic MCQ Question Bank

**Purpose:** 
This document serves as the fixed diagnostic MCQ question bank and scoring rubric for the standalone Recommendation System (RS) proof-of-concept (Task RS1). This diagnostic separates students by their comfort level with core data-structure concepts to build a measurable skill profile. The resulting profile can later be used to recommend appropriate AQVL registry examples to the student.

## I. Question Bank

### Q1. Array Insertion
**Question:** You are building an application that frequently inserts new items at the very beginning of a collection of 1,000,000 items, but rarely reads them randomly. Which of the following statements is true about using a standard contiguous array for this task?
- **A)** It is ideal because arrays provide O(1) random access to any element.
- **B)** It is inefficient because inserting at the beginning requires shifting all existing elements, taking O(N) time.
- **C)** It is inefficient because arrays must be fully sorted before any insertion can occur, taking O(N log N) time.
- **D)** It is ideal because inserting an element at the beginning of an array is an O(1) operation.

**Correct Answer:** B
**Skill Dimension:** arrays
**Rationale:** Tests understanding of contiguous memory constraints and time complexity of shifting elements.
**Scoring Weights:**
- A = 0 (Irrelevant advantage)
- B = 4 (Correct - Understands O(N) shifting cost)
- C = 1 (Recognizes inefficiency, but misidentifies the reason)
- D = 0 (Fundamentally incorrect time complexity)

### Q2. Recursion Space Complexity
**Question:** Consider a recursive function that calculates the Nth Fibonacci number directly without memoization. Which of the following best describes its space complexity and why?
- **A)** O(1), because the function only stores a few local variables in memory at any given time.
- **B)** O(N), because the maximum depth of the recursive call stack reaches N.
- **C)** O(2^N), because the total number of recursive calls made grows exponentially.
- **D)** O(log N), because the recursion divides the problem in half during each step.

**Correct Answer:** B
**Skill Dimension:** recursion
**Rationale:** Evaluates the student's ability to distinguish between time complexity (which is exponential) and space complexity (determined by maximum call stack depth).
**Scoring Weights:**
- A = 0 (Fails to account for the call stack entirely)
- B = 4 (Correct - Understands maximum call stack depth)
- C = 2 (Confuses time and space complexity, but correctly recognizes the exponential nature of the calls)
- D = 0 (Fundamentally incorrect understanding of the algorithm's behavior)

### Q3. Binary Search Tree Worst-Case
**Question:** In a standard Binary Search Tree (BST) without self-balancing properties, what is the worst-case time complexity of searching for an element, and what causes it?
- **A)** O(1), because the tree uses a deterministic hashing function to locate the node.
- **B)** O(log N), because at each step the search space is divided in half.
- **C)** O(N), which occurs when elements are inserted in sorted order, causing the tree to degenerate into a linked list.
- **D)** O(N log N), because the entire tree must be traversed and sorted during the search.

**Correct Answer:** C
**Skill Dimension:** trees
**Rationale:** Tests knowledge of tree structures and the distinction between average-case (balanced) and worst-case (degenerate/unbalanced) bounds.
**Scoring Weights:**
- A = 0 (Confuses BST with a Hash Table)
- B = 1 (Assumes a balanced BST, failing to identify the worst-case scenario)
- C = 4 (Correct - Understands degenerate trees and O(N) worst-case)
- D = 0 (Fundamentally incorrect understanding of search mechanics)

### Q4. Shortest Path Traversal
**Question:** You need to find the shortest path between a starting node and a destination node in an unweighted, undirected graph. Which traversal algorithm is most appropriate?
- **A)** Depth-First Search (DFS), because it explores paths as deeply as possible to find the destination quickly.
- **B)** Breadth-First Search (BFS), because it explores all nodes at the present depth before moving deeper, guaranteeing the first path found is the shortest.
- **C)** Dijkstra's Algorithm, because it also guarantees shortest paths, even though the graph is unweighted.
- **D)** Pre-order Traversal, because it processes the root node before moving to its adjacent children.

**Correct Answer:** B
**Skill Dimension:** graphs
**Rationale:** Tests understanding of graph traversals and when to appropriately apply BFS vs. DFS vs. Dijkstra.
**Scoring Weights:**
- A = 1 (Recognizes a valid graph traversal, but it does not guarantee shortest path)
- B = 4 (Correct - Identifies BFS as optimal for unweighted shortest paths)
- C = 2 (Technically works and finds shortest paths, but is overkill/suboptimal for an unweighted graph)
- D = 0 (Confuses general graph traversal with strict binary tree traversals)

### Q5. Hash Table Collisions
**Question:** Which of the following statements is true regarding collisions in a hash table?
- **A)** Collisions are mathematically impossible if the hash table is implemented correctly and is large enough.
- **B)** Collisions occur when two different keys hash to the same index, and can be resolved using techniques like chaining or open addressing.
- **C)** Collisions happen when the table runs out of memory and must be resized, requiring all keys to be re-hashed.
- **D)** Collisions are intentionally designed to cluster data together, improving cache locality and retrieval speed.

**Correct Answer:** B
**Skill Dimension:** hashing
**Rationale:** Measures understanding of hashing mechanics, the inevitability of collisions, and resolution strategies.
**Scoring Weights:**
- A = 0 (Fundamentally misunderstands hashing and the Pigeonhole Principle)
- B = 4 (Correct - Defines collisions and lists valid resolution strategies)
- C = 1 (Confuses collisions with the concept of load-factor-triggered rehashing/resizing)
- D = 0 (Incorrectly identifies collisions as a performance optimization rather than a problem to resolve)

## II. Scoring Rubric

### Point Accumulation
Each student starts with a score of `0` in all five skill dimensions: `arrays`, `recursion`, `trees`, `graphs`, and `hashing`.

As the student answers the 5 questions, the point weight of their selected option is added to the total score for that question's specific **Skill Dimension**. 

Since there is exactly one question per dimension in this 5-question diagnostic, the maximum possible score for any single dimension is **4 points**, and the minimum is **0 points**.

### Skill Profile Interpretation Bands
The accumulated score for each dimension defines the student's proficiency level in that specific category. This profile can later be used by the Recommendation System to suggest tailored AQVL registry examples.

- **4 Points (High Proficiency):** The student grasps both the core mechanics and nuanced edge cases (e.g., worst-case scenarios, space complexity). 
  *Recommendation behavior:* Suggest advanced or optimized AQVL registry examples for this dimension.
- **2–3 Points (Medium Proficiency):** The student understands the general topic but confuses overlapping concepts (e.g., time vs. space complexity, Dijkstra vs. BFS). 
  *Recommendation behavior:* Suggest standard, baseline AQVL registry examples to reinforce standard behavior.
- **0–1 Points (Low Proficiency):** The student harbors fundamental misunderstandings about the data structure or algorithm. 
  *Recommendation behavior:* Suggest foundational/introductory AQVL visualizer walkthroughs for this dimension.

## III. Sample Verification

Below are two complete sample answer sets, hand-calculated to verify the rubric.

### Sample 1: The "Perfect" Student
This student selects the optimal answer for every question.

- **Q1 (arrays):** Selected **B** -> +4 points
- **Q2 (recursion):** Selected **B** -> +4 points
- **Q3 (trees):** Selected **C** -> +4 points
- **Q4 (graphs):** Selected **B** -> +4 points
- **Q5 (hashing):** Selected **B** -> +4 points

**Final Skill Profile:**
- arrays: 4 (High Proficiency)
- recursion: 4 (High Proficiency)
- trees: 4 (High Proficiency)
- graphs: 4 (High Proficiency)
- hashing: 4 (High Proficiency)

### Sample 2: The "Struggling/Partial" Student
This student selects answers that show partial understanding or common misconceptions.

- **Q1 (arrays):** Selected **C** (Knows it's inefficient, wrong reason) -> +1 point
- **Q2 (recursion):** Selected **C** (Confuses time and space complexity) -> +2 points
- **Q3 (trees):** Selected **B** (Assumes balanced tree, misses worst-case) -> +1 point
- **Q4 (graphs):** Selected **A** (Picks DFS for shortest path) -> +1 point
- **Q5 (hashing):** Selected **C** (Confuses collisions with rehashing) -> +1 point

**Final Skill Profile:**
- arrays: 1 (Low Proficiency)
- recursion: 2 (Medium Proficiency)
- trees: 1 (Low Proficiency)
- graphs: 1 (Low Proficiency)
- hashing: 1 (Low Proficiency)
