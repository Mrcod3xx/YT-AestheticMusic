import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { SHORTCUT_HELP_ITEMS } from '../../../shared/keyboardShortcuts';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm pointer-events-auto"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Aesthetic Music Keyboard Shortcuts"
        className="w-full max-w-[460px] rounded-3xl p-5 text-zinc-100"
        style={{
          background: 'rgba(16, 17, 23, 0.94)',
          backdropFilter: 'blur(32px) saturate(165%)',
          WebkitBackdropFilter: 'blur(32px) saturate(165%)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: '0 28px 75px rgba(0, 0, 0, 0.85)',
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3.5">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[var(--aesthetic-accent-strong,#C28356)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close Shortcuts (Esc)"
            aria-label="Close Shortcuts"
            className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-queue-scroll">
          {SHORTCUT_HELP_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-zinc-100">
                  {item.label}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {item.description}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-1 rounded-lg bg-white/[0.08] border border-white/15 font-mono text-[11px] font-semibold text-[var(--aesthetic-accent,#E89B63)]"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
          <span>Disabled automatically while typing in search or forms</span>
          <span className="font-mono text-zinc-300">Esc to close</span>
        </div>
      </div>
    </div>
  );
};
