/**
 * Every engine declares the statements it handles (`ALGORITHMS`) and
 * AnimationController registers each engine for exactly those, so a
 * statement's handler is found by name through AlgorithmRegistry alone
 * (docs/design/algorithm-engine-pattern.md).
 */
import { describe, expect, it } from 'vitest';
import '../../packages/runtime/src/core/AnimationController';
import {
  AlgorithmRegistry,
  BinaryTreeEngine,
  BSTEngine,
  SortEngine,
  GraphEngine,
  HeapEngine,
  HashMapEngine,
  TrieEngine,
  StackEngine,
  QueueEngine,
} from '../../packages/runtime/src/core/algorithms';

describe('AlgorithmRegistry', () => {
  it.each([
    ['BinaryTreeEngine', BinaryTreeEngine],
    ['BSTEngine', BSTEngine],
    ['SortEngine', SortEngine],
    ['GraphEngine', GraphEngine],
    ['HeapEngine', HeapEngine],
    ['HashMapEngine', HashMapEngine],
    ['TrieEngine', TrieEngine],
    ['StackEngine', StackEngine],
    ['QueueEngine', QueueEngine],
  ] as const)('routes every statement %s declares to it', (_name, Engine) => {
    expect(Engine.ALGORITHMS.length).toBeGreaterThan(0);
    for (const action of Engine.ALGORITHMS) {
      expect(AlgorithmRegistry.getHandler(action)).toBeInstanceOf(Engine);
    }
  });
});
