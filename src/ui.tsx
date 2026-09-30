// Small shared UI pieces: value formatting/parsing, swatches, sheets, the visual viewport helper.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NOW, type FieldDef, type Kind } from './config';
import { abbr } from './format';

export function fmtValue(f: Pick<FieldDef, 'key' | 'kind'>, v: number): string {
  if (f.key === 'downPct' && v >= 1) return 'Cash buyer';
  if (f.key === 'buyYear') return v === 0 ? `Now (${NOW})` : String(NOW + v);
  if (f.kind === 'pct') return `${+(v * 100).toFixed(2)}%`;
  if (f.kind === 'aed') return `AED ${abbr(v)}`;
  return `${v} yr${v === 1 ? '' : 's'}`;
}

export function toInput(kind: Kind, v: number): string {
  if (kind === 'pct') return String(+(v * 100).toFixed(3));
  if (kind === 'aed') {
    if (v !== 0 && v % 1_000_000 === 0) return `${v / 1_000_000}M`;
    if (v !== 0 && v % 1000 === 0) return `${v / 1000}k`;
  }
  return String(v);
}

/** "3.5M", "250k", "250,000", "5.95" -> number (percent kinds divided by 100). */
export function parseOne(t: string, kind: Kind): number | null {
  const m = t.replace(/[,\s]|AED/gi, '').match(/^(-?\d*\.?\d+)([kKmM]?)%?$/);
  if (!m) return null;
  const mult = m[2].toLowerCase() === 'k' ? 1e3 : m[2].toLowerCase() === 'm' ? 1e6 : 1;
  const v = Number(m[1]) * mult;
  return kind === 'pct' ? +(v / 100).toFixed(6) : v;
}

export function Swatch({ color, dash, width = 2.5, w = 24 }: { color: string; dash?: string; width?: number; w?: number }) {
  return (
    <svg width={w} height="10" className="swatch" aria-hidden>
      <line x1="1" y1="5" x2={w - 1} y2="5" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash || undefined} />
    </svg>
  );
}

/** Keeps --vvh / --vvtop in sync with the visual viewport (iOS: fixed + dvh break on restore). */
export function useVisualViewport() {
  const [kb, setKb] = useState(0); // keyboard overlap in px
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      const top = vv ? vv.offsetTop : 0;
      root.style.setProperty('--vvh', `${h}px`);
      root.style.setProperty('--vvtop', `${top}px`);
      setKb(Math.max(0, window.innerHeight - (top + h)));
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('pageshow', update);
    document.addEventListener('visibilitychange', update);
    const onFocus = () => [50, 300, 600].forEach((t) => setTimeout(update, t));
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onFocus);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('pageshow', update);
      document.removeEventListener('visibilitychange', update);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onFocus);
    };
  }, []);
  return kb;
}

/** Bottom sheet on phones, centred dialog on desktop. */
export function Sheet({ open, onClose, title, subtitle, children, tall, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; tall?: boolean; footer?: ReactNode;
}) {
  const kb = useVisualViewport();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-layer" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={tall ? 'sheet tall' : 'sheet'} role="dialog" aria-modal="true" aria-label={title} style={{ marginBottom: kb }}>
        <div className="sheet-grab" aria-hidden />
        <div className="sheet-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Chevron({ open }: { open?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className={open ? 'chev open' : 'chev'} aria-hidden>
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
