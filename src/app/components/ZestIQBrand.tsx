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
    <div className={cn('zestiq-brand inline-flex items-center gap-2.5', className)} aria-label="ZestIQ">
      <img
        src="/zestiq-gold-mark.png"
        alt=""
        aria-hidden="true"
        className={cn('zestiq-brand-mark h-10 w-auto shrink-0 object-contain', markClassName)}
      />
      <span
        aria-hidden="true"
        className={cn(
          'zestiq-brand-word text-2xl font-black leading-none tracking-tight',
          compact && 'landing-compact-word',
          wordmarkClassName,
        )}
      >
        Zest<span className="text-[#D8B85B]">IQ</span>
      </span>
    </div>
  );
}
