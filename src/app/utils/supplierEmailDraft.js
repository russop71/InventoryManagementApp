export function getSupplierEmailAddress(supplierName, suppliers = []) {
  const normalized = String(supplierName || '').trim().toLowerCase();
  const matchedSupplier = suppliers.find(supplier => supplier.name.trim().toLowerCase() === normalized);
  return matchedSupplier?.email?.trim() || '';
}

export function parseEmailList(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[;,\n]/);
  return values
    .map(email => String(email || '').trim().toLowerCase())
    .filter((email, index, emails) => /^\S+@\S+\.\S+$/.test(email) && emails.indexOf(email) === index);
}

export function getInvalidEmailListEntries(value) {
  return String(value || '')
    .split(/[;,\n]/)
    .map(email => email.trim())
    .filter(email => email && !/^\S+@\S+\.\S+$/.test(email));
}

export function getSupplierCcEmails(supplierName, suppliers = [], defaultCc = []) {
  const normalized = String(supplierName || '').trim().toLowerCase();
  const matchedSupplier = suppliers.find(supplier => supplier.name.trim().toLowerCase() === normalized);
  const primaryEmail = matchedSupplier?.email?.trim().toLowerCase() || '';
  return parseEmailList([...(Array.isArray(defaultCc) ? defaultCc : []), ...(matchedSupplier?.ccEmails || [])])
    .filter(email => email !== primaryEmail);
}

export function buildSupplierEmailDrafts({ restaurantName, suggestions, suppliers = [], defaultCc = [] }) {
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
      ccEmails: getSupplierCcEmails(supplier, suppliers, defaultCc),
      canSend: Boolean(supplierEmail),
      items,
      totalCost,
      emailBody: `Hi ${supplier},\n\nPlease send the following items for ${restaurantName}:\n\n${items.map(item => `${item.itemName} - ${item.suggestedQuantity} ${item.unit || 'ea'}`).join('\n')}\n\n${urgentItems > 0 ? `Priority items included: ${urgentItems}\n\n` : ''}Thank you`,
      emailSubject: `Order Request - ${restaurantName} (${today})`,
    };
  });
}
