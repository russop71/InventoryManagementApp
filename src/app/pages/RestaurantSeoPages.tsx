import { Link } from 'react-router';
import { ArrowRight, BarChart3, CalendarClock, Check, ClipboardCheck, FileScan, PackageSearch, ReceiptText, ShieldCheck, ShoppingCart, Sparkles, TrendingDown, Wine } from 'lucide-react';
import { usePageSeo } from '../utils/seo';
import { ZestIQBrand } from '../components/ZestIQBrand';

type PageKey = 'inventory' | 'foodCost' | 'invoiceScanner' | 'labour' | 'beverage' | 'ordering' | 'multiLocation' | 'posIntegrations';

const pages = {
  inventory: {
    path: '/restaurant-inventory-management-software',
    title: 'Restaurant Inventory Management Software Canada | ZestIQ',
    description: 'Restaurant inventory management software for Canadian operators. Connect mobile counts, invoices, live food cost, waste, pars, purchasing and multi-location insights.',
    eyebrow: 'Restaurant inventory management software',
    heading: 'Know what is on hand, what it costs, and what to order next.',
    intro: 'ZestIQ is restaurant inventory management and food inventory control software built for Canadian operators. It connects counts, supplier prices, invoices, recipes and sales signals so teams can spend less time reconciling spreadsheets and more time acting on margin.',
    icon: PackageSearch,
    points: ['Mobile-friendly inventory counts by storage area', 'Par levels, low-stock signals and suggested orders', 'One ingredient linked to multiple supplier options', 'Location-level records with company-wide owner visibility'],
    workflow: [['Count', 'Organize shelf-to-sheet counts by walk-in, freezer, dry storage, bar or custom areas.'], ['Cost', 'Use current supplier and invoice prices to value stock and update ingredient cost.'], ['Act', 'Review variance, low stock and ordering needs before money leaks into waste or emergency purchases.']],
    question: 'What should restaurant inventory software actually solve?',
    answer: 'A useful system should make weekly counts faster, preserve units and pack sizes, connect purchases to on-hand value, show variance and turn stock data into ordering decisions. ZestIQ is designed around that complete operating loop.',
  },
  foodCost: {
    path: '/restaurant-food-cost-software',
    title: 'Restaurant Food Cost & Recipe Costing Software Canada | ZestIQ',
    description: 'Food costing and recipe costing software for restaurants. Link recipes to current ingredient prices, menu margins, beverage pours and supplier changes.',
    eyebrow: 'Restaurant food cost software',
    heading: 'See which menu margins changed before the month is over.',
    intro: 'ZestIQ links every recipe to the ingredient prices restaurant teams actually pay. When a case, bottle or kilogram changes cost, affected dishes and drinks can be reviewed with current margin—not last quarter’s spreadsheet.',
    icon: TrendingDown,
    points: ['Recipe cost and food-cost percentage from current inventory prices', 'Ingredient price-change visibility across affected menu items', 'Liquor, wine, beer, cocktail and pour-cost support', 'AI-assisted handwritten recipe capture with human review'],
    workflow: [['Build', 'Create recipes with yield, portions, ingredient units and menu price.'], ['Update', 'Use invoice and supplier pricing to refresh ingredient cost.'], ['Protect', 'Identify dishes or beverages below target margin and decide whether to reprice, re-portion or re-source.']],
    question: 'How does live recipe costing improve restaurant margin?',
    answer: 'Static recipe cards become inaccurate as supplier prices move. Connecting recipe quantities to current purchase costs helps operators see the financial effect earlier and focus attention on menu items where a small change matters most.',
  },
  invoiceScanner: {
    path: '/restaurant-invoice-scanner',
    title: 'AI Restaurant Invoice Scanner for PDF & Photos | ZestIQ',
    description: 'Scan restaurant supplier invoices from PDF, image or camera. Review extracted supplier, invoice number, quantities, units and prices before inventory updates.',
    eyebrow: 'AI restaurant invoice scanner',
    heading: 'Turn supplier invoices into reviewable restaurant cost data.',
    intro: 'Upload a PDF, choose a file or use a camera. ZestIQ extracts the supplier, invoice number, line items, quantities, units and prices, then keeps a person in the review step before inventory and price history change.',
    icon: FileScan,
    points: ['PDF, image and mobile-camera input', 'Duplicate invoice-number protection', 'Supplier and inventory-item matching', 'Review uncertain fields before posting costs'],
    workflow: [['Capture', 'Upload the original PDF or take a clear photo of the full invoice.'], ['Review', 'Confirm supplier, invoice number, item match, quantity, unit and price.'], ['Post', 'Update authorized location data and preserve the new supplier price history.']],
    question: 'Can an AI invoice scanner update inventory safely?',
    answer: 'It should not post uncertain AI output without review. ZestIQ separates extraction from approval, flags fields that need attention and prevents duplicate invoice numbers so users remain in control of the final record.',
  },
  labour: {
    path: '/restaurant-labour-scheduling-software',
    title: 'Restaurant Labour Scheduling Software Canada | ZestIQ',
    description: 'Restaurant labour scheduling software for shifts, labour cost, sales comparison, employee availability, swaps and time-off requests.',
    eyebrow: 'Restaurant labour scheduling software',
    heading: 'See labour cost before the schedule becomes payroll.',
    intro: 'ZestIQ puts planned hours, hourly rates, sales and target labour percentage on the same operating view. Managers can build the week while employees review shifts, request swaps and book time off.',
    icon: CalendarClock,
    points: ['Weekly scheduling by employee, role and location', 'Scheduled hours and labour cost compared with sales', 'Employee shift view, swap requests and time off', 'Owner visibility across restaurant locations'],
    workflow: [['Plan', 'Build shifts against roles, availability and expected demand.'], ['Check', 'Compare scheduled labour dollars and percentage with sales targets.'], ['Publish', 'Give employees a clear mobile schedule and controlled request workflow.']],
    question: 'What should restaurant scheduling software show an operator?',
    answer: 'A schedule should be more than a calendar. Connecting planned hours and wage rates with sales helps managers see an overstaffed or understaffed service before the week is locked, while a simple employee workflow reduces message threads and missed requests.',
  },
  beverage: {
    path: '/restaurant-beverage-costing-software',
    title: 'Restaurant Beverage Costing Software | ZestIQ',
    description: 'Liquor, wine and beer inventory and beverage costing software for bottles, cases, pours, cocktails, pars and drink margins.',
    eyebrow: 'Restaurant beverage costing software',
    heading: 'Run bar and kitchen cost from the same inventory system.',
    intro: 'Track liquor, wine and beer by bottle, case and pour. ZestIQ connects purchase cost, bottle yield, cocktail recipes, bar pars and menu price so beverage margin is visible beside food cost.',
    icon: Wine,
    points: ['Bottle, case, keg and pour-aware inventory', 'Cost per drink and bottle-yield calculations', 'Cocktail, wine-by-the-glass and beer margin', 'Bar pars, price history and variance workflows'],
    workflow: [['Receive', 'Capture beverage purchases and supplier prices from invoices.'], ['Cost', 'Convert bottle or case cost into the pour and recipe units actually sold.'], ['Control', 'Review bar stock, variance, drink margin and reorder needs.']],
    question: 'Why separate beverage costing from basic food inventory?',
    answer: 'Bar inventory has different units, yields and loss patterns. A useful full-restaurant system must understand the relationship between cases, bottles, ounces, pours and drink recipes while still reporting the total restaurant margin in one place.',
  },
  ordering: {
    path: '/restaurant-ordering-forecasting-software',
    title: 'Restaurant Ordering & Forecasting Software | ZestIQ',
    description: 'Restaurant ordering software that connects on-hand inventory, pars, sales usage, supplier pack sizes and forecasts to suggested purchase orders.',
    eyebrow: 'Restaurant ordering and forecasting software',
    heading: 'Order from current stock and demand—not last week’s guess.',
    intro: 'ZestIQ turns counts, pars, recent usage, supplier choices and pack sizes into a reviewable suggested order. Restaurant teams stay in control before anything is sent.',
    icon: ShoppingCart,
    points: ['Suggested quantities from on-hand stock and pars', 'Sales and usage signals for demand planning', 'Supplier-specific pricing and pack-size review', 'Human approval before purchase orders are placed'],
    workflow: [['Measure', 'Use current counts, incoming orders and recent usage.'], ['Suggest', 'Calculate order needs against pars and supplier packs.'], ['Approve', 'Review quantities, cost and supplier before sending or receiving.']],
    question: 'Can restaurant ordering recommendations be trusted?',
    answer: 'They are most useful when the calculation is visible. ZestIQ treats forecasts as decision support: current stock, pars, sales and pack sizes provide the evidence, and an authorized user confirms the final order.',
  },
  multiLocation: {
    path: '/multi-location-restaurant-software',
    title: 'Multi-Location Restaurant Management Software | ZestIQ',
    description: 'Manage restaurant inventory, costs, purchasing, labour and users by location while company owners retain protected cross-location visibility.',
    eyebrow: 'Multi-location restaurant operations',
    heading: 'Standardize the operation without mixing restaurant data.',
    intro: 'Each restaurant location keeps its own inventory, suppliers, counts, orders, recipes and labour records. Authorized company owners can compare locations without exposing one company to another.',
    icon: ShieldCheck,
    points: ['Location-specific inventory, counts and purchasing', 'Company-level owner visibility and user access', 'Separate restaurant companies and protected records', 'Additional locations billed clearly per active location'],
    workflow: [['Set up', 'Create the company, locations and authorized users with defined roles.'], ['Operate', 'Let each location count, buy, cost and schedule against its own records.'], ['Compare', 'Give owners a controlled view of cost, labour and operational performance across locations.']],
    question: 'How does ZestIQ keep multi-location restaurant data organized?',
    answer: 'Every operational record is associated with a company and location. Users receive only the access their role requires, while platform administration remains separate from restaurant ownership and day-to-day management.',
  },
  posIntegrations: {
    path: '/restaurant-pos-integrations',
    title: 'Restaurant POS Integrations Canada | ZestIQ',
    description: 'Connect or import restaurant POS sales into ZestIQ for menu performance, food cost, labour comparison, forecasts and ordering recommendations.',
    eyebrow: 'Restaurant POS integrations',
    heading: 'Bring sales into the same place as cost, stock and labour.',
    intro: 'ZestIQ is designed to normalize restaurant sales and menu-item data so operators can compare what sold with what it cost, what labour was scheduled and what inventory should be ordered next.',
    icon: BarChart3,
    points: ['Sales and menu-item import workflows', 'Menu-to-recipe linking for theoretical cost', 'Labour percentage and sales comparison', 'Forecast and ordering signals from historical demand'],
    workflow: [['Connect', 'Authorize a supported integration or import a structured POS sales export.'], ['Map', 'Match POS menu items to ZestIQ recipes and beverage items.'], ['Use', 'Apply sales history to margin reporting, labour review, forecasts and suggested purchasing.']],
    question: 'Which POS systems can ZestIQ work with?',
    answer: 'Availability depends on each provider’s API and customer permissions. ZestIQ supports structured import workflows now and is designed for direct integrations with Canadian restaurant POS providers as commercial access is approved.',
  },
} satisfies Record<PageKey, { path: string; title: string; description: string; eyebrow: string; heading: string; intro: string; icon: typeof PackageSearch; points: string[]; workflow: string[][]; question: string; answer: string }>;

