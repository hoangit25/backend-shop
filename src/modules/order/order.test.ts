// import { describe, it, expect, vi, beforeEach } from 'vitest';
// import { Types } from 'mongoose';
// import { orderService } from './order.service';
// import OrderModel from './order.model';
// import CartModel from '../cart/cart.model';
// import ProductModel from '../product/models/product.model';
// import { inventoryService } from '../inventory/inventory.service';

// describe('OrderService', () => {
//   beforeEach(() => {
//     vi.restoreAllMocks();
//   });

//   describe('generateOrderCode', () => {
//     it('should generate a code starting with ORD-', () => {
//       const code = orderService.generateOrderCode();
//       expect(code).toMatch(/^ORD-[A-Z0-9]+-[A-Z0-9]+$/);
//     });
//   });

//   describe('createOrder', () => {
//     it('should throw error when missing identity', async () => {
//       await expect(
//         orderService.createOrder(
//           {
//             shippingAddress: {
//               fullName: 'Nguyen Van A',
//               phone: '0987654321',
//               email: 'a@gmail.com',
//               address: '123 Le Loi',
//               city: 'TP HCM',
//             },
//             paymentMethod: 'COD',
//           },
//           {}
//         )
//       ).rejects.toThrow('User ID or Guest ID must be provided');
//     });

//     it('should throw error when missing required shipping fields', async () => {
//       await expect(
//         orderService.createOrder(
//           {
//             shippingAddress: {
//               fullName: '',
//               phone: '',
//               email: '',
//               address: '',
//               city: '',
//             },
//             paymentMethod: 'COD',
//           },
//           { userId: new Types.ObjectId().toString() }
//         )
//       ).rejects.toThrow('Full shipping address details are required');
//     });

//     it('should throw error when cart is empty', async () => {
//       vi.spyOn(CartModel, 'findOne').mockReturnValue({
//         exec: vi.fn().mockResolvedValue(null),
//       } as any);

//       await expect(
//         orderService.createOrder(
//           {
//             fromCart: true,
//             shippingAddress: {
//               fullName: 'Nguyen Van A',
//               phone: '0987654321',
//               email: 'a@gmail.com',
//               address: '123 Le Loi',
//               city: 'TP HCM',
//             },
//             paymentMethod: 'COD',
//           },
//           { userId: new Types.ObjectId().toString() }
//         )
//       ).rejects.toThrow('Cart is empty');
//     });

//     it('should throw error when stock is insufficient', async () => {
//       const productId = new Types.ObjectId();
//       const mockCart = {
//         items: [
//           {
//             productId,
//             quantity: 5,
//             selected: true,
//           },
//         ],
//       };

//       vi.spyOn(CartModel, 'findOne').mockReturnValue({
//         exec: vi.fn().mockResolvedValue(mockCart),
//       } as any);

//       vi.spyOn(ProductModel, 'findById').mockResolvedValue({
//         _id: productId,
//         name: 'Ao thun',
//         price: 150000,
//         stock: 2, // Chỉ còn 2 mà mua 5
//         isActive: true,
//         deleted: false,
//         status: 'ACTIVE',
//       } as any);

//       await expect(
//         orderService.createOrder(
//           {
//             fromCart: true,
//             shippingAddress: {
//               fullName: 'Nguyen Van A',
//               phone: '0987654321',
//               email: 'a@gmail.com',
//               address: '123 Le Loi',
//               city: 'TP HCM',
//             },
//             paymentMethod: 'COD',
//           },
//           { userId: new Types.ObjectId().toString() }
//         )
//       ).rejects.toThrow('Insufficient stock');
//     });

//     it('should create order successfully and deduct stock', async () => {
//       const productId = new Types.ObjectId();
//       const mockCart = {
//         items: [
//           {
//             productId,
//             quantity: 2,
//             selected: true,
//           },
//         ],
//         save: vi.fn().mockResolvedValue(true),
//       };

//       vi.spyOn(CartModel, 'findOne').mockReturnValue({
//         exec: vi.fn().mockResolvedValue(mockCart),
//       } as any);

//       vi.spyOn(ProductModel, 'findById').mockResolvedValue({
//         _id: productId,
//         name: 'Ao thun',
//         price: 200000,
//         stock: 10,
//         isActive: true,
//         deleted: false,
//         status: 'ACTIVE',
//       } as any);

//       const adjustStockSpy = vi.spyOn(inventoryService, 'adjustStock').mockResolvedValue({} as any);
//       const updateSoldSpy = vi.spyOn(ProductModel, 'findByIdAndUpdate').mockResolvedValue({} as any);

//       const saveSpy = vi.spyOn(OrderModel.prototype, 'save').mockImplementation(function (this: any) {
//         return Promise.resolve(this);
//       });

//       const order = await orderService.createOrder(
//         {
//           fromCart: true,
//           shippingAddress: {
//             fullName: 'Nguyen Van A',
//             phone: '0987654321',
//             email: 'a@gmail.com',
//             address: '123 Le Loi',
//             city: 'TP HCM',
//           },
//           paymentMethod: 'COD',
//         },
//         { userId: new Types.ObjectId().toString() }
//       );

//       expect(order).toBeDefined();
//       expect(order.orderStatus).toBe('PENDING');
//       expect(order.paymentStatus).toBe('PENDING');
//       expect(order.pricing.subtotal).toBe(400000);
//       expect(order.pricing.shippingFee).toBe(30000); // Dưới 500k nên phí ship 30k
//       expect(order.pricing.totalAmount).toBe(430000);
//       expect(adjustStockSpy).toHaveBeenCalledWith(
//         expect.objectContaining({
//           type: 'EXPORT',
//           quantity: -2,
//         })
//       );
//       expect(updateSoldSpy).toHaveBeenCalled();
//       expect(saveSpy).toHaveBeenCalled();
//     });
//   });

//   describe('updateOrderStatus', () => {
//     it('should throw error on invalid transition', async () => {
//       vi.spyOn(OrderModel, 'findById').mockResolvedValue({
//         _id: new Types.ObjectId(),
//         orderStatus: 'DELIVERED',
//       } as any);

//       await expect(
//         orderService.updateOrderStatus('someId', 'PENDING')
//       ).rejects.toThrow('Cannot change order status from DELIVERED to PENDING');
//     });

//     it('should restock items when order is cancelled', async () => {
//       const productId = new Types.ObjectId();
//       const mockOrder = {
//         _id: new Types.ObjectId(),
//         orderCode: 'ORD-TEST-1234',
//         orderStatus: 'PENDING',
//         items: [{ productId, quantity: 2 }],
//         statusHistory: [],
//         save: vi.fn().mockResolvedValue(true),
//       };

//       vi.spyOn(OrderModel, 'findById').mockResolvedValue(mockOrder as any);
//       const adjustStockSpy = vi.spyOn(inventoryService, 'adjustStock').mockResolvedValue({} as any);
//       const updateSoldSpy = vi.spyOn(ProductModel, 'findByIdAndUpdate').mockResolvedValue({} as any);

//       const updated = await orderService.updateOrderStatus(mockOrder._id.toString(), 'CANCELLED', 'ADMIN', 'Customer requested');

//       expect(updated.orderStatus).toBe('CANCELLED');
//       expect(adjustStockSpy).toHaveBeenCalledWith(
//         expect.objectContaining({
//           type: 'IMPORT',
//           quantity: 2,
//         })
//       );
//       expect(updateSoldSpy).toHaveBeenCalledWith(productId, { $inc: { sold: -2 } });
//     });
//   });
// });

