import { describe, expect, it } from 'vitest';
import {
  advancePomodoroPhase,
  computeSleepFadeFactor,
  createInitialPomodoroState,
  formatCountdownMmSs,
  POMODORO_BREAK_MS,
  POMODORO_FOCUS_MS,
  SLEEP_FADE_WINDOW_MS,
} from '../src/shared/sleepAndFocusTimer';

describe('sleepAndFocusTimer helpers', () => {
  it('computes smoothstep volume fade only inside the final 15s sleep window', () => {
    expect(computeSleepFadeFactor(SLEEP_FADE_WINDOW_MS + 5000)).toBe(1);
    expect(computeSleepFadeFactor(SLEEP_FADE_WINDOW_MS)).toBe(1);

    const mid = computeSleepFadeFactor(SLEEP_FADE_WINDOW_MS / 2);
    expect(mid).toBeCloseTo(0.5, 2);

    const tiny = computeSleepFadeFactor(100);
    expect(tiny).toBeGreaterThanOrEqual(0.04);
    expect(tiny).toBeLessThan(0.2);

    expect(computeSleepFadeFactor(0)).toBe(0);
    expect(computeSleepFadeFactor(-500)).toBe(0);
  });

  it('formats countdown milliseconds into readable MM:SS and H:MM:SS text', () => {
    expect(formatCountdownMmSs(0)).toBe('00:00');
    expect(formatCountdownMmSs(9_100)).toBe('00:10');
    expect(formatCountdownMmSs(25 * 60_000)).toBe('25:00');
    expect(formatCountdownMmSs(65 * 60_000)).toBe('1:05:00');
  });

  it('transitions Pomodoro state between focus and break while counting focus completions', () => {
    const initial = createInitialPomodoroState();
    expect(initial.active).toBe(false);
    expect(initial.running).toBe(false);
    expect(initial.phase).toBe('focus');
    expect(initial.remainingMs).toBe(POMODORO_FOCUS_MS);
    expect(initial.completedFocusSessions).toBe(0);

    const toBreak = advancePomodoroPhase({ ...initial, active: true, running: true });
    expect(toBreak.phase).toBe('break');
    expect(toBreak.remainingMs).toBe(POMODORO_BREAK_MS);
    expect(toBreak.completedFocusSessions).toBe(1);

    const backToFocus = advancePomodoroPhase(toBreak);
    expect(backToFocus.phase).toBe('focus');
    expect(backToFocus.remainingMs).toBe(POMODORO_FOCUS_MS);
    expect(backToFocus.completedFocusSessions).toBe(1);
  });
});
