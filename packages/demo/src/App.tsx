/// <reference types="react" />
/// <reference types="react-dom" />
import React, { useState, useEffect, useRef } from 'react';
import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator } from '@aqvl/compiler';
import { ExecutionEngine } from '@aqvl/runtime';
import { AQVECanvas } from '@aqvl/renderer';

import { IDEEditor } from './components/IDEEditor';
import { IDEToolbar } from './components/IDEToolbar';
import { IDECompilerPanel } from './components/IDECompilerPanel';
import { IDEBottomPanel } from './components/IDEBottomPanel';
import { IDEExecutionDebugger } from './components/IDEExecutionDebugger';

import { SortingScripts } from './examples/SortingLibrary';
import { LinkedListScripts } from './examples/LinkedListLibrary';

const initialScript = LinkedListScripts.ComprehensiveTest;

type PipelineStatus = 'pending' | 'success' | 'error';

export default function App() {
  const [sourceCode, setSourceCode] = useState(initialScript);
  
  // Pipeline State
  const [tokens, setTokens] = useState<any[]>([]);
  const [ast, setAst] = useState<any>(null);
  const [aqir, setAqir] = useState<any>(null);
  const [pipelineState, setPipelineState] = useState<{
    lexer: PipelineStatus;
    parser: PipelineStatus;
    semantic: PipelineStatus;
    optimizer: PipelineStatus;
    generator: PipelineStatus;
    runtime: PipelineStatus;
  }>({
    lexer: 'pending', parser: 'pending', semantic: 'pending', 
    optimizer: 'pending', generator: 'pending', runtime: 'pending'
  });

  // Runtime State
  const engineRef = useRef<ExecutionEngine | null>(null);
  const [sceneState, setSceneState] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  
  // App State
  const [consoleLogs, setConsoleLogs] = useState<{type: 'log'|'error'|'success', text: string}[]>([]);
  const [userInputs, setUserInputs] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({
    compileTime: 0,
    executionTime: 0,
    framesRendered: 0,
    characters: 0,
    lines: 0,
    tokens: 0,
    astNodes: 0
  });

  const addLog = (text: string, type: 'log'|'error'|'success' = 'log') => {
    setConsoleLogs(prev => [...prev, { text, type }]);
  };

  const countAstNodes = (node: any): number => {
    if (!node || typeof node !== 'object') return 0;
    let count = 1;
    for (const key in node) {
      if (Array.isArray(node[key])) {
        node[key].forEach((child: any) => count += countAstNodes(child));
      } else if (typeof node[key] === 'object') {
        count += countAstNodes(node[key]);
      }
    }
    return count;
  };

  const handleCompile = (inputs: Record<string, any> = userInputs) => {
    setConsoleLogs([]);
    setPipelineState({
      lexer: 'pending', parser: 'pending', semantic: 'pending', 
      optimizer: 'pending', generator: 'pending', runtime: 'pending'
    });
    setTokens([]);
    setAst(null);
    setAqir(null);
    setSceneState(null);
    setCurrentInstructionIndex(0);
    setIsPlaying(false);

    if (engineRef.current) {
      engineRef.current.pause();
      engineRef.current = null;
    }

    const startTime = performance.now();
    let currentStats = {
      characters: sourceCode.length,
      lines: sourceCode.split('\n').length,
      tokens: 0, astNodes: 0, compileTime: 0, executionTime: 0, framesRendered: 0
    };

    try {
      // 1. Lexer
      const lexer = new Lexer(sourceCode);
      const generatedTokens = lexer.tokenize();
      setTokens(generatedTokens);
      currentStats.tokens = generatedTokens.length;
      setPipelineState(p => ({ ...p, lexer: 'success' }));
      addLog('✓ Lexer Complete', 'success');

      // 2. Parser
      const parser = new Parser(generatedTokens);
      const generatedAst = parser.parse();
      setAst(generatedAst);
      currentStats.astNodes = countAstNodes(generatedAst);
      setPipelineState(p => ({ ...p, parser: 'success' }));
      addLog('✓ Parser Complete. AST Generated', 'success');

      // 3. Semantic Validation
      const validator = new SemanticValidator();
      const diagnostics = validator.validate(generatedAst);
      if (diagnostics.length > 0) {
        const errors = diagnostics.map(d => `[${d.level}] Line ${d.line}, Col ${d.column}: ${d.message}`).join('\n');
        throw new Error(`Semantic Validation Failed:\n${errors}`);
      }
      setPipelineState(p => ({ ...p, semantic: 'success' }));
      addLog('✓ Semantic Validation Passed', 'success');

      // 4. Optimizer
      const optimizer = new Optimizer();
      const optimizedAst = optimizer.optimize(generatedAst, inputs);
      setPipelineState(p => ({ ...p, optimizer: 'success' }));
      addLog('✓ Optimizer Complete', 'success');

      // 5. AQIR Generator
      const generator = new AQIRGenerator();
      const generatedAqir = generator.generate(optimizedAst);
      setAqir(generatedAqir);
      setPipelineState(p => ({ ...p, generator: 'success' }));
      addLog('✓ AQIR Generated', 'success');

      // 6. Runtime Initialization
      const engine = new ExecutionEngine();
      engine.eventDispatcher.on('SCENE_LOADED', () => {
        setSceneState(engine.stateManager.getCurrentState());
      });
      engine.eventDispatcher.on('STATE_UPDATED', (newState) => {
        setSceneState(newState);
      });
      engine.loadProgram(generatedAqir);
      
      engineRef.current = engine;
      setPipelineState(p => ({ ...p, runtime: 'success' }));
      addLog('✓ Runtime Initialized', 'success');

      currentStats.compileTime = Math.round(performance.now() - startTime);
      setStats(currentStats);

    } catch (e: any) {
      addLog(e.message || String(e), 'error');
      // Set the first pending stage to error
      setPipelineState(p => {
        const newP = { ...p };
        const stages: (keyof typeof p)[] = ['lexer', 'parser', 'semantic', 'optimizer', 'generator', 'runtime'];
        for (const stage of stages) {
          if (newP[stage] === 'pending') {
            newP[stage] = 'error';
            break;
          }
        }
        return newP;
      });
    }
  };

  useEffect(() => {
    // Initial compile
    handleCompile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    if (!engineRef.current) return;
    
    const handleStart = (idx: any) => {
      setCurrentInstructionIndex(idx);
    };
    
    const handleComplete = (idx: any) => {
      // Just visually track, the actual index increments
    };
    
    const handleFinished = () => {
      setIsPlaying(false);
    };

    engineRef.current.eventDispatcher.on('INSTRUCTION_START', handleStart);
    engineRef.current.eventDispatcher.on('INSTRUCTION_COMPLETE', handleComplete);
    engineRef.current.eventDispatcher.on('EXECUTION_FINISHED', handleFinished);

    return () => {
      if (engineRef.current) {
        // Simple cleanup for now
      }
    };
  }, [pipelineState.runtime, isPlaying]);

  const handleRun = () => {
    if (engineRef.current) {
      engineRef.current.play();
      setIsPlaying(true);
      addLog('✓ Animation Started', 'success');
    }
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pause();
      setIsPlaying(false);
      addLog('Animation Paused');
    }
  };

  const handleResume = () => {
    if (engineRef.current) {
      engineRef.current.play();
      setIsPlaying(true);
      addLog('Animation Resumed');
    }
  };

  const handleStep = () => {
    if (engineRef.current) {
      engineRef.current.play();
      setIsPlaying(true);
      addLog('Stepping instruction...');
      setTimeout(() => {
        if (engineRef.current) {
          engineRef.current.pause();
          setIsPlaying(false);
        }
      }, 800); // Approximate duration of one step
    }
  };

  const handleReset = () => {
    if (engineRef.current) {
      engineRef.current.restart();
      setIsPlaying(false);
      setCurrentInstructionIndex(0);
      setSceneState(engineRef.current.stateManager.getCurrentState());
      addLog('Runtime Reset to initial state');
    }
  };

  const handleStop = () => {
    handlePause();
    handleReset();
    addLog('Animation Stopped');
  };

  const isRuntimeReady = pipelineState.runtime === 'success';

  return (
    <div className="ide-container">
      <IDEToolbar
        onCompile={handleCompile}
        onRun={handleRun}
        onPause={handlePause}
        onResume={handleResume}
        onStep={handleStep}
        onReset={handleReset}
        onStop={handleStop}
        isPlaying={isPlaying}
        canRun={isRuntimeReady}
      />
      
      <div className="ide-main">
        <div className="ide-panel ide-left-panel">
          <div className="ide-panel-header">AQVL Source Editor</div>
          <div className="ide-panel-content">
            <IDEEditor initialValue={sourceCode} onChange={setSourceCode} />
          </div>
        </div>

        <IDECompilerPanel
          tokens={tokens}
          ast={ast}
          aqir={aqir}
          pipelineState={pipelineState}
        />

        <div className="ide-panel ide-right-panel">
          <div className="ide-panel-header" style={{ backgroundColor: '#1a1a1a' }}>Visualization</div>
          <div className="ide-panel-content" style={{ backgroundColor: '#000', position: 'relative' }}>
            {sceneState ? (
              <>
                <AQVECanvas sceneState={sceneState} />
                <IDEExecutionDebugger 
                  aqir={aqir} 
                  currentInstructionIndex={currentInstructionIndex} 
                  isPlaying={isPlaying} 
                  pipelineState={pipelineState} 
                />
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>
                {pipelineState.runtime === 'error' ? 'Compilation Failed' : 'Waiting for Compilation...'}
              </div>
            )}
          </div>
        </div>
      </div>

      <IDEBottomPanel
        aqir={aqir}
        currentInstructionIndex={currentInstructionIndex}
        runtimeStatus={{
          scene: ast?.children?.[0]?.name || 'Unknown',
          objectsCount: aqir?.objects?.length || 0,
          instructionsCount: aqir?.instructions?.length || 0,
          timelineState: isPlaying ? 'Running' : 'Stopped',
          compilerVersion: 'AQVL v0.1',
          aqirVersion: aqir?.version || '0.1'
        }}
        stats={stats}
        consoleLogs={consoleLogs}
      />
    </div>
  );
}
