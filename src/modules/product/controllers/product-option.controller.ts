import { Request, Response } from 'express';
import { ApiResponse } from '../../../common/api.responsitory';
import { asyncHandler } from '../../../common/asycn.handel';
import { ProductOptionService, productOptionService } from '../services/product-option.service';
import { PRODUCT_MESSAGES } from '../constants/product.constant';

export class ProductOptionController {
  constructor(private service: ProductOptionService = productOptionService) {}

  createOption = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const option = await this.service.createOption(productId, {
      ...req.body,
      productId,
    });
    return ApiResponse.created(res, option, PRODUCT_MESSAGES.OPTION_CREATED);
  });

  getOptions = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const options = await this.service.getOptionsByProductId(productId);
    return ApiResponse.success(res, options);
  });

  updateOption = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const optionId = req.params.optionId as string;
    const option = await this.service.updateOption(productId, optionId, req.body);
    return ApiResponse.success(res, option, PRODUCT_MESSAGES.OPTION_UPDATED);
  });

  deleteOption = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const optionId = req.params.optionId as string;
    const result = await this.service.deleteOption(productId, optionId);
    return ApiResponse.success(res, result, PRODUCT_MESSAGES.OPTION_DELETED);
  });
}

export const productOptionController = new ProductOptionController();

