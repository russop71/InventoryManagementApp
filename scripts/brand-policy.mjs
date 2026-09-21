// Yellow remains valid for stock/warning status, never for the old brand palette.
export function brandViolations(file, source) {
  const errors = [];
  if (/#(?:f5d62e|f5c10e)\b/i.test(source)) errors.push(`${file}: obsolete yellow brand colour`);
  if (file === 'src/styles/theme.css') {
    const primaryValues = [...source.matchAll(/--primary\s*:\s*([^;]+);/g)].map(match => match[1].trim().toLowerCase());
    if (!primaryValues.length || primaryValues.some(value => value !== '#f58220')) errors.push(`${file}: primary brand must remain orange #F58220`);
  }
  if (file === 'src/app/components/ZestIQBrand.tsx' && !source.includes('/zestiq-orange-vector.svg')) errors.push(`${file}: approved orange wordmark missing`);
  return errors;
}
