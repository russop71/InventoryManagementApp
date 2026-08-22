import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useInventory } from '../contexts/InventoryContext';
import type { InventoryItem, InvoiceRecord, OrderItem } from '../contexts/InventoryContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CalendarDays, FileText, DollarSign, Pencil, Trash2, Save, X, Plus, ScanLine, ChevronDown, Filter, Search, SlidersHorizontal } from 'lucide-react';
import { calculateInvoiceTotal, filterInvoiceItems } from '../utils/invoiceWorkflow';
import { toast } from 'sonner';

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtMoney(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function Invoices() {
  const navigate = useNavigate();
  const location = useLocation();
  const { invoices, inventory, addInvoice, updateInvoice, deleteInvoice, updateOrderStatus } = useInventory();
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [draftInvoices, setDraftInvoices] = useState<Record<string, { invoiceNumber: string; supplier: string; status: InvoiceRecord['status']; items: OrderItem[] }>>({});
  const [itemSearch, setItemSearch] = useState<string>('');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'open' | 'received' | 'cancelled'>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'current-month' | 'last-30-days'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  }, [invoices]);

  useEffect(() => {
    const invoiceId = new URLSearchParams(location.search).get('invoice');
    if (!invoiceId || !invoices.some(invoice => invoice.id === invoiceId)) return;
    setDateFilter('all');
    setInvoiceFilter('all');
    setExpandedInvoiceId(invoiceId);
  }, [invoices, location.search]);

  const getItemName = (itemId: string) => inventory.find(item => item.id === itemId)?.name || itemId;

  const addDraftItem = (invoiceId: string, inventoryItem: InventoryItem) => {
    setDraftInvoices(prev => {
      const currentDraft = prev[invoiceId];
      if (!currentDraft) return prev;

      const alreadyExists = currentDraft.items.some(item => item.itemId === inventoryItem.id);
      if (alreadyExists) return prev;

      return {
        ...prev,
        [invoiceId]: {
          ...currentDraft,
          supplier: currentDraft.supplier || inventoryItem.supplier,
          items: [
            ...currentDraft.items,
            {
              itemId: inventoryItem.id,
              quantity: 1,
              cost: Number(inventoryItem.unitCost || 0),
            },
          ],
        },
      };
    });
    setItemSearch('');
  };

  const startEditing = (invoice: InvoiceRecord) => {
    setExpandedInvoiceId(invoice.id);
    setEditingInvoiceId(invoice.id);
    setDraftInvoices(prev => ({
      ...prev,
      [invoice.id]: {
        invoiceNumber: invoice.invoiceNumber,
        supplier: invoice.supplier,
        status: invoice.status,
        items: invoice.items.map(item => ({ ...item })),
      },
    }));
  };

  const updateDraftInvoice = (invoiceId: string, updates: Partial<(typeof draftInvoices)[string]>) => {
    setDraftInvoices(prev => ({
      ...prev,
      [invoiceId]: {
        ...(prev[invoiceId] || { invoiceNumber: '', supplier: '', status: 'open', items: [] }),
        ...updates,
      },
    }));
  };

  const updateDraftItem = (invoiceId: string, index: number, updates: Partial<OrderItem>) => {
    setDraftInvoices(prev => {
      const currentDraft = prev[invoiceId];
      if (!currentDraft) return prev;

      const nextItems = currentDraft.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...updates } : item
      ));

      return {
        ...prev,
        [invoiceId]: {
          ...currentDraft,
          items: nextItems,
        },
      };
    });
  };

  const saveInvoice = (invoice: InvoiceRecord) => {
    const draft = draftInvoices[invoice.id];
    if (!draft) return;

    const nextItems = draft.items.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      cost: Number(item.cost) || 0,
    }));

    const result = updateInvoice(invoice.id, {
      invoiceNumber: draft.invoiceNumber.trim() || invoice.invoiceNumber,
      supplier: draft.supplier.trim() || invoice.supplier,
      status: draft.status,
      items: nextItems,
      totalAmount: calculateInvoiceTotal(nextItems),
    });
    if (!result.success) {
      window.alert(result.error || 'The invoice could not be saved.');
      return;
    }

    if (draft.status === 'received' && invoice.orderId) {
      updateOrderStatus(invoice.orderId, 'received');
    }

    setEditingInvoiceId(null);
    setExpandedInvoiceId(invoice.id);
  };

  const handleDeleteInvoice = (invoice: InvoiceRecord) => {
    deleteInvoice(invoice.id);
    if (editingInvoiceId === invoice.id) {
      setEditingInvoiceId(null);
    }
    if (expandedInvoiceId === invoice.id) {
      setExpandedInvoiceId(null);
    }
    toast.success(`Invoice ${invoice.invoiceNumber} deleted.`);
  };

  const handleCreateInvoice = () => {
    let newInvoice: InvoiceRecord;
    try {
      newInvoice = addInvoice({
        date: new Date().toISOString(),
        invoiceNumber: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
        supplier: 'Supplier',
        items: [],
        totalAmount: 0,
        status: 'open',
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'The invoice could not be created.');
      return;
    }

    setExpandedInvoiceId(newInvoice.id);
    setEditingInvoiceId(newInvoice.id);
    setDraftInvoices(prev => ({
      ...prev,
      [newInvoice.id]: {
        invoiceNumber: newInvoice.invoiceNumber,
        supplier: newInvoice.supplier,
        status: newInvoice.status,
        items: newInvoice.items.map(item => ({ ...item })),
      },
    }));
  };

  const availableSuppliers = useMemo(() => {
    return Array.from(new Set(inventory.map(item => item.supplier).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }, [inventory]);

  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

    return sortedInvoices.filter(invoice => {
      const invoiceDate = new Date(invoice.date);
      const matchesStatus = invoiceFilter === 'all' || invoice.status === invoiceFilter;
      const matchesSupplier = supplierFilter === 'all' || invoice.supplier === supplierFilter;
      const matchesDate = dateFilter === 'all'
        ? true
        : dateFilter === 'current-month'
          ? invoiceDate >= currentMonthStart
          : invoiceDate >= last30Days;
      const matchesSearch = !searchQuery || `${invoice.invoiceNumber} ${invoice.supplier}`.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSupplier && matchesDate && matchesSearch;
    });
  }, [dateFilter, invoiceFilter, searchQuery, sortedInvoices, supplierFilter]);

  return (
    <div className="space-y-3 pb-20">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Invoices</h2>
            <p className="text-sm text-gray-600 mt-1">Supplier invoices created whenever orders are placed.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="border-[#0F172A] text-[#0F172A]" onClick={handleCreateInvoice}>
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
            <Button size="sm" className="bg-[#0F172A] text-white hover:bg-[#1E293B]" onClick={() => navigate('/app/invoice-scanner')}>
              <ScanLine className="mr-2 h-4 w-4" />
              Scan Invoice
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search invoice or supplier"
              className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select value={invoiceFilter} onChange={event => setInvoiceFilter(event.target.value as 'all' | 'open' | 'received' | 'cancelled')} className="bg-transparent text-sm text-gray-700 outline-none">
              <option value="all">All types</option>
              <option value="open">Open</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <SlidersHorizontal className="h-4 w-4 text-gray-400" />
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)} className="bg-transparent text-sm text-gray-700 outline-none">
              <option value="all">All suppliers</option>
              {availableSuppliers.map(supplier => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            <select value={dateFilter} onChange={event => setDateFilter(event.target.value as 'all' | 'current-month' | 'last-30-days')} className="bg-transparent text-sm text-gray-700 outline-none">
              <option value="current-month">Current month</option>
              <option value="last-30-days">Last 30 days</option>
              <option value="all">All dates</option>
            </select>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center text-sm">
              No invoices yet. Place or approve an order to generate the first invoice.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">Invoice</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">Date</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">Supplier</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">Total</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredInvoices.map(invoice => {
                const isExpanded = expandedInvoiceId === invoice.id;
                return (
                  <>
                    <tr
                      key={invoice.id}
                      className={`align-top cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/70' : 'hover:bg-gray-50'}`}
                      onClick={() => setExpandedInvoiceId(current => current === invoice.id ? null : invoice.id)}
                    >
                      <td className="px-3 py-3">
                        <div className="font-semibold text-gray-900">{invoice.invoiceNumber}</div>
                        <div className="mt-1 text-xs text-gray-500">{invoice.items.length} line{invoice.items.length === 1 ? '' : 's'}</div>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{fmtDate(invoice.date)}</td>
                      <td className="px-3 py-3 text-gray-700">{invoice.supplier}</td>
                      <td className="px-3 py-3">
                        <Badge className="bg-[#FEF9C3] text-[#854D0E] border border-[#F5C10E]/40">
                          {invoice.status === 'received' ? 'Received' : invoice.status === 'cancelled' ? 'Cancelled' : 'Open'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-900">{fmtMoney(invoice.totalAmount)}</td>
                      <td className="px-3 py-3" onClick={event => event.stopPropagation()}>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEditing(invoice)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={event => { event.stopPropagation(); handleDeleteInvoice(invoice); }}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${invoice.id}-detail`}>
                        <td colSpan={6} className="px-3 py-0 pb-3">
                          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-[#0F172A]" />
                                  <p className="text-sm font-black text-gray-900">{invoice.invoiceNumber}</p>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{invoice.supplier}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-[#FEF9C3] text-[#854D0E] border border-[#F5C10E]/40">
                                  {invoice.status === 'received' ? 'Received' : invoice.status === 'cancelled' ? 'Cancelled' : 'Open'}
                                </Badge>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-xl bg-gray-50 p-3">
                                <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  Invoice Date
                                </div>
                                <p className="mt-1 font-semibold text-gray-900">{fmtDate(invoice.date)}</p>
                              </div>
                              <div className="rounded-xl bg-gray-50 p-3">
                                <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
                                  <DollarSign className="w-3.5 h-3.5" />
                                  Total
                                </div>
                                <p className="mt-1 font-semibold text-gray-900">{fmtMoney(invoice.totalAmount)}</p>
                              </div>
                            </div>

                            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Item</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Qty</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Unit</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Price</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {invoice.items.map((item, index) => {
                                    const inventoryItem = inventory.find(entry => entry.id === item.itemId);
                                    const unit = inventoryItem?.unit || 'unit';
                                    return (
                                      <tr key={`${invoice.id}-${index}`}>
                                        <td className="px-3 py-2 font-medium text-gray-900">{inventoryItem?.name || getItemName(item.itemId)}</td>
                                        <td className="px-3 py-2 text-gray-700">{item.quantity}</td>
                                        <td className="px-3 py-2 text-gray-700">{unit}</td>
                                        <td className="px-3 py-2 text-gray-700">{fmtMoney(item.cost)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {editingInvoiceId === invoice.id && draftInvoices[invoice.id] && (
                              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-3 space-y-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <Label className="text-xs text-gray-600">Invoice number</Label>
                                    <Input
                                      value={draftInvoices[invoice.id].invoiceNumber}
                                      onChange={event => updateDraftInvoice(invoice.id, { invoiceNumber: event.target.value })}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-gray-600">Supplier</Label>
                                    <select
                                      value={draftInvoices[invoice.id].supplier}
                                      onChange={event => updateDraftInvoice(invoice.id, { supplier: event.target.value })}
                                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                                    >
                                      <option value="">Select supplier</option>
                                      {availableSuppliers.map(supplier => (
                                        <option key={supplier} value={supplier}>{supplier}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <Label className="text-xs text-gray-600">Status</Label>
                                  <select
                                    value={draftInvoices[invoice.id].status}
                                    onChange={event => updateDraftInvoice(invoice.id, { status: event.target.value as InvoiceRecord['status'] })}
                                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                                  >
                                    <option value="open">Open</option>
                                    <option value="received">Received</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </div>

                                <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-gray-900">Add items</p>
                                    <span className="text-xs text-gray-500">
                                      {draftInvoices[invoice.id].supplier
                                        ? `Showing items from ${draftInvoices[invoice.id].supplier}`
                                        : 'Select a supplier first'}
                                    </span>
                                  </div>
                                  <div className="grid gap-2">
                                    <Input
                                      placeholder="Search items"
                                      value={itemSearch}
                                      onChange={event => setItemSearch(event.target.value)}
                                      disabled={!draftInvoices[invoice.id].supplier}
                                    />
                                  </div>
                                  <div className="max-h-40 space-y-2 overflow-auto rounded-lg border border-gray-100 p-2">
                                    {draftInvoices[invoice.id].supplier ? (
                                      filterInvoiceItems(
                                        inventory.filter(item => item.supplier === draftInvoices[invoice.id].supplier),
                                        itemSearch,
                                      ).slice(0, 8).map(item => (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() => addDraftItem(invoice.id, item)}
                                          className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm hover:bg-gray-100"
                                        >
                                          <span>
                                            <span className="font-medium text-gray-900">{item.name}</span>
                                            <span className="ml-2 text-xs text-gray-500">{item.supplier}</span>
                                          </span>
                                          <span className="text-xs text-gray-500">{item.unit}</span>
                                        </button>
                                      ))
                                    ) : (
                                      <p className="px-2 py-1 text-xs text-gray-500">Choose a supplier to load invoice items.</p>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-sm font-semibold text-gray-900">Line items</p>
                                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Item</th>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Qty</th>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Price</th>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {draftInvoices[invoice.id].items.map((item, index) => {
                                          const lineTotal = Number(item.quantity || 0) * Number(item.cost || 0);
                                          return (
                                            <tr key={`${invoice.id}-${index}`}>
                                              <td className="px-3 py-2 font-medium text-gray-900">{getItemName(item.itemId)}</td>
                                              <td className="px-3 py-2">
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  value={item.quantity}
                                                  onChange={event => updateDraftItem(invoice.id, index, { quantity: Number(event.target.value) || 0 })}
                                                  className="h-8"
                                                />
                                              </td>
                                              <td className="px-3 py-2">
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={item.cost}
                                                  onChange={event => updateDraftItem(invoice.id, index, { cost: Number(event.target.value) || 0 })}
                                                  className="h-8"
                                                />
                                              </td>
                                              <td className="px-3 py-2 font-semibold text-gray-900">{fmtMoney(lineTotal)}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" onClick={() => saveInvoice(invoice)}>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingInvoiceId(null)}>
                                    <X className="mr-2 h-4 w-4" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
