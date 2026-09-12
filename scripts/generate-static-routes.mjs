import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const pages = [
  ['/book-demo', 'Book a ZestIQ Restaurant Software Demo', 'Book a tailored ZestIQ demo for restaurant inventory, food cost, invoice scanning, purchasing, beverage and labour workflows.'],
  ['/product-tour', 'ZestIQ Product Tour | Restaurant Operations Software', 'Tour ZestIQ restaurant inventory, costing, purchasing, labour, forecasting and AI workflows.'],
  ['/capabilities', 'ZestIQ Capabilities | Full Restaurant Operations Platform', 'Explore ZestIQ capabilities for inventory, food and beverage cost, invoices, ordering, forecasting, waste, labour, users and AI.'],
  ['/pricing', 'ZestIQ Pricing | CAD $249.99 per Month', 'ZestIQ Basic costs CAD $249.99 per month for the first location. Additional locations are CAD $199.99 each. Scheduling is $49.99 for the first location plus $24.99 per additional location.'],
  ['/contact', 'Contact ZestIQ | Restaurant Software Canada', 'Contact ZestIQ about restaurant inventory, food and beverage cost, labour, integrations, security, billing or a demonstration.'],
  ['/canadian-owned', 'Canadian-Owned Restaurant Software | ZestIQ', 'ZestIQ is a Canadian-owned restaurant operations software company building inventory, cost, labour and AI tools.'],
  ['/best-restaurant-inventory-management-software-canada', 'Best Restaurant Inventory Software in Canada: 2026 Buyer’s Guide', 'A practical 2026 guide to choosing restaurant inventory management software in Canada. Compare counting, food cost, invoices, ordering, POS, labour and multi-location requirements.'],
  ['/restaurant-inventory-management-guide', 'Restaurant Inventory Management Guide: Counts, Food Cost & Ordering', 'A practical restaurant inventory management guide covering count sheets, units, recipe costing, invoice prices, waste, variance, pars and ordering.'],
  ['/restaurant-food-cost-calculator', 'Free Restaurant Food Cost Calculator | Food Cost Percentage', 'Calculate restaurant food cost percentage, gross profit and target menu price. Includes the formula and practical guidance for recipe and menu costing.'],
  ['/restaurant-inventory-management-software', 'Restaurant Inventory Management Software Canada | ZestIQ', 'Restaurant inventory management software for Canadian operators. Connect mobile counts, invoices, live food cost, waste, pars, purchasing and multi-location insights.'],
  ['/restaurant-food-cost-software', 'Restaurant Food Cost & Recipe Costing Software | ZestIQ', 'Restaurant food cost software linking recipes to current ingredient prices, menu margins, beverages and supplier changes.'],
  ['/restaurant-invoice-scanner', 'AI Restaurant Invoice Scanner for PDF & Photos | ZestIQ', 'Scan restaurant invoices from PDF, image or camera and review extracted supplier, items, units and prices.'],
  ['/restaurant-labour-scheduling-software', 'Restaurant Labour Scheduling Software Canada | ZestIQ', 'Restaurant labour scheduling for shifts, labour cost, sales comparison, employee availability, swaps and time off.'],
  ['/restaurant-beverage-costing-software', 'Restaurant Beverage Costing Software | ZestIQ', 'Liquor, wine and beer inventory and costing software for bottles, cases, pours, cocktails, pars and margins.'],
  ['/restaurant-ordering-forecasting-software', 'Restaurant Ordering & Forecasting Software | ZestIQ', 'Restaurant ordering software connecting inventory, pars, sales usage, supplier packs and forecasts to suggested orders.'],
  ['/multi-location-restaurant-software', 'Multi-Location Restaurant Management Software | ZestIQ', 'Manage inventory, costs, purchasing, labour and users by restaurant location with protected company-level visibility.'],
  ['/restaurant-pos-integrations', 'Restaurant POS Integrations Canada | ZestIQ', 'Connect or import restaurant POS sales for menu performance, labour comparison, forecasting and ordering.'],
  ['/legal', 'Legal & Trust Centre | ZestIQ Canada', 'ZestIQ privacy, terms, cookie, AI transparency and service-provider information for Canadian restaurant operators.'],
  ['/privacy', 'Privacy Policy | ZestIQ Canada', 'How ZestIQ collects, uses, shares, protects and retains personal information for its Canadian restaurant platform.'],
  ['/terms', 'Terms of Service | ZestIQ Canada', 'Terms governing subscriptions and use of the ZestIQ restaurant inventory, costing, scheduling and AI platform.'],
  ['/cookies', 'Cookie Policy | ZestIQ Canada', 'Essential cookies and browser storage used by the ZestIQ website and restaurant operations platform.'],
  ['/ai-transparency', 'AI & Data Transparency | ZestIQ', 'How ZestIQ uses AI for restaurant invoice scanning, recipe matching, ordering, forecasts and assistance.'],
  ['/subprocessors', 'Subprocessors | ZestIQ', 'Core providers that help ZestIQ host, secure, bill and deliver its restaurant operations software.'],
];

