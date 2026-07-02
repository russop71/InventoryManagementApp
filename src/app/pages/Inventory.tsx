import { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  Plus, Search, Upload, Download, ClipboardList, ChevronRight,
  AlertTriangle, TrendingUp, DollarSign, ShoppingBag,
  Fish, Leaf, Wheat, Coffee, Milk, Apple, Egg, Wine,
  Package, Flame, Sandwich, Droplets, SlidersHorizontal, Filter, X,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { toast } from 'sonner';
import { utils, writeFile } from 'xlsx';

const Y = '#F5C10E';
const D = '#0F172A';

// Maps category names to Lucide icon components — no emoji
function getCategoryIcon(category: string) {
  const k = category.toLowerCase();
  if (k.includes('protein') || k.includes('meat') || k.includes('beef') || k.includes('pork') || k.includes('chicken') || k.includes('poultry')) return Flame;
  if (k.includes('seafood') || k.includes('fish') || k.includes('salmon') || k.includes('shrimp') || k.includes('tuna')) return Fish;
  if (k.includes('produce') || k.includes('vegetable') || k.includes('lettuce') || k.includes('herb') || k.includes('greens')) return Leaf;
  if (k.includes('fruit') || k.includes('apple') || k.includes('berry')) return Apple;
  if (k.includes('dairy') || k.includes('milk') || k.includes('cream') || k.includes('cheese') || k.includes('butter')) return Milk;
  if (k.includes('egg')) return Egg;
  if (k.includes('dry') || k.includes('grain') || k.includes('flour') || k.includes('rice') || k.includes('pasta') || k.includes('cereal')) return Wheat;
  if (k.includes('bread') || k.includes('bakery') || k.includes('baked') || k.includes('pastry')) return Sandwich;
  if (k.includes('beverage') || k.includes('drink') || k.includes('juice') || k.includes('soda') || k.includes('coffee') || k.includes('tea')) return Coffee;
  if (k.includes('oil') || k.includes('sauce') || k.includes('condiment') || k.includes('dressing') || k.includes('vinegar')) return Droplets;
  if (k.includes('wine') || k.includes('alcohol') || k.includes('beer') || k.includes('spirit') || k.includes('liquor')) return Wine;
  return Package;
}

function CategoryIcon({ category }: { category: string }) {
  const Icon = getCategoryIcon(category);
  return (
    <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
      <Icon className="w-[18px] h-[18px] text-gray-400" strokeWidth={1.5} />
    </div>
  );
}

type Status = 'in-stock' | 'low-stock' | 'out-of-stock';

function getStatus(current: number, par: number): Status {
  if (current <= 0) return 'out-of-stock';
  if (current < par * 0.5) return 'low-stock';
  return 'in-stock';
}

const STATUS: Record<Status, { label: string; bg: string; color: string }> = {
  'in-stock':     { label: 'In Stock',     bg: '#DCFCE7', color: '#166534' },
  'low-stock':    { label: 'Low Stock',    bg: '#FEF9C3', color: '#854D0E' },
  'out-of-stock': { label: 'Out of Stock', bg: '#FEE2E2', color: '#991B1B' },
};

export function Inventory() {
  const navigate = useNavigate();
  const { inventory, addInventoryItem } = useInventory();
  const { salesData } = useToast();

  const [search, setSearch]           = useState('');
  const [activeTab, setActiveTab]     = useState<'all' | 'low-stock' | 'out-of-stock' | 'expiring'>('all');
  const [addOpen, setAddOpen]         = useState(false);
  const [importOpen, setImportOpen]   = useState(false);
  const [preview, setPreview]         = useState<any[]>([]);
  const [filterOpen, setFilterOpen]   = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = Array.from(new Set(inventory.map(i => i.category))).sort();

  const totalValue     = inventory.reduce((s, i) => s + i.currentStock * i.unitCost, 0);
  const lowStockItems  = inventory.filter(i => getStatus(i.currentStock, i.parLevel) === 'low-stock');
  const outItems       = inventory.filter(i => getStatus(i.currentStock, i.parLevel) === 'out-of-stock');
  const wasteValue     = inventory.reduce((s, i) => s + Math.max(0, i.currentStock - i.parLevel) * i.unitCost, 0);

  const filtered = inventory.filter(item => {
    const q = search.toLowerCase();
    const hit = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.supplier.toLowerCase().includes(q);
    const st = getStatus(item.currentStock, item.parLevel);
    const tab = activeTab === 'all' ? true : activeTab === 'low-stock' ? st === 'low-stock' : activeTab === 'out-of-stock' ? st === 'out-of-stock' : st !== 'in-stock';
    const cat = categoryFilter === 'all' || item.category === categoryFilter;
    return hit && tab && cat;
  });

  const activeFilterCount = (categoryFilter !== 'all' ? 1 : 0);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addInventoryItem({
      name: fd.get('name') as string,
      category: fd.get('category') as string,
      currentStock: Number(fd.get('currentStock')),
      unit: fd.get('unit') as string,
      unitCost: Number(fd.get('unitCost')),
      parLevel: Number(fd.get('parLevel')),
      supplier: fd.get('supplier') as string,
      lastOrdered: new Date().toISOString().split('T')[0],
    });
    setAddOpen(false);
    toast.success('Item added');
    e.currentTarget.reset();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = (ev.target?.result as string).split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('Invalid CSV'); return; }
      const hdrs = lines[0].split(',').map(h => h.trim().toLowerCase());
      const items = lines.slice(1).map(l => {
        const v = l.split(',').map(x => x.trim());
        return {
          name: v[hdrs.indexOf('name')] || '',
          category: v[hdrs.indexOf('category')] || 'Uncategorized',
          currentStock: Number(v[hdrs.indexOf('currentstock')] || v[hdrs.indexOf('stock')] || 0),
          unit: v[hdrs.indexOf('unit')] || 'lbs',
          unitCost: Number(v[hdrs.indexOf('unitcost')] || v[hdrs.indexOf('cost')] || 0),
          parLevel: Number(v[hdrs.indexOf('parlevel')] || v[hdrs.indexOf('par')] || 0),
          supplier: v[hdrs.indexOf('supplier')] || 'Unknown',
        };
      }).filter(i => i.name);
      if (!items.length) { toast.error('No valid items'); return; }
      setPreview(items);
      setImportOpen(true);
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    preview.forEach(item => addInventoryItem({ ...item, lastOrdered: new Date().toISOString().split('T')[0] }));
    toast.success(`Imported ${preview.length} items`);
    setImportOpen(false);
    setPreview([]);
  };

  const downloadTemplate = () => {
    const csv = 'Name,Category,Current Stock,Unit,Unit Cost,Par Level,Supplier\nChicken Breast,Proteins,50,lbs,3.50,100,Sysco';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: '86d-template.csv' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success('Template downloaded');
  };

  const exportExcel = () => {
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(inventory), 'Inventory');
    writeFile(wb, '86d-inventory.xlsx');
    toast.success('Exported');
  };

  const TABS = [
    { key: 'all',          label: 'All Items',     count: null as number | null },
    { key: 'low-stock',    label: 'Low Stock',     count: lowStockItems.length },
    { key: 'out-of-stock', label: 'Out of Stock',  count: outItems.length },
    { key: 'expiring',     label: 'Expiring Soon', count: null as number | null },
  ] as const;

  const fmtVal = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;

  return (
    <div className="-mx-4 bg-white min-h-screen">

      {/* Header */}
      <div className="px-4 pt-2 pb-5">
        <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: D }}>Inventory</h1>
        <p className="text-sm text-gray-400 mt-0.5">Track stock. Reduce waste. Protect margins.</p>

        {/* Search + Filter + Add */}
        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-gray-100 text-sm text-gray-800 placeholder:text-gray-400 outline-none border-0"
            />
          </div>
          {/* Filter button */}
          <button
            onClick={() => setFilterOpen(true)}
            className="relative h-10 w-10 flex items-center justify-center rounded-xl shrink-0 border border-gray-200 bg-white"
            aria-label="Filter"
          >
            <Filter className="w-4 h-4 text-gray-600" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center" style={{ background: Y, color: D }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          {/* Add Item button */}
          <button
            onClick={() => setAddOpen(true)}
            className="h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-1.5 shrink-0"
            style={{ background: Y, color: D }}
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-4 gap-2 mt-5">
          {([
            { label: 'Total Items',     value: inventory.length, Icon: ShoppingBag,  fmt: (v: number) => String(v) },
            { label: 'Low Stock',       value: lowStockItems.length, Icon: AlertTriangle, fmt: (v: number) => String(v) },
            { label: 'Inventory Value', value: totalValue,        Icon: TrendingUp,   fmt: fmtVal },
            { label: 'Potential Waste', value: wasteValue,        Icon: DollarSign,   fmt: fmtVal },
          ]).map(({ label, value, Icon, fmt }) => (
            <div key={label} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: `${Y}20` }}>
                <Icon className="w-5 h-5" style={{ color: Y }} strokeWidth={2} />
              </div>
              <p className="text-[15px] font-black leading-none" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                {fmt(value)}
              </p>
              <p className="text-[9px] text-gray-400 font-semibold mt-1 uppercase tracking-wide leading-tight text-center">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex px-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="relative flex items-center gap-1.5 py-3 px-3 text-[12px] font-bold whitespace-nowrap shrink-0 transition-colors"
                style={{ color: active ? D : '#9CA3AF' }}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span
                    className="text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: active ? Y : '#F3F4F6', color: active ? D : '#9CA3AF' }}
                  >
                    {tab.count}
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full" style={{ background: Y }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </p>
        <button className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
          <SlidersHorizontal className="w-3 h-3" />
          Sort: A–Z
        </button>
      </div>

      {/* Column headers */}
      <div
        className="grid px-4 py-2 bg-gray-50 border-b border-gray-100"
        style={{ gridTemplateColumns: '1fr 64px 64px 80px 58px 18px' }}
      >
        {(['ITEM', 'PAR LEVEL', 'ON HAND', 'STATUS', 'UNIT COST', ''] as const).map((h, i) => (
          <p key={i} className="text-[9px] font-black text-gray-400 uppercase tracking-widest" style={{ textAlign: i === 0 ? 'left' : 'right' }}>
            {h}
          </p>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Package className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-bold text-gray-500 text-sm">No items found</p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-1 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: Y, color: D }}
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Add First Item
            </button>
          </div>
        ) : (
          filtered.map(item => {
            const status = getStatus(item.currentStock, item.parLevel);
            const { label, bg, color } = STATUS[status];
            return (
              <Link
                key={item.id}
                to={`/inventory/${item.id}`}
                className="grid items-center px-4 py-3 bg-white active:bg-gray-50 transition-colors"
                style={{ gridTemplateColumns: '1fr 64px 64px 80px 58px 18px' }}
              >
                {/* Item */}
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <CategoryIcon category={item.category} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-tight text-gray-900 truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      {item.category} · {item.supplier}
                    </p>
                  </div>
                </div>

                {/* Par Level */}
                <p className="text-[11px] text-gray-500 text-right tabular-nums">
                  {item.parLevel}&nbsp;<span className="text-gray-400 text-[10px]">{item.unit}</span>
                </p>

                {/* On Hand */}
                <p
                  className="text-[11px] font-bold text-right tabular-nums"
                  style={{ color: status === 'out-of-stock' ? '#DC2626' : status === 'low-stock' ? '#92400E' : '#374151' }}
                >
                  {item.currentStock}&nbsp;<span className="text-gray-400 font-normal text-[10px]">{item.unit}</span>
                </p>

                {/* Status */}
                <div className="flex justify-end">
                  <span
                    className="text-[9px] font-black px-2 py-1 rounded-full whitespace-nowrap"
                    style={{ background: bg, color }}
                  >
                    {label}
                  </span>
                </div>

                {/* Unit cost */}
                <p className="text-[11px] font-semibold text-gray-700 text-right tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                  ${item.unitCost.toFixed(2)}
                </p>

                {/* Chevron */}
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 justify-self-end" />
              </Link>
            );
          })
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="flex gap-2 px-4 py-4 border-t border-gray-100 mt-2">
        <button
          onClick={() => navigate('/inventory-count')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-[12px] font-bold text-gray-600"
        >
          <ClipboardList className="w-4 h-4" />
          Count Sheet
        </button>
        <label
          htmlFor="csv-upload"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-[12px] font-bold text-gray-600 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          Import CSV
        </label>
        <input type="file" id="csv-upload" accept=".csv" className="hidden" onChange={handleFile} />
        <button
          onClick={exportExcel}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-[12px] font-bold text-gray-600"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>Add a new item to your inventory</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3 pt-1">
            <div>
              <Label htmlFor="name">Item Name</Label>
              <Input id="name" name="name" required className="mt-1" placeholder="e.g. Chicken Breast" />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" required className="mt-1" placeholder="e.g. Proteins, Produce" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="currentStock">Current Stock</Label>
                <Input id="currentStock" name="currentStock" type="number" step="0.01" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" name="unit" required className="mt-1" placeholder="lbs, gal" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="unitCost">Unit Cost ($)</Label>
                <Input id="unitCost" name="unitCost" type="number" step="0.01" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="parLevel">Par Level</Label>
                <Input id="parLevel" name="parLevel" type="number" step="0.01" required className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Input id="supplier" name="supplier" required className="mt-1" placeholder="e.g. Sysco" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 font-bold" style={{ background: D, color: '#fff' }}>Add Item</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filter Sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-bold" style={{ color: D }}>Filter Inventory</SheetTitle>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setCategoryFilter('all')}
                  className="text-[11px] font-bold text-red-500"
                >
                  Clear all
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="px-5 pt-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Category</p>
            <div className="space-y-1.5">
              {['all', ...categories].map(cat => {
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setFilterOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={active ? { background: Y, color: D } : { background: '#F4F5F7', color: '#374151' }}
                  >
                    <span>{cat === 'all' ? 'All Categories' : cat}</span>
                    {active && <span className="text-xs font-black">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Inventory</DialogTitle>
            <DialogDescription>Review before importing</DialogDescription>
          </DialogHeader>
          <Button type="button" variant="outline" className="mb-3" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />Download Template
          </Button>
          {preview.length > 0 && (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 pb-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{preview.length} items ready</p>
                {preview.map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold text-sm text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.category} · {item.supplier}</p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
                      <span>Stock: {item.currentStock} {item.unit}</span>
                      <span>Par: {item.parLevel}</span>
                      <span>Cost: ${Number(item.unitCost).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={confirmImport} className="w-full font-bold" style={{ background: D, color: '#fff' }}>
                Import {preview.length} Items
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
