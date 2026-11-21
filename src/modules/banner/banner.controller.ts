import { Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { BannerService, bannerService } from './banner.service';

export class BannerController {
  constructor(private service: BannerService = bannerService) {}

  getBanners = asyncHandler(async (req: Request, res: Response) => {
    const { placement, isActive } = req.query as any;
    const filter: any = {};
    if (placement) filter.placement = placement;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const banners = await this.service.getBanners(filter);
    return ApiResponse.success(res, banners, 'Banners fetched successfully');
  });

  getBannerById = asyncHandler(async (req: Request, res: Response) => {
    const banner = await this.service.getBannerById(req.params.id as string);
    return ApiResponse.success(res, banner);
  });

  createBanner = asyncHandler(async (req: Request, res: Response) => {
    const banner = await this.service.createBanner(req.body);
    return ApiResponse.created(res, banner, 'Banner created successfully');
  });

  updateBanner = asyncHandler(async (req: Request, res: Response) => {
    const banner = await this.service.updateBanner(req.params.id as string, req.body);
    return ApiResponse.success(res, banner, 'Banner updated successfully');
  });

  deleteBanner = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteBanner(req.params.id as string);
    return ApiResponse.success(res, result, 'Banner deleted successfully');
  });
}

export const bannerController = new BannerController();
