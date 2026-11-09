/**
 * Hands the just-placed order's email from checkout to the tracking page without putting it
 * in the URL, where browser history and analytics (page_location) would record it.
 * Lives only in this tab's sessionStorage.
 */
const KEY = "reelmark_last_order";

export function rememberLastOrder(orderNumber: string, email: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ orderNumber, email }));
  } catch {
    // Storage blocked: the shopper can still type their email to track the order.
  }
}

export function lastOrderEmail(orderNumber: string): string | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as {
      orderNumber?: unknown;
      email?: unknown;
    } | null;
    return saved?.orderNumber === orderNumber && typeof saved.email === "string"
      ? saved.email
      : null;
  } catch {
    return null;
  }
}
