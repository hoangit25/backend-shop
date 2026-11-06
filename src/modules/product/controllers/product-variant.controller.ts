import { Request, Response } from 'express';
import { ApiResponse } from '../../../common/api.responsitory';
import { asyncHandler } from '../../../common/asycn.handel';
import { ProductVariantService, productVariantService } from '../services/product-variant.service';
import { PRODUCT_MESSAGES } from '../constants/product.constant';

export class ProductVariantController {
  constructor(private service: ProductVariantService = productVariantService) {}

  createVariant = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const variant = await this.service.createVariant(productId, {
      ...req.body,
      productId,
    });
    return ApiResponse.created(res, variant, PRODUCT_MESSAGES.VARIANT_CREATED);
  });

  getVariants = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const variants = await this.service.getVariantsByProductId(productId);
    return ApiResponse.success(res, variants);
  });

  getVariantById = asyncHandler(async (req: Request, res: Response) => {
    const variantId = req.params.variantId as string;
    const variant = await this.service.getVariantById(variantId);
    return ApiResponse.success(res, variant);
  });

  /**
   * Tra cứu variant theo size, color hoặc optionValues
   */
  findVariant = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const { size, color, optionValues } = req.body;
    const variant = await this.service.findVariant(productId, { size, color, optionValues });
    return ApiResponse.success(res, variant);
  });

  updateVariant = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const variantId = req.params.variantId as string;
    const variant = await this.service.updateVariant(productId, variantId, req.body);
    return ApiResponse.success(res, variant, PRODUCT_MESSAGES.VARIANT_UPDATED);
  });

  deleteVariant = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const variantId = req.params.variantId as string;
    const result = await this.service.deleteVariant(productId, variantId);
    return ApiResponse.success(res, result, PRODUCT_MESSAGES.VARIANT_DELETED);
  });
}

export const productVariantController = new ProductVariantController();
