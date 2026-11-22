import { Express } from 'express';
import { authRouter } from '../modules/auth/auth.route';
import { productRouter } from '../modules/product/routes/product.route';
import { categoryRouter } from '../modules/category/category.route';
import { inventoryRouter } from '../modules/inventory/inventory.route';
import { cartRouter } from '../modules/cart/cart.route';
import { orderRouter } from '../modules/order/order.route';
import { paymentRouter } from '../modules/payment/payment.route';
import { bannerRouter } from '../modules/banner/banner.route';
import { adminUserRouter } from '../modules/user/admin-user.route';
import { adminRoleRouter } from '../modules/role/role.route';
import { verifyToken } from '../middlewares/authentication.middelware';
import { requireRoles } from '../middlewares/authorization.middleware';
import { AppError } from '../common/appError';
import { errorHandler } from '../middlewares/AppError.middleware';

export const indexRouter = (app: Express) => {
  const version = '/api/v1';

  app.use(`${version}/auth`, authRouter);
  app.use(`${version}/users`, authRouter);
  app.use(`${version}/categories`, categoryRouter);
  app.use(`${version}/products`, productRouter);
  app.use(`${version}/banners`, bannerRouter);
  app.use(`${version}/inventory`, inventoryRouter);
  app.use(`${version}/cart`, cartRouter);
  app.use(`${version}/orders`, orderRouter);
  app.use(`${version}/payments`, paymentRouter);
  // Alias hỗ trợ các URL webhook/return từ VNPay hoặc bên ngoài không có prefix /v1
  app.use('/api/payments', paymentRouter);

  // ── Admin Routes (Protected: Admin & Super-Admin) ──
  app.use(
    `${version}/admin/users`,
    verifyToken,
    requireRoles('super-admin', 'admin'),
    adminUserRouter
  );
  app.use(
    `${version}/admin/roles`,
    verifyToken,
    requireRoles('super-admin', 'admin'),
    adminRoleRouter
  );

  // 404 handler for undefined routes
  app.use((req, _res, next) => {
    next(
      AppError.NotFound(
        `Route not found: ${req.method} ${req.originalUrl}`,
        'ROUTE_NOT_FOUND'
      )
    );
  });

  app.use(errorHandler);
};
