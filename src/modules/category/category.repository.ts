import { BaseRepository } from '../../common/base-responsitory';
import CategoryModel, { ICategory } from './category.model';

export class CategoryRepository extends BaseRepository<ICategory> {
  constructor() {
    super(CategoryModel);
  }

  async findBySlug(slug: string) {
    return this.findOne({ slug, deleted: false });
  }

  async findRootCategories() {
    return this.find(
      { parentId: null, deleted: false, isActive: true },
      null,
      { sort: { position: 1 } }
    );
  }

  async findSubCategories(parentId: string) {
    return this.find(
      { parentId, deleted: false, isActive: true },
      null,
      { sort: { position: 1 } }
    );
  }
}

export const categoryRepository = new CategoryRepository();

