import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Open sheets, topmost last. Only the topmost reacts to Escape, and the page stays locked
// until the last one closes.
const openSheets: string[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface SheetProps {
  open: boolean;
  /** Called for Escape, the close button and taps outside. The parent decides whether to close. */
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  /**
   * 'bare' supplies only the backdrop, panel and behavior and lets the children draw their own
   * header and body (for windows with a custom layout). 'standard' adds the title bar and footer.
   */
  variant?: 'standard' | 'bare';
  /** On phones, fill the whole screen instead of leaving a gap above a bottom sheet. */
  fullOnMobile?: boolean;
  /** 'right' makes a full-height drawer (used by Chef AI chat). */
  placement?: 'center' | 'right';
  /** Set false while something is saving so the sheet cannot be dismissed mid-write. */
  dismissible?: boolean;
}

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '4xl': 'sm:max-w-4xl',
} as const;

/**
 * The one dialog primitive for Heirloom: a bottom sheet on phones and a centered card on larger
 * screens, with Escape to close, a focus trap, scroll lock, and correct dialog semantics.
 */
export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'xl',
  variant = 'standard',
  placement = 'center',
  fullOnMobile = false,
  dismissible = true,
}) => {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openSheets.push(id);
    document.body.style.overflow = 'hidden';

    // Move focus into the sheet unless something inside (like an autofocus field) already has it.
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      // Prefer the content or footer (for a confirmation that is Cancel), not the close button.
      const target =
        panel.querySelector<HTMLElement>('[data-sheet-body] ' + FOCUSABLE.split(', ').join(', [data-sheet-body] ')) ??
        panel.querySelector<HTMLElement>('[data-sheet-footer] ' + FOCUSABLE.split(', ').join(', [data-sheet-footer] ')) ??
        panel.querySelector<HTMLElement>(FOCUSABLE) ??
        panel;
      target.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (openSheets[openSheets.length - 1] !== id) return;
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = openSheets.indexOf(id);
      if (index >= 0) openSheets.splice(index, 1);
      if (openSheets.length === 0) document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, id]);

  if (!open) return null;

  const isDrawer = placement === 'right';
  const panelClass = isDrawer
    ? `sheet-drawer w-full ${SIZES[size]} bg-canvas h-full shadow-2xl border-l border-stone-200 flex flex-col overflow-hidden focus:outline-none`
    : `sheet-panel relative w-full ${SIZES[size]} bg-canvas ${
        fullOnMobile ? 'h-[100dvh] rounded-none' : 'rounded-t-3xl max-h-[94dvh]'
      } sm:h-auto sm:rounded-3xl sm:max-h-[90dvh] shadow-2xl border border-stone-200 flex flex-col overflow-hidden focus:outline-none`;

  return createPortal(
    <div
      className={`sheet-backdrop fixed inset-0 z-50 bg-ink-deep/55 backdrop-blur-sm flex ${
        isDrawer ? 'justify-end' : 'items-end sm:items-center justify-center sm:p-6'
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={variant === 'bare' ? title : undefined}
        aria-labelledby={variant === 'bare' ? undefined : `${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        className={panelClass}
      >
        {variant === 'bare' ? (
          children
        ) : (
          <>
            <div className="px-6 pt-5 pb-4 border-b border-stone-200/80 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 id={`${id}-title`} className="font-serif text-2xl text-stone-900 leading-tight">
                  {title}
                </h2>
                {description && (
                  <p id={`${id}-desc`} className="text-sm text-stone-600 mt-0.5">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={!dismissible}
                aria-label="Close"
                className="min-h-11 min-w-11 -mr-2 -mt-1 inline-flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 hover:text-stone-900 disabled:opacity-40"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div data-sheet-body className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 flex flex-col gap-4">
              {children}
            </div>

            {footer && (
              <div
                data-sheet-footer
                className="px-4 sm:px-6 pt-3 border-t border-stone-200/80 flex items-center justify-end gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                {footer}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Replaces the browser's native confirm() with something that matches the app. */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) => (
  <Sheet
    open={open}
    onClose={onCancel}
    title={title}
    size="sm"
    dismissible={!busy}
    footer={
      <>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-11 px-4 text-sm font-semibold text-stone-700 hover:text-stone-950 rounded-xl"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`min-h-12 px-6 rounded-xl text-base font-semibold text-white disabled:opacity-50 ${
            destructive ? 'bg-rose-700 hover:bg-rose-800' : 'bg-ink hover:bg-ink-hover'
          }`}
        >
          {confirmLabel}
        </button>
      </>
    }
  >
    <p className="text-base text-stone-700">{message}</p>
  </Sheet>
);
