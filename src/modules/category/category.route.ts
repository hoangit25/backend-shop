import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { verifyToken } from '../../middlewares/authentication.middelware';
import { categoryController } from './category.controller';
import {
  createCategorySchema,
  updateCategorySchema,
  getCategoryByIdSchema,
} from './category.validation';

const router = Router();

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', validate(getCategoryByIdSchema), categoryController.getCategoryById);

// Protected routes (Admin / Auth required)
router.post('/', verifyToken, validate(createCategorySchema), categoryController.createCategory);
router.put('/:id', verifyToken, validate(updateCategorySchema), categoryController.updateCategory);
router.delete('/:id', verifyToken, validate(getCategoryByIdSchema), categoryController.deleteCategory);

export const categoryRouter = router;

