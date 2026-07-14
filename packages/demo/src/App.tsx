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

const initialScript = LinkedListScripts.CircularLinkedList;

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

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('aqvl-docs-theme') as 'dark' | 'light') || 'dark';
  });

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('aqvl-docs-theme', next);
  };

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
    <div className="ide-container" data-theme={theme}>
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
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
      
      <div className="ide-main">
        <div className="ide-panel ide-left-panel">
          <div className="ide-panel-header">
            <svg className="ide-panel-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            AQVL Source Editor
          </div>
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
          <div className="ide-panel-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg className="ide-panel-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              Visualization
            </div>
            {sceneState && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 9px',
                background: isPlaying ? 'var(--success-soft)' : 'rgba(99,102,241,0.1)',
                border: `1px solid ${isPlaying ? 'rgba(34,197,94,.25)' : 'rgba(99,102,241,.25)'}`,
                borderRadius: '20px',
                fontSize: '10px',
                fontWeight: 600,
                color: isPlaying ? 'var(--success)' : '#a5b4fc',
                letterSpacing: '0.03em',
              }}>
                <div style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: 'currentColor',
                  animation: isPlaying ? 'pulseGreen 1.5s ease-in-out infinite' : 'none',
                }} />
                {isPlaying ? 'Animating' : 'Scene Ready'}
              </div>
            )}
          </div>
          <div className="ide-panel-content" style={{ backgroundColor: '#06060a', position: 'relative' }}>
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
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '14px',
                color: 'var(--text-subtle)',
              }}>
                {/* Subtle grid bg */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: 'linear-gradient(rgba(99,102,241,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.04) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  width: '52px', height: '52px',
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-subtle)',
                  position: 'relative', zIndex: 1,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {pipelineState.runtime === 'error' ? 'Compilation Failed' : 'Scene not loaded'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {pipelineState.runtime === 'error' ? 'Fix errors and recompile.' : 'Press Compile to build the scene.'}
                  </div>
                </div>
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
          compilerVersion: 'AQVL',
          aqirVersion: aqir?.version || '0.1'
        }}
        stats={stats}
        consoleLogs={consoleLogs}
      />
    </div>
  );
}
