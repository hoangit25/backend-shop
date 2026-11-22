import { AppError } from '../../common/appError';
import { UserRepository, userRepository } from './user.repository';
import UserModel from './user.model';
import RoleModel from '../role/role.model';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';

export class UserService {
  constructor(private repository: UserRepository = userRepository) {}

  async getUsers(
    query: {
      search?: string;
      role?: string;
      status?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const filter: any = { deleted: false };

    if (query.search) {
      const keyword = query.search.trim();
      filter.$or = [
        { fullName: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
        { phone: { $regex: keyword, $options: 'i' } },
      ];
    }

    if (query.status) {
      if (query.status === 'Hoạt động' || query.status === 'true' || query.status === 'active') {
        filter.isActive = true;
      } else if (query.status === 'Vô hiệu hóa' || query.status === 'false' || query.status === 'inactive') {
        filter.isActive = false;
      }
    }

    if (query.role) {
      // Find role by slug or name
      const roleDoc = await RoleModel.findOne({
        $or: [{ slug: query.role }, { name: query.role }],
        deleted: false,
      });
      if (roleDoc) {
        filter.roles = roleDoc._id;
      }
    }

    return this.repository.findWithFilters(filter, {
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  async getUserStats() {
    return this.repository.getStatistics();
  }

  async getUserById(id: string) {
    const user = await this.repository.findUserWithRoles(id);
    if (!user) {
      throw AppError.NotFound('Người dùng không tồn tại', 'USER_NOT_FOUND');
    }
    return user;
  }

  async createUser(data: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    avatar?: string;
    roleIds?: string[];
    isActive?: boolean;
  }) {
    const existing = await UserModel.findOne({
      email: data.email.toLowerCase().trim(),
      deleted: false,
    });

    if (existing) {
      throw AppError.Conflict('Email đã được sử dụng', 'EMAIL_ALREADY_EXISTS');
    }

    let roles: Types.ObjectId[] = [];
    if (data.roleIds && data.roleIds.length > 0) {
      roles = data.roleIds.map((id) => new Types.ObjectId(id));
    } else {
      // Default role 'user'
      const defaultRole = await RoleModel.findOne({ slug: 'user' });
      if (defaultRole) {
        roles = [defaultRole._id as Types.ObjectId];
      }
    }

    const newUser = new UserModel({
      fullName: data.fullName.trim(),
      email: data.email.toLowerCase().trim(),
      password: data.password,
      phone: data.phone || '',
      avatar: data.avatar || '',
      roles,
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    await newUser.save();
    return this.getUserById(newUser._id.toString());
  }

  async updateUser(
    id: string,
    data: {
      fullName?: string;
      phone?: string;
      avatar?: string;
      roleIds?: string[];
      isActive?: boolean;
      password?: string;
    }
  ) {
    const user = await UserModel.findOne({ _id: id, deleted: false });
    if (!user) {
      throw AppError.NotFound('Người dùng không tồn tại', 'USER_NOT_FOUND');
    }

    if (data.fullName !== undefined) user.fullName = data.fullName.trim();
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.avatar !== undefined) user.avatar = data.avatar;
    if (data.isActive !== undefined) user.isActive = data.isActive;

    // Cấp quyền / Đổi vai trò
    if (data.roleIds !== undefined) {
      user.roles = data.roleIds.map((rId) => new Types.ObjectId(rId));
    }

    // Nếu đổi mật khẩu
    if (data.password) {
      user.password = data.password;
    }

    await user.save();
    return this.getUserById(id);
  }

  async deleteUser(id: string) {
    const user = await UserModel.findOne({ _id: id, deleted: false });
    if (!user) {
      throw AppError.NotFound('Người dùng không tồn tại', 'USER_NOT_FOUND');
    }

    // Không cho phép tự xóa super-admin cuối cùng
    const roles: any = await RoleModel.find({ _id: { $in: user.roles } });
    if (roles.some((r: any) => r.slug === 'super-admin')) {
      const superAdminCount = await UserModel.countDocuments({
        roles: { $in: roles.map((r: any) => r._id) },
        deleted: false,
      });
      if (superAdminCount <= 1) {
        throw AppError.BadRequest(
          'Không thể xóa tài khoản Quản trị viên cấp cao duy nhất!',
          'CANNOT_DELETE_LAST_SUPER_ADMIN'
        );
      }
    }

    user.deleted = true;
    user.deletedAt = new Date();
    await user.save();

    return { id, deleted: true };
  }
}

export const userService = new UserService();
