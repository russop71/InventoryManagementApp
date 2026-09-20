export function stockLevel(current, par) {
  if (Number(current) <= 0) return 'out-of-stock';
  if (!(Number(par) > 0)) return 'in-stock';
  const ratio = Number(current) / Number(par);
  if (ratio < 0.5) return 'low-stock';
  if (ratio < 0.75) return 'medium';
  if (ratio < 1) return 'medium-high';
  return 'in-stock';
}

export const STOCK_LEVELS = {
  'out-of-stock': { label: 'Out of Stock', bg: '#FEE2E2', color: '#991B1B', bar: 'bg-red-500' },
  'low-stock': { label: 'Low Stock', bg: '#FEE2E2', color: '#991B1B', bar: 'bg-red-500' },
  medium: { label: 'Medium Stock', bg: '#FFEDD5', color: '#9A3412', bar: 'bg-orange-500' },
  'medium-high': { label: 'Medium-High Stock', bg: '#FEF9C3', color: '#854D0E', bar: 'bg-yellow-500' },
  'in-stock': { label: 'High Stock', bg: '#DCFCE7', color: '#166534', bar: 'bg-green-500' },
};

export const stockBarColor = (current, par) => STOCK_LEVELS[stockLevel(current, par)].bar;
