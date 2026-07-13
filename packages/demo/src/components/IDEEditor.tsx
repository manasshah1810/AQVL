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
    const keywords = ['SCENE', 'DECLARE', 'ARRAY', 'SEQUENCE', 'COMPARE', 'SWAP', 'END'];
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    
    // Simple regex for numbers
    const numberRegex = /\b\d+\b/g;

    let html = code
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(keywordRegex, '<span class="keyword">$1</span>')
      .replace(numberRegex, '<span class="number">$&</span>');

    return html;
  };

  const handleScroll = () => {
    const textarea = textareaRef.current;
    const overlay = textarea?.nextElementSibling as HTMLElement;
    if (textarea && overlay) {
      overlay.scrollTop = textarea.scrollTop;
      overlay.scrollLeft = textarea.scrollLeft;
    }
  };

  return (
    <div className="aqvl-editor-container">
      <textarea
        ref={textareaRef}
        className="aqvl-editor-textarea"
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        readOnly={readOnly}
        spellCheck="false"
      />
      <div 
        className="aqvl-editor-overlay" 
        dangerouslySetInnerHTML={{ __html: highlightCode(value) + '<br/>' }} 
        aria-hidden="true"
      />
    </div>
  );
}