export function RestaurantInventorySeo() { return <SeoPage pageKey="inventory" />; }
export function RestaurantFoodCostSeo() { return <SeoPage pageKey="foodCost" />; }
export function RestaurantInvoiceScannerSeo() { return <SeoPage pageKey="invoiceScanner" />; }
export function RestaurantLabourSeo() { return <SeoPage pageKey="labour" />; }
export function RestaurantBeverageSeo() { return <SeoPage pageKey="beverage" />; }
export function RestaurantOrderingSeo() { return <SeoPage pageKey="ordering" />; }
export function MultiLocationSeo() { return <SeoPage pageKey="multiLocation" />; }
export function PosIntegrationsSeo() { return <SeoPage pageKey="posIntegrations" />; }

function SeoPage({ pageKey }: { pageKey: PageKey }) {
  const page = pages[pageKey];
  const Icon = page.icon;
  const faqs: Array<[string, string]> = pageKey === 'inventory' ? [
    [page.question, page.answer],
    ['How often should restaurants count inventory?', 'Many restaurants complete a full inventory count weekly and use daily spot counts for expensive, fast-moving or high-variance products. The best schedule is one the team can complete consistently at the same operational cut-off.'],
    ['How is restaurant inventory software different from a generic inventory app?', 'Restaurant systems must understand changing supplier prices, cases and recipe units, preparation yields, theoretical usage, food and beverage cost, waste, pars and purchasing—not only quantities on a shelf.'],
    ['Can restaurant inventory software connect with POS sales?', 'Yes. Sales and menu-item data can support theoretical usage, menu margin, labour comparison, forecasting and suggested ordering when the POS connection or import is available.'],
  ] : pageKey === 'foodCost' ? [
    [page.question, page.answer],
    ['What is restaurant food costing software?', 'Restaurant food costing software connects ingredient quantities, yields and portions with current purchase prices to calculate recipe cost, food-cost percentage, contribution margin and menu profitability.'],
    ['How is recipe costing software different from a spreadsheet?', 'A spreadsheet records a point-in-time calculation. Connected recipe costing software can update affected dishes when reviewed supplier or invoice prices change, making margin movement easier to find.'],
    ['Can food cost software connect with restaurant inventory and invoices?', 'Yes. Connecting approved invoice prices, inventory units and recipes gives operators a more current view of ingredient cost, stock value and menu margin.'],
  ] : [[page.question, page.answer]];
  usePageSeo({ title: page.title, description: page.description, path: page.path });
  return <div className="min-h-screen bg-[#FBFAF6] text-[#303A43]">
    <header className="border-b border-black/5 bg-white"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8"><Link to="/" aria-label="ZestIQ home"><ZestIQBrand compact /></Link><div className="flex items-center gap-2"><Link to="/login" className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-black">Log in</Link><Link to="/book-demo" className="rounded-xl bg-[#303A43] px-4 py-2.5 text-sm font-black text-white">Book a demo</Link></div></div></header>
    <main>
      <section className="bg-[#303A43] text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-28"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5D62E]">{page.eyebrow}</p><h1 className="mt-5 text-5xl font-black leading-[0.96] tracking-[-0.045em] sm:text-6xl">{page.heading}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">{page.intro}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link to="/book-demo" className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#F5D62E] px-7 font-black text-[#303A43]">See ZestIQ in action<ArrowRight className="h-4 w-4" /></Link><Link to="/" className="inline-flex h-14 items-center justify-center rounded-xl border border-white/15 px-7 font-bold">Explore the platform</Link></div></div><div className="rounded-[30px] border border-white/10 bg-white/5 p-6"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F5D62E] text-[#303A43]"><Icon className="h-7 w-7" /></div><p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-white/35">Connected restaurant control</p><div className="mt-4 space-y-3">{page.points.map(point => <div key={point} className="flex items-start gap-3 rounded-2xl bg-white/8 p-4"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F5D62E]" /><p className="text-sm font-bold leading-6">{point}</p></div>)}</div></div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A7600]">A practical workflow</p><h2 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.035em] sm:text-5xl">From restaurant data to a decision your team can use.</h2><div className="mt-10 grid gap-4 lg:grid-cols-3">{page.workflow.map(([title, description], index) => <article key={title} className="rounded-3xl border border-black/10 bg-white p-7"><p className="text-sm font-black text-[#B58B00]">0{index + 1}</p><h3 className="mt-7 text-2xl font-black">{title}</h3><p className="mt-3 leading-7 text-black/55">{description}</p></article>)}</div></section>

      {pageKey === 'inventory' && <section className="border-y border-black/5 bg-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A7600]">Real ZestIQ inventory workflow</p><h2 className="mt-3 text-4xl font-black tracking-[-0.035em] sm:text-5xl">Built for restaurant units, storage areas and weekly decisions.</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-black/55">Restaurant inventory is not generic warehouse stock. ZestIQ keeps cases, kilograms, bottles, pours and portions connected with supplier prices, recipes, waste and ordering.</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><SmallFeature icon={PackageSearch} title="Count by storage area" text="Walk the walk-in, freezer, dry storage and bar in the order your team works." /><SmallFeature icon={ReceiptText} title="Use current invoice cost" text="Bring reviewed supplier pricing into inventory value and affected recipe margins." /><SmallFeature icon={TrendingDown} title="Investigate variance" text="Compare expected and actual usage, then focus on the highest-dollar exceptions." /><SmallFeature icon={ShoppingCart} title="Review suggested orders" text="Combine on-hand stock, pars, incoming purchases, demand and supplier packs." /></div></div><figure className="overflow-hidden rounded-[30px] border border-black/10 bg-[#303A43] p-3 shadow-2xl"><img src="/product-inventory.png" alt="ZestIQ restaurant inventory management dashboard showing item counts, units and stock information" width="1200" height="800" loading="lazy" className="h-auto w-full rounded-[22px]" /><figcaption className="px-3 pb-2 pt-4 text-sm font-bold text-white/55">ZestIQ inventory management—real product screen.</figcaption></figure></div></section>}

      {(pageKey === 'inventory' || pageKey === 'foodCost') && <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="rounded-[32px] bg-[#303A43] p-7 text-white md:p-10"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5D62E]">Restaurant operator resources</p><h2 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.03em] sm:text-4xl">Use the numbers to choose—and run—the right system.</h2><p className="mt-4 max-w-3xl leading-7 text-white/60">Compare restaurant inventory software with a practical scorecard, tighten the weekly count process and check recipe economics with current food-cost tools.</p><div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4"><RelatedResource to="/best-restaurant-inventory-management-software-canada" title="Canadian buyer’s guide" text="Compare counting, invoices, food cost, ordering and controls." /><RelatedResource to="/restaurant-inventory-management-guide" title="Inventory management guide" text="Build a repeatable count, variance and ordering rhythm." /><RelatedResource to="/restaurant-food-cost-calculator" title="Food-cost calculator" text="Check food-cost percentage, gross profit and target price." /><RelatedResource to="/pricing" title="ZestIQ pricing" text="Review transparent Canadian pricing and location costs." /></div></div></section>}

      <section className="bg-[#F5D62E]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start"><div><Sparkles className="h-8 w-8" /><p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-black/45">Frequently asked</p></div><div className="divide-y divide-black/15">{faqs.map(([question, answer]) => <article key={question} className="py-7 first:pt-0 last:pb-0"><h2 className="text-2xl font-black tracking-tight sm:text-3xl">{question}</h2><p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-black/60">{answer}</p></article>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="grid gap-5 rounded-[32px] bg-white p-7 shadow-sm md:grid-cols-3 md:p-10"><SmallFeature icon={ClipboardCheck} title="Inventory to action" text="Counts and pars connect to purchasing and variance." /><SmallFeature icon={ReceiptText} title="Current cost" text="Invoices and supplier prices connect to recipe margins." /><SmallFeature icon={ShieldCheck} title="Company-isolated" text="Authorized users see only their company and locations." /></div><div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-black"><Link to={pages.inventory.path} className="underline underline-offset-4">Inventory</Link><Link to={pages.foodCost.path} className="underline underline-offset-4">Food cost</Link><Link to={pages.invoiceScanner.path} className="underline underline-offset-4">Invoice scanning</Link><Link to={pages.labour.path} className="underline underline-offset-4">Labour scheduling</Link><Link to={pages.beverage.path} className="underline underline-offset-4">Beverage costing</Link><Link to={pages.ordering.path} className="underline underline-offset-4">Ordering</Link><Link to="/restaurant-inventory-management-guide" className="underline underline-offset-4">Inventory guide</Link><Link to="/best-restaurant-inventory-management-software-canada" className="underline underline-offset-4">Buyer’s guide</Link><Link to="/restaurant-food-cost-calculator" className="underline underline-offset-4">Food-cost calculator</Link></div></section>
    </main>
    <footer className="border-t border-black/5 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-black/50 sm:flex-row sm:items-center sm:justify-between sm:px-8"><p>© 2026 ZestIQ · Canadian restaurant operations intelligence</p><div className="flex flex-wrap gap-4"><Link to="/legal">Legal centre</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/book-demo">Book a demo</Link></div></div></footer>
  </div>;
}

function SmallFeature({ icon: Icon, title, text }: { icon: typeof BarChart3; title: string; text: string }) { return <div><Icon className="h-5 w-5 text-[#B58B00]" /><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm leading-6 text-black/50">{text}</p></div>; }
function RelatedResource({ to, title, text }: { to: string; title: string; text: string }) { return <Link to={to} className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-0.5 hover:bg-white/10"><h3 className="font-black text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-white/55">{text}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#F5D62E]">Read more<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></Link>; }
