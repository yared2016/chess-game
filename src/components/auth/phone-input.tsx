"use client";

import { useId, useState, useEffect } from "react";
import { cn } from "@/lib/ui";
import { Check, AlertCircle } from "lucide-react";

export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  placeholder: string;
}

export const COUNTRIES: Country[] = [
  { name: "Ethiopia", code: "ET", dialCode: "+251", flag: "🇪🇹", placeholder: "9XX XXX XXX" },
];

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Validates phone format with strict rules for Ethiopian numbers.
 * Ethiopian numbers: +251 followed by 9 digits starting with 7 or 9.
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const clean = phone.trim().replace(/[\s\-()]/g, "");

  if (clean.startsWith("+251")) {
    const local = clean.slice(4);
    return /^[79]\d{8}$/.test(local);
  }

  return E164_REGEX.test(clean);
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
}

export function PhoneInput({
  value,
  onChange,
  error,
  disabled = false,
  required = true,
  id,
  className,
  placeholder = "9XX XXX XXX",
}: PhoneInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  // Extract digits without "+251"
  const extractLocal = (val: string) => {
    if (!val) return "";
    let cleaned = val.replace(/\s+/g, "");
    if (cleaned.startsWith("+251")) {
      cleaned = cleaned.slice(4);
    } else if (cleaned.startsWith("0")) {
      cleaned = cleaned.slice(1);
    }
    return cleaned.replace(/\D/g, "").slice(0, 9);
  };

  const [localNumber, setLocalNumber] = useState<string>(() => extractLocal(value));

  useEffect(() => {
    const extracted = extractLocal(value);
    setLocalNumber(extracted);
  }, [value]);

  const handleInputChange = (raw: string) => {
    let sanitized = raw.replace(/\D/g, "");
    // If user starts typing or pastes with leading 0 (e.g. 0911...), strip the 0
    if (sanitized.startsWith("0")) {
      sanitized = sanitized.slice(1);
    }
    // Limit to 9 digits
    sanitized = sanitized.slice(0, 9);
    setLocalNumber(sanitized);

    if (sanitized.length === 0) {
      onChange("+251");
    } else {
      onChange("+251" + sanitized);
    }
  };

  const isValidLength = localNumber.length === 9;
  const isValidPrefix = localNumber.startsWith("9") || localNumber.startsWith("7");
  const isValidEthiopian = isValidLength && isValidPrefix;
  const hasInput = localNumber.length > 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        className={cn(
          "flex rounded-lg border bg-background/50 shadow-sm transition-colors",
          error
            ? "border-destructive focus-within:border-destructive focus-within:ring-1 focus-within:ring-destructive"
            : isValidEthiopian
            ? "border-emerald-500/50 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500"
            : "border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
        )}
      >
        {/* Strictly Ethiopian Locked Prefix Badge */}
        <div
          className="flex shrink-0 items-center gap-1.5 border-r border-border/70 bg-muted/40 px-3 select-none text-sm font-semibold text-foreground"
          title="Ethiopian Mobile Numbers Only (+251)"
        >
          <span className="text-base" role="img" aria-label="Ethiopia">🇪🇹</span>
          <span className="tracking-tight text-foreground font-semibold">+251</span>
        </div>

        {/* Local phone number input */}
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={localNumber}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={!!error || (hasInput && !isValidEthiopian)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="h-10 w-full rounded-r-lg bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none disabled:opacity-50 font-mono tracking-wide"
        />

        {/* Inline status icon inside input */}
        <div className="flex shrink-0 items-center pr-3">
          {isValidEthiopian ? (
            <Check className="size-4 text-emerald-500" />
          ) : hasInput ? (
            <span className="text-[0.7rem] text-muted-foreground font-mono">
              {localNumber.length}/9
            </span>
          ) : null}
        </div>
      </div>

      {/* Validation / Helper text */}
      {error ? (
        <p id={`${inputId}-error`} className="flex items-center gap-1 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hasInput && !isValidPrefix ? (
        <p className="text-xs text-amber-500 flex items-center gap-1">
          <AlertCircle className="size-3.5 shrink-0" />
          Ethiopian phone numbers must start with 9 or 7 (e.g. 911... or 712...).
        </p>
      ) : hasInput && !isValidLength ? (
        <div className="flex items-center justify-between text-xs text-amber-500">
          <span>Enter 9 digits after +251 (e.g. 9XX XXX XXX)</span>
          <span className="font-mono font-medium">{localNumber.length}/9 digits</span>
        </div>
      ) : isValidEthiopian ? (
        <p className="text-xs text-emerald-500 flex items-center gap-1 font-medium">
          <Check className="size-3.5 shrink-0" />
          Valid Ethiopian number (+251 {localNumber.slice(0, 3)} {localNumber.slice(3, 6)} {localNumber.slice(6)})
        </p>
      ) : (
        <p className="text-[0.75rem] text-muted-foreground">
          Enter 9 digits starting with 9 or 7 (e.g. 911 234 567 or 0911...).
        </p>
      )}
    </div>
  );
}
