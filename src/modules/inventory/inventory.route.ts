import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware';
import { verifyToken } from '../../middlewares/authentication.middelware';
import { inventoryController } from './inventory.controller';

const adjustStockSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    variantId: z.string().optional(),
    type: z.enum(['IMPORT', 'EXPORT', 'SALE', 'RETURN', 'ADJUSTMENT']),
    quantity: z.number().int(),
    reason: z.string().optional(),
    referenceId: z.string().optional(),
  }),
});

const router = Router();

router.use(verifyToken); // Toàn bộ API Inventory yêu cầu xác thực

router.post('/adjust', validate(adjustStockSchema), inventoryController.adjustStock);
router.get('/logs/:productId', inventoryController.getLogs);

export const inventoryRouter = router;

