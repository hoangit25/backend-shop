import { BaseRepository } from '../../common/base-responsitory';
import BannerModel, { IBanner } from './banner.model';

export class BannerRepository extends BaseRepository<IBanner> {
  constructor() {
    super(BannerModel);
  }

  async findByPlacement(placement?: string) {
    const filter: any = { deleted: false, isActive: true };
    if (placement) {
      filter.placement = placement;
    }
    return this.find(filter, null, { sort: { position: 1, createdAt: -1 } });
  }
}

export const bannerRepository = new BannerRepository();
