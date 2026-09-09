import { useState, useMemo, useEffect, useRef } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Sparkles, Package, Check, X, AlertCircle, Mail, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { groupBySupplier } from '../utils/invoiceWorkflow';
import { sendSupplierEmail } from '../utils/sendSupplierEmail.js';
import { resolveSuggestionQuantity } from '../utils/orderSuggestionUtils.js';
import { getSupplierCcEmails, getSupplierEmailAddress, parseEmailList } from '../utils/supplierEmailDraft.js';
import { calculateForecastOrderQuantity, estimateDemandForTomorrow } from '../utils/forecastOrderUtils.js';
import { apiRequest } from '../utils/api';
import { OrderBufferControl } from '../components/OrderBufferControl';

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
  forecastDemand?: number;
  baseSuggestedQuantity?: number;
  bufferPercent?: number;
  bufferQuantity?: number;
}

interface SupplierEmail {
  supplier: string;
  supplierEmail: string;
  ccText: string;
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

function openMailtoDraft(to: string, subject: string, body: string, cc: string[] = []) {
  const params = new URLSearchParams({ subject, body });
  if (cc.length) params.set('cc', cc.join(','));
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
  const [supplierEmailCc, setSupplierEmailCc] = useState<string[]>([]);
  const [safetyBufferPercent, setSafetyBufferPercent] = useState(10);
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
    if (user?.email?.trim().toLowerCase() === 'demo@zestiq.com') {
      setEmailServiceConfigured(false);
      return;
    }
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
  }, [user?.email]);

  useEffect(() => {
    if (!accountId || user?.email?.trim().toLowerCase() === 'demo@zestiq.com') return;
    let cancelled = false;
    void apiRequest<{ onboarding?: { clientProfile?: { supplierEmailCc?: string[] } } }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/onboarding`)
      .then(payload => {
        if (!cancelled) setSupplierEmailCc(Array.isArray(payload.onboarding?.clientProfile?.supplierEmailCc) ? payload.onboarding.clientProfile.supplierEmailCc : []);
      })
      .catch(() => {
        if (!cancelled) setSupplierEmailCc([]);
      });
    return () => { cancelled = true; };
  }, [accountId, user?.email]);

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
        const bufferQuantity = estimatedDailyUsage * (safetyBufferPercent / 100);
        const baseSuggestedQuantity = calculateForecastOrderQuantity({
          currentStock: item.currentStock,
          expectedUsage: estimatedDailyUsage,
          parLevel: item.parLevel,
          safetyBuffer: 0,
          minimumOrderQty: item.minimumOrderQty || 0,
        });
        const suggestedQuantity = calculateForecastOrderQuantity({
          currentStock: item.currentStock,
          expectedUsage: estimatedDailyUsage,
          parLevel: item.parLevel,
          safetyBuffer: bufferQuantity,
          minimumOrderQty: item.minimumOrderQty || 0,
        });

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
          forecastDemand: estimatedDailyUsage,
          baseSuggestedQuantity,
          bufferPercent: safetyBufferPercent,
          bufferQuantity: Math.max(0, suggestedQuantity - baseSuggestedQuantity),
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
  }, [inventory, forecasts, salesData, safetyBufferPercent]);

  const effectiveSuggestions = useMemo(() => {
    if (!aiSuggestions) return orderSuggestions;
    const calculatedByItem = new Map(orderSuggestions.map(suggestion => [suggestion.itemId, suggestion]));
    return aiSuggestions.map(suggestion => {
      const calculated = calculatedByItem.get(suggestion.itemId);
      return calculated
        ? {
            ...suggestion,
            suggestedQuantity: calculated.suggestedQuantity,
            totalCost: calculated.totalCost,
            forecastDemand: calculated.forecastDemand,
            baseSuggestedQuantity: calculated.baseSuggestedQuantity,
            bufferPercent: calculated.bufferPercent,
            bufferQuantity: calculated.bufferQuantity,
          }
        : suggestion;
    });
  }, [aiSuggestions, orderSuggestions]);

  const displayedSuggestions = showAllSuggestions 
    ? effectiveSuggestions
    : effectiveSuggestions.filter(s => s.priority === 'critical' || s.priority === 'high');

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
    const selectedItems = effectiveSuggestions.filter(s => selectedSuggestions.has(s.itemId));
    return buildSupplierGroups(selectedItems);
  }, [effectiveSuggestions, selectedSuggestions]);

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
    const sourceList = effectiveSuggestions;
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
        ccText: getSupplierCcEmails(supplier, suppliers, supplierEmailCc).join(', '),
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

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-white text-red-700 border-red-200';
      case 'high': return 'bg-white text-amber-700 border-amber-200';
      default: return 'bg-white text-slate-600 border-slate-200';
    }
  };

  const generateEmails = () => {
    const sourceList = effectiveSuggestions;
    const ordersToPlace = sourceList.filter(s => selectedSuggestions.has(s.itemId));
    
    // Group orders by supplier
    const supplierGroups = buildSupplierGroups(ordersToPlace);

    const emails: SupplierEmail[] = supplierGroups.map(({ supplier, items }) => {
      const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
      const emailBody = buildSupplierEmailBody(supplier, restaurantName, items);

      return {
        supplier,
        supplierEmail: getSupplierEmailAddress(supplier, suppliers),
        ccText: getSupplierCcEmails(supplier, suppliers, supplierEmailCc).join(', '),
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

  const updateDraftEmailField = (supplier: string, field: 'emailSubject' | 'emailBody' | 'ccText', value: string) => {
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
      openMailtoDraft(email.supplierEmail, email.emailSubject, email.emailBody, parseEmailList(email.ccText));
      toast.info('Email service is not configured. Opened your mail app with a draft instead.');
      return;
    }

    setEmailSendStatus(prev => ({ ...prev, [email.supplier]: 'sending' }));
    try {
      await sendSupplierEmail({
        to: email.supplierEmail,
        cc: parseEmailList(email.ccText),
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
        openMailtoDraft(email.supplierEmail, email.emailSubject, email.emailBody, parseEmailList(email.ccText));
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
          cc: parseEmailList(email.ccText),
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
      ccText: getSupplierCcEmails(selectedSupplier, suppliers, supplierEmailCc).join(', '),
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
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Purchasing</p>
        <div>
          <h2 className="mt-1 flex items-center text-2xl font-extrabold tracking-tight text-slate-950">
            <Package className="mr-2 h-6 w-6 text-[#303A43]" />
            Order assistant
          </h2>
          <p className="mt-1 text-sm text-slate-600">Build supplier orders from current stock, par levels, and forecasted demand.</p>
        </div>
      </div>

      <div ref={createOrderRef} className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Create a supplier order</CardTitle>
            <p className="text-sm text-slate-600">Choose a supplier, review stock, then enter only the quantities you need.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="supplier" className="text-sm font-semibold text-gray-700">Supplier</label>
              <select
                id="supplier"
                value={selectedSupplier}
                onChange={(event) => setSelectedSupplier(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
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
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
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
                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/70">
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
                              className="h-9 w-20 rounded-lg border border-slate-300 bg-white px-2 text-center"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <div>
                    <p className="text-sm text-slate-500">{manualOrderLineCount} {manualOrderLineCount === 1 ? 'item' : 'items'} selected</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">${manualOrderTotal.toFixed(2)}</p>
                  </div>
                  <Button className="bg-[#303A43] text-white hover:bg-[#1E293B]" onClick={handleCreateSupplierOrder}>
                    Create Order & Invoice
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Inventory status</CardTitle>
            <p className="text-sm text-slate-600">Items from this supplier that may need attention.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Critical</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{supplierLowStockItems.length}</p>
                <p className="text-xs text-slate-500">Below 30% of par</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Below par</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{supplierBelowParItems.length}</p>
                <p className="text-xs text-slate-500">May need replenishment</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">At-risk items</p>
              </div>
              <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                {selectedSupplier ? (
                  supplierBelowParItems.length > 0 ? (
                    supplierBelowParItems.map(item => (
                      <div key={item.id} className="border-b border-slate-100 py-2 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <Badge variant="outline" className={item.currentStock < item.parLevel * 0.3 ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700'}>
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

      <OrderBufferControl value={safetyBufferPercent} onChange={setSafetyBufferPercent} />

      {/* Forecast summary */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="grid grid-cols-2 gap-y-5 py-4 sm:grid-cols-4">
          <div className="px-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggestions</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{effectiveSuggestions.length}</p>
          </div>
          <div className="px-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Critical</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{effectiveSuggestions.filter(s => s.priority === 'critical').length}</p>
          </div>
          <div className="px-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">High priority</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{effectiveSuggestions.filter(s => s.priority === 'high').length}</p>
          </div>
          <div className="px-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated total</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">${effectiveSuggestions.reduce((sum, s) => sum + s.totalCost, 0).toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Selection Actions */}
      {effectiveSuggestions.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">
                    {selectedCount} items selected
                  </p>
                  <p className="text-sm text-slate-500">
                    Estimated total ${totalOrderCost.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
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
              {selectedCount > 0 && <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1 bg-[#303A43] text-white hover:bg-[#1E293B]" onClick={handleApproveOrders}>
                  <Check className="mr-2 h-4 w-4" />
                  Approve {selectedCount} {selectedCount === 1 ? 'order' : 'orders'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={generateEmails}>
                  <Mail className="mr-2 h-4 w-4" />
                  Prepare supplier emails
                </Button>
              </div>}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCount > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Order review</p>
                <p className="text-xs text-slate-500">Approval creates one order and invoice for each supplier below.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {selectedApprovalGroups.length} supplier{selectedApprovalGroups.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {selectedApprovalGroups.map(group => (
                <div key={group.supplier} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{group.supplier}</p>
                    <p className="text-xs font-semibold text-gray-600">{group.itemCount} item{group.itemCount === 1 ? '' : 's'} • ${group.totalCost.toFixed(2)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {group.items.map(item => (
                      <span key={item.itemId} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
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
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-semibold text-slate-950">Recommended orders</h3>
          <p className="mt-0.5 text-xs text-slate-500">{showAllSuggestions ? 'Showing every forecast suggestion' : 'Showing the items that need attention first'}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAllSuggestions(!showAllSuggestions)}
          className="text-xs"
        >
          {showAllSuggestions ? 'Priority only' : 'Show all'}
        </Button>
      </div>

      {/* Order Suggestions List */}
      <div className="space-y-3">
        {displayedSuggestions.length === 0 ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100"><Check className="h-5 w-5 text-slate-600" /></div>
              <p className="text-lg font-semibold text-slate-950">Inventory is on track</p>
              <p className="mt-1 text-sm text-slate-500">
                No urgent orders are needed based on current inventory levels.
              </p>
            </CardContent>
          </Card>
        ) : (
          displayedSuggestions.map((suggestion) => {
            const isSelected = selectedSuggestions.has(suggestion.itemId);
            return (
              <Card
                key={suggestion.itemId}
                className={`cursor-pointer border-slate-200 shadow-sm transition-all hover:border-slate-300 ${
                  isSelected ? 'border-[#303A43] bg-slate-50 ring-1 ring-[#303A43]' : 'bg-white'
                }`}
                onClick={() => toggleSelection(suggestion.itemId)}
              >
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{suggestion.itemName}</h3>
                          <Badge className={`${getPriorityBadgeColor(suggestion.priority)} border text-[10px]`}>
                            {suggestion.priority.toUpperCase()}
                          </Badge>
                        </div>
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
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="flex items-start space-x-2">
                        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-700">{suggestion.reasoning}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Forecast confidence {(suggestion.confidence * 100).toFixed(0)}%
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

                    {suggestion.bufferPercent !== undefined && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-amber-900">Forecast buffer</span>
                          <span className="font-black text-amber-900">
                            +{suggestion.bufferQuantity || 0} {suggestion.unit} ({suggestion.bufferPercent}%)
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-amber-900/70">
                          Base suggestion {suggestion.baseSuggestedQuantity ?? suggestion.suggestedQuantity} {suggestion.unit}; final quantity remains editable before approval.
                        </p>
                      </div>
                    )}

                    {/* Days Until Stockout */}
                    {suggestion.daysUntilStockout < 7 && (
                      <div className="flex items-center space-x-2 rounded border border-red-200 p-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <p className="text-xs font-medium text-red-800">
                          {suggestion.daysUntilStockout} days until projected stockout
                        </p>
                      </div>
                    )}

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="flex items-center justify-center space-x-2 rounded bg-[#303A43] p-2 text-white">
                        <Check className="h-4 w-4" />
                        <p className="text-xs font-semibold">Selected for ordering</p>
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
              <Mail className="mr-2 h-5 w-5 text-slate-600" />
              Supplier email drafts ({draftEmails.length})
            </DialogTitle>
            <DialogDescription>
              Review each draft before sending it to the supplier.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <Button
              onClick={sendAllDraftEmails}
              disabled={sendingAllEmails || draftEmails.length === 0}
              className="w-full bg-[#303A43] text-white hover:bg-[#1E293B]"
            >
              <Mail className="w-4 h-4 mr-2" />
              {sendingAllEmails ? 'Sending all...' : 'Send All Emails'}
            </Button>
          </div>
          <div className="space-y-4 pt-4">
            {draftEmails.map((email, idx) => (
              <Card key={email.supplier} className="overflow-hidden">
                <CardHeader className="border-b border-slate-200 bg-slate-50 pb-3">
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
                        className="border-[#303A43] bg-white font-semibold text-[#303A43] hover:bg-gray-100"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEmailClient(email)}
                        disabled={sendingAllEmails}
                        className="border-[#303A43] bg-white font-semibold text-[#303A43] hover:bg-gray-100"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Open Email
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">CC recipients</label>
                    <input
                      type="text"
                      value={email.ccText}
                      onChange={(event) => updateDraftEmailField(email.supplier, 'ccText', event.target.value)}
                      placeholder="chef@restaurant.ca, manager@restaurant.ca"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500">Supplier defaults are included automatically. Edit this list for this order only.</p>
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
