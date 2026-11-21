import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { verifyToken } from '../../middlewares/authentication.middelware';
import { bannerController } from './banner.controller';
import {
  getBannersQuerySchema,
  createBannerSchema,
  updateBannerSchema,
  getBannerByIdSchema,
} from './banner.validation';

const router = Router();

// Public routes
router.get('/', validate(getBannersQuerySchema), bannerController.getBanners);
router.get('/:id', validate(getBannerByIdSchema), bannerController.getBannerById);

// Protected routes (Admin / Manager)
router.post('/', verifyToken, validate(createBannerSchema), bannerController.createBanner);
router.put('/:id', verifyToken, validate(updateBannerSchema), bannerController.updateBanner);
router.delete('/:id', verifyToken, validate(getBannerByIdSchema), bannerController.deleteBanner);

export const bannerRouter = router;
