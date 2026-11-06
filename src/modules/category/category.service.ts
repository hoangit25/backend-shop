import { Types } from 'mongoose';
import { AppError } from '../../common/appError';
import { CategoryRepository, categoryRepository } from './category.repository';
import { cacheService } from '../../config/redis.config';
import { generateSlug } from '../product/utils/product.utils';

export class CategoryService {
  constructor(private repository: CategoryRepository = categoryRepository) {}

  async createCategory(data: any) {
    const slug = generateSlug(data.name);
    const existing = await this.repository.findBySlug(slug);
    if (existing) {
      throw AppError.Conflict('Category slug already exists', 'CATEGORY_SLUG_EXISTS');
    }

    const category = await this.repository.create({
      ...data,
      slug,
      parentId: data.parentId ? new Types.ObjectId(data.parentId) : null,
    });

    // Invalidate categories cache
    await cacheService.delPattern('categories:*');
    return category;
  }

  async getAllCategories() {
    const cacheKey = 'categories:all';
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const categories = await this.repository.find(
      { deleted: false, isActive: true },
      null,
      { sort: { position: 1, createdAt: -1 } }
    );

    await cacheService.set(cacheKey, categories, 600); // 10 minutes cache
    return categories;
  }

  async getCategoryById(id: string) {
    const category = await this.repository.findById(id);
    if (!category || category.deleted) {
      throw AppError.NotFound('Category not found', 'CATEGORY_NOT_FOUND');
    }
    return category;
  }

  async updateCategory(id: string, data: any) {
    const category = await this.repository.findById(id);
    if (!category || category.deleted) {
      throw AppError.NotFound('Category not found', 'CATEGORY_NOT_FOUND');
    }

    const updateData: any = { ...data };
    if (data.parentId !== undefined) {
      updateData.parentId = data.parentId ? new Types.ObjectId(data.parentId) : null;
    }
    if (data.name && data.name !== category.name) {
      updateData.slug = generateSlug(data.name);
    }

    const updated = await this.repository.updateById(id, updateData);
    await cacheService.delPattern('categories:*');
    return updated;
  }

  async deleteCategory(id: string) {
    const category = await this.repository.findById(id);
    if (!category || category.deleted) {
      throw AppError.NotFound('Category not found', 'CATEGORY_NOT_FOUND');
    }

    await this.repository.softDelete(id);
    await cacheService.delPattern('categories:*');
    return { message: 'Category deleted successfully' };
  }
}

export const categoryService = new CategoryService();

