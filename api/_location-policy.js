// An active subscription alone is not proof that an added location was paid for.
export function paidAdditionalLocations(subscription, priceId) {
  if (!priceId || subscription?.status !== 'active' || subscription?.pending_update
    || subscription?.latest_invoice?.status !== 'paid') return 0;
  return (subscription.items?.data || []).reduce((total, item) => {
    const quantity = Number(item.quantity);
    return item.price?.id === priceId && Number.isInteger(quantity) && quantity > 0
      ? total + quantity : total;
  }, 0);
}
