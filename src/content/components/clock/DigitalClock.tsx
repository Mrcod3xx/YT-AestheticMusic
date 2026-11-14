import React, { useEffect, useState } from 'react';
import { AestheticSettings } from '../../../shared/types';
import { resolveClockFontFamilyCss } from '../../../shared/themeTokens';

interface DigitalClockProps {
  visible: boolean;
  use24Hour: boolean;
  scalePercent: number;
  color: string;
  fontFamily?: AestheticSettings['fontFamily'];
  paused?: boolean;
}

export const DigitalClock: React.FC<DigitalClockProps> = ({
  visible,
  use24Hour,
  scalePercent,
  color,
  fontFamily = 'modern',
  paused = false,
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

      {/* Geometric / Editorial / Mono Clock Numerals */}
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
    </div>
  );
};
