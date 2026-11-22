import { BaseRepository } from '../../common/base-responsitory';
import UserModel, { IUser } from './user.model';
import { Types } from 'mongoose';

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  async findUserWithRoles(id: string) {
    return this.model
      .findOne({ _id: id, deleted: false })
      .populate({
        path: 'roles',
        populate: { path: 'permissions' },
      })
      .select('-password');
  }

  async findWithFilters(
    filter: any = {},
    pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
  ) {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 10));
    const skip = (page - 1) * limit;
    const sortField = pagination.sortBy || 'createdAt';
    const sortDirection = pagination.sortOrder === 'asc' ? 1 : -1;

    const [items, totalItems] = await Promise.all([
      this.model
        .find(filter)
        .populate({
          path: 'roles',
          select: '_id name slug description isSystem isActive',
        })
        .select('-password')
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      totalItems,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async getStatistics() {
    const [totalUsers, activeUsers, inactiveUsers] = await Promise.all([
      this.model.countDocuments({ deleted: false }),
      this.model.countDocuments({ deleted: false, isActive: true }),
      this.model.countDocuments({ deleted: false, isActive: false }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
    };
  }
}

export const userRepository = new UserRepository();
