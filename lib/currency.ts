/**
 * Currency conversion using the Frankfurter API (free, no API key).
 * Rates are cached in-memory for 24 hours on the server.
 */

interface RatesCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
let cache: RatesCache | null = null;

/**
 * Fetch exchange rates from Frankfurter API with the given base currency.
 * Returns a map like { "USD": 0.0178, "CAD": 0.0243, "PHP": 1 } when base is PHP.
 */
async function fetchRates(base: string): Promise<Record<string, number>> {
  const res = await fetch(
    `https://api.frankfurter.dev/v1/latest?base=${base}`,
    { next: { revalidate: 86400 } } // Next.js cache: 24h
  );

  if (!res.ok) {
    console.error(`Frankfurter API error: ${res.status}`);
    return {};
  }

  const data = await res.json();
  return data.rates ?? {};
}

/**
 * Get exchange rates with the given base currency.
 * Uses in-memory cache (24h TTL) to avoid repeated API calls.
 */
export async function getExchangeRates(
  base: string = "PHP"
): Promise<Record<string, number>> {
  const now = Date.now();

  if (cache && cache.base === base && now - cache.fetchedAt < CACHE_TTL) {
    return cache.rates;
  }

  const rates = await fetchRates(base);

  // The base currency isn't included in the response — add it
  rates[base] = 1;

  cache = { base, rates, fetchedAt: now };
  return rates;
}

/**
 * Convert an amount from one currency to the target currency.
 * `rates` should be fetched via `getExchangeRates(targetCurrency)`.
 *
 * Example: convertAmount(100, "USD", rates) where rates base is PHP
 *  → returns 100 / rates["USD"] (since rates["USD"] = how many USD per 1 PHP)
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  rates: Record<string, number>
): number {
  if (!fromCurrency || fromCurrency === Object.keys(rates).find((k) => rates[k] === 1)) {
    return amount;
  }

  const rate = rates[fromCurrency];
  if (!rate) {
    // Unknown currency — return as-is
    return amount;
  }

  // rates are "1 BASE = X FOREIGN", so to convert FOREIGN → BASE: amount / rate
  return amount / rate;
}

/**
 * Sum an array of { amount, currency } objects, converting everything to the target currency.
 */
export function sumConverted(
  items: { amount: number; currency: string }[],
  rates: Record<string, number>
): number {
  return items.reduce(
    (sum, item) => sum + convertAmount(item.amount, item.currency, rates),
    0
  );
}
