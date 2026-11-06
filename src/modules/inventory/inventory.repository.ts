import { BaseRepository } from '../../common/base-responsitory';
import InventoryLogModel, { IInventoryLog } from './inventory.model';

export class InventoryRepository extends BaseRepository<IInventoryLog> {
  constructor() {
    super(InventoryLogModel);
  }

  async getLogsByProduct(productId: string) {
    return this.find({ productId }, null, { sort: { createdAt: -1 } });
  }

  async getLogsByVariant(variantId: string) {
    return this.find({ variantId }, null, { sort: { createdAt: -1 } });
  }
}

export const inventoryRepository = new InventoryRepository();

