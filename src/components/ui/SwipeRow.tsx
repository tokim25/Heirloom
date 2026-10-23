import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeRowProps {
  /** Called once the row is dragged far enough to the left and released. */
  onSwipeDelete: () => void;
  children: React.ReactNode;
}

const THRESHOLD = 96;

/**
 * Drag a row to the left to delete it, like Reminders and Mail. Touch only (a mouse keeps its own buttons), and only
 * when the drag is mostly sideways, so scrolling the list never deletes anything. Whatever deletes should offer Undo.
 */
export const SwipeRow: React.FC<SwipeRowProps> = ({ onSwipeDelete, children }) => {
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    start.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!dragging.current) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        start.current = null; // a vertical scroll: not ours
        return;
      }
      if (dx > -12) return;
      dragging.current = true;
      setSettling(false);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    setOffset(Math.min(0, dx));
  };

  const finish = () => {
    const wasDragging = dragging.current;
    start.current = null;
    dragging.current = false;
    if (!wasDragging) return;
    setSettling(true);
    if (offset <= -THRESHOLD) {
      setOffset(-480);
      window.setTimeout(() => {
        onSwipeDelete();
        setOffset(0);
        setSettling(false);
      }, 160);
    } else {
      setOffset(0);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-rose-700 text-white flex items-center justify-end gap-2 pr-6 text-sm font-semibold"
        style={{ opacity: offset < 0 ? 1 : 0 }}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="relative bg-surface"
        style={{
          transform: `translateX(${offset}px)`,
          transition: settling ? 'transform 160ms ease-out' : 'none',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
};
