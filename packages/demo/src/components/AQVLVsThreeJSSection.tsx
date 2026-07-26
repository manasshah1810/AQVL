import React, { useEffect, useRef, useState, useCallback } from 'react';
import './AQVLVsThreeJSSection.css';

const AQVL_CODE = `SCENE "Array Swap"

DECLARE
    ARRAY arr = [10, 20, 30]

SEQUENCE
    HIGHLIGHT arr[0]
    HIGHLIGHT arr[2]
    SWAP arr[0] arr[2]
END`;

const THREE_CODE = `import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import * as TWEEN from '@tweenjs/tween.js';

// 1. Setup Scene, Camera, Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// 2. Setup Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// 3. Create Array Elements
const arr = [10, 20, 30];
const group = new THREE.Group();
const cubes = [];

const geometry = new THREE.BoxGeometry(2, 2, 2);
const defaultMat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a });

arr.forEach((val, i) => {
    const mesh = new THREE.Mesh(geometry, defaultMat.clone());
    mesh.position.x = (i - 1) * 3;
    
    // (Font loading and TextGeometry setup omitted for brevity...)
    
    cubes.push(mesh);
    group.add(mesh);
});
scene.add(group);

// 4. Highlight Logic
function highlight(index) {
    cubes[index].material.color.setHex(0xa855f7);
}
highlight(0);
highlight(2);

// 5. Swap Animation
function swap(idx1, idx2) {
    const obj1 = cubes[idx1];
    const obj2 = cubes[idx2];
    const pos1 = obj1.position.clone();
    const pos2 = obj2.position.clone();

    new TWEEN.Tween(obj1.position)
        .to({ x: pos2.x }, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();

    new TWEEN.Tween(obj2.position)
        .to({ x: pos1.x }, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
        
    // Swap references
    const temp = cubes[idx1];
    cubes[idx1] = cubes[idx2];
    cubes[idx2] = temp;
}

// Trigger swap after 1s
setTimeout(() => swap(0, 2), 1000);

// 6. Render Loop
function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
    renderer.render(scene, camera);
}
animate();`;

