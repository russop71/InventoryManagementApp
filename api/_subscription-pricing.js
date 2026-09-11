export const SUBSCRIPTION_PRICES_CAD_CENTS = Object.freeze({
  firstLocation: 24999,
  additionalLocation: 19999,
  schedulingFirstLocation: 4999,
  schedulingAdditionalLocation: 2499,
});

export function monthlySubscriptionTotalCents(locationCount = 1, schedulingEnabled = false) {
  const count = Math.max(1, Number(locationCount) || 1);
  const additionalLocations = Math.max(0, count - 1);
  return SUBSCRIPTION_PRICES_CAD_CENTS.firstLocation
    + additionalLocations * SUBSCRIPTION_PRICES_CAD_CENTS.additionalLocation
    + (schedulingEnabled
      ? SUBSCRIPTION_PRICES_CAD_CENTS.schedulingFirstLocation
        + additionalLocations * SUBSCRIPTION_PRICES_CAD_CENTS.schedulingAdditionalLocation
      : 0);
}

export function checkoutLineItems({
  basePriceId,
  additionalLocationPriceId,
  schedulingPriceId,
  additionalLocationSchedulingPriceId,
  locationCount = 1,
  schedulingEnabled = false,
}) {
  const count = Math.max(1, Number(locationCount) || 1);
  const additionalLocations = Math.max(0, count - 1);
  return [
    { price: basePriceId, quantity: 1 },
    ...(additionalLocations ? [{ price: additionalLocationPriceId, quantity: additionalLocations }] : []),
    ...(schedulingEnabled ? [{ price: schedulingPriceId, quantity: 1 }] : []),
    ...(schedulingEnabled && additionalLocations
      ? [{ price: additionalLocationSchedulingPriceId, quantity: additionalLocations }]
      : []),
  ];
}

export function addCheckoutLineItems(form, items = []) {
  items.forEach((item, index) => {
    form[`line_items[${index}][price]`] = item.price;
    form[`line_items[${index}][quantity]`] = String(item.quantity);
  });
  return form;
}
