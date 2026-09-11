"use client";

import { FileText } from "lucide-react";

interface OriginalTextPanelProps {
  text: string;
}

export default function OriginalTextPanel({ text }: OriginalTextPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden h-full">
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-50 border-b border-surface-200">
        <FileText className="w-4 h-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-surface-800">Original Content</h3>
      </div>
      <div className="p-4 max-h-[600px] overflow-y-auto">
        <div className="text-sm text-surface-800 whitespace-pre-wrap leading-relaxed">
          {text || (
            <span className="text-surface-800/30 italic">
              Your original pasted content will appear here after you click Auto Fill Logbook.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
