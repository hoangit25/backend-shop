import { Model, QueryOptions, SaveOptions, InsertManyOptions, UpdateQuery } from 'mongoose';
import { PAGINATION_DEFAULTS, PaginationQuery, PaginatedResult } from '../types/pagination.type';

export class BaseRepository<T> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async create(data: Partial<T>, options?: SaveOptions): Promise<T> {
    const doc = new this.model(data);
    await doc.save(options);
    return doc as unknown as T;
  }

  async insertMany(data: Partial<T>[], options?: InsertManyOptions) {
    return this.model.insertMany(data, options);
  }

  async findById(id: string, projection?: any, options?: QueryOptions) {
    return this.model.findById(id, projection, options);
  }

  async findOne(filter: any, projection?: any, options?: QueryOptions) {
    return this.model.findOne(filter, projection, options);
  }

  async find(filter: any, projection?: any, options?: QueryOptions) {
    return this.model.find(filter, projection, options);
  }

  async exists(filter: any) {
    return this.model.exists(filter);
  }

  async count(filter: any) {
    return this.model.countDocuments(filter);
  }

  async findWithPagination(
    filter: any,
    query: PaginationQuery = {}
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, query.page || PAGINATION_DEFAULTS.PAGE);
    const limit = Math.min(
      Math.max(1, query.limit || PAGINATION_DEFAULTS.LIMIT),
      PAGINATION_DEFAULTS.MAX_LIMIT
    );
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || PAGINATION_DEFAULTS.SORT_BY;
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, totalItems] = await Promise.all([
      this.model
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: items as unknown as T[],
      totalItems,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async updateById(id: string, update: UpdateQuery<T>, options: QueryOptions = { new: true }) {
    return this.model.findByIdAndUpdate(id, update, options);
  }

  async updateOne(filter: any, update: UpdateQuery<T>, options: QueryOptions = {}) {
    return this.model.findOneAndUpdate(filter, update, options);
  }

  async hardDeleteById(id: string, options?: QueryOptions) {
    return this.model.findByIdAndDelete(id, options as any);
  }

  async deleteById(id: string, options?: QueryOptions) {
    await this.model.findByIdAndDelete(id, options as any);
  }

  async deleteOne(filter: any, options?: QueryOptions) {
    return this.model.deleteOne(filter, options as any);
  }

  async softDelete(id: string, options: QueryOptions = { new: true }) {
    return this.model.findByIdAndUpdate(
      id,
      {
        deleted: true,
        isActive: false,
        deletedAt: new Date(),
      } as any,
      options
    );
  }

  async restore(id: string, options: QueryOptions = { new: true }) {
    return this.model.findByIdAndUpdate(
      id,
      {
        deleted: false,
        isActive: true,
        deletedAt: null,
      } as any,
      options
    );
  }
}
