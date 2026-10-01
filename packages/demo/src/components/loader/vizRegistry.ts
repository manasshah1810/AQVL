import { BfsViz, BinarySearchViz, DijkstraViz, HanoiViz, InsertionSortViz, StackViz } from './AlgoViz';

export const VISUALIZATIONS = [
  { name: 'Insertion sort', Component: InsertionSortViz },
  { name: 'Breadth-first search', Component: BfsViz },
  { name: 'Binary search', Component: BinarySearchViz },
  { name: 'Stack push and pop', Component: StackViz },
  { name: 'Dijkstra’s shortest paths', Component: DijkstraViz },
  { name: 'Tower of Hanoi', Component: HanoiViz },
] as const;

let nextViz = Math.floor(Math.random() * VISUALIZATIONS.length);

/** Rotates through the set so consecutive loaders never show the same trace. */
export function takeVizIndex() {
  const i = nextViz;
  nextViz = (nextViz + 1) % VISUALIZATIONS.length;
  return i;
}
