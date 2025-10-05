'use client';
import React, { useEffect, useState } from "react";

const steps = [
  { title: "Step-1", subtitle: "Discover" },
  { title: "Step-2", subtitle: "Define" },
  { title: "Step-3", subtitle: "Design" },
  { title: "Step-4", subtitle: "Develop" },
  { title: "Step-5", subtitle: "Test" },
  { title: "Step-6", subtitle: "Deliver" },
];

export default function SixStepCircle() {
  const cx = 400;
  const cy = 400;
  const radius = 260;
  const nodeRadius = 56;

  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleSteps((prev) => {
        if (prev < steps.length) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 800); // delay per step

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-white">
      <svg viewBox="0 0 800 800" className="w-[820px] max-w-[95vw]">
        <defs>
          <linearGradient id="ringGrad" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#7f2aff" />
            <stop offset="100%" stopColor="#2be7ff" />
          </linearGradient>
          <linearGradient id="nodeGrad" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#ff39b4" />
            <stop offset="100%" stopColor="#4bd3ff" />
          </linearGradient>
          <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="#8a8f95" fillOpacity="0.35" />
          </pattern>
          <symbol id="icon-bulb" viewBox="0 0 24 24">
            <path d="M9 21h6v-1a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1v1z" fill="currentColor" />
            <path d="M12 2a6 6 0 0 0-4 10.8V15a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.2A6 6 0 0 0 12 2z" fill="currentColor" />
          </symbol>
        </defs>

        {/* Outer dotted ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="2.5"
          opacity="0.08"
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="url(#dots)"
          strokeWidth="1"
          opacity="0.25"
        />

        {/* Nodes with animation */}
        {steps.map((s, i) => {
          const angle = (-90 + i * (360 / steps.length)) * (Math.PI / 180);
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);

          const isVisible = i < visibleSteps;

          return (
            <g
              key={i}
              transform={`translate(${x - cx}, ${y - cy})`}
              className={`transition-opacity duration-700 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <circle
                cx={cx}
                cy={cy}
                r={nodeRadius}
                className="fill-neutral-900 stroke-[3px]"
                stroke="url(#nodeGrad)"
              />
              <circle cx={cx} cy={cy} r={nodeRadius - 10} fill="#0b0b0c" />
              <use
                href="#icon-bulb"
                x={cx - 12}
                y={cy - 26}
                width={24}
                height={24}
                fill="#3fe0e8"
              />
              <text
                x={cx}
                y={cy + 20}
                textAnchor="middle"
                className="font-extrabold text-lg fill-white"
              >
                {s.title}
              </text>
              <text
                x={cx}
                y={cy + 36}
                textAnchor="middle"
                className="font-semibold text-xs fill-gray-400"
              >
                {s.subtitle}
              </text>
            </g>
          );
        })}

        {/* Center Label */}
        <text
          x={cx}
          y={cy + 20}
          textAnchor="middle"
          className="fill-gray-400 text-sm"
        >
          6‑Step Process
        </text>
      </svg>
    </div>
  );
}
