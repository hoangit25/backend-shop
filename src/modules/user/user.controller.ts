import { Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { UserService, userService } from './user.service';

export class UserController {
  constructor(private service: UserService = userService) {}

  getUsers = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, role, status, sortBy, sortOrder } = req.query as any;

    const result = await this.service.getUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      role,
      status,
      sortBy,
      sortOrder,
    });

    return ApiResponse.paginated(
      res,
      result.items,
      {
        totalItems: result.totalItems,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
      'Users retrieved successfully'
    );
  });

  getStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await this.service.getUserStats();
    return ApiResponse.success(res, stats, 'User statistics retrieved successfully');
  });

  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.service.getUserById(req.params.id as string);
    return ApiResponse.success(res, user, 'User retrieved successfully');
  });

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.service.createUser(req.body);
    return ApiResponse.created(res, user, 'User created successfully');
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.service.updateUser(req.params.id as string, req.body);
    return ApiResponse.success(res, user, 'User updated successfully');
  });

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteUser(req.params.id as string);
    return ApiResponse.success(res, result, 'User deleted successfully');
  });
}

export const userController = new UserController();
