import { Response } from 'express';
import { HttpStatus } from './http-status';

export class ApiResponse {
  static success(res: Response, data: any, message = 'Success') {
    return res.status(HttpStatus.OK).json({
      success: true,
      message,
      data,
    });
  }

  static created(res: Response, data: any, message = 'Created successfully') {
    return res.status(HttpStatus.CREATED).json({
      success: true,
      message,
      data,
    });
  }

  static paginated(
    res: Response,
    data: any,
    meta: any,
    message = 'Success'
  ) {
    return res.status(HttpStatus.OK).json({
      success: true,
      message,
      data,
      meta,
    });
  }

  static message(
    res: Response,
    message: string,
    statusCode: number = HttpStatus.OK
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
    });
  }

  static noContent(res: Response) {
    return res.status(HttpStatus.NO_CONTENT).end();
  }
}
