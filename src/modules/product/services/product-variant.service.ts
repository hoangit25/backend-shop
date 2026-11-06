import { AppError } from '../../../common/appError';
import { ProductVariantRepository, productVariantRepository } from '../repositories/product-variant.repository';
import { ProductRepository, productRepository } from '../repositories/product.repository';
import { PRODUCT_MESSAGES } from '../constants/product.constant';
import { ICreateProductVariant, IUpdateProductVariant } from '../types/product.type';

export class ProductVariantService {
  constructor(
    private variantRepo: ProductVariantRepository = productVariantRepository,
    private productRepo: ProductRepository = productRepository
  ) {}

  async createVariant(productId: string, data: ICreateProductVariant) {
    const product = await this.productRepo.findById(productId);
    if (!product || product.deleted) {
      throw AppError.NotFound(PRODUCT_MESSAGES.PRODUCT_NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }

    const skuUpper = data.sku.toUpperCase();

    // Kiểm tra tính duy nhất của SKU
    const existingSku = await this.variantRepo.findBySku(skuUpper);
    if (existingSku) {
      throw AppError.Conflict(PRODUCT_MESSAGES.VARIANT_SKU_EXISTS, 'SKU_EXISTS');
    }

    const variant = await this.variantRepo.create({
      ...data,
      sku: skuUpper,
      productId: product._id,
    });

    // Cập nhật tổng tồn kho của sản phẩm cha khi thêm variant có stock
    if (data.stock && data.stock > 0) {
      await this.productRepo.updateStock(productId, data.stock);
    }

    return variant;
  }

  async getVariantsByProductId(productId: string) {
    return this.variantRepo.findActiveByProductId(productId);
  }

  async getVariantById(variantId: string) {
    const variant = await this.variantRepo.findById(variantId);
    if (!variant || variant.deleted) {
      throw AppError.NotFound(PRODUCT_MESSAGES.VARIANT_NOT_FOUND, 'VARIANT_NOT_FOUND');
    }
    return variant;
  }

  /**
   * Tra cứu biến thể theo Size, Color hoặc OptionValues khi khách hàng click chọn trên giao diện
   */
  async findVariant(
    productId: string,
    params: { size?: string; color?: string; optionValues?: Record<string, string> }
  ) {
    const variant = await this.variantRepo.findBySizeAndColor(productId, params);
    if (!variant) {
      throw AppError.NotFound(PRODUCT_MESSAGES.VARIANT_MATCH_NOT_FOUND, 'VARIANT_NOT_FOUND');
    }
    return variant;
  }

  async updateVariant(productId: string, variantId: string, data: IUpdateProductVariant) {
    const variant = await this.variantRepo.findById(variantId);
    if (!variant || variant.deleted || variant.productId.toString() !== productId) {
      throw AppError.NotFound(PRODUCT_MESSAGES.VARIANT_NOT_FOUND, 'VARIANT_NOT_FOUND');
    }

    const updateData: any = { ...data };

    // Kiểm tra SKU nếu cập nhật SKU mới
    if (data.sku) {
      const skuUpper = data.sku.toUpperCase();
      if (skuUpper !== variant.sku) {
        const existingSku = await this.variantRepo.findBySku(skuUpper);
        if (existingSku) {
          throw AppError.Conflict(PRODUCT_MESSAGES.VARIANT_SKU_EXISTS, 'SKU_EXISTS');
        }
        updateData.sku = skuUpper;
      }
    }

    // Nếu thay đổi stock của variant -> cân chỉnh lại tổng stock của product cha
    if (data.stock !== undefined && data.stock !== variant.stock) {
      const diff = data.stock - variant.stock;
      await this.productRepo.updateStock(productId, diff);
    }

    const updated = await this.variantRepo.updateById(variantId, updateData);
    return updated;
  }

  async deleteVariant(productId: string, variantId: string) {
    const variant = await this.variantRepo.findById(variantId);
    if (!variant || variant.deleted || variant.productId.toString() !== productId) {
      throw AppError.NotFound(PRODUCT_MESSAGES.VARIANT_NOT_FOUND, 'VARIANT_NOT_FOUND');
    }

    await this.variantRepo.softDelete(variantId);

    // Trừ stock của variant đã xóa khỏi product cha
    if (variant.stock > 0) {
      await this.productRepo.updateStock(productId, -variant.stock);
    }

    return { message: PRODUCT_MESSAGES.VARIANT_DELETED };
  }
}

export const productVariantService = new ProductVariantService();
