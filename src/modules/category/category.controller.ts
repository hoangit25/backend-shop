import { Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { CategoryService, categoryService } from './category.service';

export class CategoryController {
  constructor(private service: CategoryService = categoryService) {}

  createCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await this.service.createCategory(req.body);
    return ApiResponse.created(res, category, 'Category created successfully');
  });

  getAllCategories = asyncHandler(async (_req: Request, res: Response) => {
    const categories = await this.service.getAllCategories();
    return ApiResponse.success(res, categories);
  });

  getCategoryById = asyncHandler(async (req: Request, res: Response) => {
    const category = await this.service.getCategoryById(req.params.id as string);
    return ApiResponse.success(res, category);
  });

  updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await this.service.updateCategory(req.params.id as string, req.body);
    return ApiResponse.success(res, category, 'Category updated successfully');
  });

  deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteCategory(req.params.id as string);
    return ApiResponse.success(res, result, 'Category deleted successfully');
  });
}

export const categoryController = new CategoryController();

