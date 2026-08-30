import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { CalendarDays } from 'lucide-react';
import {
  Plus, ChevronRight, ShoppingCart, Truck, CheckCircle2,
  Clock, Package, SlidersHorizontal, Sparkles, Mail,
  Check, AlertCircle, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateForecastOrderQuantity, estimateDemandForTomorrow } from '../utils/forecastOrderUtils';
import { buildSupplierEmailDrafts } from '../utils/supplierEmailDraft.js';
import { sendSupplierEmail } from '../utils/sendSupplierEmail.js';

const Y = '#F5C10E';
const D = '#0F172A';

type OrderStatus = 'pending' | 'ordered' | 'received' | 'cancelled';

const STATUS_CFG: Record<OrderStatus, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Open',       bg: `${Y}25`,  color: '#7A5E00' },
  ordered:   { label: 'In Transit', bg: '#DBEAFE', color: '#1E40AF' },
  received:  { label: 'Received',   bg: '#DCFCE7', color: '#166534' },
  cancelled: { label: 'Cancelled',  bg: '#F3F4F6', color: '#6B7280' },
};

const AVATAR_COLORS = [
  { bg: '#EFF6FF', text: '#1D4ED8' },
  { bg: '#F0FDF4', text: '#15803D' },
  { bg: '#FEF9C3', text: '#854D0E' },
  { bg: '#FDF4FF', text: '#7E22CE' },
  { bg: '#FFF7ED', text: '#C2410C' },
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDefaultOrderDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function fmtMoney(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function openMailtoDraft(to: string, ccEmails: string[], subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  if (ccEmails.length) params.set('cc', ccEmails.join(','));
  const mailtoLink = `mailto:${encodeURIComponent(to)}?${params.toString()}`;
  window.location.href = mailtoLink;
}

interface SupplierEmailDraft {
  supplier: string;
  supplierEmail: string;
  ccEmails: string[];
  items: OrderSuggestion[];
  totalCost: number;
  emailBody: string;
  emailSubject: string;
}

interface OrderSuggestion {
  itemId: string;
  itemName: string;
  currentStock: number;
  parLevel: number;
  suggestedQuantity: number;
  unitCost: number;
  totalCost: number;
  supplier: string;
  unit: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string;
  daysUntilStockout: number;
  confidence: number;
}

export function Orders() {
  const { orders, inventory, forecasts, updateOrderStatus, placeOrder, suppliers, invoices, updateInvoice } = useInventory();
  const { salesData } = useToast();
  const { accountId, accountName, user } = useAuth();
  const orderingOnly = user?.role === 'Ordering';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | OrderStatus>('all');
  // Keep the selected order itself. Some imported/demo orders can be refreshed
  // while the dialog is opening, which made an ID lookup briefly return empty.
  const [detailOrder, setDetailOrder] = useState<(typeof orders)[number] | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<OrderSuggestion[] | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [editableItems, setEditableItems] = useState<Record<string, { quantity: number; cost: number }>>({});
  const [supplierDateOverrides, setSupplierDateOverrides] = useState<Record<string, string>>({});
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [draftEmails, setDraftEmails] = useState<SupplierEmailDraft[]>([]);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showManualOrderDialog, setShowManualOrderDialog] = useState(false);
  const [manualSupplier, setManualSupplier] = useState<string>('');
  const [manualItemQuery, setManualItemQuery] = useState('');
  const [manualQuantities, setManualQuantities] = useState<Record<string, number>>({});
  const [emailServiceConfigured, setEmailServiceConfigured] = useState<boolean | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderSupplierFilter, setOrderSupplierFilter] = useState('');

  const open      = orders.filter(o => o.status === 'pending');
  const inTransit = orders.filter(o => o.status === 'ordered');
  const received  = orders.filter(o => o.status === 'received');
  const cancelled = orders.filter(o => o.status === 'cancelled');

  const sorted = [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const primarySupplierFor = (order: (typeof orders)[number]) => {
    const counts: Record<string, number> = {};
    order.items.forEach(line => {
      const item = inventory.find(entry => entry.id === line.itemId);
      if (item?.supplier) counts[item.supplier] = (counts[item.supplier] || 0) + 1;
    });
    return Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] || 'Supplier';
  };
  const orderSuppliers = Array.from(new Set(orders.map(primarySupplierFor))).sort((left, right) => left.localeCompare(right));
  const filtered = (activeTab === 'all' ? sorted : sorted.filter(order => order.status === activeTab)).filter(order => {
    const supplier = primarySupplierFor(order);
    const query = orderSearchQuery.trim().toLowerCase();
    const matchesQuery = !query || [order.id, supplier, ...order.items.map(line => inventory.find(item => item.id === line.itemId)?.name || '')]
      .some(value => value.toLowerCase().includes(query));
    return matchesQuery && (!orderSupplierFilter || supplier === orderSupplierFilter);
  });

  const restaurantName = useMemo(() => {
    if (accountId) {
      const profileStorageKey = `zestiq:account:${accountId}:profile`;
      const raw = localStorage.getItem(profileStorageKey);
      if (raw) {
        try {
          const profile = JSON.parse(raw) as { restaurant?: string };
          const profileRestaurantName = profile.restaurant?.trim();
          if (profileRestaurantName) return profileRestaurantName;
        } catch {
          // ignore malformed data
        }
      }
    }
    return accountName?.trim() || 'Restaurant';
  }, [accountId, accountName]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/send-supplier-email')
      .then(response => response.json())
      .then(payload => {
        if (cancelled) return;
        setEmailServiceConfigured(Boolean(payload?.configured));
      })
      .catch(() => {
        if (cancelled) return;
        setEmailServiceConfigured(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const orderSuggestions = useMemo(() => {
    const suggestions: OrderSuggestion[] = [];
    const salesTrend = salesData.length >= 2
      ? (salesData[salesData.length - 1].revenue - salesData[0].revenue) / salesData[0].revenue
      : 0;

    inventory.forEach(item => {
      const stockPercentage = (item.currentStock / item.parLevel) * 100;
      const forecastEntry = forecasts
        .filter(forecast => forecast.items.some(entry => entry.itemId === item.id))
        .sort((left, right) => left.date.localeCompare(right.date))
        .find(forecast => forecast.date >= new Date().toISOString().slice(0, 10));
      const estimatedDailyUsage = estimateDemandForTomorrow({ inventoryItem: item, forecastItems: forecasts, salesData });

      const suggestedQuantity = calculateForecastOrderQuantity({
        currentStock: item.currentStock,
        expectedUsage: estimatedDailyUsage,
        parLevel: item.parLevel,
        safetyBuffer: Math.max(item.parLevel * 0.1, 2),
        minimumOrderQty: item.minimumOrderQty || 0,
      });

      const daysUntilStockout = estimatedDailyUsage > 0 ? Math.floor(item.currentStock / estimatedDailyUsage) : 999;
      let priority: OrderSuggestion['priority'] = 'low';
      let shouldOrder = false;
      let reasoning = '';
      let confidence = 0;

      const forecastNote = forecastEntry ? ` Forecast for ${forecastEntry.date}${forecastEntry.weatherSummary ? ` (${forecastEntry.weatherSummary})` : ''}.` : '';
      if (daysUntilStockout <= 2) {
        shouldOrder = true; priority = 'critical'; reasoning = `Critical: only ${daysUntilStockout} days of stock left.${forecastNote}`; confidence = forecastEntry ? 0.96 : 0.95;
      } else if (daysUntilStockout <= 4) {
        shouldOrder = true; priority = 'high'; reasoning = `High priority: ${daysUntilStockout} days until stockout.${forecastNote}`; confidence = forecastEntry ? 0.9 : 0.88;
      } else if (stockPercentage < 40) {
        shouldOrder = true; priority = 'medium'; reasoning = `Below 40% par level (${stockPercentage.toFixed(0)}%)`; confidence = 0.75;
      } else if (stockPercentage < 70) {
        shouldOrder = true; priority = 'low'; reasoning = `Stock at ${stockPercentage.toFixed(0)}% - consider ordering soon`; confidence = 0.6;
      }

      if (shouldOrder) {
        suggestions.push({
          itemId: item.id,
          itemName: item.name,
          currentStock: item.currentStock,
          parLevel: item.parLevel,
          suggestedQuantity,
          unitCost: item.unitCost,
          totalCost: suggestedQuantity * item.unitCost,
          supplier: item.supplier,
          unit: item.unit,
          priority,
          reasoning,
          daysUntilStockout,
          confidence,
        });
      }
    });

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return suggestions.sort((a, b) => priorityOrder[a.priority] === priorityOrder[b.priority] ? b.confidence - a.confidence : priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [inventory, forecasts, salesData]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4001');
    ws.addEventListener('open', () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: 'requestAiOrder', payload: { inventory, salesData } }));
    });
    ws.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'aiOrder') {
          setAiSuggestions(payload.data || []);
        }
      } catch {
        // ignore malformed websocket data
      }
    });
    ws.addEventListener('close', () => setWsConnected(false));
    return () => ws.close();
  }, [inventory, salesData]);

  const displayedSuggestions = showAllSuggestions
    ? (aiSuggestions || orderSuggestions)
    : (aiSuggestions || orderSuggestions).filter(s => s.priority === 'critical' || s.priority === 'high');

  const totalOrderCost = displayedSuggestions.filter(s => selectedSuggestions.has(s.itemId)).reduce((sum, s) => sum + s.totalCost, 0);
  const selectedCount = selectedSuggestions.size;
  const manualSupplierOptions = useMemo(
    () => Array.from(new Set(inventory.map(item => item.supplier).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [inventory],
  );
  const manualSupplierItems = useMemo(() => {
    if (!manualSupplier) return [];
    const normalizedSupplier = manualSupplier.trim().toLowerCase();
    return inventory.filter(item => item.supplier.trim().toLowerCase() === normalizedSupplier);
  }, [inventory, manualSupplier]);
  const filteredManualSupplierItems = useMemo(() => {
    const query = manualItemQuery.trim().toLowerCase();
    if (!query) return manualSupplierItems;
    return manualSupplierItems.filter(item => [item.name, item.sku, item.vendorItemCode]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query)));
  }, [manualItemQuery, manualSupplierItems]);
  const manualOrderLineCount = manualSupplierItems.filter(item => (manualQuantities[item.id] || 0) > 0).length;
  const manualOrderTotal = manualSupplierItems.reduce((sum, item) => {
    const quantity = manualQuantities[item.id] || 0;
    return sum + quantity * item.unitCost;
  }, 0);

  const toggleSelection = (itemId: string) => {
    const next = new Set(selectedSuggestions);
    next.has(itemId) ? next.delete(itemId) : next.add(itemId);
    setSelectedSuggestions(next);
  };

  const selectAll = () => setSelectedSuggestions(new Set(displayedSuggestions.map(s => s.itemId)));
  const deselectAll = () => setSelectedSuggestions(new Set());

  const updateManualQuantity = (itemId: string, value: string) => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
    setManualQuantities(prev => ({ ...prev, [itemId]: safeValue }));
  };

  const openManualOrderDialog = () => {
    setManualSupplier('');
    setManualItemQuery('');
    setManualQuantities({});
    setShowManualOrderDialog(true);
  };

  const handleCreateManualOrderFromDialog = () => {
    if (!manualSupplier) {
      toast.error('Select a supplier first');
      return;
    }

    const itemsForOrder = manualSupplierItems
      .map(item => {
        const quantity = manualQuantities[item.id] || 0;
        if (quantity <= 0) return null;
        return {
          itemId: item.id,
          itemName: item.name,
          currentStock: item.currentStock,
          parLevel: item.parLevel,
          suggestedQuantity: quantity,
          unitCost: item.unitCost,
          totalCost: quantity * item.unitCost,
          supplier: item.supplier,
          unit: item.unit,
          priority: item.currentStock < item.parLevel ? 'high' : 'low',
          reasoning: item.currentStock < item.parLevel
            ? `On hand is below par (${item.currentStock} / ${item.parLevel} ${item.unit})`
            : 'Manual order line',
          daysUntilStockout: 0,
          confidence: 1,
        } as OrderSuggestion;
      })
      .filter((entry): entry is OrderSuggestion => Boolean(entry));

    if (itemsForOrder.length === 0) {
      toast.error('Add at least one item quantity');
      return;
    }

    const orderItems = itemsForOrder.map(item => ({
      itemId: item.itemId,
      quantity: item.suggestedQuantity,
      cost: item.totalCost,
    }));

    placeOrder({
      date: getDefaultOrderDate(),
      items: orderItems,
      supplier: manualSupplier,
      totalCost: orderItems.reduce((sum, item) => sum + item.cost, 0),
      status: 'pending',
    });

    const drafts = buildSupplierEmailDrafts({
      restaurantName,
      suggestions: itemsForOrder,
      suppliers,
    });

    setDraftEmails(drafts);
    setShowManualOrderDialog(false);
    setShowEmailDialog(true);
    toast.success(`Created order for ${manualSupplier}: ${itemsForOrder.length} item${itemsForOrder.length === 1 ? '' : 's'}`);
  };

  const openEmailClient = async (email: SupplierEmailDraft) => {
    if (!email.supplierEmail) {
      toast.error('No supplier email address is configured');
      return;
    }

    if (emailServiceConfigured === false) {
      openMailtoDraft(email.supplierEmail, email.ccEmails, email.emailSubject, email.emailBody);
      toast.info('Email service is not configured. Opened your mail app with a draft instead.');
      return;
    }

    try {
      await sendSupplierEmail({
        to: email.supplierEmail,
        cc: email.ccEmails,
        subject: email.emailSubject,
        text: email.emailBody,
        senderEmail: user?.email,
        senderName: user?.name,
      });
      toast.success(`Sent supplier email to ${email.supplier}`);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'EMAIL_SERVICE_NOT_CONFIGURED') {
        openMailtoDraft(email.supplierEmail, email.ccEmails, email.emailSubject, email.emailBody);
        toast.info('Email service not configured. Opened your mail app with a draft instead.');
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    }
  };

  const updateDraftCcEmails = (supplier: string, value: string) => {
    const ccEmails = value.split(/[;,\n]/).map(email => email.trim().toLowerCase()).filter(Boolean);
    setDraftEmails(prev => prev.map(email => email.supplier === supplier ? { ...email, ccEmails } : email));
  };

  const updateDraftEmailField = (supplier: string, field: 'emailSubject' | 'emailBody', value: string) => {
    setDraftEmails(prev => prev.map(email => {
      if (email.supplier !== supplier) return email;
      return { ...email, [field]: value };
    }));
  };

  const updateDraftItemQuantity = (supplier: string, itemId: string, value: string) => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

    setDraftEmails(prev => prev.map(email => {
      if (email.supplier !== supplier) return email;

      const updatedItems = email.items.map(item => {
        if (item.itemId !== itemId) return item;
        const nextQuantity = Math.max(0, Math.round(safeValue));
        return {
          ...item,
          suggestedQuantity: nextQuantity,
          totalCost: nextQuantity * item.unitCost,
        };
      });

      const totalCost = updatedItems.reduce((sum, item) => sum + item.totalCost, 0);
      return {
        ...email,
        items: updatedItems,
        totalCost,
        emailBody: `${email.emailBody.split('\n').slice(0, 3).join('\n')}\n\n${updatedItems.map(item => `${item.itemName} - ${item.suggestedQuantity} ${item.unit}`).join('\n')}`,
      };
    }));
  };

  const copyDraftToClipboard = async (email: SupplierEmailDraft) => {
    try {
      await navigator.clipboard.writeText(`${email.emailSubject}\n\n${email.emailBody}`);
      toast.success(`Copied ${email.supplier} draft`);
    } catch {
      toast.error('Clipboard access is unavailable');
    }
  };

  const handleApproveOrders = () => {
    const sourceList = aiSuggestions || orderSuggestions;
    const ordersToPlace = sourceList.filter(s => selectedSuggestions.has(s.itemId));
    if (ordersToPlace.length === 0) {
      toast.error('Select at least one item to place an order');
      return;
    }

    const supplierMap: Record<string, OrderSuggestion[]> = {};
    ordersToPlace.forEach(suggestion => {
      if (!supplierMap[suggestion.supplier]) supplierMap[suggestion.supplier] = [];
      supplierMap[suggestion.supplier].push(suggestion);
    });

    const drafts = buildSupplierEmailDrafts({ restaurantName, suggestions: ordersToPlace, suppliers });

    Object.entries(supplierMap).forEach(([supplier, suggestions]) => {
      const items = suggestions.map(suggestion => ({
        itemId: suggestion.itemId,
        quantity: suggestion.suggestedQuantity,
        cost: suggestion.totalCost,
      }));
      placeOrder({
        date: getDefaultOrderDate(),
        items,
        supplier,
        totalCost: items.reduce((sum, item) => sum + item.cost, 0),
        status: 'pending',
      });
    });

    setDraftEmails(drafts);
    setShowEmailDialog(true);
    toast.success(`✓ ${ordersToPlace.length} items approved and added to orders/invoices`);
    setSelectedSuggestions(new Set());
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const handleStatus = (id: string, status: OrderStatus) => {
    updateOrderStatus(id, status as any);
    toast.success(`Order marked as ${STATUS_CFG[status].label}`);
  };

  const handleSaveLineEdits = (orderId: string) => {
    const order = orders.find(entry => entry.id === orderId);
    if (!order) return;

    const nextItems = order.items.map(item => ({
      ...item,
      quantity: editableItems[item.itemId]?.quantity ?? item.quantity,
      cost: editableItems[item.itemId]?.cost ?? item.cost,
    }));

    const updatedTotal = nextItems.reduce((sum, item) => sum + item.cost, 0);
    const updatedOrder = { ...order, items: nextItems, totalCost: updatedTotal };

    const existingInvoice = invoices.find(invoice => invoice.orderId === orderId);
    if (existingInvoice) {
      updateInvoice(existingInvoice.id, { items: nextItems, totalAmount: updatedTotal, supplier: order.supplier });
    }

    toast.success('Order lines updated');
  };

  const updateEditableItem = (itemId: string, field: 'quantity' | 'cost', value: number) => {
    setEditableItems(prev => ({
      ...prev,
      [itemId]: {
        quantity: prev[itemId]?.quantity ?? 0,
        cost: prev[itemId]?.cost ?? 0,
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const resetEditableItems = (orderId: string) => {
    const order = orders.find(entry => entry.id === orderId);
    if (!order) return;

    const nextState: Record<string, { quantity: number; cost: number }> = {};
    order.items.forEach(item => {
      nextState[item.itemId] = { quantity: item.quantity, cost: item.cost };
    });
    setEditableItems(nextState);

    const nextDates = Object.fromEntries(
      Object.entries(order.supplierDates || {}).filter(([, value]) => Boolean(value))
    );
    setSupplierDateOverrides(nextDates);
  };

  const TABS = [
    { key: 'all',       label: 'All Orders', count: orders.length },
    { key: 'pending',   label: 'Open',       count: open.length },
    { key: 'ordered',   label: 'In Transit', count: inTransit.length },
    { key: 'received',  label: 'Received',   count: received.length },
    { key: 'cancelled', label: 'Cancelled',  count: cancelled.length },
  ] as const;

  return (
    <div className="-mx-4 bg-white min-h-screen">

      {/* Header */}
      <div className="px-4 pt-2 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: D }}>Orders</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage purchase orders and track deliveries.</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => navigate(orderingOnly ? '/orders/ai' : '/app/forecasting')}
              className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-bold shrink-0 border border-gray-200 bg-white text-gray-700"
            >
              <TrendingUp className="w-4 h-4" />
              Forecasting
            </button>
            <button
              onClick={() => navigate(orderingOnly ? '/orders/ai' : '/app/ai-orders')}
              className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-bold shrink-0 border border-gray-200 bg-white text-gray-700"
            >
              <Sparkles className="w-4 h-4" />
              AI Orders
            </button>
            <button
              onClick={openManualOrderDialog}
              className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-bold shrink-0"
              style={{ background: Y, color: D }}
            >
              <Plus className="w-4 h-4" />
              New Order
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-4 gap-2 mt-5">
          {[
            { label: 'Open Orders',      count: open.length,      val: open.reduce((s,o)=>s+o.totalCost,0),      dotBg: `${Y}30`,  dotColor: '#7A5E00' },
            { label: 'In Transit',       count: inTransit.length, val: inTransit.reduce((s,o)=>s+o.totalCost,0), dotBg: '#DBEAFE', dotColor: '#1E40AF' },
            { label: 'Received',         count: received.length,  val: received.reduce((s,o)=>s+o.totalCost,0),  dotBg: '#DCFCE7', dotColor: '#166534' },
            { label: 'Pending Approval', count: cancelled.length, val: cancelled.reduce((s,o)=>s+o.totalCost,0), dotBg: '#F3F4F6', dotColor: '#6B7280' },
          ].map(({ label, count, val, dotBg, dotColor }) => (
            <div key={label} className="flex flex-col items-center text-center">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 text-base font-black"
                style={{ background: dotBg, color: dotColor, fontFamily: 'var(--font-mono)' }}
              >
                {count}
              </div>
              <p className="text-[11px] font-black tabular-nums" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                {val >= 1000 ? `$${(val/1000).toFixed(1)}k` : fmtMoney(val)}
              </p>
              <p className="text-[9px] text-gray-400 font-semibold mt-1 uppercase tracking-wide leading-tight text-center">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-900">Order workspace</p>
              <p className="text-xs text-slate-500">Find a supplier, product or purchase order in seconds.</p>
            </div>
            <span className="rounded-full bg-[#F5C10E] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#0F172A]">Fast order</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
            <Input
              value={orderSearchQuery}
              onChange={event => setOrderSearchQuery(event.target.value)}
              placeholder="Search orders, suppliers or items…"
              className="h-11 rounded-xl border-slate-200 bg-white"
            />
            <select
              value={orderSupplierFilter}
              onChange={event => setOrderSupplierFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            >
              <option value="">All suppliers</option>
              {orderSuppliers.map(supplier => <option key={supplier} value={supplier}>{supplier}</option>)}
            </select>
          </div>
          {(orderSearchQuery || orderSupplierFilter) && <button type="button" onClick={() => { setOrderSearchQuery(''); setOrderSupplierFilter(''); }} className="mt-2 text-xs font-bold text-slate-500 underline underline-offset-2">Clear order search</button>}
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
                {tab.count > 0 && (
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
          {filtered.length} order{filtered.length !== 1 ? 's' : ''}
        </p>
        <button className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
          <SlidersHorizontal className="w-3 h-3" />
          Sort: Newest
        </button>
      </div>

      <div className="px-4 mt-4 space-y-3">
        <Card className="border-gray-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-gray-900">AI order suggestions</p>
                <p className="text-xs text-gray-500">Smart recommendations based on inventory risk and recent sales.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-[#0F172A] text-white">{wsConnected ? 'Live' : 'Offline'}</Badge>
                <Button size="sm" variant="outline" onClick={() => setShowAllSuggestions(!showAllSuggestions)}>
                  {showAllSuggestions ? 'Priority only' : 'Show all'}
                </Button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-600">{selectedCount} selected · Est. ${totalOrderCost.toFixed(2)}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={selectAll}>Select all</Button>
                <Button size="sm" variant="outline" onClick={deselectAll}>Clear</Button>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-gray-600">Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(event) => setSelectedSupplier(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <option value="">Choose a supplier</option>
                {Array.from(new Set(displayedSuggestions.map(item => item.supplier))).sort((a, b) => a.localeCompare(b)).map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </div>

            <div className="mt-3 space-y-2">
              {displayedSuggestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                  No urgent reorder suggestions right now.
                </div>
              ) : (
                displayedSuggestions
                  .filter(suggestion => !selectedSupplier || suggestion.supplier === selectedSupplier)
                  .map(suggestion => (
                    <button
                      key={suggestion.itemId}
                      onClick={() => toggleSelection(suggestion.itemId)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${selectedSuggestions.has(suggestion.itemId) ? 'border-[#0F172A] bg-[#FEFCE8]' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${getPriorityColor(suggestion.priority)}`} />
                            <p className="text-sm font-semibold text-gray-900">{suggestion.itemName}</p>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{suggestion.reasoning}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{suggestion.suggestedQuantity} {suggestion.unit}</p>
                          <p className="text-xs text-gray-500">${suggestion.totalCost.toFixed(2)}</p>
                        </div>
                      </div>
                    </button>
                  ))
              )}
            </div>

            {selectedCount > 0 && (
              <div className="mt-3 flex gap-2">
                <Button className="flex-1 bg-[#0F172A] hover:bg-[#1E293B] text-white" onClick={handleApproveOrders}>
                  <Check className="mr-2 h-4 w-4" /> Approve {selectedCount} orders
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order rows */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
            <ShoppingCart className="w-7 h-7 text-gray-300" />
          </div>
          <p className="font-bold text-gray-500 text-sm">No orders yet</p>
          <p className="text-xs text-gray-400">Place an order to generate your first order list</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {filtered.map(order => {
            // Primary supplier
            const supCounts: Record<string, number> = {};
            order.items.forEach(oi => {
              const item = inventory.find(i => i.id === oi.itemId);
              if (item) supCounts[item.supplier] = (supCounts[item.supplier] || 0) + 1;
            });
            const primarySup = Object.entries(supCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Supplier';
            const cfg = STATUS_CFG[order.status as OrderStatus] ?? STATUS_CFG.pending;
            const av  = avatarColor(primarySup);

            const delivery = new Date(order.date);
            delivery.setDate(delivery.getDate() + 3);

            return (
              <button
                key={order.id}
                onClick={() => {
                  setDetailOrder(order);
                  resetEditableItems(order.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-4 bg-white active:bg-gray-50 transition-colors text-left"
              >
                {/* Supplier avatar */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
                  style={{ background: av.bg, color: av.text }}
                >
                  {initials(primarySup)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-gray-900 truncate">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <span
                      className="text-[9px] font-black px-2 py-1 rounded-full shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">{primarySup}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {fmtDate(order.date)} · Delivery: {fmtDate(delivery.toISOString())}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[15px] font-black" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                      {fmtMoney(order.totalCost)}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">{order.items.length} items</p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={showManualOrderDialog} onOpenChange={setShowManualOrderDialog}>
        <DialogContent className="max-w-[760px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Supplier</label>
              <select
                value={manualSupplier}
                onChange={(event) => {
                  setManualSupplier(event.target.value);
                  setManualItemQuery('');
                  setManualQuantities({});
                }}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select supplier...</option>
                {manualSupplierOptions.map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </div>

            {!manualSupplier && (
              <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                Choose a supplier to load all available items.
              </p>
            )}

            {manualSupplier && manualSupplierItems.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                No inventory items are currently linked to this supplier.
              </p>
            )}

            {manualSupplierItems.length > 0 && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="manual-order-item-search" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Search supplier items
                  </label>
                  <Input
                    id="manual-order-item-search"
                    value={manualItemQuery}
                    onChange={(event) => setManualItemQuery(event.target.value)}
                    placeholder="Search by item name or product code"
                    className="mt-1"
                  />
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">On hand</th>
                        <th className="px-3 py-2">Unit cost</th>
                        <th className="px-3 py-2">Order qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredManualSupplierItems.map(item => (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-gray-900">{item.name}</td>
                          <td className="px-3 py-2 text-gray-700">{item.currentStock} {item.unit}</td>
                          <td className="px-3 py-2 text-gray-700">{fmtMoney(item.unitCost)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step="1"
                              value={manualQuantities[item.id] ?? 0}
                              onChange={(event) => updateManualQuantity(item.id, event.target.value)}
                              className="w-24 rounded-md border border-gray-300 px-2 py-1"
                            />
                          </td>
                        </tr>
                      ))}
                      {filteredManualSupplierItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">
                            No items match that search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <p className="text-gray-700">{manualOrderLineCount} line items selected</p>
                  <p className="font-semibold text-gray-900">Order total: {fmtMoney(manualOrderTotal)}</p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowManualOrderDialog(false)}>Cancel</Button>
                  <Button className="bg-[#0F172A] hover:bg-[#1E293B] text-white" onClick={handleCreateManualOrderFromDialog}>
                    Create Order & Generate Email
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email draft dialog */}
      <Dialog open={showEmailDialog} onOpenChange={open => !open && setShowEmailDialog(false)}>
        <DialogContent className="max-w-[760px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplier email drafts</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {draftEmails.length === 0 ? (
              <p className="text-sm text-gray-500">No supplier drafts available yet.</p>
            ) : draftEmails.map(email => (
              <div key={`${email.supplier}-${email.supplierEmail}`} className="rounded-2xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{email.supplier}</p>
                    <p className="text-xs text-gray-500">{email.supplierEmail}</p>
                    {email.ccEmails.length > 0 && <p className="mt-1 text-xs text-gray-500">CC: {email.ccEmails.join(', ')}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyDraftToClipboard(email)}>
                      <Mail className="mr-1.5 h-3.5 w-3.5" /> Copy
                    </Button>
                    <Button size="sm" onClick={() => void openEmailClient(email)}>
                      <Mail className="mr-1.5 h-3.5 w-3.5" /> Send
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">CC team members</label>
                  <input
                    type="text"
                    value={email.ccEmails.join(', ')}
                    onChange={(event) => updateDraftCcEmails(email.supplier, event.target.value)}
                    placeholder="souschef@restaurant.com, manager@restaurant.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-500">Separate multiple addresses with commas.</p>
                </div>
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Subject</label>
                  <input
                    value={email.emailSubject}
                    onChange={(event) => updateDraftEmailField(email.supplier, 'emailSubject', event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Body</label>
                  <textarea
                    value={email.emailBody}
                    onChange={(event) => updateDraftEmailField(email.supplier, 'emailBody', event.target.value)}
                    rows={8}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Item quantities</label>
                  <div className="space-y-2">
                    {email.items.map(item => (
                      <div key={item.itemId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.itemName}</p>
                          <p className="text-xs text-gray-500">{item.unit}</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.suggestedQuantity}
                          onChange={(event) => updateDraftItemQuantity(email.supplier, item.itemId, event.target.value)}
                          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailOrder} onOpenChange={open => !open && setDetailOrder(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {detailOrder ? `Order #${detailOrder.id.slice(0,8).toUpperCase()}` : 'Order Details'}
            </DialogTitle>
          </DialogHeader>

          {detailOrder && (() => {
            const cfg = STATUS_CFG[detailOrder.status as OrderStatus] ?? STATUS_CFG.pending;
            const groups: Record<string, typeof detailOrder.items> = {};
            detailOrder.items.forEach(oi => {
              const sup = inventory.find(i => i.id === oi.itemId)?.supplier || 'Unknown';
              if (!groups[sup]) groups[sup] = [];
              groups[sup].push(oi);
            });

            return (
              <div className="flex-1 overflow-y-auto space-y-4 pb-2">
                <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: cfg.bg }}>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>Status</p>
                    <p className="text-base font-black mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total</p>
                    <p className="text-xl font-black" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                      {fmtMoney(detailOrder.totalCost)}
                    </p>
                  </div>
                </div>

                {Object.entries(groups).map(([sup, items]) => {
                  const av = avatarColor(sup);
                  const tot = items.reduce((sum, oi) => sum + (editableItems[oi.itemId]?.cost ?? oi.cost), 0);
                  const receiptDate = supplierDateOverrides[sup] || detailOrder.supplierDates?.[sup] || '';
                  return (
                    <div key={sup}>
                      <div className="mb-2 flex items-center gap-2 px-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black" style={{ background: av.bg, color: av.text }}>
                          {initials(sup)}
                        </div>
                        <p className="flex-1 text-xs font-bold text-gray-700">{sup}</p>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                            <CalendarDays className="h-3.5 w-3.5" />
                            <input
                              type="date"
                              value={receiptDate}
                              onChange={(event) => setSupplierDateOverrides(prev => ({ ...prev, [sup]: event.target.value }))}
                              className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px]"
                            />
                          </label>
                          <p className="text-xs font-bold" style={{ color: D }}>{fmtMoney(tot)}</p>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-gray-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-600">Item</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-600">Qty</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-600">Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {items.map(oi => {
                              const item = inventory.find(i => i.id === oi.itemId);
                              if (!item) return null;
                              const current = editableItems[oi.itemId] ?? { quantity: oi.quantity, cost: oi.cost };
                              return (
                                <tr key={oi.itemId}>
                                  <td className="px-3 py-2">
                                    <p className="text-sm font-bold text-gray-900">{item.name}</p>
                                    <p className="text-[10px] text-gray-400">{item.unit}</p>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={current.quantity}
                                      onChange={(event) => updateEditableItem(oi.itemId, 'quantity', Number(event.target.value) || 0)}
                                      className="w-24"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={current.cost}
                                      onChange={(event) => updateEditableItem(oi.itemId, 'cost', Number(event.target.value) || 0)}
                                      className="w-28"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                <div className="flex gap-2 pt-2">
                  {detailOrder.status === 'pending' && (
                    <Button className="flex-1 font-bold" style={{ background: D, color: '#fff' }}
                      onClick={() => { handleStatus(detailOrder.id, 'ordered'); setDetailOrder(null); }}>
                      <Truck className="w-4 h-4 mr-1.5" /> Mark In Transit
                    </Button>
                  )}
                  {detailOrder.status === 'ordered' && (
                    <Button className="flex-1 font-bold" style={{ background: '#166534', color: '#fff' }}
                      onClick={() => { handleStatus(detailOrder.id, 'received'); setDetailOrder(null); }}>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark Received
                    </Button>
                  )}
                  {detailOrder.status === 'received' && (
                    <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-green-700 font-bold text-sm bg-green-50">
                      <CheckCircle2 className="w-4 h-4" /> Order Complete
                    </div>
                  )}
                  <Button variant="outline" className="flex-1" onClick={() => setDetailOrder(null)}>Close</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
