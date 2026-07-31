const FALLBACK_EMAILS = {
  'US Foods': 'orders@usfoods.com',
  Sysco: 'orders@sysco.com',
  'Gordon Food Service': 'sales@gfs.com',
  'Ontario Seafood': 'fresh@ontarioseafood.ca',
  'Fresh Valley Farms': 'orders@freshvalley.ca',
  'Restaurant Depot': 'orders@restaurantdepot.com',
  Woodward: 'orderdesk@woodwardmeats.com',
  'Daily Seafood': 'order@dailyseafood.ca',
  Eccolo: 'orderdesk@eccolo.ca',
  'Bondi Produce': '',
};

export function getSupplierEmailAddress(supplierName, suppliers = []) {
  const normalized = String(supplierName || '').trim().toLowerCase();
  const matchedSupplier = suppliers.find(supplier => supplier.name.trim().toLowerCase() === normalized);
  if (matchedSupplier?.email?.trim()) return matchedSupplier.email.trim();
  return FALLBACK_EMAILS[supplierName] || FALLBACK_EMAILS[supplierName?.trim()] || 'orders@supplier.com';
}

export function buildSupplierEmailDrafts({ restaurantName, suggestions, suppliers = [] }) {
  const supplierGroups = suggestions.reduce((groups, suggestion) => {
    const supplier = suggestion.supplier || 'Supplier';
    if (!groups[supplier]) groups[supplier] = [];
    groups[supplier].push(suggestion);
    return groups;
  }, {});

  return Object.entries(supplierGroups).map(([supplier, items]) => {
    const totalCost = items.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
    const urgentItems = items.filter(item => item.priority === 'critical' || item.priority === 'high').length;
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      supplier,
      supplierEmail: getSupplierEmailAddress(supplier, suppliers),
      items,
      totalCost,
      emailBody: `Hi ${supplier},\n\nPlease send the following items for ${restaurantName}:\n\n${items.map(item => `${item.itemName} - ${item.suggestedQuantity} ${item.unit || 'ea'}`).join('\n')}\n\n${urgentItems > 0 ? `Priority items included: ${urgentItems}\n\n` : ''}Thank you`,
      emailSubject: `Order Request - ${restaurantName} (${today})`,
    };
  });
}
