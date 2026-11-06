import { Request, Response } from 'express';
import { ApiResponse } from '../../../common/api.responsitory';
import { asyncHandler } from '../../../common/asycn.handel';
import { ProductService, productService } from '../services/product.service';
import { PRODUCT_MESSAGES } from '../constants/product.constant';
import { uploadToCloudinary } from '../../../middlewares/upload.middleware';
import { CLOUDINARY_FOLDERS } from '../../../common/constants/cloudinary-folders.constant';
import { AppError } from '../../../common/appError';

export class ProductController {
  constructor(private service: ProductService = productService) {}

  createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await this.service.createProduct(req.body);
    return ApiResponse.created(res, product, PRODUCT_MESSAGES.PRODUCT_CREATED);
  });

  getProductById = asyncHandler(async (req: Request, res: Response) => {
    const product = await this.service.getProductById(req.params.id as string);
    return ApiResponse.success(res, product);
  });

  getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
    const product = await this.service.getProductBySlug(req.params.slug as string);
    return ApiResponse.success(res, product);
  });

  getProductDetail = asyncHandler(async (req: Request, res: Response) => {
    const product = await this.service.getProductDetail(req.params.idOrSlug as string);
    return ApiResponse.success(res, product);
  });

  getProducts = asyncHandler(async (req: Request, res: Response) => {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      keyword,
      categoryId,
      brand,
      minPrice,
      maxPrice,
      rating,
      inStock,
      isFeatured,
      status,
    } = req.query as any;

    const filter = {
      keyword,
      categoryId,
      brand,
      minPrice,
      maxPrice,
      rating,
      inStock,
      isFeatured,
      status,
    };
    const pagination = { page, limit, sortBy, sortOrder };

    const result = await this.service.getProducts(filter, pagination);

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
      'Products retrieved successfully'
    );
  });

  updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await this.service.updateProduct(req.params.id as string, req.body);
    return ApiResponse.success(res, product, PRODUCT_MESSAGES.PRODUCT_UPDATED);
  });

  deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteProduct(req.params.id as string);
    return ApiResponse.success(res, result, PRODUCT_MESSAGES.PRODUCT_DELETED);
  });

  restoreProduct = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.restoreProduct(req.params.id as string);
    return ApiResponse.success(res, result, PRODUCT_MESSAGES.PRODUCT_RESTORED);
  });

  /**
   * Upload hình ảnh sản phẩm lên Cloudinary
   */
  uploadImages = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw AppError.BadRequest('No images provided', 'MISSING_FILES');
    }

    const uploadPromises = files.map((file) =>
      uploadToCloudinary(file.buffer, CLOUDINARY_FOLDERS.PRODUCTS)
    );
    const urls = await Promise.all(uploadPromises);

    return ApiResponse.success(res, { urls }, 'Images uploaded successfully');
  });
}

export const productController = new ProductController();
