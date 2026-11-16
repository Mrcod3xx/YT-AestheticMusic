export const SLEEP_FADE_WINDOW_MS = 15_000;
export const POMODORO_FOCUS_MS = 25 * 60_000;
export const POMODORO_BREAK_MS = 5 * 60_000;

export type PomodoroPhase = 'focus' | 'break';

export interface PomodoroState {
  active: boolean;
  running: boolean;
  phase: PomodoroPhase;
  remainingMs: number;
  completedFocusSessions: number;
}

/**
 * Returns a smooth 1.0 -> 0.04 attenuation factor during the final sleep fade window
 * so audio fades out gently before pausing playback.
 */
export function computeSleepFadeFactor(
  remainingMs: number,
  fadeWindowMs = SLEEP_FADE_WINDOW_MS
): number {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0;
  if (fadeWindowMs <= 0 || remainingMs >= fadeWindowMs) return 1;
  const linear = remainingMs / fadeWindowMs;
  const curved = linear * linear * (3 - 2 * linear); // smoothstep ease
  return Math.max(0.04, Math.min(1, curved));
}

/** Formats remaining milliseconds into compact `MM:SS` or `H:MM:SS` readout. */
export function formatCountdownMmSs(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function createInitialPomodoroState(): PomodoroState {
  return {
    active: false,
    running: false,
    phase: 'focus',
    remainingMs: POMODORO_FOCUS_MS,
    completedFocusSessions: 0,
  };
}

/** Transitions a finished Pomodoro session cleanly between 25m focus and 5m break. */
export function advancePomodoroPhase(state: PomodoroState): PomodoroState {
  if (state.phase === 'focus') {
    return {
      ...state,
      phase: 'break',
      remainingMs: POMODORO_BREAK_MS,
      completedFocusSessions: state.completedFocusSessions + 1,
    };
  }
  return {
    ...state,
    phase: 'focus',
    remainingMs: POMODORO_FOCUS_MS,
  };
}
