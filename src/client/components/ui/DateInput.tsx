import React, { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { formatDate, toISODate } from "../../lib/formatters";

export interface DateInputProps {
  value?: string;
  onChange: (e: { target: { value: string; name?: string } }) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  min?: string;
  max?: string;
  placeholder?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value = "",
  onChange,
  className = "",
  required = false,
  disabled = false,
  name,
  id,
  min,
  max,
  placeholder = "DD-MM-YYYY",
}) => {
  const [displayText, setDisplayText] = useState<string>(() => {
    return value ? formatDate(value) : "";
  });
  const pickerRef = useRef<HTMLInputElement>(null);

  // Sync display text when value prop changes from parent
  useEffect(() => {
    if (value) {
      const formatted = formatDate(value);
      if (formatted !== "-") {
        setDisplayText(formatted);
      } else {
        setDisplayText(value);
      }
    } else {
      setDisplayText("");
    }
  }, [value]);

  // Handle direct keyboard typing
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    
    // Allow user to clear
    if (!rawVal) {
      setDisplayText("");
      onChange({ target: { value: "", name } });
      return;
    }

    // Replace slashes with dashes
    let cleaned = rawVal.replace(/\//g, "-").replace(/[^\d-]/g, "");

    // If user is typing digits without dashes, auto format: 30102026 -> 30-10-2026
    const digitsOnly = cleaned.replace(/-/g, "");
    if (!cleaned.includes("-") && digitsOnly.length > 2) {
      if (digitsOnly.length <= 4) {
        cleaned = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2)}`;
      } else {
        cleaned = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 4)}-${digitsOnly.slice(4, 8)}`;
      }
    }

    if (cleaned.length > 10) {
      cleaned = cleaned.slice(0, 10);
    }

    setDisplayText(cleaned);

    // If complete date DD-MM-YYYY is typed, convert and notify parent
    if (cleaned.length === 10) {
      const parts = cleaned.split("-");
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
          const iso = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          onChange({ target: { value: iso, name } });
        }
      }
    }
  };

  const handleBlur = () => {
    if (displayText && displayText.length === 10) {
      const parts = displayText.split("-");
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
          const iso = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          onChange({ target: { value: iso, name } });
          setDisplayText(`${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`);
        }
      }
    } else if (value) {
      setDisplayText(formatDate(value));
    }
  };

  // When user picks a date using the calendar picker
  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickerVal = e.target.value; // YYYY-MM-DD
    if (pickerVal) {
      const formatted = formatDate(pickerVal);
      setDisplayText(formatted);
      onChange({ target: { value: pickerVal, name } });
    }
  };

  const isoValue = toISODate(value);

  const baseClasses = className
    ? className
    : "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 font-medium";

  return (
    <div className="relative flex items-center w-full">
      <input
        type="text"
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        value={displayText}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={10}
        className={`${baseClasses} pr-10 font-medium tracking-wide`}
      />

      {/* Calendar icon and native picker overlay */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7">
        <CalendarIcon className="w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          disabled={disabled}
          min={min ? toISODate(min) : undefined}
          max={max ? toISODate(max) : undefined}
          value={isoValue}
          onChange={handlePickerChange}
          title="Click to select date"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
};
