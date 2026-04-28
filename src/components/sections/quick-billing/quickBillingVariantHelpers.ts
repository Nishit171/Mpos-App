/**
 * Helpers for Quick Billing “+ next variant” flow: numbered names, SKU/HSN stubs, search pick.
 */

/** "Shirt 1" → "Shirt 2"; "Product" → "Product 2" */
export function getNextNumberedProductName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^(.+?)\s+(\d+)\s*$/i);
  if (m) {
    const n = parseInt(m[2], 10);
    if (!Number.isNaN(n)) return `${m[1].trim()} ${n + 1}`;
  }
  return `${trimmed} 2`;
}

type VariantSearchItem = {
  name?: string;
} & Record<string, unknown>;

const norm = (s: string) => s.trim().toLowerCase();

/** Pick the best cart row from search results for a variant label. */
export function pickCartItemForVariant(
  items: VariantSearchItem[],
  nextLabel: string,
): VariantSearchItem | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const t = norm(nextLabel);
  const exact = items.find(it => norm(String(it?.name ?? '')) === t);
  if (exact) return exact;
  const includes = items.find(it => norm(String(it?.name ?? '')).includes(t));
  if (includes) return includes;
  return items[0] ?? null;
}

export function randomSkuNumber(): number {
  return Math.floor(100000 + Math.random() * 900000);
}

export function randomHsnCode(): number {
  return Math.floor(10000000 + Math.random() * 90000000);
}
