import { useState, useMemo, useEffect, useRef } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Sparkles, TrendingUp, Calendar, DollarSign, Package, Check, X, AlertCircle, Mail, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { groupBySupplier } from '../utils/invoiceWorkflow';
import { sendSupplierEmail } from '../utils/sendSupplierEmail.js';
import { resolveSuggestionQuantity } from '../utils/orderSuggestionUtils.js';
import { getSupplierCcEmails, getSupplierEmailAddress } from '../utils/supplierEmailDraft.js';
import { estimateDemandForTomorrow } from '../utils/forecastOrderUtils.js';
import { buildApiUrl } from '../utils/api';

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

interface SupplierEmail {
  supplier: string;
  supplierEmail: string;
  ccEmails: string[];
  items: OrderSuggestion[];
  totalCost: number;
  emailBody: string;
  emailSubject: string;
}

const MARKETMAN_UOM_OPTIONS = new Set([
  'oz', 'EA', 'gr', 'L', 'Kg', 'lb',
]);
const MAX_MAILTO_BODY_CHARS = 1200;

const MARKETMAN_UOM_ALIASES: Record<string, string> = {
  EACH: 'EA',
  EAC: 'EA',
  POUND: 'lb',
  POUNDS: 'lb',
  LBS: 'lb',
  OUNCE: 'oz',
  OUNCES: 'oz',
  LITRE: 'L',
  LITER: 'L',
  LITRES: 'L',
  LITERS: 'L',
  MILLILITRE: 'gr',
  MILLILITER: 'gr',
  MILLILITRES: 'gr',
  MILLILITERS: 'gr',
  CASE: 'EA',
  BOX: 'EA',
  PACK: 'EA',
  BOTTLE: 'EA',
  PIECE: 'EA',
  PIECES: 'EA',
};

function normalizeMarketmanUnit(unit?: string) {
  const cleaned = unit?.trim() || '';
  if (!cleaned || cleaned.toUpperCase() === 'NONE' || cleaned.toUpperCase() === 'N/A') return 'oz';
  if (MARKETMAN_UOM_OPTIONS.has(cleaned)) return cleaned;
  const normalized = cleaned.toUpperCase();
  if (MARKETMAN_UOM_ALIASES[normalized]) return MARKETMAN_UOM_ALIASES[normalized];
  return cleaned;
}

function buildSupplierEmailBody(supplier: string, restaurantName: string, items: OrderSuggestion[]) {
  const urgentItems = items.filter(item => item.priority === 'critical' || item.priority === 'high').length;
  return `Hi ${supplier},

Please send the following items for ${restaurantName}:

${items.map(item => `${item.itemName} - ${item.suggestedQuantity} ${normalizeMarketmanUnit(item.unit)}`).join('\n')}

${urgentItems > 0 ? `Priority items included: ${urgentItems}\n\n` : ''}Thank you`;
}

function buildSupplierEmailSubject(restaurantName: string) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `Order Request - ${restaurantName} (${today})`;
}

function getDefaultOrderDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function openMailtoDraft(to: string, ccEmails: string[], subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  if (ccEmails.length) params.set('cc', ccEmails.join(','));
  const mailtoLink = `mailto:${encodeURIComponent(to)}?${params.toString()}`;
  window.location.href = mailtoLink;
}

