import { Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { InventoryService, inventoryService } from './inventory.service';

export class InventoryController {
  constructor(private service: InventoryService = inventoryService) {}

  adjustStock = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?._id;
    const result = await this.service.adjustStock({
      ...req.body,
      userId,
    });
    return ApiResponse.success(res, result, 'Inventory adjusted successfully');
  });

  getLogs = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const logs = await this.service.getLogs(productId as string);
    return ApiResponse.success(res, logs);
  });
}

export const inventoryController = new InventoryController();

