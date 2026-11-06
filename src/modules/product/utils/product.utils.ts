/**
 * Generate a URL-friendly slug from a product name.
 * E.g. "Áo thun nam Basic" -> "ao-thun-nam-basic-1699999999999"
 */
export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return `${slug}-${Date.now()}`;
}

/**
 * Generate a unique SKU from product name and option values.
 * E.g. ("Áo thun", { color: "Red", size: "M" }) -> "AO-THUN-RED-M"
 */
export function generateSku(
  productName: string,
  optionValues: Record<string, string> = {}
): string {
  const base = productName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toUpperCase();

  const optionPart = Object.values(optionValues)
    .map((v) =>
      v
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
    )
    .join('-');

  return optionPart ? `${base}-${optionPart}` : base;
}

/**
 * Calculate the discounted price.
 */
export function calculateDiscountedPrice(price: number, discount: number): number {
  if (discount <= 0) return price;
  return Math.round(price * (1 - discount / 100) * 100) / 100;
}

