import * as React from "react";

import { cn } from "./utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, onChange, onFocus, onBlur, min, ...props }, ref) => {
    const [numberDraft, setNumberDraft] = React.useState<string | null>(null);
    const isNumber = type === 'number';
    const displayValue = isNumber && numberDraft !== null ? numberDraft : value;

    const sendValue = (event: React.ChangeEvent<HTMLInputElement>, nextValue: string) => {
      if (!onChange) return;
      onChange({
        ...event,
        target: { ...event.target, value: nextValue },
        currentTarget: { ...event.currentTarget, value: nextValue },
      } as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <input
        ref={ref}
        type={type}
        value={displayValue}
        min={min}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
        {...props}
        onFocus={event => {
          if (isNumber) setNumberDraft(String(value ?? ''));
          onFocus?.(event);
        }}
        onChange={event => {
          if (!isNumber) {
            onChange?.(event);
            return;
          }

          const rawValue = event.target.value;
          setNumberDraft(rawValue);
          if (rawValue !== '') sendValue(event, rawValue);
        }}
        onBlur={event => {
          if (isNumber && numberDraft === '') {
            // Keep a field clear while it is being edited; only restore its safe minimum after the user leaves it.
            sendValue(event as React.ChangeEvent<HTMLInputElement>, String(min ?? 0));
          }
          if (isNumber) setNumberDraft(null);
          onBlur?.(event);
        }}
      />
    );
  },
);

Input.displayName = 'Input';

export { Input };
