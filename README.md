# AQVL

**AQVL turns algorithm code into 3D animation — automatically.**

You write the logic (loops, recursion, functions). You declare how it should be arranged in space (a line, a tree, a graph, a grid). AQVL compiles both into an animated 3D scene. No animation library calls, no manual "draw a box here" code — the visualization *is* the program.

```
SCENE BubbleSort

DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    LOOP j FROM 0 TO LENGTH(arr) - i - 2
      COMPARE arr[j] arr[j+1]
      IF arr[j] > arr[j+1]
        SWAP arr[j] arr[j+1]
      END
    END
    HIGHLIGHT arr[LENGTH(arr) - i - 1]
  END
  HIGHLIGHT arr[0]
END
```

That's the entire bubble sort program — comparisons, swaps, and highlights all become animated 3D events when it runs. Try it live in the [Playground](packages/demo).

---

## 🧩 The problem

Algorithms are usually taught with a wall of pseudocode and a handful of static diagrams. You read that a pointer moves, a node gets rebalanced, a comparison happens — but you rarely *see* it happen, step by step, in the order the code actually executes.

The alternative — building a custom visualizer for every data structure — is a lot of throwaway frontend work. Every new algorithm means writing new drawing code, new animation timing, new layout math. Most people give up before they get there.

**AQVL's answer:** make the visualization part of the language itself, so writing the algorithm *is* writing the visualization.

## 💡 What is AQVL?

AQVL (Algorithm/Animation Query/Visualization Language) is a small domain-specific language for describing data structures and algorithms — and how they should look while they run.

A program has two things living side by side:

1. **The algorithm layer** — real control flow: `FUNCTION`s, `LOOP`s, `IF`s, recursion, array/graph/tree operations like `SWAP`, `COMPARE`, and `LINK`.
2. **The spatial layer** — statements that describe *where things go and how the camera behaves*: `LAYOUT ... AS HIERARCHY`, `CAMERA POSITION(0, 0, 22)`, `POSITION node AT (x=1, y=0, z=0)`.

Both get compiled together. A pipeline — **Lexer → Parser → semantic validator → optimizer → AQIR generator** — turns your source into AQIR, a compact bytecode-like instruction set. A runtime virtual machine executes that AQIR and drives a React Three Fiber renderer, frame by frame.

> Think of it like a shader for algorithms: you describe *what* to visualize and how it's arranged; the renderer figures out *how* to draw it.

The key idea: layout is a **language feature**, not something hardcoded in a frontend component. Add a new layout strategy or a new data structure to the runtime, and every AQVL program can use it — no per-structure UI code required.

## 🌳 A fuller example

Here's a trimmed piece of a segment-tree program, showing functions, recursion, layout, camera, and node state changes together (`examples/data-structures/segmenttree.aqvl`):

```
SCENE SegmentTreeDemo
DECLARE
  FUNCTION query(l, r, ql, qr) {
    IF r < ql { RETURN 0 }
    IF qr < l { RETURN 0 }
    IF ql <= l {
      IF r <= qr { RETURN nodeSum(l, r) }
    }
    RETURN query(l, splitPoint(l, r), ql, qr) + query(splitPoint(l, r) + 1, r, ql, qr)
  }

  GRAPH st
  NODE seg_0_5 = [24] { parent: st }
  NODE leaf0 = [2] { parent: st }

SEQUENCE
  qFull = query(0, 5, 0, 5)

  CAMERA POSITION(0, 0, 22)
  LAYOUT st AS CUSTOM()

  POSITION seg_0_5 AT (x=0.6, y=0, z=0)
  LINK seg_0_5 TO seg_0_2
  WAIT

  HIGHLIGHT seg_0_5
  SET leaf0 STATE excluded
  HIGHLIGHT leaf1 'SUCCESS'
  WAIT
END
```

This is the *entire* visual behavior: layout, camera framing, node linking, and highlight states are all statements in the same program that computes the query.

## ✨ Features

**Data structures** — arrays, linked lists (singly/doubly/circular), binary trees, BSTs, AVL trees, red-black trees, graphs, heaps, priority queues, hash maps, tries, union-find.

**Algorithms** — sorting (bubble, selection, insertion, merge, quick, heap, shell, counting, radix and more), searching (linear, binary), traversal (DFS, BFS), BST operations (insert/delete/search/traverse), lowest-common-ancestor, and more — with real functions and real recursion, not pseudocode approximations.

**Layout strategies** — `LINE`, `HIERARCHY`, `CIRCULAR`, `FORCE_DIRECTED`, `GRID`, and `CUSTOM` for hand-placed positions.

**Camera control** — `AUTO_FIT`, `FOCUS(target)`, `ORBIT(speed)`, `POSITION(x, y, z)`.

**Real control flow** — `FUNCTION`/`RETURN`, `LOOP ... FROM ... TO`, `IF`, recursion — the same constructs you'd use in any language, so the algorithm you write is the algorithm that runs, with nothing lost in translation to a diagram.

## 🎯 Why this matters

| | Textbook pseudocode | Hand-built visualizer | AQVL |
|---|---|---|---|
| Shows step-by-step execution | ❌ | ✅ | ✅ |
| Runs as real, checkable code | ❌ | ✅ | ✅ |
| New structure = new frontend code | — | ✅ (a lot) | ❌ |
| Layout is reusable across algorithms | — | ❌ | ✅ |
| Time to add a new algorithm | — | Days | Minutes |

