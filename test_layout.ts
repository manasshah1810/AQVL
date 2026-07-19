import { TreeLayoutStrategy } from './packages/runtime/src/core/layouts/TreeLayoutStrategy';

const strategy = new TreeLayoutStrategy({ startY: 2 });

const elements = [
  { id: 'r', originalType: 'TREE_NODE', logicalParent: 't', type: 'sphere' },
  { id: 'c1', originalType: 'TREE_NODE', logicalParent: 't', type: 'sphere' },
  { id: 'c2', originalType: 'TREE_NODE', logicalParent: 't', type: 'sphere' },
  { id: 'edge_r_c1', type: 'edge', sourceId: 'r', targetId: 'c1', logicalParent: 't' },
  { id: 'edge_r_c2', type: 'edge', sourceId: 'r', targetId: 'c2', logicalParent: 't' }
];

const mockRM = { getEdges: () => [] } as any;

const map = strategy.applyLayout(elements as any, mockRM);

console.log('Layout Map:');
for (const [id, pos] of map.entries()) {
  console.log(id, pos);
}
