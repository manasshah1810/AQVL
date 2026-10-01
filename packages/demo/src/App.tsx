import React, { useState, useEffect, useMemo } from 'react';
import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator } from '@aqvl/compiler';
import type { AQIRProgram as RuntimeProgram } from '@aqvl/runtime';
import { usePlayhead } from '@aqvl/renderer';

import { IDEEditor } from './components/IDEEditor';
import { IDEToolbar } from './components/IDEToolbar';
import { IDECompilerPanel } from './components/IDECompilerPanel';
import { IDEBottomPanel } from './components/IDEBottomPanel';
import { IDEExecutionDebugger } from './components/IDEExecutionDebugger';
import { RuntimeOutputPanel, RuntimeLogEntry } from './components/RuntimeOutputPanel';
import { Visualizer } from './components/visualizer/Visualizer';
import { useTraceRun } from './components/visualizer/useTraceRun';
import { usePrefersReducedMotion } from './lib/motion';
import { useTheme } from './lib/theme';

import { TreeScripts } from './examples/TreeLibrary';
import './styles/ide.css';
import type { AQIRProgram, PipelineStage, PipelineState, ProgramNode, Token } from './types/pipeline';

const initialScript = TreeScripts.BinaryTreeBasics;

const LOG_KINDS = new Set<RuntimeLogEntry['kind']>(['traversal', 'search', 'info', 'relationship', 'operation', 'step', 'result', 'swap', 'compare']);

