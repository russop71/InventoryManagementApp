export function getSupplierEmailAddress(supplierName, suppliers = []) {
  const normalized = String(supplierName || '').trim().toLowerCase();
  const matchedSupplier = suppliers.find(supplier => supplier.name.trim().toLowerCase() === normalized);
  return matchedSupplier?.email?.trim() || '';
}

export function getSupplierCcEmails(supplierName, suppliers = []) {
  const normalized = String(supplierName || '').trim().toLowerCase();
  const matchedSupplier = suppliers.find(supplier => supplier.name.trim().toLowerCase() === normalized);
  const values = Array.isArray(matchedSupplier?.ccEmails) ? matchedSupplier.ccEmails : [];
  return [...new Set(values.map(email => String(email).trim().toLowerCase()).filter(Boolean))];
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

    const supplierEmail = getSupplierEmailAddress(supplier, suppliers);
    return {
      supplier,
      supplierEmail,
      ccEmails: getSupplierCcEmails(supplier, suppliers),
      canSend: Boolean(supplierEmail),
      items,
      totalCost,
      emailBody: `Hi ${supplier},\n\nPlease send the following items for ${restaurantName}:\n\n${items.map(item => `${item.itemName} - ${item.suggestedQuantity} ${item.unit || 'ea'}`).join('\n')}\n\n${urgentItems > 0 ? `Priority items included: ${urgentItems}\n\n` : ''}Thank you`,
      emailSubject: `Order Request - ${restaurantName} (${today})`,
    };
  });
}