const highlightJS = (code: string) => {
  let colored = code
    .replace(/(\/\/.*)/g, '<span class="js-comment">$1</span>')
    .replace(/\b(import|from|const|let|var|function|new|return|if|true|false)\b/g, '<span class="js-kw">$1</span>')
    .replace(/('[^']*')/g, '<span class="js-str">$1</span>')
    .replace(/\b(THREE|document|window|Math|Date|OrbitControls)\b/g, '<span class="js-class">$1</span>');
  
  return <span dangerouslySetInnerHTML={{ __html: colored }} />;
};

const tokenizeAQVL = (line: string) => {
    if (line.startsWith('//')) return <span className="ctv-tok-comment">{line}</span>;
    if (/^(SCENE|DECLARE|SEQUENCE|END)\b/.test(line)) {
        return (
            <>
                <span className="ctv-tok-kw">{line.split(' ')[0]}</span>
                {line.split(' ').length > 1 && <span className="ctv-tok-str">{' ' + line.split(' ').slice(1).join(' ')}</span>}
            </>
        );
    }
    if (line.trim().startsWith('CUBE')) {
        return (
            <>
                <span style={{ opacity: 0 }}>{'    '}</span>
                <span className="ctv-tok-type">CUBE</span>
                <span className="ctv-tok-ident">{' ' + line.trim().split(' ')[1]}</span>
            </>
        );
    }
    if (line.includes('=')) {
        const parts = line.split('=');
        return (
            <>
                <span style={{ opacity: 0 }}>{'    '}</span>
                <span className="ctv-tok-ident">{parts[0].trim()}</span>
                <span className="ctv-tok-num"> = </span>
                <span className="ctv-tok-str">{parts[1].trim()}</span>
            </>
        );
    }
    if (line.includes('.rotate')) {
        return (
            <>
                <span style={{ opacity: 0 }}>{'    '}</span>
                <span className="ctv-tok-ident">myCube.rotate</span>
                <span className="ctv-tok-num">(360, 2s)</span>
            </>
        );
    }
    return <span>{line}</span>;
};

export function AQVLVsThreeJSSection() {
    const [aqvlLines, setAqvlLines] = useState<string[]>([]);
    const [threeLines, setThreeLines] = useState<string[]>([]);
    const [aqvlCurrent, setAqvlCurrent] = useState('');
    const [threeCurrent, setThreeCurrent] = useState('');
    const [showResult, setShowResult] = useState(false);
    
    const aqvlLinesArray = AQVL_CODE.split('\n');
    const threeLinesArray = THREE_CODE.split('\n');

    const aqvlRef = useRef<HTMLDivElement>(null);
    const threeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (aqvlRef.current) aqvlRef.current.scrollTop = aqvlRef.current.scrollHeight;
    }, [aqvlLines, aqvlCurrent]);

    useEffect(() => {
        if (threeRef.current) threeRef.current.scrollTop = threeRef.current.scrollHeight;
    }, [threeLines, threeCurrent]);

    useEffect(() => {
        let isCancelled = false;

        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        const runTyping = async () => {
            while (!isCancelled) {
                setAqvlLines([]);
                setThreeLines([]);
                setAqvlCurrent('');
                setThreeCurrent('');
                setShowResult(false);
                
                await delay(1000); // initial wait

                const runAqvl = async () => {
                    for (let i = 0; i < aqvlLinesArray.length; i++) {
                        if (isCancelled) return;
                        const text = aqvlLinesArray[i];
                        for (let c = 0; c <= text.length; c++) {
                            if (isCancelled) return;
                            setAqvlCurrent(text.slice(0, c));
                            await delay(15);
                        }
                        setAqvlLines(prev => [...prev, text]);
                        setAqvlCurrent('');
                        await delay(100); 
                    }
                };

                const runThree = async () => {
                    for (let i = 0; i < threeLinesArray.length; i++) {
                        if (isCancelled) return;
                        const text = threeLinesArray[i];
                        const charDelay = i > 15 ? 2 : 12; 
                        const lineDelay = i > 15 ? 10 : 60;

                        for (let c = 0; c <= text.length; c++) {
                            if (isCancelled) return;
                            setThreeCurrent(text.slice(0, c));
                            await delay(charDelay);
                        }
                        setThreeLines(prev => [...prev, text]);
                        setThreeCurrent('');
                        await delay(lineDelay);
                    }
                };

                runAqvl();
                await runThree();

                if (isCancelled) return;

                await delay(500);
                setShowResult(true);

                await delay(5000);
            }
        };

        runTyping();
        return () => { isCancelled = true; };
    }, [aqvlLinesArray.length, threeLinesArray.length]);

    return (
        <section className="vs-section" aria-label="Comparison with Three.js">
            <div className="vs-header">
                <div className="landing-section-label">
                    <span>The Difference</span>
                </div>
                <h2 className="vs-title">Stop writing boilerplate.</h2>
                <p className="vs-subtitle">
                    AQVL abstracts the complexity of WebGL so you can focus on algorithms, not rendering logic.
                </p>
            </div>

            <div className="vs-container">
                {/* Overlay Result */}
                <div className={`vs-result-overlay ${showResult ? 'visible' : ''}`}>
                    <div className="vs-result-card">
                        <div className="vs-result-text">
                            <span className="vs-highlight-aqvl">9 lines of AQVL</span>
                            <span className="vs-equals">=</span>
                            <span className="vs-highlight-three">75 lines of Three.js</span>
                        </div>
                        <p className="vs-result-subtext">Up to 88% less code for standard 3D interactions.</p>
                    </div>
                </div>

                {/* Left: AQVL */}
                <div className="vs-editor-panel vs-aqvl-panel">
                    <div className="vs-editor-chrome">
                        <div className="ctv-editor-dots">
                            <span className="ctv-dot ctv-dot--red" />
                            <span className="ctv-dot ctv-dot--yellow" />
                            <span className="ctv-dot ctv-dot--green" />
                        </div>
                        <div className="ctv-editor-title">cube.aqvl</div>
                        <div className="vs-editor-badge vs-badge-aqvl">AQVL</div>
                    </div>
                    <div className="vs-editor-body" ref={aqvlRef}>
                        <div className="vs-editor-lines">
                            {aqvlLines.map((line, i) => (
                                <div key={i} className="vs-line">
                                    <span className="vs-line-num">{i + 1}</span>
                                    <span className="vs-line-content">{tokenizeAQVL(line)}</span>
                                </div>
                            ))}
                            {!aDoneStatus(aqvlLines.length, aqvlLinesArray.length) && (
                                <div className="vs-line">
                                    <span className="vs-line-num">{aqvlLines.length + 1}</span>
                                    <span className="vs-line-content">
                                        {aqvlCurrent}
                                        <span className="vs-cursor" />
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* VS Badge */}
                <div className="vs-badge-center">VS</div>

                {/* Right: Three.js */}
                <div className="vs-editor-panel vs-three-panel">
                    <div className="vs-editor-chrome">
                        <div className="ctv-editor-dots">
                            <span className="ctv-dot ctv-dot--red" />
                            <span className="ctv-dot ctv-dot--yellow" />
                            <span className="ctv-dot ctv-dot--green" />
                        </div>
                        <div className="ctv-editor-title">cube.js</div>
                        <div className="vs-editor-badge vs-badge-three">Three.js</div>
                    </div>
                    <div className="vs-editor-body" ref={threeRef}>
                        <div className="vs-editor-lines">
                            {threeLines.map((line, i) => (
                                <div key={i} className="vs-line">
                                    <span className="vs-line-num">{i + 1}</span>
                                    <span className="vs-line-content">{highlightJS(line)}</span>
                                </div>
                            ))}
                            {!tDoneStatus(threeLines.length, threeLinesArray.length) && (
                                <div className="vs-line">
                                    <span className="vs-line-num">{threeLines.length + 1}</span>
                                    <span className="vs-line-content">
                                        {threeCurrent}
                                        <span className="vs-cursor" />
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function aDoneStatus(current: number, total: number) {
    return current >= total;
}
function tDoneStatus(current: number, total: number) {
    return current >= total;
}
