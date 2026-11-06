export const OPTION_DISPLAY_TYPES = ['TEXT', 'COLOR', 'IMAGE', 'DROPDOWN'] as const;
export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'ARCHIVED'] as const;

export const PRODUCT_CONSTANTS = {
  MAX_NAME_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 10000,
  MAX_IMAGES: 15,
  MAX_OPTIONS: 5,
  MAX_OPTION_VALUES: 50,
  MAX_VARIANTS: 100,
  MIN_PRICE: 0,
  MAX_PRICE: 999999999,
  MAX_DISCOUNT: 100,
  MIN_DISCOUNT: 0,
  DEFAULT_STOCK: 0,
  SKU_MAX_LENGTH: 50,
};

export const PRODUCT_MESSAGES = {
  PRODUCT_NOT_FOUND: 'Product not found',
  PRODUCT_CREATED: 'Product created successfully',
  PRODUCT_UPDATED: 'Product updated successfully',
  PRODUCT_DELETED: 'Product deleted successfully',
  PRODUCT_RESTORED: 'Product restored successfully',
  PRODUCT_SLUG_EXISTS: 'Product slug already exists',

  OPTION_NOT_FOUND: 'Product option not found',
  OPTION_CREATED: 'Product option created successfully',
  OPTION_UPDATED: 'Product option updated successfully',
  OPTION_DELETED: 'Product option deleted successfully',

  VARIANT_NOT_FOUND: 'Product variant not found',
  VARIANT_CREATED: 'Product variant created successfully',
  VARIANT_UPDATED: 'Product variant updated successfully',
  VARIANT_DELETED: 'Product variant deleted successfully',
  VARIANT_SKU_EXISTS: 'SKU already exists',
  VARIANT_MATCH_NOT_FOUND: 'No variant matches selected options',
};
