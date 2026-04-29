'use client';

import { useRef, useCallback, useState } from 'react';
import { Move } from 'lucide-react';

interface Props {
  /** URL of the image to position */
  imageUrl: string;
  /** Width of image as % of canvas (0–100) */
  imageWidth: number;
  /** Opacity for watermark (0–1). Pass 1 for header. */
  opacity: number;
  /** Current X position in % of canvas (0–100) */
  x: number;
  /** Current Y position in % of canvas (0–100) */
  y: number;
  /** Called when user drops the image to a new position */
  onChange: (x: number, y: number) => void;
  /** Label shown at top of canvas */
  label: string;
  /** Background indicator text (e.g. "Document Content") */
  docBg?: boolean;
}

/**
 * A Canva-like canvas where an image can be dragged to any position.
 * Position is stored as percentage of canvas dimensions (center of image).
 */
export default function DraggableImageCanvas({
  imageUrl, imageWidth, opacity, x, y, onChange, label, docBg = true,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x, y });
  const [isDragging, setIsDragging] = useState(false);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current = { x, y };

    function onMove(ev: MouseEvent) {
      if (!dragging.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - startMouse.current.x) / rect.width) * 100;
      const dy = ((ev.clientY - startMouse.current.y) / rect.height) * 100;
      onChange(
        clamp(startPos.current.x + dx, 0, 100),
        clamp(startPos.current.y + dy, 0, 100),
      );
    }
    function onUp() {
      dragging.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [x, y, onChange]);

  // Touch support
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragging.current = true;
    setIsDragging(true);
    startMouse.current = { x: touch.clientX, y: touch.clientY };
    startPos.current = { x, y };

    function onMove(ev: TouchEvent) {
      if (!dragging.current || !canvasRef.current) return;
      const t = ev.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((t.clientX - startMouse.current.x) / rect.width) * 100;
      const dy = ((t.clientY - startMouse.current.y) / rect.height) * 100;
      onChange(
        clamp(startPos.current.x + dx, 0, 100),
        clamp(startPos.current.y + dy, 0, 100),
      );
    }
    function onEnd() {
      dragging.current = false;
      setIsDragging(false);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    }
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  }, [x, y, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-slate-300">{label}</span>
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <Move className="w-3 h-3" /> Drag to reposition
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 overflow-hidden select-none"
        style={{ height: 220, background: '#f8f9fa', cursor: isDragging ? 'grabbing' : 'default' }}
      >
        {/* Document content placeholder */}
        {docBg && (
          <div className="absolute inset-0 flex flex-col gap-1.5 p-4 pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-2 rounded bg-gray-200 dark:bg-slate-700"
                style={{ width: `${70 + (i % 3) * 10}%`, opacity: 0.5 }} />
            ))}
          </div>
        )}

        {/* Draggable image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={label}
          draggable={false}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
            width: `${imageWidth}%`,
            opacity,
            objectFit: 'contain',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            maxHeight: '80%',
            transition: dragging.current ? 'none' : undefined,
          }}
        />

        {/* Position indicator */}
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] rounded px-1.5 py-0.5 pointer-events-none font-mono">
          {Math.round(x)}%, {Math.round(y)}%
        </div>

        {/* Crosshair guide lines */}
        {isDragging && (
          <>
            <div className="absolute top-0 bottom-0 border-l border-dashed border-primary-400/50 pointer-events-none" style={{ left: `${x}%` }} />
            <div className="absolute left-0 right-0 border-t border-dashed border-primary-400/50 pointer-events-none" style={{ top: `${y}%` }} />
          </>
        )}
      </div>

      {/* Quick-position buttons */}
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: '↖ Top Left', x: 10, y: 10 },
          { label: '↑ Top Center', x: 50, y: 10 },
          { label: '↗ Top Right', x: 90, y: 10 },
          { label: '← Mid Left', x: 10, y: 50 },
          { label: '⊕ Center', x: 50, y: 50 },
          { label: '→ Mid Right', x: 90, y: 50 },
          { label: '↙ Bot Left', x: 10, y: 85 },
          { label: '↓ Bot Center', x: 50, y: 85 },
          { label: '↘ Bot Right', x: 90, y: 85 },
        ].map(p => (
          <button key={p.label}
            onClick={() => onChange(p.x, p.y)}
            className={`text-[10px] py-1 px-1 rounded border transition-colors ${Math.abs(x - p.x) < 5 && Math.abs(y - p.y) < 5 ? 'border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 text-gray-500 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
