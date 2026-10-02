"use client";

import { useId, useState, useEffect } from "react";
import { cn } from "@/lib/ui";

export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  placeholder: string;
}

export const COUNTRIES: Country[] = [
  { name: "Ethiopia", code: "ET", dialCode: "+251", flag: "🇪🇹", placeholder: "9XX XXX XXX" },
  { name: "United States", code: "US", dialCode: "+1", flag: "🇺🇸", placeholder: "(555) 000-0000" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "🇬🇧", placeholder: "7000 000000" },
  { name: "Kenya", code: "KE", dialCode: "+254", flag: "🇰🇪", placeholder: "700 000000" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", flag: "🇦🇪", placeholder: "50 000 0000" },
  { name: "Germany", code: "DE", dialCode: "+49", flag: "🇩🇪", placeholder: "150 0000000" },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦", placeholder: "(555) 000-0000" },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷", placeholder: "6 00 00 00 00" },
  { name: "India", code: "IN", dialCode: "+91", flag: "🇮🇳", placeholder: "90000 00000" },
  { name: "Other", code: "XX", dialCode: "+", flag: "🌐", placeholder: "Country code + number" },
];

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Validates international phone format with strict rules for Ethiopian numbers.
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const clean = phone.trim().replace(/[\s\-()]/g, "");

  if (clean.startsWith("+251")) {
    const local = clean.slice(4);
    // Ethiopian numbers: 9 digits starting with 7 or 9
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
}

export function PhoneInput({
  value,
  onChange,
  error,
  disabled = false,
  required = true,
  id,
  className,
}: PhoneInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  // Determine initial country based on value prefix
  const [selectedCountry, setSelectedCountry] = useState<Country>(() => {
    if (value) {
      const match = COUNTRIES.find((c) => c.dialCode !== "+" && value.startsWith(c.dialCode));
      if (match) return match;
    }
    return COUNTRIES[0]; // Ethiopia by default
  });

  // Local phone number part without the dialCode
  const [localNumber, setLocalNumber] = useState<string>(() => {
    if (!value) return "";
    if (selectedCountry.dialCode !== "+" && value.startsWith(selectedCountry.dialCode)) {
      return value.slice(selectedCountry.dialCode.length);
    }
    return value;
  });

  // Sync internal state when external value changes
  useEffect(() => {
    if (value && selectedCountry.dialCode !== "+" && value.startsWith(selectedCountry.dialCode)) {
      setLocalNumber(value.slice(selectedCountry.dialCode.length));
    }
  }, [value, selectedCountry.dialCode]);

  const handleCountryChange = (dialCode: string) => {
    const nextCountry = COUNTRIES.find((c) => c.dialCode === dialCode) ?? COUNTRIES[0];
    setSelectedCountry(nextCountry);

    if (nextCountry.dialCode === "+") {
      onChange("+" + localNumber.replace(/^\+/, ""));
    } else {
      const cleaned = localNumber.replace(/^[0]/, "").replace(/\D/g, "");
      onChange(nextCountry.dialCode + cleaned);
    }
  };

  const handleLocalChange = (input: string) => {
    // Strip non-digits unless dialCode is "+"
    let sanitized = input;
    if (selectedCountry.dialCode !== "+") {
      sanitized = input.replace(/\D/g, "");
      // Remove leading zero if user pasted "0911..."
      if (sanitized.startsWith("0")) {
        sanitized = sanitized.slice(1);
      }
    }
    setLocalNumber(sanitized);

    if (selectedCountry.dialCode === "+") {
      const prefixed = sanitized.startsWith("+") ? sanitized : `+${sanitized}`;
      onChange(prefixed);
    } else {
      onChange(selectedCountry.dialCode + sanitized);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex rounded-lg border border-input bg-background/50 shadow-sm transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        {/* Country Code Dropdown */}
        <div className="relative flex shrink-0 items-center border-r border-border/70 bg-muted/30">
          <select
            value={selectedCountry.dialCode}
            onChange={(e) => handleCountryChange(e.target.value)}
            disabled={disabled}
            aria-label="Country Code"
            className="h-10 cursor-pointer appearance-none rounded-l-lg bg-transparent pl-3 pr-7 text-sm font-medium text-foreground outline-none focus:outline-none disabled:opacity-50"
          >
            {COUNTRIES.map((country) => (
              <option key={country.code + country.dialCode} value={country.dialCode} className="bg-popover text-popover-foreground">
                {country.flag} {country.dialCode} ({country.name})
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 text-xs text-muted-foreground" aria-hidden>
            ▼
          </span>
        </div>

        {/* Phone text input */}
        <input
          id={inputId}
          type="tel"
          value={localNumber}
          onChange={(e) => handleLocalChange(e.target.value)}
          placeholder={selectedCountry.placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="h-10 w-full rounded-r-lg bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none disabled:opacity-50"
        />
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-[0.75rem] text-muted-foreground">
          Private to your account. Never exposed on your public chess profile.
        </p>
      )}
    </div>
  );
}
