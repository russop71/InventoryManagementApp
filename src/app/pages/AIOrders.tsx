import { useState, useMemo } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Sparkles, TrendingUp, Calendar, DollarSign, Package, Check, X, AlertCircle, Mail, Copy } from 'lucide-react';
import { toast } from 'sonner';

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
  items: OrderSuggestion[];
  totalCost: number;
  emailBody: string;
  emailSubject: string;
}

export function AIOrders() {
  const { inventory, addInventoryItem, updateInventoryItem } = useInventory();
  const { salesData } = useToast();
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [draftEmails, setDraftEmails] = useState<SupplierEmail[]>([]);

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
      
      // Estimate daily usage based on stock level and category
      let estimatedDailyUsage = 0;
      if (item.category === 'Proteins') {
        estimatedDailyUsage = item.parLevel * 0.15; // 15% of par per day
      } else if (item.category === 'Produce') {
        estimatedDailyUsage = item.parLevel * 0.20; // 20% of par per day (higher turnover)
      } else if (item.category === 'Dairy') {
        estimatedDailyUsage = item.parLevel * 0.12;
      } else {
        estimatedDailyUsage = item.parLevel * 0.10;
      }

      // Adjust for sales trends
      if (salesTrend > 0.1) {
        estimatedDailyUsage *= 1.2; // 20% increase if sales are trending up
      } else if (salesTrend < -0.1) {
        estimatedDailyUsage *= 0.85; // 15% decrease if sales are trending down
      }

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
        reasoning = `Critical: Only ${daysUntilStockout} days of stock remaining`;
        confidence = 0.95;
      } else if (daysUntilStockout <= 4) {
        shouldOrder = true;
        priority = 'high';
        reasoning = `High priority: ${daysUntilStockout} days until stockout`;
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
  }, [inventory, salesData]);

  const displayedSuggestions = showAllSuggestions 
    ? orderSuggestions 
    : orderSuggestions.filter(s => s.priority === 'critical' || s.priority === 'high');

  const totalOrderCost = displayedSuggestions
    .filter(s => selectedSuggestions.has(s.itemId))
    .reduce((sum, s) => sum + s.totalCost, 0);

  const selectedCount = selectedSuggestions.size;

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

  const handleApproveOrders = () => {
    const ordersToPlace = orderSuggestions.filter(s => selectedSuggestions.has(s.itemId));
    
    ordersToPlace.forEach(order => {
      updateInventoryItem(order.itemId, {
        currentStock: order.currentStock + order.suggestedQuantity,
        lastUpdated: new Date().toISOString().split('T')[0],
      });
    });

    toast.success(`✓ ${ordersToPlace.length} orders approved and stock updated`);
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
    const ordersToPlace = orderSuggestions.filter(s => selectedSuggestions.has(s.itemId));
    
    // Group orders by supplier
    const supplierMap: { [key: string]: OrderSuggestion[] } = {};
    ordersToPlace.forEach(suggestion => {
      if (!supplierMap[suggestion.supplier]) {
        supplierMap[suggestion.supplier] = [];
      }
      supplierMap[suggestion.supplier].push(suggestion);
    });

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Supplier email mapping
    const supplierEmails: { [key: string]: string } = {
      'US Foods': 'orders@usfoods.com',
      'Sysco': 'orders@sysco.com',
      'Gordon Food Service': 'sales@gfs.com',
      'Ontario Seafood': 'fresh@ontarioseafood.ca',
      'Fresh Valley Farms': 'orders@freshvalley.ca',
      'Restaurant Depot': 'orders@restaurantdepot.com',
    };

    const emails: SupplierEmail[] = Object.keys(supplierMap).map(supplier => {
      const items = supplierMap[supplier];
      const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
      
      // Count critical/high priority items
      const urgentItems = items.filter(i => i.priority === 'critical' || i.priority === 'high').length;
      
      const emailBody = `Subject: Order Request - 86'D Restaurant (${today})

Dear ${supplier} Team,

We'd like to place the following order for 86'D Restaurant:

ORDER DETAILS:
${items.map((item, idx) => 
  `${idx + 1}. ${item.itemName}
   Quantity: ${item.suggestedQuantity} ${item.unit}
   Unit Price: $${item.unitCost.toFixed(2)}
   Line Total: $${item.totalCost.toFixed(2)}
   ${item.priority === 'critical' ? '   ⚠️ URGENT - Low Stock' : item.priority === 'high' ? '   Priority Item' : ''}`
).join('\n\n')}

TOTAL ORDER VALUE: $${totalCost.toFixed(2)}

${urgentItems > 0 ? `⚠️ URGENT: ${urgentItems} item(s) marked as high priority due to low stock levels.\n` : ''}
Please confirm availability and estimated delivery date at your earliest convenience.

Thank you for your continued partnership.

Best regards,
86'D Restaurant
Kitchen Management Team`;

      return {
        supplier,
        supplierEmail: supplierEmails[supplier] || 'orders@supplier.com',
        items,
        totalCost,
        emailBody,
        emailSubject: `Order Request - 86'D Restaurant (${today})`,
      };
    });

    setDraftEmails(emails);
    setShowEmailDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Email copied to clipboard!');
  };

  const openEmailClient = (email: SupplierEmail) => {
    const mailtoLink = `mailto:${email.supplierEmail}?subject=${encodeURIComponent(email.emailSubject)}&body=${encodeURIComponent(email.emailBody)}`;
    window.location.href = mailtoLink;
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
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border-[#0F172A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-white">Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-white mb-2">{orderSuggestions.length}</div>
            <div className="text-xs text-white space-y-1">
              <p className="whitespace-nowrap">{orderSuggestions.filter(s => s.priority === 'critical').length} critical</p>
              <p className="whitespace-nowrap">{orderSuggestions.filter(s => s.priority === 'high').length} high</p>
              <p className="whitespace-nowrap">{orderSuggestions.filter(s => s.priority === 'medium').length} medium</p>
              <p className="whitespace-nowrap">{orderSuggestions.filter(s => s.priority === 'low').length} low</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0F172A] border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-slate-400">Est. Cost</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-white mb-2">
              ${orderSuggestions.reduce((sum, s) => sum + s.totalCost, 0).toFixed(2)}
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
                        <p className="text-sm font-medium text-gray-700">
                          {suggestion.suggestedQuantity} {suggestion.unit}
                        </p>
                        <p className="text-xs text-gray-500">${suggestion.totalCost.toFixed(2)}</p>
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
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
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
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => copyToClipboard(email.emailBody)}
                        className="bg-[#0F172A] hover:bg-[#1E293B]"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openEmailClient(email)}
                        className="bg-[#0F172A] hover:bg-[#1E293B]"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Open Email
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                      {email.emailBody}
                    </pre>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
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