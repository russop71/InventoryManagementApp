import { Link } from 'react-router';
import { ArrowRight, BarChart3, Check, ClipboardCheck, FileScan, PackageSearch, ReceiptText, ShieldCheck, Sparkles, TrendingDown } from 'lucide-react';
import { usePageSeo } from '../utils/seo';

type PageKey = 'inventory' | 'foodCost' | 'invoiceScanner';

const pages = {
  inventory: {
    path: '/restaurant-inventory-management-software',
    title: 'Restaurant Inventory Management Software | ZestIQ',
    description: 'Restaurant inventory management software for counts, pars, purchasing, recipe costs, supplier pricing and multi-location visibility. See ZestIQ in action.',
    eyebrow: 'Restaurant inventory management software',
    heading: 'Know what is on hand, what it costs, and what to order next.',
    intro: 'ZestIQ connects restaurant inventory counts, supplier prices, invoices, recipes and sales signals so operators can spend less time reconciling spreadsheets and more time acting on margin.',
    icon: PackageSearch,
    points: ['Mobile-friendly inventory counts by storage area', 'Par levels, low-stock signals and suggested orders', 'One ingredient linked to multiple supplier options', 'Location-level records with company-wide owner visibility'],
    workflow: [['Count', 'Organize shelf-to-sheet counts by walk-in, freezer, dry storage, bar or custom areas.'], ['Cost', 'Use current supplier and invoice prices to value stock and update ingredient cost.'], ['Act', 'Review variance, low stock and ordering needs before money leaks into waste or emergency purchases.']],
    question: 'What should restaurant inventory software actually solve?',
    answer: 'A useful system should make weekly counts faster, preserve units and pack sizes, connect purchases to on-hand value, show variance and turn stock data into ordering decisions. ZestIQ is designed around that complete operating loop.',
  },
  foodCost: {
    path: '/restaurant-food-cost-software',
    title: 'Restaurant Food Cost & Recipe Costing Software | ZestIQ',
    description: 'Restaurant food cost software that links recipes to current ingredient prices, menu margins, beverage pours and supplier price changes.',
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
} satisfies Record<PageKey, { path: string; title: string; description: string; eyebrow: string; heading: string; intro: string; icon: typeof PackageSearch; points: string[]; workflow: string[][]; question: string; answer: string }>;

export function RestaurantInventorySeo() { return <SeoPage pageKey="inventory" />; }
export function RestaurantFoodCostSeo() { return <SeoPage pageKey="foodCost" />; }
export function RestaurantInvoiceScannerSeo() { return <SeoPage pageKey="invoiceScanner" />; }

function SeoPage({ pageKey }: { pageKey: PageKey }) {
  const page = pages[pageKey];
  const Icon = page.icon;
  usePageSeo({ title: page.title, description: page.description, path: page.path });
  return <div className="min-h-screen bg-[#FBFAF6] text-[#0B1220]">
    <header className="border-b border-black/5 bg-white"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8"><Link to="/" className="flex items-center gap-2 text-2xl font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F5C10E]">Z</span><span>zest<span className="text-[#D9A900]">IQ</span></span></Link><div className="flex items-center gap-2"><Link to="/login" className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-black">Log in</Link><Link to="/book-demo" className="rounded-xl bg-[#0B1220] px-4 py-2.5 text-sm font-black text-white">Book a demo</Link></div></div></header>
    <main>
      <section className="bg-[#0B1220] text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-28"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5C10E]">{page.eyebrow}</p><h1 className="mt-5 text-5xl font-black leading-[0.96] tracking-[-0.045em] sm:text-6xl">{page.heading}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">{page.intro}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link to="/book-demo" className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#F5C10E] px-7 font-black text-[#0B1220]">See ZestIQ in action<ArrowRight className="h-4 w-4" /></Link><Link to="/" className="inline-flex h-14 items-center justify-center rounded-xl border border-white/15 px-7 font-bold">Explore the platform</Link></div></div><div className="rounded-[30px] border border-white/10 bg-white/5 p-6"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F5C10E] text-[#0B1220]"><Icon className="h-7 w-7" /></div><p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-white/35">Connected restaurant control</p><div className="mt-4 space-y-3">{page.points.map(point => <div key={point} className="flex items-start gap-3 rounded-2xl bg-white/8 p-4"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F5C10E]" /><p className="text-sm font-bold leading-6">{point}</p></div>)}</div></div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A7600]">A practical workflow</p><h2 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.035em] sm:text-5xl">From restaurant data to a decision your team can use.</h2><div className="mt-10 grid gap-4 lg:grid-cols-3">{page.workflow.map(([title, description], index) => <article key={title} className="rounded-3xl border border-black/10 bg-white p-7"><p className="text-sm font-black text-[#B58B00]">0{index + 1}</p><h3 className="mt-7 text-2xl font-black">{title}</h3><p className="mt-3 leading-7 text-black/55">{description}</p></article>)}</div></section>

      <section className="bg-[#F5C10E]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start"><div><Sparkles className="h-8 w-8" /><p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-black/45">Frequently asked</p></div><div><h2 className="text-3xl font-black tracking-tight sm:text-4xl">{page.question}</h2><p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-black/60">{page.answer}</p></div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="grid gap-5 rounded-[32px] bg-white p-7 shadow-sm md:grid-cols-3 md:p-10"><SmallFeature icon={ClipboardCheck} title="Inventory to action" text="Counts and pars connect to purchasing and variance." /><SmallFeature icon={ReceiptText} title="Current cost" text="Invoices and supplier prices connect to recipe margins." /><SmallFeature icon={ShieldCheck} title="Company-isolated" text="Authorized users see only their company and locations." /></div><div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-black"><Link to={pages.inventory.path} className="underline underline-offset-4">Restaurant inventory software</Link><Link to={pages.foodCost.path} className="underline underline-offset-4">Food cost software</Link><Link to={pages.invoiceScanner.path} className="underline underline-offset-4">AI invoice scanner</Link></div></section>
    </main>
    <footer className="border-t border-black/5 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-black/50 sm:flex-row sm:items-center sm:justify-between sm:px-8"><p>© ZestIQ · Restaurant operations intelligence</p><div className="flex gap-4"><Link to="/privacy">Privacy</Link><Link to="/book-demo">Book a demo</Link></div></div></footer>
  </div>;
}

function SmallFeature({ icon: Icon, title, text }: { icon: typeof BarChart3; title: string; text: string }) { return <div><Icon className="h-5 w-5 text-[#B58B00]" /><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm leading-6 text-black/50">{text}</p></div>; }
