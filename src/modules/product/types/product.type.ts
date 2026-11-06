import { OptionDisplayType, IOptionValue } from '../models/product-option.model';
import { ProductStatus, IProductAttribute, IProductDimensions } from '../models/product.model';

export interface ICreateProduct {
  name: string;
  description?: string;
  brand?: string;
  image?: string;
  images?: string[];
  categoryId: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  stock?: number;
  attributes?: IProductAttribute[];
  tags?: string[];
  weight?: number;
  dimensions?: IProductDimensions;
  status?: ProductStatus;
  isFeatured?: boolean;
}

export interface IUpdateProduct {
  name?: string;
  description?: string;
  brand?: string;
  image?: string;
  images?: string[];
  categoryId?: string;
  price?: number;
  originalPrice?: number;
  discount?: number;
  stock?: number;
  attributes?: IProductAttribute[];
  tags?: string[];
  weight?: number;
  dimensions?: IProductDimensions;
  status?: ProductStatus;
  isFeatured?: boolean;
  isActive?: boolean;
}

export interface ICreateProductOption {
  productId: string;
  name: string;
  type?: OptionDisplayType;
  isRequired?: boolean;
  description?: string;
  values: IOptionValue[];
  position?: number;
}

export interface IUpdateProductOption {
  name?: string;
  type?: OptionDisplayType;
  isRequired?: boolean;
  description?: string;
  values?: IOptionValue[];
  position?: number;
  isActive?: boolean;
}

export interface ICreateProductVariant {
  productId: string;
  sku: string;
  barcode?: string;
  size?: string;
  color?: string;
  colorCode?: string;
  optionValues?: Record<string, string>;
  price: number;
  originalPrice?: number;
  stock?: number;
  image?: string;
  weight?: number;
}

export interface IUpdateProductVariant {
  sku?: string;
  barcode?: string;
  size?: string;
  color?: string;
  colorCode?: string;
  optionValues?: Record<string, string>;
  price?: number;
  originalPrice?: number;
  stock?: number;
  image?: string;
  weight?: number;
  isActive?: boolean;
}

export interface IProductFilter {
  categoryId?: string;
  keyword?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStock?: boolean;
  isFeatured?: boolean;
  status?: ProductStatus;
  isActive?: boolean;
}
