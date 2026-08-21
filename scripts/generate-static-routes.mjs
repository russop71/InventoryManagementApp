import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const pages = [
  ['/book-demo', 'Book a ZestIQ Restaurant Software Demo', 'Book a tailored ZestIQ demo for restaurant inventory, food cost, invoice scanning, purchasing, beverage and labour workflows.'],
  ['/restaurant-inventory-management-software', 'Restaurant Inventory Management Software | ZestIQ', 'Restaurant inventory software for counts, pars, purchasing, recipe costs, supplier pricing and multi-location visibility.'],
  ['/restaurant-food-cost-software', 'Restaurant Food Cost & Recipe Costing Software | ZestIQ', 'Restaurant food cost software linking recipes to current ingredient prices, menu margins, beverages and supplier changes.'],
  ['/restaurant-invoice-scanner', 'AI Restaurant Invoice Scanner for PDF & Photos | ZestIQ', 'Scan restaurant invoices from PDF, image or camera and review extracted supplier, items, units and prices.'],
  ['/restaurant-labour-scheduling-software', 'Restaurant Labour Scheduling Software Canada | ZestIQ', 'Restaurant labour scheduling for shifts, labour cost, sales comparison, employee availability, swaps and time off.'],
  ['/restaurant-beverage-costing-software', 'Restaurant Beverage Costing Software | ZestIQ', 'Liquor, wine and beer inventory and costing software for bottles, cases, pours, cocktails, pars and margins.'],
  ['/restaurant-ordering-forecasting-software', 'Restaurant Ordering & Forecasting Software | ZestIQ', 'Restaurant ordering software connecting inventory, pars, sales usage, supplier packs and forecasts to suggested orders.'],
  ['/legal', 'Legal & Trust Centre | ZestIQ Canada', 'ZestIQ privacy, terms, cookie, AI transparency and service-provider information for Canadian restaurant operators.'],
  ['/privacy', 'Privacy Policy | ZestIQ Canada', 'How ZestIQ collects, uses, shares, protects and retains personal information for its Canadian restaurant platform.'],
  ['/terms', 'Terms of Service | ZestIQ Canada', 'Terms governing subscriptions and use of the ZestIQ restaurant inventory, costing, scheduling and AI platform.'],
  ['/cookies', 'Cookie Policy | ZestIQ Canada', 'Essential cookies and browser storage used by the ZestIQ website and restaurant operations platform.'],
  ['/ai-transparency', 'AI & Data Transparency | ZestIQ', 'How ZestIQ uses AI for restaurant invoice scanning, recipe matching, ordering, forecasts and assistance.'],
  ['/subprocessors', 'Subprocessors | ZestIQ', 'Core providers that help ZestIQ host, secure, bill and deliver its restaurant operations software.'],
];

const template = await readFile('dist/index.html', 'utf8');
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

for (const [path, title, description] of pages) {
  const url = `https://zestiq.ca${path}`;
  const schema = { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url, isPartOf: { '@type': 'WebSite', name: 'ZestIQ', url: 'https://zestiq.ca/' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'ZestIQ', item: 'https://zestiq.ca/' }, { '@type': 'ListItem', position: 2, name: title, item: url }] } };
  let html = template
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/s, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/s, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/s, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/s, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/s, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/s, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/s, `<link rel="canonical" href="${url}" />`)
    .replace(/\s*<script id="zestiq-home-schema" type="application\/ld\+json">.*?<\/script>/s, '')
    .replace('</head>', `    <script type="application/ld+json">${JSON.stringify(schema)}</script>\n  </head>`);
  const destination = join('dist', path.slice(1));
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'index.html'), html);
}

console.log(`Generated ${pages.length} crawlable route entry files.`);
