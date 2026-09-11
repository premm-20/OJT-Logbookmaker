"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export default function TimePicker({
  value,
  onChange,
  label,
  className = "",
}: TimePickerProps) {
  // Parse incoming value
  const parseValue = (timeStr: string) => {
    if (!timeStr) {
      return { hours: "09", minutes: "00", period: "AM" as "AM" | "PM" };
    }
    const cleaned = timeStr.trim();
    const match = cleaned.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2].padStart(2, "0");
      let p = (match[3]?.toUpperCase() as "AM" | "PM") || undefined;
      if (!p) {
        p = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
      }
      return {
        hours: String(h).padStart(2, "0"),
        minutes: m,
        period: p,
      };
    }
    return { hours: "09", minutes: "00", period: "AM" as "AM" | "PM" };
  };

  const initial = parseValue(value);
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [period, setPeriod] = useState<"AM" | "PM">(initial.period);

  useEffect(() => {
    const parsed = parseValue(value);
    setHours(parsed.hours);
    setMinutes(parsed.minutes);
    setPeriod(parsed.period);
  }, [value]);

  const emitChange = (h: string, m: string, p: "AM" | "PM") => {
    onChange(`${h}:${m} ${p}`);
  };

  const handleHourChange = (newHour: string) => {
    setHours(newHour);
    emitChange(newHour, minutes, period);
  };

  const handleMinuteChange = (newMin: string) => {
    setMinutes(newMin);
    emitChange(hours, newMin, period);
  };

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    setPeriod(newPeriod);
    emitChange(hours, minutes, newPeriod);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="flex items-center gap-1.5 text-xs font-semibold text-surface-800">
          <Clock className="w-3.5 h-3.5 text-primary-500" />
          {label}
        </label>
      )}

      <div className="flex items-center gap-1 bg-surface-50 border border-surface-200 rounded-xl p-1 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-400 focus-within:bg-white transition-all shadow-xs">
        {/* Hours */}
        <select
          value={hours}
          onChange={(e) => handleHourChange(e.target.value)}
          className="bg-transparent text-sm font-bold text-surface-900 px-2 py-1.5 rounded-lg focus:outline-none cursor-pointer"
        >
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <span className="font-bold text-surface-400 text-sm">:</span>

        {/* Minutes */}
        <select
          value={minutes}
          onChange={(e) => handleMinuteChange(e.target.value)}
          className="bg-transparent text-sm font-bold text-surface-900 px-2 py-1.5 rounded-lg focus:outline-none cursor-pointer"
        >
          {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* AM / PM Toggle Pill */}
        <div className="flex items-center ml-auto bg-surface-200/70 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => handlePeriodChange("AM")}
            className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              period === "AM"
                ? "bg-primary-600 text-white shadow-xs scale-102"
                : "text-surface-700 hover:text-surface-900"
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => handlePeriodChange("PM")}
            className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              period === "PM"
                ? "bg-primary-600 text-white shadow-xs scale-102"
                : "text-surface-700 hover:text-surface-900"
            }`}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
}