export function AIOrders() {
  const { inventory, suppliers, forecasts, placeOrder } = useInventory();
  const { salesData } = useToast();
  const { accountId, accountName, user } = useAuth();
  const createOrderRef = useRef<HTMLDivElement | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [editableSuggestionQuantities, setEditableSuggestionQuantities] = useState<Record<string, number>>({});
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [manualOrderQuantities, setManualOrderQuantities] = useState<Record<string, number>>({});
  const [draftEmails, setDraftEmails] = useState<SupplierEmail[]>([]);
  const [sendingAllEmails, setSendingAllEmails] = useState(false);
  const [emailSendStatus, setEmailSendStatus] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'failed'>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<OrderSuggestion[] | null>(null);
  const [emailServiceConfigured, setEmailServiceConfigured] = useState<boolean | null>(null);
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
          // Ignore malformed profile payloads.
        }
      }
    }

    return accountName?.trim() || 'Restaurant';
  }, [accountId, accountName]);

  useEffect(() => {
    let cancelled = false;
    void fetch(buildApiUrl('/api/send-supplier-email'))
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

  // WebSocket connection for live AI suggestions
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4001');
    ws.addEventListener('open', () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: 'requestAiOrder', payload: { inventory, salesData } }));
    });
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'aiOrder') {
          setAiSuggestions(msg.data || []);
        }
      } catch (e) { console.error(e); }
    });
    ws.addEventListener('close', () => setWsConnected(false));
    return () => ws.close();
  }, [inventory, salesData]);

  // AI-powered order suggestions
  const orderSuggestions = useMemo(() => {
    const suggestions: OrderSuggestion[] = [];

    // Calculate average daily sales from Toast POS data
    const avgDailySales = salesData.length > 0
      ? salesData.reduce((sum, day) => sum + day.revenue, 0) / salesData.length
      : 0;

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

      const daysUntilStockout = estimatedDailyUsage > 0 
        ? Math.floor(item.currentStock / estimatedDailyUsage)
        : 999;

      // Determine if we should suggest an order
      let shouldOrder = false;
      let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
      let reasoning = '';
      let confidence = 0;

      if (daysUntilStockout <= 2) {
        shouldOrder = true;
        priority = 'critical';
        reasoning = `Critical: Only ${daysUntilStockout} days of stock remaining${forecastEntry ? ` for the ${forecastEntry.date} forecast` : ''}`;
        confidence = 0.95;
      } else if (daysUntilStockout <= 4) {
        shouldOrder = true;
        priority = 'high';
        reasoning = `High priority: ${daysUntilStockout} days until stockout${forecastEntry ? ` for the ${forecastEntry.date} forecast` : ''}`;
        confidence = 0.88;
      } else if (stockPercentage < 40) {
        shouldOrder = true;
        priority = 'medium';
        reasoning = `Below 40% par level (${stockPercentage.toFixed(0)}%)`;
        confidence = 0.75;
      } else if (stockPercentage < 60 && salesTrend > 0.15) {
        shouldOrder = true;
        priority = 'medium';
        reasoning = `Sales trending up ${(salesTrend * 100).toFixed(0)}%, stock at ${stockPercentage.toFixed(0)}%`;
        confidence = 0.70;
      } else if (stockPercentage < 70) {
        shouldOrder = true;
        priority = 'low';
        reasoning = `Stock at ${stockPercentage.toFixed(0)}% - Consider ordering soon`;
        confidence = 0.60;
      } else if (daysUntilStockout <= 10 && daysUntilStockout > 4) {
        shouldOrder = true;
        priority = 'low';
        reasoning = `${daysUntilStockout} days of stock remaining`;
        confidence = 0.55;
      }

      if (shouldOrder) {
        // Calculate suggested order quantity
        let suggestedQuantity = item.parLevel - item.currentStock;
        
        // Add buffer for high-demand items
        if (salesTrend > 0.2) {
          suggestedQuantity *= 1.15; // 15% buffer
        }

        // Round to reasonable quantities
        suggestedQuantity = Math.ceil(suggestedQuantity);

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

    // Sort by priority and confidence
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return suggestions.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });
  }, [inventory, forecasts, salesData]);

  const displayedSuggestions = showAllSuggestions 
    ? (aiSuggestions || orderSuggestions) 
    : (aiSuggestions || orderSuggestions).filter(s => s.priority === 'critical' || s.priority === 'high');

  const supplierOptions = useMemo(() => {
    const names = [
      ...suppliers.map(supplier => supplier.name),
      ...inventory.map(item => item.supplier),
    ]
      .map(name => name.trim())
      .filter(Boolean);

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [suppliers, inventory]);

  const selectedSupplierItems = useMemo(() => {
    if (!selectedSupplier) return [];
    return inventory.filter(
      item => item.supplier.trim().toLowerCase() === selectedSupplier.trim().toLowerCase(),
    );
  }, [inventory, selectedSupplier]);

  const totalOrderCost = displayedSuggestions
    .filter(s => selectedSuggestions.has(s.itemId))
    .reduce((sum, s) => sum + resolveSuggestionQuantity(s, editableSuggestionQuantities).totalCost, 0);

  const selectedCount = selectedSuggestions.size;

  const buildSupplierGroups = (items: OrderSuggestion[]) => {
    return groupBySupplier(items).map(group => ({
      supplier: group.supplier,
      items: group.items as OrderSuggestion[],
      totalCost: group.totalCost,
      itemCount: group.items.length,
    }));
  };

  const selectedApprovalGroups = useMemo(() => {
    const selectedItems = (aiSuggestions || orderSuggestions).filter(s => selectedSuggestions.has(s.itemId));
    return buildSupplierGroups(selectedItems);
  }, [aiSuggestions, orderSuggestions, selectedSuggestions]);

  useEffect(() => {
    if (!selectedSupplier) return;

    setManualOrderQuantities(prev => {
      const next: Record<string, number> = {};
      selectedSupplierItems.forEach(item => {
        next[item.id] = prev[item.id] ?? 0;
      });
      return next;
    });
  }, [selectedSupplier, selectedSupplierItems]);

  const toggleSelection = (itemId: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedSuggestions(newSelected);
  };

  const selectAll = () => {
    const allIds = new Set(displayedSuggestions.map(s => s.itemId));
    setSelectedSuggestions(allIds);
  };

  const deselectAll = () => {
    setSelectedSuggestions(new Set());
  };

  const updateSuggestionQuantity = (itemId: string, value: string) => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setEditableSuggestionQuantities(prev => ({ ...prev, [itemId]: safeValue }));
  };

  const handleApproveOrders = () => {
    const sourceList = aiSuggestions || orderSuggestions;
    const ordersToPlace = sourceList.filter(s => selectedSuggestions.has(s.itemId));

    if (ordersToPlace.length === 0) {
      toast.error('Select at least one item to place an order');
      return;
    }

    const adjustedOrdersToPlace = ordersToPlace.map(suggestion => {
      const { quantity, totalCost } = resolveSuggestionQuantity(suggestion, editableSuggestionQuantities);
      return {
        ...suggestion,
        suggestedQuantity: quantity,
        totalCost,
      };
    });

    const supplierGroups = buildSupplierGroups(adjustedOrdersToPlace);
    const emailsToDraft: SupplierEmail[] = [];

    supplierGroups.forEach(({ supplier, items }) => {
      const orderItems = items.map(suggestion => ({
        itemId: suggestion.itemId,
        quantity: suggestion.suggestedQuantity,
        cost: suggestion.totalCost,
      }));

      placeOrder({
        date: getDefaultOrderDate(),
        items: orderItems,
        supplier,
        totalCost: orderItems.reduce((sum, item) => sum + item.cost, 0),
        status: 'pending',
      });

      const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
      const emailBody = buildSupplierEmailBody(supplier, restaurantName, items);

      emailsToDraft.push({
        supplier,
        supplierEmail: getSupplierEmailAddress(supplier, suppliers),
        ccEmails: getSupplierCcEmails(supplier, suppliers),
        items,
        totalCost,
        emailBody,
        emailSubject: buildSupplierEmailSubject(restaurantName),
      });
    });

    setDraftEmails(emailsToDraft);
    setShowEmailDialog(true);
    toast.success(`✓ Created ${supplierGroups.length} supplier order${supplierGroups.length === 1 ? '' : 's'} and prepared ${emailsToDraft.length} editable draft email${emailsToDraft.length === 1 ? '' : 's'}`);
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
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const generateEmails = () => {
    const sourceList = aiSuggestions || orderSuggestions;
    const ordersToPlace = sourceList.filter(s => selectedSuggestions.has(s.itemId));
    
    // Group orders by supplier
    const supplierGroups = buildSupplierGroups(ordersToPlace);

    const emails: SupplierEmail[] = supplierGroups.map(({ supplier, items }) => {
      const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
      const emailBody = buildSupplierEmailBody(supplier, restaurantName, items);

      return {
        supplier,
        supplierEmail: getSupplierEmailAddress(supplier, suppliers),
        ccEmails: getSupplierCcEmails(supplier, suppliers),
        items,
        totalCost,
        emailBody,
        emailSubject: buildSupplierEmailSubject(restaurantName),
      };
    });

    setDraftEmails(emails);
    setShowEmailDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Email copied to clipboard!');
  };

  const resetEmailSendStatus = () => setEmailSendStatus({});

  const updateDraftEmailField = (supplier: string, field: 'emailSubject' | 'emailBody', value: string) => {
    setDraftEmails(prev => prev.map(email => {
      if (email.supplier !== supplier) return email;
      return { ...email, [field]: value };
    }));
  };

  const updateDraftCcEmails = (supplier: string, value: string) => {
    const ccEmails = value.split(/[;,\n]/).map(email => email.trim().toLowerCase()).filter(Boolean);
    setDraftEmails(prev => prev.map(email => email.supplier === supplier ? { ...email, ccEmails } : email));
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
      const emailBody = buildSupplierEmailBody(supplier, restaurantName, updatedItems);

      return {
        ...email,
        items: updatedItems,
        totalCost,
        emailBody,
      };
    }));
  };

  const openEmailClient = async (email: SupplierEmail) => {
    if (!email.supplierEmail) {
      toast.error('No supplier email address is configured');
      return;
    }

    if (emailServiceConfigured === false) {
      setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'sent' }));
      openMailtoDraft(email.supplierEmail, email.ccEmails, email.emailSubject, email.emailBody);
      toast.info('Email service is not configured. Opened your mail app with a draft instead.');
      return;
    }

    setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'sending' }));
    try {
      await sendSupplierEmail({
        to: email.supplierEmail,
        cc: email.ccEmails,
        subject: email.emailSubject,
        text: email.emailBody,
        senderEmail: user?.email,
        senderName: user?.name,
      });
      setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'sent' }));
      toast.success(`Sent supplier email to ${email.supplier}`);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'EMAIL_SERVICE_NOT_CONFIGURED') {
        setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'sent' }));
        openMailtoDraft(email.supplierEmail, email.ccEmails, email.emailSubject, email.emailBody);
        toast.info('Email service not configured. Opened your mail app with a draft instead.');
        return;
      }
      setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'failed' }));
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    }
  };

  const sendAllDraftEmails = async () => {
    if (draftEmails.length === 0) {
      toast.error('No draft emails to send');
      return;
    }

    if (emailServiceConfigured === false) {
      toast.info('Email service is not configured. Use each Send button to open drafts in your mail app.');
      return;
    }

    setSendingAllEmails(true);
    let successCount = 0;
    let failedCount = 0;

    for (const email of draftEmails) {
      if (!email.supplierEmail) {
        setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'failed' }));
        failedCount += 1;
        continue;
      }

      setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'sending' }));
      try {
        await sendSupplierEmail({
          to: email.supplierEmail,
          cc: email.ccEmails,
          subject: email.emailSubject,
          text: email.emailBody,
          senderEmail: user?.email,
          senderName: user?.name,
        });
        setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'sent' }));
        successCount += 1;
      } catch {
        setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'failed' }));
        failedCount += 1;
      }
    }

    setSendingAllEmails(false);
    if (failedCount === 0) {
      toast.success(`Sent all ${successCount} supplier email${successCount === 1 ? '' : 's'}`);
    } else {
      toast.error(`Sent ${successCount} email${successCount === 1 ? '' : 's'}, ${failedCount} failed`);
    }
  };

  const updateManualOrderQuantity = (itemId: string, value: string) => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setManualOrderQuantities(prev => ({ ...prev, [itemId]: safeValue }));
  };

  const manualOrderTotal = selectedSupplierItems.reduce((total, item) => {
    const qty = manualOrderQuantities[item.id] ?? 0;
    return total + qty * item.unitCost;
  }, 0);

  const manualOrderLineCount = selectedSupplierItems.filter(item => (manualOrderQuantities[item.id] ?? 0) > 0).length;
  const supplierLowStockItems = selectedSupplierItems.filter(item => item.currentStock < item.parLevel * 0.3);
  const supplierBelowParItems = selectedSupplierItems.filter(item => item.currentStock < item.parLevel);

  const handleCreateSupplierOrder = () => {
    if (!selectedSupplier) {
      toast.error('Select a supplier first');
      return;
    }

    if (manualOrderLineCount === 0) {
      toast.error('Add a quantity for at least one item');
      return;
    }

    const itemsForEmail = selectedSupplierItems
      .map(item => {
        const quantity = manualOrderQuantities[item.id] ?? 0;
        if (quantity <= 0) return null;

        return {
          itemId: item.id,
          itemName: item.name,
          currentStock: item.currentStock,
          parLevel: item.parLevel,
          suggestedQuantity: quantity,
          unitCost: item.unitCost,
          totalCost: quantity * item.unitCost,
          supplier: selectedSupplier,
          unit: item.packUnit || item.unit,
          priority: item.currentStock < item.parLevel * 0.3 ? 'critical' : item.currentStock < item.parLevel ? 'high' : 'low',
          reasoning: item.currentStock < item.parLevel
            ? `On hand is below par (${item.currentStock} / ${item.parLevel} ${item.unit})`
            : 'Manual order line',
          daysUntilStockout: 0,
          confidence: 1,
        } as OrderSuggestion;
      })
      .filter((item): item is OrderSuggestion => Boolean(item));

    const emailBody = buildSupplierEmailBody(selectedSupplier, restaurantName, itemsForEmail);
    const emailSubject = buildSupplierEmailSubject(restaurantName);

    const orderItems = itemsForEmail.map(item => ({
      itemId: item.itemId,
      quantity: item.suggestedQuantity,
      cost: item.totalCost,
    }));

    placeOrder({
      date: getDefaultOrderDate(),
      items: orderItems,
      supplier: selectedSupplier,
      totalCost: orderItems.reduce((sum, item) => sum + item.cost, 0),
      status: 'pending',
    });

    const supplierEmailDraft: SupplierEmail = {
      supplier: selectedSupplier,
      supplierEmail: getSupplierEmailAddress(selectedSupplier, suppliers),
      ccEmails: getSupplierCcEmails(selectedSupplier, suppliers),
      items: itemsForEmail,
      totalCost: manualOrderTotal,
      emailBody,
      emailSubject: emailSubject,
    };

    setDraftEmails([supplierEmailDraft]);
    setShowEmailDialog(true);
    setSelectedSupplier('');
    setManualOrderQuantities({});
    toast.success(`Created order and invoice for ${selectedSupplier}: ${manualOrderLineCount} items • $${manualOrderTotal.toFixed(2)}`);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center">
            <Sparkles className="w-6 h-6 mr-2 text-[#0F172A]" />
            AI Order Assistant
          </h2>
          <p className="text-sm text-gray-600 mt-1">Smart ordering powered by sales forecasting</p>
        </div>
        <Button
          className="bg-[#0F172A] hover:bg-[#1E293B] text-white"
          onClick={handleCreateSupplierOrder}
        >
          Create Order & Invoice
        </Button>
      </div>

      <div ref={createOrderRef} className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Supplier Order Builder</CardTitle>
            <p className="text-sm text-gray-600">Select a supplier and build an order using live on-hand inventory.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="supplier" className="text-sm font-semibold text-gray-700">Supplier</label>
              <select
                id="supplier"
                value={selectedSupplier}
                onChange={(event) => setSelectedSupplier(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select supplier...</option>
                {supplierOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {selectedSupplier && selectedSupplierItems.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                No inventory items are currently linked to this supplier.
              </div>
            )}

            {selectedSupplierItems.length > 0 && (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2">On hand</th>
                        <th className="px-3 py-2">Par</th>
                        <th className="px-3 py-2">Order qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupplierItems.map(item => (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-gray-900">{item.name}</td>
                          <td className="px-3 py-2 text-gray-700">{item.unit}</td>
                          <td className="px-3 py-2 text-gray-900">{item.currentStock} {item.unit}</td>
                          <td className="px-3 py-2 text-gray-700">{item.parLevel} {item.unit}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step="1"
                              value={manualOrderQuantities[item.id] ?? 0}
                              onChange={(event) => updateManualOrderQuantity(item.id, event.target.value)}
                              className="w-24 rounded-md border border-gray-300 px-2 py-1"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <p className="text-gray-700">{manualOrderLineCount} line items selected</p>
                  <p className="font-semibold text-gray-900">Order total: ${manualOrderTotal.toFixed(2)}</p>
                </div>

                <div className="flex justify-end">
                  <Button className="bg-[#0F172A] hover:bg-[#1E293B] text-white" onClick={handleCreateSupplierOrder}>
                    Create Order & Invoice
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Live Inventory Risk</CardTitle>
            <p className="text-sm text-gray-600">What this supplier is impacting right now.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs uppercase tracking-wide text-red-700">Critical</p>
                <p className="text-2xl font-black text-red-700">{supplierLowStockItems.length}</p>
                <p className="text-xs text-red-600">Below 30% of par</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-wide text-amber-700">Below Par</p>
                <p className="text-2xl font-black text-amber-700">{supplierBelowParItems.length}</p>
                <p className="text-xs text-amber-600">Need replenishment</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-100 px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">At-risk items</p>
              </div>
              <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                {selectedSupplier ? (
                  supplierBelowParItems.length > 0 ? (
                    supplierBelowParItems.map(item => (
                      <div key={item.id} className="rounded-md bg-gray-50 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <Badge className={item.currentStock < item.parLevel * 0.3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                            {item.currentStock < item.parLevel * 0.3 ? 'Critical' : 'Low'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">{item.currentStock} / {item.parLevel} {item.unit} on hand</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No at-risk items for this supplier.</p>
                  )
                ) : (
                  <p className="text-sm text-gray-500">Select a supplier to see risk signals.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border-[#0F172A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-white">Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-white mb-2">{(aiSuggestions || orderSuggestions).length}</div>
            <div className="text-xs text-white space-y-1">
              <p className="whitespace-nowrap">{(aiSuggestions || orderSuggestions).filter(s => s.priority === 'critical').length} critical</p>
              <p className="whitespace-nowrap">{(aiSuggestions || orderSuggestions).filter(s => s.priority === 'high').length} high</p>
              <p className="whitespace-nowrap">{(aiSuggestions || orderSuggestions).filter(s => s.priority === 'medium').length} medium</p>
              <p className="whitespace-nowrap">{(aiSuggestions || orderSuggestions).filter(s => s.priority === 'low').length} low</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0F172A] border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-slate-400">Est. Cost</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-white mb-2">
              ${(aiSuggestions || orderSuggestions).reduce((sum, s) => sum + s.totalCost, 0).toFixed(2)}
            </div>
            <p className="text-xs text-slate-400">Total if all approved</p>
          </CardContent>
        </Card>
      </div>

      {/* Selection Actions */}
      {orderSuggestions.length > 0 && (
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-green-900">
                    {selectedCount} items selected
                  </p>
                  <p className="text-sm text-green-700">
                    Total: ${totalOrderCost.toFixed(2)}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAll}
                    className="text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={deselectAll}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              {selectedCount > 0 && (
                <Button
                  className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white"
                  onClick={handleApproveOrders}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve {selectedCount} Orders (${totalOrderCost.toFixed(2)})
                </Button>
              )}
              {selectedCount > 0 && (
                <Button
                  className="w-full bg-gray-900 hover:bg-gray-950 text-white"
                  onClick={generateEmails}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Generate Emails
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCount > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">Approval preview</p>
                <p className="text-xs text-blue-700">These supplier groups will become orders and invoices once you approve them.</p>
              </div>
              <div className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                {selectedApprovalGroups.length} supplier{selectedApprovalGroups.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {selectedApprovalGroups.map(group => (
                <div key={group.supplier} className="rounded-lg border border-blue-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{group.supplier}</p>
                    <p className="text-xs font-semibold text-gray-600">{group.itemCount} item{group.itemCount === 1 ? '' : 's'} • ${group.totalCost.toFixed(2)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {group.items.map(item => (
                      <span key={item.itemId} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                        {item.itemName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Toggle */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">
          {showAllSuggestions ? 'All Suggestions' : 'High Priority Only'}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAllSuggestions(!showAllSuggestions)}
          className="text-xs"
        >
          {showAllSuggestions ? 'Show Priority Only' : 'Show All'}
        </Button>
      </div>

      {/* Order Suggestions List */}
      <div className="space-y-3">
        {displayedSuggestions.length === 0 ? (
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="py-12 text-center">
              <Check className="w-12 h-12 mx-auto text-green-600 mb-3" />
              <p className="text-lg font-semibold text-green-900">All Stocked Up!</p>
              <p className="text-sm text-green-700 mt-1">
                No urgent orders needed based on current inventory levels
              </p>
            </CardContent>
          </Card>
        ) : (
          displayedSuggestions.map((suggestion) => {
            const isSelected = selectedSuggestions.has(suggestion.itemId);
            return (
              <Card
                key={suggestion.itemId}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-blue-500 bg-[#FEFCE8]' : ''
                }`}
                onClick={() => toggleSelection(suggestion.itemId)}
              >
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-3 h-3 rounded-full ${getPriorityColor(suggestion.priority)}`}
                          />
                          <h3 className="font-semibold text-gray-900">{suggestion.itemName}</h3>
                        </div>
                        <Badge className={`${getPriorityBadgeColor(suggestion.priority)} border text-xs mt-1`}>
                          {suggestion.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <label className="text-[10px] uppercase tracking-wide text-gray-500">Qty</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={resolveSuggestionQuantity(suggestion, editableSuggestionQuantities).quantity}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => updateSuggestionQuantity(suggestion.itemId, event.target.value)}
                            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
                          />
                        </div>
                      </div>
                    </div>

                    {/* AI Reasoning */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                      <div className="flex items-start space-x-2">
                        <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-purple-900 font-medium">{suggestion.reasoning}</p>
                          <p className="text-xs text-purple-700 mt-0.5">
                            Confidence: {(suggestion.confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stock Details */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Current</p>
                        <p className="font-semibold text-gray-900">
                          {suggestion.currentStock} {suggestion.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Par Level</p>
                        <p className="font-semibold text-gray-900">
                          {suggestion.parLevel} {suggestion.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Supplier</p>
                        <p className="font-semibold text-gray-900">{suggestion.supplier}</p>
                      </div>
                    </div>

                    {/* Days Until Stockout */}
                    {suggestion.daysUntilStockout < 7 && (
                      <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded p-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <p className="text-xs text-red-900 font-medium">
                          {suggestion.daysUntilStockout} days until projected stockout
                        </p>
                      </div>
                    )}

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="flex items-center justify-center space-x-2 bg-[#FEF9C3] border border-[#F5C10E]/50 rounded p-2">
                        <Check className="w-4 h-4 text-[#1D4ED8]" />
                        <p className="text-xs font-semibold text-[#0F172A]">Selected for ordering</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={(open) => {
        setShowEmailDialog(open);
        if (!open) resetEmailSendStatus();
      }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Mail className="w-5 h-5 mr-2 text-[#2563EB]" />
              Draft Supplier Emails ({draftEmails.length})
            </DialogTitle>
            <DialogDescription>
              Copy and send these emails to your suppliers
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <Button
              onClick={sendAllDraftEmails}
              disabled={sendingAllEmails || draftEmails.length === 0}
              className="w-full bg-[#0F172A] text-white hover:bg-[#1E293B]"
            >
              <Mail className="w-4 h-4 mr-2" />
              {sendingAllEmails ? 'Sending all...' : 'Send All Emails'}
            </Button>
          </div>
          <div className="space-y-4 pt-4">
            {draftEmails.map((email, idx) => (
              <Card key={email.supplier} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-[#FEFCE8] to-[#FEF9C3] pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{email.supplier}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {email.items.length} item(s) • ${email.totalCost.toFixed(2)}
                      </p>
                      {emailSendStatus[email.supplier] && emailSendStatus[email.supplier] !== 'idle' && (
                        <p className={`mt-1 text-xs font-semibold ${emailSendStatus[email.supplier] === 'sent' ? 'text-emerald-700' : emailSendStatus[email.supplier] === 'failed' ? 'text-red-700' : 'text-blue-700'}`}>
                          {emailSendStatus[email.supplier] === 'sent'
                            ? 'Sent'
                            : emailSendStatus[email.supplier] === 'failed'
                              ? 'Failed'
                              : 'Sending...'}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(email.emailBody)}
                        className="border-[#0F172A] bg-white font-semibold text-[#0F172A] hover:bg-gray-100"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEmailClient(email)}
                        disabled={sendingAllEmails}
                        className="border-[#0F172A] bg-white font-semibold text-[#0F172A] hover:bg-gray-100"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Open Email
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">CC team members</label>
                    <input
                      type="text"
                      value={email.ccEmails.join(', ')}
                      onChange={(event) => updateDraftCcEmails(email.supplier, event.target.value)}
                      placeholder="bar.manager@restaurant.com, bartenders@restaurant.com"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500">Defaulted from the supplier record; adjust it for this order if needed.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</label>
                    <input
                      value={email.emailSubject}
                      onChange={(event) => updateDraftEmailField(email.supplier, 'emailSubject', event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Body</label>
                    <textarea
                      value={email.emailBody}
                      onChange={(event) => updateDraftEmailField(email.supplier, 'emailBody', event.target.value)}
                      rows={8}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Item quantities</label>
                    <div className="space-y-2">
                      {email.items.map(item => (
                        <div key={item.itemId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{item.itemName}</p>
                            <p className="text-xs text-gray-500">{item.supplier}</p>
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
                  <div className="flex flex-wrap gap-2">
                    {email.items.map(item => (
                      <Badge 
                        key={item.itemId} 
                        className={`${getPriorityBadgeColor(item.priority)} border text-xs`}
                      >
                        {item.itemName}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
