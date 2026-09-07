import { ShieldCheck } from 'lucide-react';

export const ORDER_BUFFER_OPTIONS = [0, 5, 10, 15] as const;

interface OrderBufferControlProps {
  value: number;
  onChange: (value: number) => void;
}

export function OrderBufferControl({ value, onChange }: OrderBufferControlProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F5C10E] text-[#0F172A]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-black text-[#0F172A]">Forecast safety buffer</p>
            <p className="mt-1 text-xs leading-5 text-amber-900/70">
              Adds {value}% of forecast demand before rounding. Every suggested quantity remains editable and requires approval.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1 rounded-xl border border-amber-200 bg-white p-1" aria-label="Forecast safety buffer percentage">
          {ORDER_BUFFER_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={value === option}
              onClick={() => onChange(option)}
              className={`min-w-11 rounded-lg px-3 py-2 text-xs font-black transition ${
                value === option ? 'bg-[#0F172A] text-white shadow-sm' : 'text-amber-900 hover:bg-amber-50'
              }`}
            >
              {option}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