- **Students** watch algorithms execute instead of imagining them from static diagrams — the loop, the swap, the recursive call each become a visible event.
- **Educators** get a way to demonstrate a new algorithm without building a custom visualizer from scratch.
- **Developers** extend the system by writing AQVL and adding layout/algorithm modules to the runtime — not by wiring up new renderer components for every structure.

## 🚀 Getting started

AQVL is a pnpm workspace with four core packages plus a demo playground.

```bash
git clone https://github.com/manasshah1810/AQVL.git
cd AQVL
pnpm install

# run the interactive playground
cd packages/demo
pnpm dev
```

Then open the Playground in your browser, pick an example from the library, and press run.

To run the test suite from the repo root:

```bash
pnpm test
```

**Dig deeper:**
- [Language spec](docs/LANGUAGE_SPEC.md) — the full language design and compiler pipeline
- [Grammar](docs/grammar.md) and [AST specification](docs/ast_specification.md) — formal syntax reference
- [API reference](docs/API_REFERENCE.md) — package-level APIs
- [Demo playground](packages/demo) — browse and run examples in your browser

## 📦 Packages

| Package | What it does |
|---|---|
| [`@aqvl/compiler`](packages/compiler) | Lexer, parser, semantic validator, optimizer, and AQIR code generator |
| [`@aqvl/runtime`](packages/runtime) | Executes AQIR: the algorithm engines, data structures, and layout strategies |
| [`@aqvl/renderer`](packages/renderer) | Renders the running scene in 3D with React Three Fiber |
| [`@aqvl/shared`](packages/shared) | Shared types used across the pipeline |
| [`packages/demo`](packages/demo) | The Playground/IDE web app for writing and running AQVL programs |

## 🖼️ More examples

The demo Playground ships with a categorized example library, including:

- **Sorting** — 17 examples written out with loops, IFs and recursive functions: bubble (with early exit), selection, insertion, cocktail shaker, quick, merge, heap, shell, counting, radix, cycle and pancake sort, plus practical problems — an exam rank list, a game leaderboard, counting inversions, the median with quickselect, and a stability check
- **Trees** — binary trees, BST insert/delete/search, traversals, lowest common ancestor
- **Linked lists** — singly/doubly/circular, reversal, tortoise-and-hare (find-middle)
- **Heaps** — 16 examples written out with loops, IFs and functions over `h[i]`, drawn as a tree and as its array: sift up / sift down, extract-min, max-heap, Floyd's bottom-up build, recursive heapify, decrease-key, delete at any index, heap sort, plus practical problems — emergency-room triage, top-k scores, k-th smallest, connecting ropes, last stone weight and the running median with two heaps
- **Hash maps** — 17 examples written as real code with `m[key] = value`, `m[key]`, `CONTAINS`, `DELETE m[key]` and `KEY_AT`, every hash, bucket, collision chain and resize drawn: the hash function by hand, collisions and chaining, load factor and resizing, open addressing with linear probing built from arrays, plus practical problems — a phone book, shopping cart totals, word frequency, first non-repeating character, valid anagram, two sum, first reused ticket, longest consecutive run, subarrays adding up to k, longest substring without repeats, an election tally, a ransom note and memoized Fibonacci
- **Graphs** — 19 algorithms written out with loops, queues, stacks and recursion: BFS, iterative and recursive DFS, fewest-stop paths, connected components, cycle detection, bipartite check, topological sort (Kahn and DFS), Dijkstra, Bellman-Ford, Prim, Kruskal with union-find, backtracking over all paths, greedy colouring
- **Searching** — linear and binary search
- **Advanced structures** — segment trees, skip lists (see `examples/data-structures/`)

Browse them in [`packages/demo/src/examples/registry.ts`](packages/demo/src/examples/registry.ts) or open them directly in the Playground.

## ❓ FAQ

<details>
<summary><strong>Can I add my own data structure or algorithm?</strong></summary>

Yes — write it as an AQVL program using the existing primitives (`ARRAY`, `NODE`, `GRAPH`, `FUNCTION`, loops, etc.). If it needs a data structure the runtime doesn't support yet, that's implemented in `packages/runtime/src/data-structures`.
</details>

<details>
<summary><strong>Can I change how something is visualized?</strong></summary>

Yes — `LAYOUT` and `CAMERA` statements are part of the language, not hardcoded. Switch strategies (`LINE`, `HIERARCHY`, `CIRCULAR`, `FORCE_DIRECTED`, `GRID`) or use `CUSTOM` with explicit `POSITION ... AT (x=, y=, z=)` statements for full manual control.
</details>

<details>
<summary><strong>Is AQVL production-ready?</strong></summary>

No — it's an educational and research project for visualizing algorithms, not a production animation engine.
</details>

<details>
<summary><strong>What if my structure doesn't fit any built-in layout?</strong></summary>

Use `LAYOUT <target> AS CUSTOM()` and place elements yourself with `POSITION <target> AT (x=, y=, z=)`, as in the segment tree and skip list examples.
</details>

<details>
<summary><strong>How does compilation actually work?</strong></summary>

Source → Lexer → Parser (AST) → semantic validation/type checking → optimizer → AQIR (a bytecode-like instruction set) → runtime virtual machine → React Three Fiber renderer. See [`docs/LANGUAGE_SPEC.md`](docs/LANGUAGE_SPEC.md) for the full pipeline.
</details>

## 🤝 Contributing

Issues and pull requests are welcome. There's no formal contributing guide yet — for now, open an issue to discuss a change before sending a large PR.

---

**Ready to visualize your first algorithm?** Clone the repo, run `pnpm dev` in [`packages/demo`](packages/demo), and open the Playground.
