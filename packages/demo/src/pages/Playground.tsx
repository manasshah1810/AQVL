import React, { useState, useEffect, useRef } from 'react';
import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator } from '@aqvl/compiler';
import { ExecutionEngine } from '@aqvl/runtime';
import { AQVECanvas } from '@aqvl/renderer';

import { IDEEditor } from '../components/IDEEditor';
import { SortingScripts } from '../examples/SortingLibrary';

import './playground.css';

const initialScript = SortingScripts.ArrayTest;

export default function Playground() {
  const [sourceCode, setSourceCode] = useState(initialScript);
  
  // Pipeline State
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  
  // Runtime State
  const engineRef = useRef<ExecutionEngine | null>(null);
  const [sceneState, setSceneState] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [totalInstructions, setTotalInstructions] = useState(0);

  const handleCompileAndRun = () => {
    setIsCompiling(true);
    setCompileError(null);
    setSceneState(null);
    setCurrentInstructionIndex(0);
    setIsPlaying(false);

    if (engineRef.current) {
      engineRef.current.pause();
      engineRef.current = null;
    }

    try {
      // 1. Lexer
      const lexer = new Lexer(sourceCode);
      const generatedTokens = lexer.tokenize();

      // 2. Parser
      const parser = new Parser(generatedTokens);
      const generatedAst = parser.parse();

      // 3. Semantic Validation
      const validator = new SemanticValidator();
      const diagnostics = validator.validate(generatedAst);
      if (diagnostics.length > 0) {
        const errors = diagnostics.map(d => `[${d.level}] Line ${d.line}, Col ${d.column}: ${d.message}`).join('\n');
        throw new Error(`Semantic Validation Failed:\n${errors}`);
      }

      // 4. Optimizer
      const optimizer = new Optimizer();
      const optimizedAst = optimizer.optimize(generatedAst, {});

      // 5. AQIR Generator
      const generator = new AQIRGenerator();
      const generatedAqir = generator.generate(optimizedAst);
      
      setTotalInstructions(generatedAqir.instructions?.length || 0);

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
      setIsCompiling(false);
      
      // Auto-start after compilation
      setTimeout(() => {
          handlePlay();
      }, 100);

    } catch (e: any) {
      setCompileError(e.message || String(e));
      setIsCompiling(false);
    }
  };

  useEffect(() => {
    // Initial compile
    handleCompileAndRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    if (!engineRef.current) return;
    
    const handleStart = (idx: any) => {
      setCurrentInstructionIndex(idx);
    };
    
    const handleFinished = () => {
      setIsPlaying(false);
    };

    engineRef.current.eventDispatcher.on('INSTRUCTION_START', handleStart);
    engineRef.current.eventDispatcher.on('EXECUTION_FINISHED', handleFinished);

    return () => {
      // Cleanup
    };
  }, [isPlaying]);

  const handlePlay = () => {
    if (engineRef.current) {
      engineRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStepPrev = () => {
    if (engineRef.current) {
      engineRef.current.stepBackward();
      setIsPlaying(false);
    }
  };

  const handleStepNext = () => {
    if (engineRef.current) {
      engineRef.current.stepAnimateForward(() => {
        setIsPlaying(false);
      });
    }
  };

  const handleReset = () => {
    if (engineRef.current) {
      engineRef.current.restart();
      setIsPlaying(false);
      setCurrentInstructionIndex(0);
      setSceneState(engineRef.current.stateManager.getCurrentState());
    }
  };

  const isRuntimeReady = !!sceneState && !isCompiling;

  return (
    <div className="playground-root">
      {/* Left Panel: Code Editor */}
      <div className="pg-left-panel">
        <div className="pg-panel-header">
          <span>AQVL Code</span>
          <button className="pg-button primary" onClick={handleCompileAndRun} disabled={isCompiling}>
            {isCompiling ? 'Compiling...' : 'Compile & Run'}
          </button>
        </div>
        <div className="pg-editor-container">
          <IDEEditor initialValue={sourceCode} onChange={setSourceCode} />
        </div>
      </div>

      {/* Right Panel: Visualization & Controls */}
      <div className="pg-right-panel">
        <div className="pg-panel-header">
          <span>Algorithm Visualization</span>
        </div>
        
        <div className="pg-canvas-container">
          {isCompiling && (
            <div className="pg-loading-overlay">Compiling and building 3D scene...</div>
          )}
          
          {compileError && !isCompiling && (
            <div className="pg-loading-overlay" style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: '20px', textAlign: 'center', whiteSpace: 'pre-wrap' }}>
              Compilation Error:{'\n'}{compileError}
            </div>
          )}

          {isRuntimeReady && (
            <AQVECanvas sceneState={sceneState} />
          )}
        </div>

        {/* Playback Controls */}
        <div className="pg-controls">
          <button className="pg-button" onClick={handleReset} disabled={!isRuntimeReady}>
            Reset
          </button>
          <button className="pg-button" onClick={handleStepPrev} disabled={!isRuntimeReady}>
            &lt; Prev
          </button>
          
          {!isPlaying ? (
            <button className="pg-button primary" onClick={handlePlay} disabled={!isRuntimeReady}>
              Play
            </button>
          ) : (
            <button className="pg-button" onClick={handlePause} disabled={!isRuntimeReady}>
              Pause
            </button>
          )}

          <button className="pg-button" onClick={handleStepNext} disabled={!isRuntimeReady}>
            Next &gt;
          </button>

          <div className="pg-step-indicator">
            Step {currentInstructionIndex + 1} / {totalInstructions > 0 ? totalInstructions : '?'}
          </div>
        </div>
      </div>
    </div>
  );
}
