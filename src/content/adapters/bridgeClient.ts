let reqCounter = 0;

export function callMainWorldBridge<T = Record<string, unknown>>(
  action: string,
  payload?: Record<string, unknown>,
  timeoutMs = 2800
): Promise<T | null> {
  return new Promise((resolve) => {
    const requestId = `am-req-${Date.now()}-${++reqCounter}`;

    const timer = window.setTimeout(() => {
      window.removeEventListener('aesthetic-music:response', listener as EventListener);
      resolve(null);
    }, timeoutMs);

    const listener = (event: CustomEvent<{ requestId: string; data: T }>) => {
      if (event.detail?.requestId === requestId) {
        window.clearTimeout(timer);
        window.removeEventListener('aesthetic-music:response', listener as EventListener);
        resolve(event.detail.data);
      }
    };

    window.addEventListener('aesthetic-music:response', listener as EventListener);

    window.dispatchEvent(
      new CustomEvent('aesthetic-music:request', {
        detail: {
          action,
          requestId,
          payload,
        },
      })
    );
  });
}
