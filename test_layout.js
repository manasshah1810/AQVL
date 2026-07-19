const { TreeLayoutStrategy } = require('./packages/runtime/dist/core/layouts/TreeLayoutStrategy.js');

const strategy = new TreeLayoutStrategy({ startY: 2 });

const elements = [
  { id: 'r', originalType: 'TREE_NODE', logicalParent: 't' },
  { id: 'c1', originalType: 'TREE_NODE', logicalParent: 't' },
  { id: 'c2', originalType: 'TREE_NODE', logicalParent: 't' },
  { id: 'edge_r_c1', type: 'edge', sourceId: 'r', targetId: 'c1', logicalParent: 't' },
  { id: 'edge_r_c2', type: 'edge', sourceId: 'r', targetId: 'c2', logicalParent: 't' }
];

const mockRM = { getEdges: () => [] };

const map = strategy.applyLayout(elements, mockRM);

console.log('Layout Map:');
for (const [id, pos] of map.entries()) {
  console.log(id, pos);
}
