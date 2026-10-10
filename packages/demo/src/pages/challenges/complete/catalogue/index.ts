import type { Kernel } from '../types';
import { ARRAY_KERNELS } from './arrays';
import { SORTING_KERNELS } from './sorting';
import { SEARCHING_KERNELS } from './searching';
import { RECURSION_KERNELS } from './recursion';
import { STACK_KERNELS } from './stacks';
import { QUEUE_KERNELS } from './queues';
import { LIST_KERNELS } from './lists';
import { TREE_KERNELS } from './trees';
import { GRAPH_KERNELS } from './graphs';
import { HEAP_KERNELS } from './heaps';
import { HASHMAP_KERNELS } from './hashmaps';
import { TRIE_KERNELS } from './tries';

/** Every algorithm in Complete the Algorithm, in topic order. */
export const CATALOGUE: Kernel[] = [
  ...ARRAY_KERNELS,
  ...SORTING_KERNELS,
  ...SEARCHING_KERNELS,
  ...RECURSION_KERNELS,
  ...STACK_KERNELS,
  ...QUEUE_KERNELS,
  ...LIST_KERNELS,
  ...TREE_KERNELS,
  ...GRAPH_KERNELS,
  ...HEAP_KERNELS,
  ...HASHMAP_KERNELS,
  ...TRIE_KERNELS,
];
