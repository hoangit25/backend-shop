import { AppError } from '../../common/appError';
import { BannerRepository, bannerRepository } from './banner.repository';
import { cacheService } from '../../config/redis.config';

const DEFAULT_HOME_HERO_BANNERS = [
  {
    title: '11.11',
    subtitle: 'Adidas Mua Sắm Mùa Lễ Hội',
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=2070&auto=format&fit=crop',
    alt: 'Ưu đãi mua sắm giày thể thao',
    date: 'DUY NHẤT 29.10',
    discount: '30% +',
    voucher: '20%',
    link: '/products',
    placement: 'home_hero',
    position: 1,
    isActive: true,
  },
  {
    title: 'SALE 50%',
    subtitle: 'Phụ Kiện Thời Trang Cao Cấp',
    image:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=2070&auto=format&fit=crop',
    alt: 'Ưu đãi đồng hồ và phụ kiện',
    date: 'ƯU ĐÃI ĐẶC BIỆT',
    discount: '50%',
    voucher: '15%',
    link: '/products',
    placement: 'home_hero',
    position: 2,
    isActive: true,
  },
  {
    title: 'MEGA SALE',
    subtitle: 'Săn Deal Thời Trang Mùa Lễ Hội',
    image:
      'https://images.unsplash.com/photo-1556906781-9a412961c28c?q=80&w=2070&auto=format&fit=crop',
    alt: 'Ưu đãi thời trang và giày dép',
    date: 'DEAL HOT MỖI NGÀY',
    discount: '40% +',
    voucher: '25%',
    link: '/products',
    placement: 'home_hero',
    position: 3,
    isActive: true,
  },
];

export class BannerService {
  constructor(private repository: BannerRepository = bannerRepository) {}

  async getBanners(filter: { placement?: string; isActive?: boolean } = {}) {
    const cacheKey = `banners:${filter.placement || 'all'}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    let banners = await this.repository.findByPlacement(filter.placement);

    // Tự động seed dữ liệu mẫu ban đầu nếu placement là home_hero và chưa có banner nào trong DB
    if (
      (!banners || banners.length === 0) &&
      (!filter.placement || filter.placement === 'home_hero')
    ) {
      await this.repository.insertMany(DEFAULT_HOME_HERO_BANNERS as any);
      banners = await this.repository.findByPlacement(filter.placement);
    }

    await cacheService.set(cacheKey, banners, 300); // 5 phút cache
    return banners;
  }

  async getBannerById(id: string) {
    const banner = await this.repository.findById(id);
    if (!banner || banner.deleted) {
      throw AppError.NotFound('Banner not found', 'BANNER_NOT_FOUND');
    }
    return banner;
  }

  async createBanner(data: any) {
    const banner = await this.repository.create(data);
    await cacheService.delPattern('banners:*');
    return banner;
  }

  async updateBanner(id: string, data: any) {
    const banner = await this.repository.findById(id);
    if (!banner || banner.deleted) {
      throw AppError.NotFound('Banner not found', 'BANNER_NOT_FOUND');
    }
    const updated = await this.repository.updateById(id, data);
    await cacheService.delPattern('banners:*');
    return updated;
  }

  async deleteBanner(id: string) {
    const banner = await this.repository.findById(id);
    if (!banner || banner.deleted) {
      throw AppError.NotFound('Banner not found', 'BANNER_NOT_FOUND');
    }
    await this.repository.softDelete(id);
    await cacheService.delPattern('banners:*');
    return { id, deleted: true };
  }
}

export const bannerService = new BannerService();
