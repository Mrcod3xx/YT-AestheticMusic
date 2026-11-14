import { ExtensionMessage, YTMStatusResponse } from './types';
import { hasValidExtensionRuntime } from './runtimeSafety';

export async function findYouTubeMusicTabs(): Promise<chrome.tabs.Tab[]> {
  if (!hasValidExtensionRuntime() || !chrome.tabs) return [];
  try {
    return await chrome.tabs.query({ url: 'https://music.youtube.com/*' });
  } catch {
    return [];
  }
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (!hasValidExtensionRuntime() || !chrome.tabs) return null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

export async function sendMessageToYTMTab<T = YTMStatusResponse>(
  message: ExtensionMessage
): Promise<T | null> {
  const activeTab = await getActiveTab();
  if (activeTab?.id && activeTab.url?.startsWith('https://music.youtube.com')) {
    try {
      return await chrome.tabs.sendMessage(activeTab.id, message);
    } catch {
      // Content script might not be injected yet
    }
  }

  const ytmTabs = await findYouTubeMusicTabs();
  for (const tab of ytmTabs) {
    if (tab.id) {
      try {
        return await chrome.tabs.sendMessage(tab.id, message);
      } catch {
        continue;
      }
    }
  }
  return null;
}

export async function broadcastToYTM(message: ExtensionMessage): Promise<void> {
  const ytmTabs = await findYouTubeMusicTabs();
  await Promise.all(
    ytmTabs.map(async (tab) => {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch {
          // Ignore tabs where content script is not ready
        }
      }
    })
  );
}
