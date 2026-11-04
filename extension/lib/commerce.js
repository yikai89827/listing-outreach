/**
 * Checkout / pricing — replace CHECKOUT_URL with your Lemon Squeezy link.
 * Example: https://yourstore.lemonsqueezy.com/checkout/buy/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const CHECKOUT_URL = '';

export const PRICING = {
  productName: 'Listing Outreach Pro',
  // Display only — actual charge is set in Lemon Squeezy
  priceLabel: '$29',
  billingLabel: 'one-time',
};

export function isCheckoutConfigured() {
  return /^https:\/\//i.test(String(CHECKOUT_URL || '').trim());
}

export async function openCheckout() {
  const url = String(CHECKOUT_URL || '').trim();
  if (!/^https:\/\//i.test(url)) {
    return { ok: false, error: 'Checkout URL not set yet. See docs/lemonsqueezy-checklist.md' };
  }
  await chrome.tabs.create({ url });
  return { ok: true };
}
