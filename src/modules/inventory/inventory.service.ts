import { Types } from 'mongoose';
import { AppError } from '../../common/appError';
import { InventoryRepository, inventoryRepository } from './inventory.repository';
import { ProductRepository, productRepository } from '../product/repositories/product.repository';
import { ProductVariantRepository, productVariantRepository } from '../product/repositories/product-variant.repository';
import { InventoryTransactionType } from './inventory.model';
import { cacheService } from '../../config/redis.config';

export interface IStockAdjustmentDto {
  productId: string;
  variantId?: string;
  type: InventoryTransactionType;
  quantity: number; // Số lượng thay đổi (dương khi nhập, âm khi xuất)
  reason?: string;
  referenceId?: string;
  userId?: string;
}

export class InventoryService {
  constructor(
    private repository: InventoryRepository = inventoryRepository,
    private productRepo: ProductRepository = productRepository,
    private variantRepo: ProductVariantRepository = productVariantRepository
  ) {}

  /**
   * Điều chỉnh tồn kho và ghi nhật ký lịch sử
   */
  async adjustStock(dto: IStockAdjustmentDto) {
    const { productId, variantId, type, quantity, reason, referenceId, userId } = dto;

    let previousStock = 0;
    let newStock = 0;

    if (variantId) {
      const variant = await this.variantRepo.findById(variantId);
      if (!variant || variant.deleted) {
        throw AppError.NotFound('Variant not found', 'VARIANT_NOT_FOUND');
      }

      previousStock = variant.stock;
      newStock = previousStock + quantity;
      if (newStock < 0) {
        throw AppError.BadRequest('Insufficient variant inventory', 'INSUFFICIENT_STOCK');
      }

      await this.variantRepo.updateStock(variantId, quantity);
      // Đồng bộ stock sản phẩm cha
      await this.productRepo.updateStock(productId, quantity);
    } else {
      const product = await this.productRepo.findById(productId);
      if (!product || product.deleted) {
        throw AppError.NotFound('Product not found', 'PRODUCT_NOT_FOUND');
      }

      previousStock = product.stock;
      newStock = previousStock + quantity;
      if (newStock < 0) {
        throw AppError.BadRequest('Insufficient product inventory', 'INSUFFICIENT_STOCK');
      }

      await this.productRepo.updateStock(productId, quantity);
    }

    // Ghi nhật ký Inventory Log
    const log = await this.repository.create({
      productId: new Types.ObjectId(productId),
      variantId: variantId ? new Types.ObjectId(variantId) : undefined,
      type,
      quantityChange: quantity,
      previousStock,
      newStock,
      reason: reason || '',
      referenceId: referenceId || '',
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    // Invalidate product caches
    await cacheService.delPattern('products:*');

    return {
      log,
      previousStock,
      newStock,
    };
  }

  async getLogs(productId: string) {
    return this.repository.getLogsByProduct(productId);
  }
}

export const inventoryService = new InventoryService();

