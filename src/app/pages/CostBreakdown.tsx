import { useEffect, useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Settings2, Plus, Pencil, Trash2, Search, Info, Link2, Check } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useSearchParams } from 'react-router';
import { COGSBreakdown } from './COGSBreakdown';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';

function CategoryConfiguration({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { categories, inventory, suppliers, addCategory, updateCategory, deleteCategory } = useInventory();
  const { provider, isConnected, menuItems, cogsCategories, addCogsCategory, updateCogsCategoryMappings } = useToast();
  const [activeSection, setActiveSection] = useState<'categories' | 'mapping'>('categories');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [name, setName] = useState('');
  const [expenseAccount, setExpenseAccount] = useState('');
  const [newReportingGroup, setNewReportingGroup] = useState('');
  const [mappingDraft, setMappingDraft] = useState<Record<string, { inventoryCategoryIds: string[]; posCategoryNames: string[] }>>({});
  const normalizedSearch = search.trim().toLowerCase();
  const visibleCategories = categories.filter(category => !normalizedSearch || category.name.toLowerCase().includes(normalizedSearch) || category.expenseAccount.toLowerCase().includes(normalizedSearch));
  const posCategories = [...new Set(menuItems.map(item => item.category.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));

  useEffect(() => {
    if (!open) return;
    setMappingDraft(Object.fromEntries(cogsCategories.map(category => [category.id, {
      inventoryCategoryIds: category.inventoryCategoryIds || [],
      posCategoryNames: category.posCategoryNames || [],
    }])));
  }, [open, cogsCategories]);

  const resetEditor = () => {
    setEditingId(null);
    setName('');
    setExpenseAccount('');
    setIsEditorOpen(false);
  };

  const saveCategory = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const duplicate = categories.some(category => category.id !== editingId && category.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      toast.error('That category already exists');
      return;
    }
    if (editingId) updateCategory(editingId, { name: trimmedName, expenseAccount });
    else addCategory({ name: trimmedName, expenseAccount });
    toast.success(editingId ? 'Category updated' : 'Category added');
    resetEditor();
  };

  const toggleMapping = (groupId: string, key: 'inventoryCategoryIds' | 'posCategoryNames', value: string) => {
    setMappingDraft(previous => {
      const selected = previous[groupId]?.[key]?.includes(value);
      const next = Object.fromEntries(Object.entries(previous).map(([id, mapping]) => [id, {
        ...mapping,
        [key]: mapping[key].filter(item => item !== value),
      }]));
      if (!selected) next[groupId] = { ...next[groupId], [key]: [...(next[groupId]?.[key] || []), value] };
      return next;
    });
  };

  const saveMappings = () => {
    cogsCategories.forEach(category => updateCogsCategoryMappings(category.id, mappingDraft[category.id] || { inventoryCategoryIds: [], posCategoryNames: [] }));
    toast.success('COGS category mappings saved');
  };

  const createReportingGroup = (event: React.FormEvent) => {
    event.preventDefault();
    const nextName = newReportingGroup.trim();
    if (!nextName) return;
    if (cogsCategories.some(category => category.name.toLowerCase() === nextName.toLowerCase())) return toast.error('That reporting group already exists');
    addCogsCategory(nextName);
    setNewReportingGroup('');
    toast.success('Reporting group added');
  };

  return (
    <Dialog open={open} onOpenChange={value => { onOpenChange(value); if (!value) resetEditor(); }}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-5 sm:max-w-4xl sm:p-7">
        <DialogHeader>
          <DialogTitle>Category configuration</DialogTitle>
          <DialogDescription>Manage categories and connect inventory with the categories imported from your POS.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
          <button type="button" onClick={() => setActiveSection('categories')} className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${activeSection === 'categories' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Inventory categories</button>
          <button type="button" onClick={() => setActiveSection('mapping')} className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${activeSection === 'mapping' ? 'bg-[#303A43] text-white shadow-sm' : 'text-slate-500'}`}>POS category mapping</button>
        </div>

        {activeSection === 'categories' ? <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search categories" className="pl-9" />
          </label>
          <Button type="button" onClick={() => { resetEditor(); setIsEditorOpen(true); }} className="bg-[#303A43] text-white hover:bg-[#1E293B]"><Plus className="mr-2 h-4 w-4" />Add category</Button>
        </div>

        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-700">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#B58B00]" />
          <p>Expense accounts are optional. When configured, the category provides the accounting default for matching inventory and supplier records.</p>
        </div>

        {isEditorOpen && (
          <form onSubmit={saveCategory} className="grid gap-3 rounded-2xl border-2 border-[#F5D62E] bg-[#FFFBE7] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div><Label htmlFor="category-name">Category name</Label><Input id="category-name" value={name} onChange={event => setName(event.target.value)} placeholder="Food" required /></div>
            <div><Label htmlFor="expense-account">Expense account (optional)</Label><Input id="expense-account" value={expenseAccount} onChange={event => setExpenseAccount(event.target.value)} placeholder="5000 · Food purchases" /></div>
            <div className="flex gap-2"><Button type="submit" className="bg-[#303A43] text-white">{editingId ? 'Save' : 'Add'}</Button><Button type="button" variant="outline" onClick={resetEditor}>Cancel</Button></div>
          </form>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="hidden grid-cols-[1.2fr_.7fr_1fr_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 sm:grid">
            <span>Name</span><span>Status</span><span>Expense account</span><span>Actions</span>
          </div>
          <div className="divide-y divide-slate-200">
            {visibleCategories.map(category => {
              const itemCount = inventory.filter(item => item.category === category.name).length;
              const supplierCount = suppliers.filter(supplier => supplier.category === category.name).length;
              const inUse = itemCount + supplierCount > 0;
              return (
                <div key={category.id} className="grid gap-2 px-4 py-4 sm:grid-cols-[1.2fr_.7fr_1fr_auto] sm:items-center sm:gap-3">
                  <div><p className="font-black text-slate-900">{category.name}</p><p className="text-xs text-slate-500">{itemCount} items · {supplierCount} suppliers</p></div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${inUse ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{inUse ? 'In use' : 'Not used'}</span>
                  <p className="text-sm text-slate-600">{category.expenseAccount || 'Not assigned'}</p>
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" variant="outline" aria-label={`Edit ${category.name}`} onClick={() => { setEditingId(category.id); setName(category.name); setExpenseAccount(category.expenseAccount); setIsEditorOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" size="sm" variant="outline" aria-label={`Delete ${category.name}`} disabled={inUse} onClick={() => { const result = deleteCategory(category.id); if (!result.success) toast.error(result.error); else toast.success('Category deleted'); }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </div>
                </div>
              );
            })}
            {visibleCategories.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No categories match your search.</p>}
          </div>
        </div>
        </> : (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-700">
              <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-[#B58B00]" />
              <p>Place inventory categories and matching POS categories under one ZestIQ reporting group. Each category can belong to only one group, preventing duplicated COGS.</p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-slate-900">POS source</p>
                <p className="text-sm text-slate-500">{isConnected ? `${provider === 'generic' ? 'Imported POS' : provider} connected · ${posCategories.length} categories found` : 'Connect or import POS data to discover its categories.'}</p>
              </div>
              <form onSubmit={createReportingGroup} className="flex gap-2">
                <Input value={newReportingGroup} onChange={event => setNewReportingGroup(event.target.value)} placeholder="New group, e.g. Wine" aria-label="New COGS reporting group" />
                <Button type="submit" className="shrink-0 bg-[#303A43] text-white"><Plus className="mr-1.5 h-4 w-4" />Add</Button>
              </form>
            </div>

            {cogsCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center">
                <p className="font-black text-slate-900">Create your first reporting group</p>
                <p className="mt-1 text-sm text-slate-500">Start with groups such as Food, Beverage, Wine, Liquor, or Retail.</p>
              </div>
            ) : cogsCategories.map(group => {
              const draft = mappingDraft[group.id] || { inventoryCategoryIds: [], posCategoryNames: [] };
              return (
                <section key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                    <div><h3 className="font-black text-slate-900">{group.name}</h3><p className="text-xs text-slate-500">{draft.inventoryCategoryIds.length} inventory · {draft.posCategoryNames.length} POS categories</p></div>
                  </div>
                  <div className="grid gap-5 p-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-slate-500">Inventory categories</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.map(category => {
                          const selected = draft.inventoryCategoryIds.includes(category.id);
                          return <button key={category.id} type="button" onClick={() => toggleMapping(group.id, 'inventoryCategoryIds', category.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${selected ? 'border-[#F5D62E] bg-[#FFF6BF] text-slate-900' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}`}>{selected && <Check className="h-3.5 w-3.5" />}{category.name}</button>;
                        })}
                        {categories.length === 0 && <p className="text-sm text-slate-400">No inventory categories yet.</p>}
                      </div>
                    </div>
                    <div className="md:border-l md:border-slate-200 md:pl-5">
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-slate-500">POS categories</p>
                      <div className="flex flex-wrap gap-2">
                        {posCategories.map(posCategory => {
                          const selected = draft.posCategoryNames.includes(posCategory);
                          return <button key={posCategory} type="button" onClick={() => toggleMapping(group.id, 'posCategoryNames', posCategory)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${selected ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}`}>{selected && <Check className="h-3.5 w-3.5" />}{posCategory}</button>;
                        })}
                        {posCategories.length === 0 && <p className="text-sm text-slate-400">No POS categories imported yet.</p>}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}

            <div className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-white/95 pt-4 backdrop-blur">
              <Button type="button" onClick={saveMappings} disabled={cogsCategories.length === 0} className="w-full bg-[#F5D62E] font-black text-[#303A43] hover:bg-[#E8C514] sm:w-auto"><Check className="mr-2 h-4 w-4" />Save category mappings</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CostBreakdown() {
  const { inventory, orders, forecasts } = useInventory();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categoryConfigOpen, setCategoryConfigOpen] = useState(searchParams.get('categories') === 'open');
  const activeView = searchParams.get('view') === 'cogs' ? 'cogs' : 'inventory';

  const setActiveView = (view: 'inventory' | 'cogs') => {
    const next = new URLSearchParams(searchParams);
    if (view === 'cogs') next.set('view', 'cogs');
    else next.delete('view');
    setSearchParams(next, { replace: true });
  };

  // Calculate total inventory value
  const totalInventoryValue = inventory.reduce(
    (sum, item) => sum + (item.currentStock * item.unitCost),
    0
  );

  // Calculate costs by category
  const categoryData = inventory.reduce((acc, item) => {
    const existing = acc.find(c => c.name === item.category);
    const value = item.currentStock * item.unitCost;
    if (existing) {
      existing.value += value;
    } else {
      acc.push({
        name: item.category,
        value: value,
      });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Calculate order costs by month
  const ordersByMonth = orders.reduce((acc, order) => {
    const month = new Date(order.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const existing = acc.find(m => m.month === month);
    if (existing) {
      existing.value += order.totalCost;
      existing.count += 1;
    } else {
      acc.push({
        month,
        value: order.totalCost,
        count: 1,
      });
    }
    return acc;
  }, [] as { month: string; value: number; count: number }[]);

  // Calculate total orders cost
  const totalOrdersCost = orders.reduce((sum, order) => sum + order.totalCost, 0);
  const averageOrderCost = orders.length > 0 ? totalOrdersCost / orders.length : 0;

  // Most expensive items
  const expensiveItems = [...inventory]
    .sort((a, b) => (b.currentStock * b.unitCost) - (a.currentStock * a.unitCost))
    .slice(0, 5);

  // Supplier breakdown
  const supplierData = inventory.reduce((acc, item) => {
    const existing = acc.find(s => s.supplier === item.supplier);
    const value = item.currentStock * item.unitCost;
    if (existing) {
      existing.value += value;
      existing.items += 1;
    } else {
      acc.push({
        supplier: item.supplier,
        value: value,
        items: 1,
      });
    }
    return acc;
  }, [] as { supplier: string; value: number; items: number }[]);

  const categoryTotal = categoryData.reduce((sum, category) => sum + category.value, 0);
  const sortedCategoryData = [...categoryData].sort((left, right) => right.value - left.value);
  const COLORS = ['#F5D62E', '#303A43', '#D9BC24', '#68747D', '#FFE97A', '#46525B', '#E8C91F', '#8A949B'];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Cost &amp; COGS Reports</h2>
          <p className="text-sm text-gray-600 mt-1">Inventory value, purchasing costs and menu-item COGS in one place.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setCategoryConfigOpen(true)} className="w-full border-[#D9BC24] bg-[#FFFBE7] font-bold text-[#303A43] sm:w-auto"><Settings2 className="mr-2 h-4 w-4" />Category configuration</Button>
      </div>

      <CategoryConfiguration open={categoryConfigOpen} onOpenChange={setCategoryConfigOpen} />

      <div className="inline-flex w-full rounded-2xl border border-[#DDD8CA] bg-white p-1.5 shadow-sm sm:w-auto">
        <button
          type="button"
          onClick={() => setActiveView('inventory')}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition sm:flex-none"
          style={activeView === 'inventory' ? { background: '#303A43', color: '#FFFFFF' } : { color: '#68747D' }}
        >
          Inventory &amp; purchasing
        </button>
        <button
          type="button"
          onClick={() => setActiveView('cogs')}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition sm:flex-none"
          style={activeView === 'cogs' ? { background: '#F5D62E', color: '#303A43' } : { color: '#68747D' }}
        >
          Menu COGS
        </button>
      </div>

      {activeView === 'cogs' ? (
        <COGSBreakdown embedded />
      ) : (
      <div className="space-y-4">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalInventoryValue.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">
              Across {inventory.length} items
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Total Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">${totalOrdersCost.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">
                {orders.length} orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Avg Order</CardTitle>
              <TrendingDown className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">${averageOrderCost.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">
                Per order
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedCategoryData.length > 0 ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(260px,.8fr)_1.2fr] lg:items-center">
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sortedCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={88}
                        paddingAngle={2}
                        stroke="#FFFEFA"
                        strokeWidth={3}
                        dataKey="value"
                      >
                        {sortedCategoryData.map((entry, index) => (
                          <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  {sortedCategoryData.map((category, index) => {
                    const percentage = categoryTotal > 0 ? (category.value / categoryTotal) * 100 : 0;
                    return (
                      <div key={category.name} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800">{category.name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">${category.value.toFixed(2)}</p>
                        </div>
                        <span className="shrink-0 text-xs font-black text-slate-700">{percentage.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ordersByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4DFD2" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#68747D' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#68747D' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                  <Bar dataKey="value" fill="#F5D62E" radius={[6, 6, 0, 0]} name="Cost ($)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
                No orders yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Expensive Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expensiveItems.map((item, index) => {
                const totalValue = item.currentStock * item.unitCost;
                const percentage = (totalValue / totalInventoryValue) * 100;
                
                return (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-start flex-1">
                        <div className="w-6 h-6 rounded-full bg-[#F5D62E] text-[#303A43] flex items-center justify-center text-xs font-black mr-2 flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.currentStock} {item.unit} @ ${item.unitCost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-gray-900">${totalValue.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost by Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {supplierData.sort((a, b) => b.value - a.value).map((supplier, index) => {
                const percentage = (supplier.value / totalInventoryValue) * 100;
                
                return (
                  <div key={supplier.supplier} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-start flex-1">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white mr-2 flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{supplier.supplier}</p>
                          <p className="text-xs text-gray-500">
                            {supplier.items} items
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-gray-900">${supplier.value.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
      )}
    </div>
  );
}
