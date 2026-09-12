import { useState } from 'react';

/** Select an existing value without losing the ability to enter a new one. */
export function InventoryOptionSelect({ label, value, options, required = false, onChange }: {
  label: string;
  value: string;
  options: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const [custom, setCustom] = useState(false);
  const choices = Array.from(new Set(options.map(option => option.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const fieldClass = 'mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none focus:border-amber-400';
  return (
    <div className="text-sm font-bold text-slate-700">
      <label>{label}{required && <span aria-hidden="true"> *</span>}
        <select aria-label={label} aria-required={required} className={fieldClass} value={custom ? '__new__' : value} onChange={event => {
          const next = event.target.value;
          setCustom(next === '__new__');
          onChange(next === '__new__' ? '' : next);
        }}>
          <option value="">Select {label.toLowerCase()}…</option>
          {choices.map(option => <option key={option} value={option}>{option}</option>)}
          {!custom && value && !choices.includes(value) && <option value={value}>{value}</option>}
          <option value="__new__">+ Add new {label.toLowerCase()}…</option>
        </select>
      </label>
      {custom && <label className="mt-2 block">New {label.toLowerCase()}
        <input aria-label={`New ${label.toLowerCase()}`} aria-required={required} autoFocus value={value} onChange={event => onChange(event.target.value)} className={fieldClass} placeholder={`Enter ${label.toLowerCase()}`} />
      </label>}
    </div>
  );
}
