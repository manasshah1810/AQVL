import React, { useId } from 'react';
import { motion } from 'motion/react';
import { spring } from '../../lib/motion';
import './controls.css';

/** A row of mutually exclusive choices, one filled. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`seg ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} title={o.hint} className={`seg__opt${on ? ' is-on' : ''}`} onClick={() => onChange(o.value)}>
            {on && <motion.span layoutId={`seg-${id}`} className="seg__bg" transition={spring.layout} />}
            <span className="seg__label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** An on / off switch with a visible label (the whole row is the button). */
export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="tog" onClick={() => onChange(!checked)}>
      <span className="tog__text">
        <span className="tog__label">{label}</span>
        {hint && <span className="tog__hint">{hint}</span>}
      </span>
      <span className="tog__track" aria-hidden="true">
        <motion.span className="tog__thumb" animate={{ x: checked ? 16 : 0 }} transition={spring.snappy} />
      </span>
    </button>
  );
}
