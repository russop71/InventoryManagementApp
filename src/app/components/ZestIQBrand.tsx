import { cn } from './ui/utils';

type ZestIQBrandProps = {
  compact?: boolean;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

export function ZestIQBrand({
  compact = false,
  className,
  markClassName,
  wordmarkClassName,
}: ZestIQBrandProps) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)} aria-label="ZestIQ">
      <img
        src="/zestiq-mark.svg"
        alt=""
        aria-hidden="true"
        className={cn('h-9 w-9 shrink-0 rounded-xl', markClassName)}
      />
      <span
        aria-hidden="true"
        className={cn(
          'text-2xl font-black leading-none tracking-tight',
          compact && 'landing-compact-word',
          wordmarkClassName,
        )}
      >
        zest<span className="text-[#D9A900]">IQ</span>
      </span>
    </div>
  );
}
