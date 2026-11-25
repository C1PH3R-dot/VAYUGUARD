// ============================================================================
// Custom Accessible SVG AQI Radial Gauge
// ============================================================================

import React from 'react';
import type { AqiCategoryInfo } from '../types';

interface AqiRadialGaugeProps {
  aqi: number;
  category: AqiCategoryInfo;
  pm25: number;
}

const AqiRadialGauge: React.FC<AqiRadialGaugeProps> = ({ aqi, category, pm25 }) => {
  const clamped = Math.min(500, Math.max(0, aqi));
  const pct = clamped / 500;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const dashOffset = arcLength * (1 - pct);

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none shrink-0"
      role="img"
      aria-label={`US EPA Air Quality Index is ${aqi}, categorized as ${category.label}, with PM2.5 at ${pm25} micrograms per cubic meter`}
    >
      <svg
        width="156"
        height="144"
        viewBox="0 0 156 144"
        className="overflow-visible"
      >
        <circle
          cx="78"
          cy="68"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform="rotate(135 78 68)"
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx="78"
          cy="68"
          r={radius}
          fill="none"
          stroke={category.accentHex}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform="rotate(135 78 68)"
          className="transition-all duration-700 ease-out"
        />
        <text
          x="78"
          y="58"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-900 dark:fill-white font-extrabold text-[28px] tracking-tight"
        >
          {aqi}
        </text>
        <text
          x="78"
          y="78"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-500 dark:fill-slate-400 font-semibold text-[10px] uppercase tracking-wider"
        >
          US EPA AQI
        </text>
        <text
          x="78"
          y="130"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-700 dark:fill-slate-300 font-semibold text-[11px]"
        >
          PM2.5: {pm25} µg/m³
        </text>
      </svg>
    </div>
  );
};

export default AqiRadialGauge;
