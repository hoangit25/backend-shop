import { Express } from 'express';
import {authRouter} from'../modules/auth/auth.route'
import { AppError } from '../common/appError';
import { errorHandler }from '../middlewares/AppError.middleware'
export const indexRouter = (app: Express) => {
  const version = '/api/v1';


    app.use(`${version}/auth`, authRouter);



      // 404 handler for undefined routes
  app.use((req, _res, next) => {
    next(AppError.NotFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
  });

  app.use(errorHandler);
}
