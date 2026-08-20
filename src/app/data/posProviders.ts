export interface PosProvider {
  id: string;
  name: string;
  mark: string;
  colour: string;
  connection: 'API onboarding' | 'Export import';
  description: string;
  website: string;
}

export const POS_PROVIDERS: PosProvider[] = [
  { id: 'toast', name: 'Toast', mark: 'T', colour: '#F97316', connection: 'API onboarding', description: 'Restaurant sales, menu items and location reporting.', website: 'https://pos.toasttab.com/ca' },
  { id: 'touchbistro', name: 'TouchBistro', mark: 'TB', colour: '#2563EB', connection: 'API onboarding', description: 'Canadian restaurant POS and reporting exports.', website: 'https://www.touchbistro.com/' },
  { id: 'lightspeed', name: 'Lightspeed Restaurant', mark: 'L', colour: '#E11D48', connection: 'API onboarding', description: 'K, L, O and U Series restaurant reporting.', website: 'https://www.lightspeedhq.com/pos/restaurant/' },
  { id: 'square', name: 'Square for Restaurants', mark: 'S', colour: '#111827', connection: 'API onboarding', description: 'Orders, items, payments and multi-location sales.', website: 'https://squareup.com/ca/en/point-of-sale/restaurants' },
  { id: 'clover', name: 'Clover Dining', mark: 'C', colour: '#16A34A', connection: 'API onboarding', description: 'Restaurant orders, menu and sales reporting.', website: 'https://www.clover.com/ca/pos-solutions/restaurant' },
  { id: 'moneris', name: 'Moneris', mark: 'M', colour: '#0F766E', connection: 'Export import', description: 'Canadian payment and restaurant POS exports.', website: 'https://www.moneris.com/' },
  { id: 'oracle-micros', name: 'Oracle MICROS', mark: 'O', colour: '#DC2626', connection: 'API onboarding', description: 'Enterprise food-and-beverage sales data.', website: 'https://www.oracle.com/ca-en/food-beverage/restaurant-pos-systems/' },
  { id: 'maitred', name: "Maitre'D", mark: 'MD', colour: '#7C3AED', connection: 'Export import', description: 'Restaurant and hospitality reporting exports.', website: 'https://www.maitredpos.com/' },
  { id: 'squirrel', name: 'Squirrel Systems', mark: 'SQ', colour: '#B45309', connection: 'Export import', description: 'Hospitality POS sales and product reports.', website: 'https://www.squirrelsystems.com/' },
  { id: 'silverware', name: 'SilverWare POS', mark: 'SW', colour: '#475569', connection: 'Export import', description: 'Canadian hospitality and venue sales exports.', website: 'https://www.silverwarepos.com/' },
  { id: 'revel', name: 'Revel Systems', mark: 'R', colour: '#0284C7', connection: 'API onboarding', description: 'Cloud POS products, orders and reporting.', website: 'https://revelsystems.com/' },
  { id: 'shopify', name: 'Shopify POS', mark: 'SP', colour: '#65A30D', connection: 'API onboarding', description: 'Useful for cafes and restaurant-retail concepts.', website: 'https://www.shopify.com/ca/pos' },
  { id: 'generic', name: 'Other POS / CSV', mark: '+', colour: '#0F172A', connection: 'Export import', description: 'Use ZestIQ’s universal CSV or JSON sales importer.', website: 'mailto:demo@zestiq.ca?subject=ZestIQ%20POS%20integration' },
];

export function getPosProvider(id: string | null | undefined) {
  return POS_PROVIDERS.find(provider => provider.id === id) || POS_PROVIDERS[POS_PROVIDERS.length - 1];
}