export default function App() {
  const [sourceCode, setSourceCode] = useState(initialScript);
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();

  // Pipeline State
  const [tokens, setTokens] = useState<Token[]>([]);
  const [ast, setAst] = useState<ProgramNode | null>(null);
  const [aqir, setAqir] = useState<AQIRProgram | null>(null);
  const [pipelineState, setPipelineState] = useState<PipelineState>({
    lexer: 'pending', parser: 'pending', semantic: 'pending',
    optimizer: 'pending', generator: 'pending', runtime: 'pending'
  });

  // Runtime State: the program recorded as a trace, played by a playhead.
  const { run, start, clear } = useTraceRun();
  const snap = usePlayhead(run?.playhead ?? null);
  const isPlaying = snap.playing;
  const currentInstructionIndex = run?.trace.frames[snap.active]?.pc ?? 0;

  // App State
  const [consoleLogs, setConsoleLogs] = useState<{type: 'log'|'error'|'success', text: string}[]>([]);
  const [logsClearedThrough, setLogsClearedThrough] = useState(0);
  const runtimeLogs = useMemo<RuntimeLogEntry[]>(() => {
    if (!run) return [];
    const out: RuntimeLogEntry[] = [];
    for (let k = Math.max(1, logsClearedThrough + 1); k <= Math.min(snap.step, run.trace.frames.length - 1); k++) {
      run.trace.frames[k].logs.forEach((l, i) =>
        out.push({
          id: k * 1000 + i,
          timestamp: 0,
          keyword: l.keyword,
          message: l.message,
          kind: LOG_KINDS.has(l.kind as RuntimeLogEntry['kind']) ? (l.kind as RuntimeLogEntry['kind']) : 'info',
          step: k,
        }),
      );
    }
    return out;
  }, [run, snap.step, logsClearedThrough]);
  // Values typed into the input panel, by variable name (none are wired up yet).
  const userInputs: Record<string, unknown> = {};
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

  const countAstNodes = (node: unknown): number => {
    if (!node || typeof node !== 'object') return 0;
    let count = 1;
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        child.forEach((grandchild) => count += countAstNodes(grandchild));
      } else if (typeof child === 'object') {
        count += countAstNodes(child);
      }
    }
    return count;
  };

  const handleCompile = (inputs: Record<string, unknown> = userInputs) => {
    setConsoleLogs([]);
    setLogsClearedThrough(0);
    setPipelineState({
      lexer: 'pending', parser: 'pending', semantic: 'pending',
      optimizer: 'pending', generator: 'pending', runtime: 'pending'
    });
    setTokens([]);
    setAst(null);
    setAqir(null);
    run?.playhead.pause();

    const startTime = performance.now();
    const currentStats = {
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

      // 6. Runtime: run the program once and record it as a trace.
      const program = generatedAqir as unknown as RuntimeProgram;
      program.functionTable = {};
      for (const fn of generator.getFunctionTable().all()) {
        program.functionTable[fn.name] = { name: fn.name, params: fn.params, entryAddress: fn.startPC };
      }
      currentStats.compileTime = Math.round(performance.now() - startTime);
      const traceStart = performance.now();
      void start(program, sourceCode).then((next) => {
        if (!next) return;
        currentStats.executionTime = Math.round(performance.now() - traceStart);
        currentStats.framesRendered = next.trace.frames.length;
        setStats({ ...currentStats });
        for (const frame of next.trace.frames) for (const l of frame.logs) addLog(`[${l.keyword}] ${l.message}`);
        if (next.trace.error) {
          addLog(`Runtime error: ${next.trace.error.message}`, 'error');
          setPipelineState(p => ({ ...p, runtime: 'error' }));
        } else {
          setPipelineState(p => ({ ...p, runtime: 'success' }));
          addLog(`✓ Runtime traced ${next.trace.frames.length - 1} steps`, 'success');
        }
      });
      setStats(currentStats);

    } catch (e) {
      clear();
      addLog(e instanceof Error ? e.message : String(e), 'error');
      // Set the first pending stage to error
      setPipelineState(p => {
        const newP = { ...p };
        const stages: PipelineStage[] = ['lexer', 'parser', 'semantic', 'optimizer', 'generator', 'runtime'];
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
    // Initial compile, on the first frame after mount. Cancelled on unmount,
    // so StrictMode's mount -> unmount -> mount compiles only once.
    const frame = requestAnimationFrame(() => handleCompile());
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleRun = () => {
    if (run) {
      run.playhead.play();
      addLog('✓ Playback started', 'success');
    }
  };

  const handlePause = () => {
    if (run) {
      run.playhead.pause();
      addLog('Playback paused');
    }
  };

  const handleStep = () => {
    if (run) {
      run.playhead.stepForward();
      addLog('Stepping one step');
    }
  };

  const handleReset = () => {
    if (run) {
      run.playhead.restart();
      setLogsClearedThrough(0);
      addLog('Runtime reset to the initial state');
    }
  };

  const handleStop = () => {
    handleReset();
    addLog('Playback stopped');
  };

  const isRuntimeReady = !!run;

  return (
    <div className="ide-container">
      <IDEToolbar
        onCompile={handleCompile}
        onRun={handleRun}
        onPause={handlePause}
        onStep={handleStep}
        onReset={handleReset}
        onStop={handleStop}
        isPlaying={isPlaying}
        canRun={isRuntimeReady}
      />

      <div className="ide-main">
        <section className="ide-panel ide-left-panel" aria-label="Source">
          <div className="ide-panel-header">Source</div>
          <div className="ide-panel-content" style={{ overflow: 'hidden', display: 'flex' }}>
            <IDEEditor initialValue={sourceCode} onChange={setSourceCode} />
          </div>
        </section>

        <IDECompilerPanel
          tokens={tokens}
          ast={ast}
          aqir={aqir}
          pipelineState={pipelineState}
        />

        <section className="ide-panel ide-right-panel" aria-label="Visualization">
          <div className="ide-panel-header" style={{ justifyContent: 'space-between' }}>
            <span>Viewport</span>
            {run && <span className={isPlaying ? 'text-cream' : 'muted'}>{isPlaying ? 'Animating' : 'Scene ready'}</span>}
          </div>
          <div className="ide-panel-content ide-canvas-host">
            {run ? (
              <>
                <div className="ide-stage">
                  <Visualizer trace={run.trace} playhead={run.playhead} source={run.source} theme={theme} reducedMotion={reducedMotion} compact />
                </div>
                <div className="ide-run-panels">
                  <RuntimeOutputPanel
                    logs={runtimeLogs}
                    onClear={() => setLogsClearedThrough(snap.step)}
                  />
                  <IDEExecutionDebugger
                    aqir={aqir}
                    currentInstructionIndex={currentInstructionIndex}
                    isPlaying={isPlaying}
                    pipelineState={pipelineState}
                  />
                </div>
              </>
            ) : (
              <div className="ide-empty">
                <p className="title">{pipelineState.runtime === 'error' ? 'Compilation failed.' : 'No scene loaded.'}</p>
                <p className="muted mt-2">
                  {pipelineState.runtime === 'error' ? 'The console below says where. Fix it and compile again.' : 'Press Compile to build the scene.'}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <IDEBottomPanel
        aqir={aqir}
        currentInstructionIndex={currentInstructionIndex}
        runtimeStatus={{
          scene: ast?.scenes[0]?.name.name ?? 'Unknown',
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
