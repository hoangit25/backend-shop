import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import { verifyToken } from '../../../middlewares/authentication.middelware';
import { upload } from '../../../middlewares/upload.middleware';
import { productController } from '../controllers/product.controller';
import { productOptionController } from '../controllers/product-option.controller';
import { productVariantController } from '../controllers/product-variant.controller';

import {
  createProductSchema,
  updateProductSchema,
  getProductByIdSchema,
  getProductBySlugSchema,
  listProductsQuerySchema,
} from '../validations/product.validation';

import {
  createProductOptionSchema,
  updateProductOptionSchema,
  deleteProductOptionSchema,
} from '../validations/product-option.validation';

import {
  createProductVariantSchema,
  updateProductVariantSchema,
  deleteProductVariantSchema,
  findVariantSchema,
} from '../validations/product-variant.validation';

const router = Router();

// ── Public Product Endpoints ──
router.get('/', validate(listProductsQuerySchema), productController.getProducts);
router.get('/detail/:idOrSlug', productController.getProductDetail);
router.get('/slug/:slug', validate(getProductBySlugSchema), productController.getProductBySlug);
router.get('/:id', validate(getProductByIdSchema), productController.getProductById);

// ── Protected Product Endpoints (Auth Required) ──
router.post(
  '/upload-images',
  verifyToken,
  upload.array('images', 10),
  productController.uploadImages
);
router.post('/', verifyToken, validate(createProductSchema), productController.createProduct);
router.put('/:id', verifyToken, validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', verifyToken, validate(getProductByIdSchema), productController.deleteProduct);
router.patch('/:id/restore', verifyToken, validate(getProductByIdSchema), productController.restoreProduct);

// ── Product Options ──
router.get('/:productId/options', productOptionController.getOptions);
router.post(
  '/:productId/options',
  verifyToken,
  validate(createProductOptionSchema),
  productOptionController.createOption
);
router.put(
  '/:productId/options/:optionId',
  verifyToken,
  validate(updateProductOptionSchema),
  productOptionController.updateOption
);
router.delete(
  '/:productId/options/:optionId',
  verifyToken,
  validate(deleteProductOptionSchema),
  productOptionController.deleteOption
);

// ── Product Variants ──
router.get('/:productId/variants', productVariantController.getVariants);
router.get('/:productId/variants/:variantId', productVariantController.getVariantById);
router.post(
  '/:productId/variants/find',
  validate(findVariantSchema),
  productVariantController.findVariant
);
router.post(
  '/:productId/variants',
  verifyToken,
  validate(createProductVariantSchema),
  productVariantController.createVariant
);
router.put(
  '/:productId/variants/:variantId',
  verifyToken,
  validate(updateProductVariantSchema),
  productVariantController.updateVariant
);
router.delete(
  '/:productId/variants/:variantId',
  verifyToken,
  validate(deleteProductVariantSchema),
  productVariantController.deleteVariant
);

export const productRouter = router;
