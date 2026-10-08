"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  labelAside?: ReactNode;
  inputClassName?: string;
}

export function Field({
  label,
  error,
  hint,
  leading,
  trailing,
  labelAside,
  className,
  inputClassName,
  ...input
}: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-surface-800">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        {leading && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-medium text-surface-600">
            {leading}
          </div>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full rounded-xl border border-surface-300 bg-white px-3.5 text-[15px] text-surface-900 shadow-[0_1px_0_oklch(0.21_0.016_236/0.04)]",
            "placeholder:text-surface-500 hover:border-surface-400",
            "focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15",
            "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15",
            "disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-surface-600",
            leading ? "pl-14" : "",
            trailing ? "pr-12" : "",
            inputClassName
          )}
          {...input}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-[13px] font-medium text-danger">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-[13px] text-surface-600">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-800"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

export function OtpField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Field
      label="Verification code"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="\d{6}"
      maxLength={6}
      placeholder="000000"
      autoFocus
      error={error}
      inputClassName="h-14 text-center font-mono text-2xl font-medium tracking-[0.55em] placeholder:text-surface-300"
    />
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm",
        tone === "error"
          ? "animate-shake bg-danger/8 text-[oklch(0.45_0.16_25)]"
          : "bg-primary-50 text-primary-900"
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SubmitButton({
  loading,
  loadingLabel,
  children,
  disabled,
}: {
  loading: boolean;
  loadingLabel: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={cn(
        "flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 text-[15px] font-semibold text-white",
        "shadow-[0_1px_2px_oklch(0.3_0.058_236/0.35),inset_0_1px_0_oklch(1_0_0/0.12)]",
        "hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="my-7 flex items-center gap-4 text-[13px] text-surface-600" role="separator">
      <span className="h-px flex-1 bg-surface-200" />
      {label}
      <span className="h-px flex-1 bg-surface-200" />
    </div>
  );
}