const resourceContent = {
  '/restaurant-inventory-management-software': {
    label: 'Restaurant inventory management software for Canadian operators',
    heading: 'Know what is on hand, what it costs, and what to order next.',
    intro: 'ZestIQ is restaurant inventory management and food inventory control software built for Canadian operators. It connects counts, supplier prices, invoices, recipes and sales signals so teams can spend less time reconciling spreadsheets and more time acting on margin.',
    modified: '2026-09-12',
    schemaType: 'SoftwareApplication',
    sections: [
      ['Count restaurant inventory by storage area', 'Organize mobile-friendly counts in the physical order the team walks the freezer, walk-in, dry storage and bar. Track cases, kilograms, bottles, pours, portions and other restaurant units.'],
      ['Keep inventory value and recipe cost current', 'Review supplier invoice prices before they update ingredient cost, on-hand inventory value and affected food or beverage recipes. Price history helps managers find margin changes earlier.'],
      ['Turn counts and demand into suggested orders', 'Compare on-hand stock, pars, incoming purchases, supplier pack sizes and recent demand. ZestIQ produces reviewable ordering recommendations that an authorized manager approves before sending.'],
      ['Separate every restaurant location', 'Each location keeps its own inventory, COGS, invoices, orders, waste, forecasts and labour records. Managers see assigned locations while authorized company owners retain cross-location oversight.'],
      ['Use inventory data to investigate variance', 'Compare actual stock movement with recipe-linked sales and purchases, then focus on high-dollar exceptions caused by unit errors, waste, over-portioning, receiving mistakes or other operational issues.'],
    ],
    faqs: [
      ['What should restaurant inventory software actually solve?', 'A useful system should make weekly counts faster, preserve units and pack sizes, connect purchases to on-hand value, show variance and turn stock data into ordering decisions. ZestIQ is designed around that complete operating loop.'],
      ['How often should restaurants count inventory?', 'Many restaurants complete a full inventory count weekly and use daily spot counts for expensive, fast-moving or high-variance products. The best schedule is one the team can complete consistently at the same operational cut-off.'],
      ['How is restaurant inventory software different from a generic inventory app?', 'Restaurant systems must understand changing supplier prices, cases and recipe units, preparation yields, theoretical usage, food and beverage cost, waste, pars and purchasing—not only quantities on a shelf.'],
      ['Can restaurant inventory software connect with POS sales?', 'Yes. Sales and menu-item data can support theoretical usage, menu margin, labour comparison, forecasting and suggested ordering when the POS connection or import is available.'],
    ],
  },
  '/best-restaurant-inventory-management-software-canada': {
    label: '2026 Canadian restaurant software buyer’s guide',
    heading: 'How to choose the best restaurant inventory software for your operation.',
    intro: 'Compare restaurant inventory systems by the workflows operators actually need: mobile counts, invoice capture, live recipe cost, waste, ordering, forecasting, POS data and multi-location control.',
    modified: '2026-09-09',
    sections: [
      ['Start with the operating problem', 'Document who counts inventory, how products are received and stored, which units the team uses, how invoices arrive and who approves an order. The best software fits that operating rhythm instead of creating another administrative task.'],
      ['Test real restaurant workflows', 'Test mobile counts, unit conversions, invoice scanning with review, live recipe and beverage costing, suggested ordering, waste and variance reporting, and protected location-level permissions.'],
      ['Compare the complete Canadian cost', 'Confirm Canadian-dollar pricing, onboarding fees, additional-location costs, invoice limits, POS connections, scheduling, support, tax handling and contract terms.'],
    ],
    faqs: [
      ['What is restaurant inventory management software?', 'It helps restaurants count stock, value on-hand inventory, organize suppliers, calculate recipe cost, monitor waste and make replenishment decisions.'],
      ['How much does restaurant inventory software cost in Canada?', 'Pricing varies by location count, feature set, invoice volume, integrations and onboarding. Compare the complete monthly cost in Canadian dollars.'],
    ],
  },
  '/restaurant-inventory-management-guide': {
    label: 'Complete restaurant inventory management guide',
    heading: 'Restaurant inventory management: from weekly count to daily decision.',
    intro: 'A practical restaurant inventory guide covering item setup, storage-area counts, supplier invoices, recipe usage, variance, waste, pars and ordering.',
    modified: '2026-09-10',
    sections: [
      ['Build one clean inventory item list', 'Give every ingredient and beverage a clear name, category, base unit, purchase unit, supplier and storage location. Document conversions between cases, kilograms, bottles, ounces, portions and individual units.'],
      ['Design a count people can finish', 'Arrange count sheets in the physical order the team walks each storage area. Use a consistent cut-off time, assign ownership and complete weekly full counts with daily spot counts for high-value products.'],
      ['Use a weekly restaurant inventory routine', 'Every day, review deliveries, post approved invoice prices, log waste and spot-count critical items. On count day, finish receiving, count storage areas in walking order and complete every line. The next morning, investigate dollar variance, review price changes and approve replenishment by supplier.'],
      ['Connect invoices, recipes and sales', 'Current supplier prices should flow into inventory value and recipe cost. Linking POS menu items to recipes creates theoretical usage that can be compared with actual stock movement.'],
      ['Turn variance into action', 'Review the highest-dollar variances first, separate price variance from usage variance, verify unit conversions, log waste consistently and adjust pars using demand and lead time.'],
      ['Track four practical inventory formulas', 'Actual usage equals beginning inventory plus purchases minus ending inventory. Actual food cost percentage divides actual food usage cost by food sales. Usage variance compares actual with theoretical usage. Days on hand divides ending inventory value by average daily cost of goods sold.'],
    ],
    faqs: [
      ['How often should a restaurant count inventory?', 'Many restaurants complete a full count weekly and daily spot counts for expensive, fast-moving or high-variance products.'],
      ['What is restaurant inventory variance?', 'It is the difference between expected usage or stock and the actual count, expressed in units or dollars.'],
      ['How do pars improve restaurant ordering?', 'Comparing target stock with current stock, incoming orders and expected demand creates a more defensible order quantity.'],
    ],
  },
  '/restaurant-food-cost-calculator': {
    label: 'Free restaurant food-cost calculator',
    heading: 'Calculate restaurant food-cost percentage, gross profit and target menu price.',
    intro: 'Use the free ZestIQ food-cost calculator to compare current ingredient cost with menu price and estimate the price required to reach a target food-cost percentage.',
    modified: '2026-09-09',
    sections: [
      ['Restaurant food-cost formula', 'Food cost percentage equals ingredient cost divided by menu price, multiplied by 100. A dish with $6.40 of ingredients and a $24 menu price has a food cost of 26.7 percent.'],
      ['Use current supplier prices', 'A one-time calculation becomes outdated as purchase prices change. Connect invoice prices to ingredient units and recipes, then review menu items that move outside their target margin.'],
    ],
    faqs: [
      ['What is a good food cost percentage for a restaurant?', 'There is no universal percentage. Operators should use category-specific targets and consider contribution margin, labour, waste and menu demand.'],
      ['Should food cost include waste?', 'Recipe cost measures expected ingredients. Actual food cost is also affected by waste, over-portioning, receiving errors and count accuracy.'],
    ],
  },
};

