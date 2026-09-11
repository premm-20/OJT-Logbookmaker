"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";

interface DetectedFieldsProps {
  mySpace: string;
  tasksCarriedOut: string;
  keyLearningObservations: string;
  toolsTechnologyUsed: string;
  specialAchievements: string;
  onUpdate: (field: string, value: string) => void;
}

const FIELDS = [
  { key: "mySpace", label: "My Space", dbKey: "my_space" },
  { key: "tasksCarriedOut", label: "Tasks Carried Out Today", dbKey: "tasks_carried_out" },
  {
    key: "keyLearningObservations",
    label: "Key Learning / Observations",
    dbKey: "key_learning_observations",
  },
  { key: "toolsTechnologyUsed", label: "Tools / Technology Used", dbKey: "tools_technology_used" },
  { key: "specialAchievements", label: "Special Achievements", dbKey: "special_achievements" },
];

export default function DetectedFields({
  mySpace,
  tasksCarriedOut,
  keyLearningObservations,
  toolsTechnologyUsed,
  specialAchievements,
  onUpdate,
}: DetectedFieldsProps) {
  const values: Record<string, string> = {
    mySpace,
    tasksCarriedOut,
    keyLearningObservations,
    toolsTechnologyUsed,
    specialAchievements,
  };

  return (
    <div className="space-y-4">
      {FIELDS.map((field) => (
        <EditableField
          key={field.key}
          label={field.label}
          value={values[field.key]}
          onChange={(val) => onUpdate(field.dbKey, val)}
        />
      ))}
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  function handleSave() {
    onChange(editValue);
    setEditing(false);
  }

  function handleEdit() {
    setEditValue(value);
    setEditing(true);
  }

  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-50 border-b border-surface-200">
        <h3 className="text-sm font-semibold text-surface-800">{label}</h3>
        <button
          onClick={editing ? handleSave : handleEdit}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-200"
          style={{
            color: editing ? "var(--color-success)" : "var(--color-primary-600)",
          }}
        >
          {editing ? (
            <>
              <Check className="w-3.5 h-3.5" /> Save
            </>
          ) : (
            <>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </>
          )}
        </button>
      </div>
      <div className="p-4">
        {editing ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={4}
            className="w-full p-3 rounded-lg border border-primary-200 bg-primary-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/20 resize-y"
          />
        ) : (
          <div className="text-sm text-surface-800 whitespace-pre-wrap min-h-[40px]">
            {value || <span className="text-surface-800/30 italic">No content detected</span>}
          </div>
        )}
      </div>
    </div>
  );
}
