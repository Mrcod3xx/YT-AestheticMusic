/**
 * Runtime safety helpers for Chrome MV3 extension reload recovery and scoped input shielding.
 */

export function hasValidExtensionRuntime(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function isExtensionContextInvalidatedError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : String(err);

  return (
    msg.includes('Extension context invalidated') ||
    msg.includes('context invalidated') ||
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection')
  );
}

interface KeyboardTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

export function shouldShieldKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as KeyboardTargetLike;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  const role = el.getAttribute?.('role')?.toLowerCase();
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}
