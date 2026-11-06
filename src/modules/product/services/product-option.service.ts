import { AppError } from '../../../common/appError';
import { ProductOptionRepository, productOptionRepository } from '../repositories/product-option.repository';
import { ProductRepository, productRepository } from '../repositories/product.repository';
import { PRODUCT_MESSAGES } from '../constants/product.constant';
import { ICreateProductOption, IUpdateProductOption } from '../types/product.type';

export class ProductOptionService {
  constructor(
    private optionRepo: ProductOptionRepository = productOptionRepository,
    private productRepo: ProductRepository = productRepository
  ) {}

  async createOption(productId: string, data: ICreateProductOption) {
    const product = await this.productRepo.findById(productId);
    if (!product || product.deleted) {
      throw AppError.NotFound(PRODUCT_MESSAGES.PRODUCT_NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }

    const option = await this.optionRepo.create({
      ...data,
      productId: product._id,
    });

    return option;
  }

  async getOptionsByProductId(productId: string) {
    return this.optionRepo.findActiveByProductId(productId);
  }

  async updateOption(productId: string, optionId: string, data: IUpdateProductOption) {
    const option = await this.optionRepo.findById(optionId);
    if (!option || option.deleted || option.productId.toString() !== productId) {
      throw AppError.NotFound(PRODUCT_MESSAGES.OPTION_NOT_FOUND, 'OPTION_NOT_FOUND');
    }

    const updated = await this.optionRepo.updateById(optionId, data);
    return updated;
  }

  async deleteOption(productId: string, optionId: string) {
    const option = await this.optionRepo.findById(optionId);
    if (!option || option.deleted || option.productId.toString() !== productId) {
      throw AppError.NotFound(PRODUCT_MESSAGES.OPTION_NOT_FOUND, 'OPTION_NOT_FOUND');
    }

    await this.optionRepo.softDelete(optionId);
    return { message: PRODUCT_MESSAGES.OPTION_DELETED };
  }
}

export const productOptionService = new ProductOptionService();

