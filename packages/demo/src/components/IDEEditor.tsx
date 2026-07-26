import React, { useState, useRef, useEffect } from 'react';

interface IDEEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function IDEEditor({ initialValue, onChange, readOnly = false }: IDEEditorProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onChange(e.target.value);
  };

  // Basic syntax highlighting overlay
  const highlightCode = (code: string) => {
    // Simple regex for basic AQVL keywords
    const keywords = [
      'SCENE', 'DECLARE', 'ARRAY', 'SEQUENCE', 'COMPARE', 'SWAP', 'END', 
      'HIGHLIGHT', 'UPDATE', 'INSERT', 'DELETE', 'MOVE', 'LINKEDLIST', 
      'INSERT_HEAD', 'INSERT_TAIL', 'DELETE_HEAD', 'DELETE_TAIL', 
      'WAIT', 'LOOP', 'FROM', 'TO', 'IF', 'LENGTH', 'NULL', 'DOUBLY',
      'TREE', 'ROOT', 'CHILD', 'PARENT', 'PREORDER', 'POSTORDER', 'LEVELORDER', 'DFS', 'BFS', 'SEARCH',
      'INTO', 'HEIGHT', 'SIZE', 'LEAVES', 'ANCESTORS', 'PATH'
    ];
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    
    // CIRCULAR is a structural modifier — distinct vivid purple
    const circularRegex = /\bCIRCULAR\b/g;

    // Simple regex for numbers
    const numberRegex = /\b\d+\b/g;

    let html = code
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(keywordRegex, '<span class="keyword">$1</span>')
      .replace(circularRegex, '<span class="keyword-circular">CIRCULAR</span>')
      .replace(numberRegex, '<span class="number">$&</span>')
      .replace(/(\/\/.*)$/gm, '<span class="comment">$1</span>');

    return html;
  };

  return (
    <div className="aqvl-editor-container">
      <div className="aqvl-editor-scroller">
        <textarea
          ref={textareaRef}
          className="aqvl-editor-textarea"
          value={value}
          onChange={handleChange}
          readOnly={readOnly}
          spellCheck="false"
        />
        <div 
          className="aqvl-editor-overlay" 
          dangerouslySetInnerHTML={{ __html: highlightCode(value) + '<br/>' }} 
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
