"use client";

import Link from "next/link";
import { formatDate, formatTime, calculateHours } from "@/lib/utils";
import type { DailyEntry } from "@/lib/types";
import { Calendar, Clock, Eye, Pencil, Trash2, Copy } from "lucide-react";

interface EntryCardProps {
  entry: DailyEntry;
  onDelete: (id: string) => void;
  onDuplicate: (entry: DailyEntry) => void;
}

export default function EntryCard({ entry, onDelete, onDuplicate }: EntryCardProps) {
  const totalHours = calculateHours(entry.start_time, entry.end_time);

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4 hover:shadow-md hover:border-primary-200 group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Calendar className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-semibold text-surface-900">{formatDate(entry.date)}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-surface-800/50">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(entry.start_time)} – {formatTime(entry.end_time)} ({totalHours}h)
            </span>
            {entry.department && (
              <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-medium">
                {entry.department}
              </span>
            )}
          </div>
          {entry.my_space && (
            <p className="mt-2 text-sm text-surface-800/70 line-clamp-2">{entry.my_space}</p>
          )}
        </div>

        {/* Status badge */}
        <div className="ml-3">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
            Completed
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-surface-200 opacity-0 group-hover:opacity-100">
        <Link
          href={`/dashboard/entry/${entry.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Preview & Edit in Logbook
        </Link>
        <button
          onClick={() => onDuplicate(entry)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-800/60 hover:text-primary-600 hover:bg-primary-50 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" /> Duplicate
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-800/60 hover:text-red-600 hover:bg-red-50 ml-auto cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
