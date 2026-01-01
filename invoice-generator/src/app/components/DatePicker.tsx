"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./datepicker.css";

type Props = {
  label?: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder?: string;
  className?: string;
};

const monthNames = [
  "January","February","March","April","May","June","July","August","September","October","November","December"
];
const weekdayShort = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export default function DatePicker({ label, value, onChange, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => value ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (value) setViewDate(value);
  }, [value]);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const isSameDate = (a: Date, b: Date) => fmt(a) === fmt(b);

  const grid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay(); // 0..6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: { date: Date; inMonth: boolean; isToday: boolean; isSelected: boolean }[] = [];
    // Previous month tail
    for (let i = 0; i < startDay; i++) {
      const d = new Date(year, month - 1, prevMonthDays - (startDay - 1 - i));
      cells.push({
        date: d,
        inMonth: false,
        isToday: isSameDate(d, new Date()),
        isSelected: value ? isSameDate(d, value) : false,
      });
    }
    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({
        date: d,
        inMonth: true,
        isToday: isSameDate(d, new Date()),
        isSelected: value ? isSameDate(d, value) : false,
      });
    }
    // Fill to 6 rows * 7 cols = 42 cells
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({
        date: next,
        inMonth: false,
        isToday: isSameDate(next, new Date()),
        isSelected: value ? isSameDate(next, value) : false,
      });
    }
    return cells;
  }, [viewDate, value]);

  const onPick = (d: Date) => {
    onChange(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    setOpen(false);
  };

  return (
    <div ref={ref} className={(className || "") + " relative"}>
      {label && (
        <label className="block text-[11px] font-medium text-white">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="dp-input mt-1 w-40 text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/60 text-left py-1.5"
      >
        {value ? fmt(value) : (placeholder || "Select date")}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 bg-[#121212] border border-white/10 rounded-xl shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button
              className="px-2 py-1 text-xs bg-white/10 rounded hover:bg-white/20"
              onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            >
              ◀
            </button>
            <div className="text-sm font-semibold text-white">
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button
              className="px-2 py-1 text-xs bg-white/10 rounded hover:bg-white/20"
              onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            >
              ▶
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[11px] text-white/70 mb-1">
            {weekdayShort.map(w => (
              <div key={w} className="text-center">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => (
              <button
                key={i}
                className={[
                  "text-xs h-8 rounded",
                  cell.inMonth ? "text-white" : "text-white/40",
                  cell.isSelected ? "bg-[var(--accent)] text-black" : "bg-black/40 hover:bg-black/60",
                  cell.isToday && !cell.isSelected ? "ring-1 ring-[var(--accent)]" : ""
                ].join(" ")}
                onClick={() => onPick(cell.date)}
                title={fmt(cell.date)}
              >
                {cell.date.getDate()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
