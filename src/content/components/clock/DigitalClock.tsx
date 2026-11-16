import React, { useEffect, useState } from 'react';
import { Moon, Timer, Play, Pause, X } from 'lucide-react';
import { AestheticSettings, ClockStyle } from '../../../shared/types';
import { resolveClockFontFamilyCss } from '../../../shared/themeTokens';

interface PomodoroClockPill {
  phase: 'focus' | 'break';
  timeText: string;
  running: boolean;
  onToggleRun?: () => void;
  onStop?: () => void;
}

interface DigitalClockProps {
  visible: boolean;
  use24Hour: boolean;
  clockStyle?: ClockStyle;
  scalePercent: number;
  color: string;
  fontFamily?: AestheticSettings['fontFamily'];
  paused?: boolean;
  sleepCountdownText?: string | null;
  onCancelSleepTimer?: () => void;
  pomodoro?: PomodoroClockPill | null;
}

export const DigitalClock: React.FC<DigitalClockProps> = ({
  visible,
  use24Hour,
  clockStyle = 'digital',
  scalePercent,
  color,
  fontFamily = 'modern',
  paused = false,
  sleepCountdownText = null,
  onCancelSleepTimer,
  pomodoro = null,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!visible || paused) return;
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, paused]);

  if (!visible) return null;

  const weekday = now.toLocaleDateString(undefined, { weekday: 'short' });
  const month = now.toLocaleDateString(undefined, { month: 'short' });
  const day = now.getDate();
  const formattedDate = `${weekday} ${month} ${day}`;

  const rawHours = now.getHours();
  const hours = use24Hour
    ? String(rawHours).padStart(2, '0')
    : String(rawHours % 12 || 12);
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const scale = Math.max(0.65, Math.min(1.5, scalePercent / 100));
  const clockFont = resolveClockFontFamilyCss(fontFamily);
  const isModernTall = fontFamily === 'modern';

  return (
    <div
      className="flex flex-col items-center select-none pointer-events-none z-20 transition-transform duration-300"
      style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
    >
      {/* Date Label */}
      <div
        className="text-[15.5px] font-medium tracking-[0.04em] mb-2"
        style={{
          color: 'rgba(235, 224, 212, 0.88)',
          textShadow: '0 2px 12px rgba(0, 0, 0, 0.78)',
        }}
      >
        {formattedDate}
      </div>

      {/* Geometric / Editorial / Mono / Flip Clock Numerals */}
      {clockStyle === 'flip' ? (
        <div
          className="flex items-center justify-center gap-3 mb-5"
          style={{ fontFamily: clockFont, color: color || '#C28356' }}
        >
          {[
            {
              value: use24Hour ? hours : hours.padStart(2, '0'),
              badge: !use24Hour ? (rawHours >= 12 ? 'PM' : 'AM') : undefined,
            },
            { value: minutes, badge: undefined },
          ].map((card, idx) => (
            <React.Fragment key={idx}>
              <div
                className="relative min-w-[104px] sm:min-w-[116px] px-4 py-2.5 rounded-2xl border border-white/15 bg-zinc-950/75 backdrop-blur-xl shadow-[0_16px_38px_rgba(0,0,0,0.58)] flex items-center justify-center overflow-hidden"
                style={{
                  backgroundImage:
                    'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 48%, rgba(0,0,0,0.28) 52%, rgba(0,0,0,0.12) 100%)',
                }}
              >
                {card.badge && (
                  <span className="absolute top-2 left-2.5 text-[10px] font-bold tracking-widest opacity-65">
                    {card.badge}
                  </span>
                )}
                <span className="tabular-nums text-[78px] leading-none font-semibold tracking-tight drop-shadow-[0_6px_16px_rgba(0,0,0,0.65)]">
                  {card.value}
                </span>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-black/75 border-b border-white/10"
                />
              </div>
              {idx === 0 && (
                <div className="flex flex-col items-center justify-center gap-3.5 px-0.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color || '#C28356', opacity: 0.9 }}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color || '#C28356', opacity: 0.9 }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div
          className="flex items-center justify-center leading-none"
          style={{
            fontFamily: clockFont,
            color: color || '#C28356',
            fontSize: isModernTall ? '150px' : fontFamily === 'editorial' ? '126px' : '116px',
            fontWeight: isModernTall ? 300 : fontFamily === 'editorial' ? 500 : 500,
            letterSpacing: isModernTall ? '0.02em' : '-0.02em',
            transform: isModernTall ? 'scaleY(1.42) scaleX(0.92)' : 'none',
            transformOrigin: 'top center',
            textShadow: '0 14px 42px rgba(0, 0, 0, 0.75)',
            marginBottom: isModernTall ? '52px' : '24px',
          }}
        >
          <span className="transition-all duration-300">{hours}</span>
          <span
            className="flex flex-col items-center justify-center gap-5 mx-3"
            style={{
              transform: isModernTall
                ? 'scaleY(0.70) scaleX(1.08) translateY(-4px)'
                : 'translateY(-4px)',
            }}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color || '#C28356', opacity: 0.92 }}
            />
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color || '#C28356', opacity: 0.92 }}
            />
          </span>
          <span className="transition-all duration-300">{minutes}</span>
        </div>
      )}

      {/* Subtle Active Timer Status Pills (Sleep / Focus Pomodoro) */}
      {(sleepCountdownText || pomodoro) && (
        <div className="pointer-events-auto flex items-center justify-center gap-2 -mt-2 mb-1">
          {sleepCountdownText && (
            <button
              type="button"
              onClick={onCancelSleepTimer}
              title="Click to cancel Sleep Timer"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/55 hover:bg-black/75 border border-white/15 backdrop-blur-xl text-[11.5px] font-medium text-zinc-200 hover:text-white shadow-lg transition cursor-pointer"
            >
              <Moon className="w-3.5 h-3.5 text-[var(--aesthetic-accent,#E89B63)]" />
              <span className="font-mono tabular-nums">
                Sleep {sleepCountdownText}
              </span>
              <X className="w-3 h-3 text-zinc-400" />
            </button>
          )}

          {pomodoro && (
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-black/55 border border-white/15 backdrop-blur-xl text-[11.5px] font-medium text-zinc-200 shadow-lg">
              <Timer className="w-3.5 h-3.5 text-[var(--aesthetic-accent,#E89B63)]" />
              <span className="capitalize text-zinc-300">{pomodoro.phase}</span>
              <span className="font-mono tabular-nums text-white mx-0.5">
                {pomodoro.timeText}
              </span>
              {pomodoro.onToggleRun && (
                <button
                  type="button"
                  onClick={pomodoro.onToggleRun}
                  title={pomodoro.running ? 'Pause focus timer' : 'Resume focus timer'}
                  className="p-0.5 rounded-full hover:bg-white/15 text-zinc-300 hover:text-white cursor-pointer"
                >
                  {pomodoro.running ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                </button>
              )}
              {pomodoro.onStop && (
                <button
                  type="button"
                  onClick={pomodoro.onStop}
                  title="Close focus timer"
                  className="p-0.5 rounded-full hover:bg-white/15 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
