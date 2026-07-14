import React, { useState, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows } from '@react-three/drei';
import type { SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from './SceneElementRenderer';
import { ArrayRenderer } from './library/ArrayRenderer';
import { LinkedListRenderer } from './library/LinkedListRenderer';
import { StackRenderer } from './library/StackRenderer';
import { QueueRenderer } from './library/QueueRenderer';
import { TreeRenderer } from './library/TreeRenderer';
import { GraphRenderer } from './library/GraphRenderer';
import * as THREE from 'three';

export interface AQVECanvasProps {
  sceneState: SceneState | null;
}

const CameraRig = ({ sceneState, autoFollow }: { sceneState: SceneState | null; autoFollow: boolean }) => {
  const { controls } = useThree();
  useFrame(() => {
    if (!sceneState || !controls || !autoFollow) return;
    
    // Calculate center of elements that are active (raised y > 0.1)
    let totalX = 0;
    let count = 0;
    sceneState.elements.forEach((el) => {
      if (el.position && el.position.y > 0.1) {
        totalX += el.position.x;
        count++;
      }
    });

    if (count > 0 && (controls as any).target) {
      const centerX = totalX / count;
      const target = (controls as any).target as THREE.Vector3;
      // Soft lerp camera target towards center X
      target.x = THREE.MathUtils.lerp(target.x, centerX, 0.03);
    }
  });
  return null;
};

export const AQVECanvas: React.FC<AQVECanvasProps> = ({ sceneState }) => {
  const [autoFollow, setAutoFollow] = useState(true);
  const controlsRef = useRef<any>(null);

  const handleResetCamera = () => {
    setAutoFollow(true);
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleControlStart = () => {
    setAutoFollow(false);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Camera Controls Overlay */}
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, display: 'flex', gap: '8px' }}>
        <button 
          onClick={handleResetCamera}
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)';
          }}
        >
          Reset Camera {autoFollow ? '(Auto)' : ''}
        </button>
      </div>

      <Canvas shadows camera={{ position: [0, 3, 10], fov: 45 }}>
        {/* @ts-ignore */}
        <color attach="background" args={['#111111']} />
        
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />
        
        {/* Environment lighting for premium reflections */}
        <Environment preset="city" />

        {/* Grid helper for visual reference */}
        <Grid 
          position={[0, -0.5, 0]} 
          args={[30, 30]} 
          cellSize={1} 
          cellThickness={0.5} 
          cellColor="#2a2a2a" 
          sectionSize={3} 
          sectionThickness={1} 
          sectionColor="#444444" 
          fadeDistance={25} 
          fadeStrength={1} 
        />

        <ContactShadows position={[0, -0.49, 0]} opacity={0.6} scale={20} blur={2.5} far={4} />

        {/* Camera logic */}
        <CameraRig sceneState={sceneState} autoFollow={autoFollow} />

        {/* Passively render all elements from the scene state */}
        {sceneState && (() => {
          const elements = Array.from(sceneState.elements.values());
          const arrayGroups: Record<string, any[]> = {};
          const linkedListGroups: Record<string, any[]> = {};
          const stackGroups: Record<string, any[]> = {};
          const queueGroups: Record<string, any[]> = {};
          const treeGroups: Record<string, any[]> = {};
          const heapArrayGroups: Record<string, any[]> = {};
          const graphGroups: Record<string, any[]> = {};
          const standalone: any[] = [];
          
          elements.forEach((el: any) => {
            if (el.originalType === 'ARRAY_ELEMENT' && el.logicalParent) {
              if (!arrayGroups[el.logicalParent]) arrayGroups[el.logicalParent] = [];
              arrayGroups[el.logicalParent].push(el);
            } else if (el.originalType === 'HEAP_ARRAY_ELEMENT' && el.logicalParent) {
              if (!heapArrayGroups[el.logicalParent]) heapArrayGroups[el.logicalParent] = [];
              heapArrayGroups[el.logicalParent].push(el);
            } else if ((el.originalType === 'LINKEDLIST_NODE' || (el.originalType === 'EDGE' && el.logicalParent && elements.some((e: any) => e.originalType === 'LINKEDLIST_NODE' && e.logicalParent === el.logicalParent))) && el.logicalParent) {
              if (!linkedListGroups[el.logicalParent]) linkedListGroups[el.logicalParent] = [];
              linkedListGroups[el.logicalParent].push(el);
            } else if (el.originalType === 'STACK_ELEMENT' && el.logicalParent) {
              if (!stackGroups[el.logicalParent]) stackGroups[el.logicalParent] = [];
              stackGroups[el.logicalParent].push(el);
            } else if (el.originalType === 'QUEUE_ELEMENT' && el.logicalParent) {
              if (!queueGroups[el.logicalParent]) queueGroups[el.logicalParent] = [];
              queueGroups[el.logicalParent].push(el);
            } else if ((el.originalType === 'TREE_NODE' || el.originalType === 'HEAP_NODE' || el.originalType === 'TRIE_NODE' || (el.originalType === 'EDGE' && el.logicalParent && elements.some((e: any) => (e.originalType === 'TREE_NODE' || e.originalType === 'HEAP_NODE' || e.originalType === 'TRIE_NODE') && e.logicalParent === el.logicalParent))) && el.logicalParent) {
              if (!treeGroups[el.logicalParent]) treeGroups[el.logicalParent] = [];
              treeGroups[el.logicalParent].push(el);
            } else if ((el.originalType === 'VERTEX' || el.originalType === 'GRAPH_EDGE' || (el.originalType === 'EDGE' && el.logicalParent && elements.some((e: any) => e.originalType === 'VERTEX' && e.logicalParent === el.logicalParent))) && el.logicalParent) {
              if (!graphGroups[el.logicalParent]) graphGroups[el.logicalParent] = [];
              graphGroups[el.logicalParent].push(el);
            } else {
              standalone.push(el);
            }
          });

          return (
            <>
              {Object.keys(arrayGroups).map((parent: string) => {
                const els = arrayGroups[parent];
                return <ArrayRenderer key={parent} parentName={parent} elements={els} sceneState={sceneState} />;
              })}
              {Object.keys(heapArrayGroups).map((parent: string) => {
                const els = heapArrayGroups[parent];
                return <ArrayRenderer key={parent} parentName={parent} elements={els} sceneState={sceneState} />;
              })}
              {Object.keys(linkedListGroups).map((parent: string) => {
                const els = linkedListGroups[parent];
                return <LinkedListRenderer key={parent} parentName={parent} elements={els} sceneState={sceneState} />;
              })}
              {Object.keys(stackGroups).map((parent: string) => {
                const els = stackGroups[parent];
                return <StackRenderer key={parent} parentName={parent} elements={els} sceneState={sceneState} />;
              })}
              {Object.keys(queueGroups).map((parent: string) => {
                const els = queueGroups[parent];
                return <QueueRenderer key={parent} parentName={parent} elements={els} sceneState={sceneState} />;
              })}
              {Object.keys(treeGroups).map((parent: string) => {
                const els = treeGroups[parent];
                return <TreeRenderer key={parent} parentName={parent} elements={els} sceneState={sceneState} />;
              })}
              {Object.keys(graphGroups).map((parent: string) => {
                const els = graphGroups[parent];
                return <GraphRenderer key={parent} parentName={parent} elements={els} sceneState={sceneState} />;
              })}
              {standalone.map(el => (
                <SceneElementRenderer key={el.id} element={el} sceneState={sceneState} />
              ))}
            </>
          );
        })()}

        {/* Advanced Camera Controls */}
        <OrbitControls 
          ref={controlsRef}
          makeDefault 
          onStart={handleControlStart}
          enableDamping
          dampingFactor={0.05}
          maxDistance={35}
          minDistance={2}
          maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going under the floor
        />
      </Canvas>
    </div>
  );
};