const template = await readFile('dist/index.html', 'utf8');
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

for (const [path, title, description] of pages) {
  const url = `https://zestiq.ca${path}`;
  const content = resourceContent[path];
  const graph = [
    { '@type': 'WebPage', '@id': `${url}#webpage`, name: title, description, url, inLanguage: 'en-CA', isPartOf: { '@type': 'WebSite', name: 'ZestIQ', url: 'https://zestiq.ca/' } },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'ZestIQ', item: 'https://zestiq.ca/' }, { '@type': 'ListItem', position: 2, name: title, item: url }] },
  ];
  if (content) {
    const contentType = content.schemaType || (path.endsWith('calculator') ? 'WebApplication' : 'Article');
    graph.push(contentType === 'SoftwareApplication'
      ? { '@type': contentType, name: 'ZestIQ', headline: content.heading, description, url, dateModified: content.modified, inLanguage: 'en-CA', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '249.99', priceCurrency: 'CAD', url: 'https://zestiq.ca/pricing' }, mainEntityOfPage: { '@id': `${url}#webpage` } }
      : { '@type': contentType, headline: content.heading, description, url, dateModified: content.modified, inLanguage: 'en-CA', mainEntityOfPage: { '@id': `${url}#webpage` } });
    graph.push({ '@type': 'FAQPage', mainEntity: content.faqs.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) });
  }
  const schema = { '@context': 'https://schema.org', '@graph': graph };
  const crawlableContent = content ? `<main id="zestiq-crawlable-content"><article><p>${escapeHtml(content.label)}</p><h1>${escapeHtml(content.heading)}</h1><p>${escapeHtml(content.intro)}</p>${content.sections.map(([heading, body]) => `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></section>`).join('')}<section><h2>Frequently asked questions</h2>${content.faqs.map(([question, answer]) => `<h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p>`).join('')}</section><nav aria-label="Related restaurant resources"><a href="/restaurant-inventory-management-software">Restaurant inventory software</a> · <a href="/restaurant-inventory-management-guide">Inventory guide</a> · <a href="/restaurant-food-cost-calculator">Food-cost calculator</a> · <a href="/book-demo">Book a ZestIQ demo</a></nav></article></main>` : '';
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
    .replace('</head>', `    <script type="application/ld+json">${JSON.stringify(schema)}</script>\n  </head>`)
    .replace(/<div id="root">.*?<\/div>/s, `<div id="root">${crawlableContent}</div>`);
  const destination = join('dist', path.slice(1));
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'index.html'), html);
}

console.log(`Generated ${pages.length} crawlable route entry files.`);
