import React from 'react';
import { addDays, daysBetween, formatDate, shortDate } from './model';
import type { Segment, SeriesPoint } from './metrics';

const monthName = (k: string) => {
  const [yy, mm] = k.split('-').map(Number);
  return new Date(yy, mm - 1, 1).toLocaleDateString(undefined, { month: 'short' });
};

/** A "nice" step (1, 2, 2.5, 5 × 10^n) giving roughly `count` intervals. */
function niceStep(max: number, count = 5): number {
  const raw = Math.max(max, 1) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  return Math.max(1, step);
}

function axis(max: number): { top: number; ticks: number[] } {
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

// ─── Legend ──────────────────────────────────────────────────────────────

export function Legend({ items }: { items: { label: string; cls: string; value?: React.ReactNode; dashed?: boolean }[] }) {
  return (
    <ul className="tkc-legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className={`tkc-swatch ${i.cls} ${i.dashed ? 'is-dashed' : ''}`} />
          <span>{i.label}</span>
          {i.value !== undefined && <strong>{i.value}</strong>}
        </li>
      ))}
    </ul>
  );
}

// ─── Donut ───────────────────────────────────────────────────────────────


export function Donut({ segments, size = 168, center, sub }: { segments: Segment[]; size?: number; center: React.ReactNode; sub?: string }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const stroke = size * 0.16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="tkc-donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="tkc-track" strokeWidth={stroke} />
        {total > 0 &&
          segments.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                className={`tkc-seg ${s.cls}`}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              >
                <title>{`${s.label}: ${s.value} of ${total} (${Math.round((s.value / total) * 100)}%)`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="tkc-donut__center">
        <strong>{center}</strong>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

// ─── Burn-up ─────────────────────────────────────────────────────────────

export function BurnUp({
  data,
  today,
  height = 260,
}: {
  data: { start: string; end: string; total: number; planned: SeriesPoint[]; actual: SeriesPoint[] };
  today: string;
  height?: number;
}) {
  const W = 720;
  const H = height;
  const pad = { l: 40, r: 16, t: 16, b: 32 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const span = Math.max(1, daysBetween(data.start, data.end));
  const ax = axis(data.total);
  const yMax = ax.top;
  const x = (k: string) => pad.l + (daysBetween(data.start, k) / span) * iw;
  const y = (v: number) => pad.t + ih - (v / yMax) * ih;
  const path = (pts: SeriesPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');

  const monthTicks: string[] = [];
  const [sy, sm] = data.start.split('-').map(Number);
  for (let i = 0; i < 24; i++) {
    const k = new Date(sy, sm - 1 + i, 1);
    const key = `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, '0')}-01`;
    if (key > data.end) break;
    if (key >= data.start) monthTicks.push(key);
  }
  const dayTicks = monthTicks.length < 2 ? Array.from({ length: 5 }, (_, i) => addDays(data.start, Math.round((span * i) / 4))) : monthTicks;
  const todayIn = daysBetween(data.start, today) >= 0 && daysBetween(today, data.end) >= 0;
  const lastActual = data.actual.at(-1);
  const plannedToday = data.planned.filter((p) => p.date <= today).at(-1)?.value ?? 0;
  const area = data.actual.length
    ? `${path(data.actual)} L${x(data.actual.at(-1)!.date).toFixed(1)} ${y(0)} L${x(data.actual[0].date).toFixed(1)} ${y(0)} Z`
    : '';

  return (
    <figure className="tkc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Burn-up: ${lastActual?.value ?? 0} completed against ${plannedToday} planned by today, ${data.total} total`}>
        {ax.ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="tkc-grid" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="tkc-tick">{v}</text>
          </g>
        ))}
        {dayTicks.map((k) => (
          <text key={k} x={x(k)} y={H - 10} textAnchor="middle" className="tkc-tick">{shortDate(k)}</text>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(data.total)} y2={y(data.total)} className="tkc-scope" />
        <text x={W - pad.r} y={y(data.total) - 6} textAnchor="end" className="tkc-tick tkc-tick--strong">Scope {data.total}</text>
        {area && <path d={area} className="tkc-area" />}
        <path d={path(data.planned)} className="tkc-line tkc-line--planned" />
        {data.actual.length > 0 && <path d={path(data.actual)} className="tkc-line tkc-line--actual" />}
        {todayIn && (
          <g>
            <line x1={x(today)} x2={x(today)} y1={pad.t} y2={pad.t + ih} className="tkc-today" />
            <text x={x(today) + 6} y={pad.t + 12} className="tkc-tick tkc-tick--strong">Today</text>
          </g>
        )}
        {lastActual && (
          <circle cx={x(lastActual.date)} cy={y(lastActual.value)} r={5} className="tkc-dot">
            <title>{`${lastActual.value} completed by ${formatDate(lastActual.date)}`}</title>
          </circle>
        )}
        {data.planned.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={9} className="tkc-hit">
            <title>{`${formatDate(p.date)}: ${p.value} planned${data.actual.find((a) => a.date === p.date) ? `, ${data.actual.find((a) => a.date === p.date)!.value} done` : ''}`}</title>
          </circle>
        ))}
      </svg>
      <Legend
        items={[
          { label: 'Completed (actual)', cls: 'tkc-sw-actual', value: lastActual?.value ?? 0 },
          { label: 'Due by date (plan)', cls: 'tkc-sw-planned', dashed: true, value: plannedToday },
          { label: 'Total scope', cls: 'tkc-sw-scope', value: data.total },
        ]}
      />
    </figure>
  );
}

// ─── Column chart ────────────────────────────────────────────────────────

export function Columns({
  bars,
  height = 200,
  cls = 'tkc-col--accent',
  emptyNote,
}: {
  bars: { label: string; value: number; cls?: string; title?: string }[];
  height?: number;
  cls?: string;
  emptyNote?: string;
}) {
  const W = 720;
  const H = height;
  const pad = { l: 32, r: 8, t: 20, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const ax = axis(Math.max(...bars.map((b) => b.value), 0));
  const max = ax.top;
  const slot = iw / bars.length;
  const bw = Math.min(56, slot * 0.62);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const allZero = bars.every((b) => b.value === 0);

  return (
    <figure className="tkc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={bars.map((b) => `${b.label}: ${b.value}`).join(', ')}>
        {ax.ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="tkc-grid" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="tkc-tick">{v}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = pad.l + slot * i + slot / 2;
          const h = Math.max(b.value > 0 ? 3 : 0, ih - (y(b.value) - pad.t));
          return (
            <g key={b.label + i}>
              <rect x={cx - bw / 2} y={pad.t + ih - h} width={bw} height={h} rx={4} className={`tkc-col ${b.cls ?? cls}`}>
                <title>{b.title ?? `${b.label}: ${b.value}`}</title>
              </rect>
              {b.value > 0 && <text x={cx} y={pad.t + ih - h - 6} textAnchor="middle" className="tkc-val">{b.value}</text>}
              <text x={cx} y={H - 10} textAnchor="middle" className="tkc-tick">{b.label}</text>
            </g>
          );
        })}
        {allZero && emptyNote && (
          <text x={pad.l + iw / 2} y={pad.t + ih / 2} textAnchor="middle" className="tkc-empty">{emptyNote}</text>
        )}
      </svg>
    </figure>
  );
}

// ─── Stacked horizontal rows ─────────────────────────────────────────────

export function StackedRows({ rows }: { rows: { label: React.ReactNode; key: string; segments: Segment[]; right?: React.ReactNode }[] }) {
  return (
    <div className="tkc-stack">
      {rows.map((r) => {
        const total = r.segments.reduce((n, s) => n + s.value, 0);
        return (
          <div key={r.key} className="tkc-stack__row">
            <span className="tkc-stack__label">{r.label}</span>
            <div className="tkc-stack__bar" role="img" aria-label={r.segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
              {r.segments.filter((s) => s.value > 0).map((s) => (
                <span key={s.label} className={`tkc-stack__seg ${s.cls}`} style={{ flexGrow: s.value }} title={`${s.label}: ${s.value} of ${total}`} />
              ))}
            </div>
            <span className="tkc-stack__right">{r.right ?? total}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Activity heatmap ────────────────────────────────────────────────────

export function Heatmap({ data, today, weeks = 16 }: { data: Map<string, { sessions: number; completed: number }>; today: string; weeks?: number }) {
  const cell = 14;
  const gap = 3;
  const [y, m, d] = today.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const start = addDays(today, -dow - 7 * (weeks - 1));
  const labelW = 28;
  const W = labelW + weeks * (cell + gap);
  const H = 18 + 7 * (cell + gap);
  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
  const months: { x: number; label: string }[] = [];

  const cells: React.ReactNode[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const k = addDays(start, w * 7 + r);
      if (k > today) continue;
      if (r === 0 && (w === 0 || k.slice(8) <= '07')) months.push({ x: labelW + w * (cell + gap), label: monthName(k) });
      const e = data.get(k);
      const n = (e?.sessions ?? 0) + (e?.completed ?? 0);
      cells.push(
        <rect key={k} x={labelW + w * (cell + gap)} y={18 + r * (cell + gap)} width={cell} height={cell} rx={3} className={`tkc-heat tkc-heat--${level(n)}`}>
          <title>{`${formatDate(k)}: ${e?.sessions ?? 0} session${e?.sessions === 1 ? '' : 's'}, ${e?.completed ?? 0} task${e?.completed === 1 ? '' : 's'} completed`}</title>
        </rect>,
      );
    }
  }

  return (
    <figure className="tkc-chart tkc-chart--heat">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily activity: sessions recorded plus tasks completed">
        {months.map((mo) => <text key={mo.x} x={mo.x} y={11} className="tkc-tick">{mo.label}</text>)}
        {['Mon', 'Wed', 'Fri'].map((lbl, i) => (
          <text key={lbl} x={0} y={18 + (i * 2) * (cell + gap) + 11} className="tkc-tick">{lbl}</text>
        ))}
        {cells}
      </svg>
      <div className="tkc-heat-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`tkc-heat-key tkc-heat--${l}`} />)}
        <span>More</span>
      </div>
    </figure>
  );
}

