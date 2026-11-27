import { Types } from 'mongoose';
import { AppError } from '../../common/appError';
import {
  IOrder,
  IOrderItem,
  IShippingAddress,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './order.model';
import { OrderRepository, orderRepository } from './order.repository';
import CartModel from '../cart/cart.model';
import ProductModel from '../product/models/product.model';
import ProductVariantModel from '../product/models/product-variant.model';
import { inventoryService } from '../inventory/inventory.service';
import { recalculateCartPricing } from '../cart/cart.pricing';

export interface CreateOrderItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface CreateOrderDto {
  fromCart?: boolean;
  items?: CreateOrderItemInput[];
  shippingAddress: IShippingAddress;
  paymentMethod: PaymentMethod;
  note?: string;
}

export interface OrderIdentity {
  userId?: string | Types.ObjectId | null;
  guestId?: string | null;
  role?: string;
  isAdmin?: boolean;
}

export interface GetOrdersQuery {
  userId?: string;
  guestId?: string;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod | string;
  search?: string;
  page?: number;
  limit?: number;
  isAdmin?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

// Hợp lệ các bước chuyển trạng thái đơn hàng
const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export class OrderService {
  constructor(private repository: OrderRepository = orderRepository) {}

  /**
   * Sinh mã đơn hàng ngẫu nhiên, dễ đọc và duy nhất
   * Ví dụ: ORD-M1B8Z3-A7K2
   */
  generateOrderCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * 1. Tạo đơn hàng mới từ Giỏ hàng hoặc danh sách sản phẩm chỉ định
   */
  async createOrder(dto: CreateOrderDto, identity: OrderIdentity): Promise<IOrder> {
    const { fromCart = true, shippingAddress, paymentMethod, note } = dto;

    if (!identity.userId && !identity.guestId) {
      throw AppError.BadRequest('User ID or Guest ID must be provided', 'MISSING_IDENTITY');
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.address || !shippingAddress.city) {
      throw AppError.BadRequest('Full shipping address details are required', 'INVALID_SHIPPING_ADDRESS');
    }

    let rawItems: { productId: string; variantId?: string | null; quantity: number }[] = [];
    let cartToUpdate: any = null;

    // Lấy items từ giỏ hàng nếu fromCart = true
    if (fromCart) {
      const cartFilter: Record<string, any> = identity.userId
        ? { userId: new Types.ObjectId(identity.userId.toString()), status: 'ACTIVE' }
        : { guestId: identity.guestId?.trim(), status: 'ACTIVE' };

      cartToUpdate = await CartModel.findOne(cartFilter).exec();
      if (!cartToUpdate || cartToUpdate.items.length === 0) {
        throw AppError.BadRequest('Cart is empty', 'CART_EMPTY');
      }

      // Chỉ lấy các sản phẩm đang được tích chọn (selected !== false)
      const selectedCartItems = cartToUpdate.items.filter((item: any) => item.selected !== false);
      if (selectedCartItems.length === 0) {
        throw AppError.BadRequest('No items selected in cart for checkout', 'NO_SELECTED_ITEMS');
      }

      rawItems = selectedCartItems.map((item: any) => ({
        productId: item.productId.toString(),
        variantId: item.variantId ? item.variantId.toString() : null,
        quantity: item.quantity,
      }));
    } else {
      if (!dto.items || dto.items.length === 0) {
        throw AppError.BadRequest('Items list cannot be empty', 'EMPTY_ITEMS');
      }
      rawItems = dto.items;
    }

    // 2. Validate từng item: kiểm tra tồn kho, giá, trạng thái sản phẩm
    const validatedItems: IOrderItem[] = [];
    let subtotal = 0;

    for (const raw of rawItems) {
      if (raw.quantity <= 0) {
        throw AppError.BadRequest('Item quantity must be greater than 0', 'INVALID_QUANTITY');
      }

      const product = await ProductModel.findById(raw.productId);
      if (!product || product.deleted || !product.isActive || product.status === 'ARCHIVED') {
        throw AppError.BadRequest(
          `Product is no longer available: ${product?.name || raw.productId}`,
          'PRODUCT_UNAVAILABLE'
        );
      }

      let variant: any = null;
      let availableStock = product.stock;
      let unitPrice = product.price;
      let sku = '';
      let variantImage = product.image;
      let attributes: Record<string, any> = {};

      if (raw.variantId) {
        variant = await ProductVariantModel.findOne({
          _id: raw.variantId,
          productId: product._id,
          deleted: false,
        });

        if (!variant || !variant.isActive) {
          throw AppError.BadRequest(
            `Selected product variant is unavailable for ${product.name}`,
            'VARIANT_UNAVAILABLE'
          );
        }

        availableStock = variant.stock;
        unitPrice = variant.price;
        sku = variant.sku || '';
        if (variant.image) variantImage = variant.image;
        attributes = {
          size: variant.size,
          color: variant.color,
          ...(variant.optionValues || {}),
        };
      }

      if (availableStock < raw.quantity) {
        throw AppError.BadRequest(
          `Insufficient stock for "${product.name}". Only ${availableStock} left.`,
          'INSUFFICIENT_STOCK'
        );
      }

      const itemSubtotal = Math.round(unitPrice * raw.quantity);
      subtotal += itemSubtotal;

      validatedItems.push({
        productId: product._id as Types.ObjectId,
        variantId: variant ? (variant._id as Types.ObjectId) : null,
        sku,
        name: product.name,
        image: variantImage,
        price: unitPrice,
        originalPrice: variant ? (variant.originalPrice || unitPrice) : (product.originalPrice || unitPrice),
        quantity: raw.quantity,
        subtotal: itemSubtotal,
        attributes,
      });
    }

    // 3. Tính phí vận chuyển và giảm giá
    // Miễn phí vận chuyển cho đơn từ 500,000 VND, ngược lại 30,000 VND
    const shippingFee = subtotal >= 500000 ? 0 : 30000;
    const discountAmount = 0; // Chưa áp dụng coupon hoặc coupon mở rộng sau
    const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

    const orderCode = this.generateOrderCode();

    // 4. Trừ tồn kho thông qua inventoryService và tăng lượt đã bán (sold)
    for (const item of validatedItems) {
      await inventoryService.adjustStock({
        productId: item.productId.toString(),
        variantId: item.variantId ? item.variantId.toString() : undefined,
        type: 'EXPORT',
        quantity: -item.quantity,
        reason: `Order placed: ${orderCode}`,
        referenceId: orderCode,
        userId: identity.userId ? identity.userId.toString() : undefined,
      });

      // Tăng số lượng đã bán
      await ProductModel.findByIdAndUpdate(item.productId, {
        $inc: { sold: item.quantity },
      });
    }

    // 5. Nếu đặt từ giỏ hàng, loại bỏ các sản phẩm đã mua khỏi giỏ hàng
    if (cartToUpdate) {
      cartToUpdate.items = cartToUpdate.items.filter((item: any) => item.selected === false);
      recalculateCartPricing(cartToUpdate);
      await cartToUpdate.save();
    }

    // 6. Khởi tạo đơn hàng trong cơ sở dữ liệu qua repository
    const newOrder = await this.repository.create({
      orderCode,
      userId: identity.userId ? new Types.ObjectId(identity.userId.toString()) : null,
      guestId: identity.userId ? null : identity.guestId?.trim() || null,
      items: validatedItems,
      shippingAddress: {
        ...shippingAddress,
        note: note || shippingAddress.note || '',
      },
      pricing: {
        subtotal,
        shippingFee,
        discountAmount,
        totalAmount,
      },
      paymentMethod,
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      statusHistory: [
        {
          status: 'PENDING',
          changedAt: new Date(),
          changedBy: identity.userId ? new Types.ObjectId(identity.userId.toString()) : 'CUSTOMER',
          note: 'Order successfully created',
        },
      ],
    });

    return newOrder;
  }

  /**
   * 2. Cập nhật trạng thái đơn hàng (State machine)
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy?: string | Types.ObjectId,
    note?: string
  ): Promise<IOrder> {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw AppError.NotFound('Order not found', 'ORDER_NOT_FOUND');
    }

    const currentStatus = order.orderStatus;

    if (currentStatus === newStatus) {
      return order;
    }

    // Kiểm tra tính hợp lệ của việc chuyển trạng thái
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw AppError.BadRequest(
        `Cannot change order status from ${currentStatus} to ${newStatus}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Nếu đơn hàng bị HUỶ (CANCELLED) hoặc HOÀN TRẢ (RETURNED): Hoàn trả lại tồn kho
    if (newStatus === 'CANCELLED' || newStatus === 'RETURNED') {
      for (const item of order.items) {
        await inventoryService.adjustStock({
          productId: item.productId.toString(),
          variantId: item.variantId ? item.variantId.toString() : undefined,
          type: 'IMPORT',
          quantity: item.quantity,
          reason: `Order ${order.orderCode} ${newStatus}: restock items`,
          referenceId: order.orderCode,
          userId: changedBy ? changedBy.toString() : undefined,
        });

        // Giảm lại lượt đã bán
        await ProductModel.findByIdAndUpdate(item.productId, {
          $inc: { sold: -item.quantity },
        });
      }

      if (newStatus === 'CANCELLED') {
        order.cancelledAt = new Date();
        order.cancelReason = note || 'Order cancelled';
      }
    }

    // Nếu đơn hàng GIAO THÀNH CÔNG (DELIVERED)
    if (newStatus === 'DELIVERED') {
      order.deliveredAt = new Date();
      // Với đơn COD, khi giao hàng thành công thì ghi nhận đã thanh toán
      if (order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING') {
        order.paymentStatus = 'PAID';
        order.paidAt = new Date();
      }
    }

    order.orderStatus = newStatus;
    order.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      changedBy: changedBy ? changedBy.toString() : 'SYSTEM',
      note: note || `Status changed to ${newStatus}`,
    });

    await order.save();
    return order;
  }

  /**
   * 3. Huỷ đơn hàng bởi khách hàng hoặc người bán
   */
  async cancelOrder(
    orderId: string,
    identity: OrderIdentity,
    reason?: string
  ): Promise<IOrder> {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw AppError.NotFound('Order not found', 'ORDER_NOT_FOUND');
    }

    // Kiểm tra quyền sở hữu đơn hàng nếu không phải ADMIN
    if (identity.role !== 'ADMIN') {
      const isOwner =
        (identity.userId && order.userId?.toString() === identity.userId.toString()) ||
        (identity.guestId && order.guestId === identity.guestId);

      if (!isOwner) {
        throw AppError.Forbidden('You are not authorized to cancel this order', 'FORBIDDEN');
      }
    }

    // Chỉ cho phép huỷ khi đơn hàng đang ở PENDING hoặc CONFIRMED
    if (!['PENDING', 'CONFIRMED'].includes(order.orderStatus)) {
      throw AppError.BadRequest(
        `Cannot cancel order with current status "${order.orderStatus}". Please contact support.`,
        'CANNOT_CANCEL_ORDER'
      );
    }

    return this.updateOrderStatus(
      orderId,
      'CANCELLED',
      identity.userId || 'CUSTOMER',
      reason || 'Cancelled by customer'
    );
  }

  /**
   * 4. Lấy chi tiết đơn hàng theo ID hoặc OrderCode
   */
  async getOrderById(orderIdentifier: string, identity?: OrderIdentity): Promise<IOrder> {
    const order = await this.repository.findByIdOrCode(orderIdentifier, true);
    if (!order) {
      throw AppError.NotFound('Order not found', 'ORDER_NOT_FOUND');
    }

    // Kiểm tra quyền xem đơn hàng
    if (identity && identity.role !== 'ADMIN') {
      const isOwner =
        (identity.userId && order.userId?.toString() === identity.userId.toString()) ||
        (identity.guestId && order.guestId === identity.guestId);

      // Cho phép tra cứu nếu là chủ đơn hàng HOẶC người dùng có mã đơn hàng cụ thể (orderCode bí mật)
      // (Phục vụ cho luồng xác thực sau khi VNPay redirect về trang kết quả thanh toán)
      const isObjectId = Types.ObjectId.isValid(orderIdentifier);
      const isMatchingOrderCode =
        !isObjectId && order.orderCode.toUpperCase() === orderIdentifier.toUpperCase();

      if (!isOwner && !isMatchingOrderCode) {
        throw AppError.Forbidden('You do not have access to this order', 'FORBIDDEN');
      }
    }

    return order;
  }

  /**
   * 5. Lấy danh sách đơn hàng có phân trang và bộ lọc (Dùng chung cho cả Khách hàng và Admin)
   */
  async getOrders(query: GetOrdersQuery) {
    const {
      userId,
      guestId,
      orderStatus,
      paymentStatus,
      paymentMethod,
      search,
      page = 1,
      limit = 10,
      isAdmin = false,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 10));

    const filter: Record<string, any> = {};

    // Nếu KHÔNG PHẢI là Admin thì BẮT BUỘC chỉ được xem đơn hàng của chính mình
    if (!isAdmin) {
      if (userId) {
        filter.userId = new Types.ObjectId(userId);
      } else if (guestId) {
        filter.guestId = guestId.trim();
      }
    } else if (userId) {
      // Nếu là Admin lọc đơn của 1 user cụ thể
      filter.userId = new Types.ObjectId(userId);
    }

    if (orderStatus) {
      filter.orderStatus = orderStatus;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod.toUpperCase();
    }

    if (search && search.trim()) {
      const keyword = search.trim();
      filter.$or = [
        { orderCode: { $regex: keyword, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: keyword, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: keyword, $options: 'i' } },
        { 'shippingAddress.email': { $regex: keyword, $options: 'i' } },
      ];
    }

    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, any> = {};
      if (query.startDate) {
        dateFilter.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (!query.endDate.includes('T')) {
          end.setHours(23, 59, 59, 999);
        }
        dateFilter.$lte = end;
      }
      filter.createdAt = dateFilter;
    }

    const sortOption: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const skip = (pageNum - 1) * limitNum;

    const { orders, totalItems } = await this.repository.findOrdersWithPagination(
      filter,
      {
        skip,
        limit: limitNum,
        sort: sortOption,
      }
    );

    const totalPages = Math.ceil(totalItems / limitNum) || 1;

    return {
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  /**
   * 6. Lấy thống kê tổng quan về đơn hàng & chỉ số người dùng (Dành cho Quản trị viên, hỗ trợ lọc theo ngày)
   */
  async getOrderStats(dateRange?: { startDate?: string; endDate?: string }) {
    let dateFilter: { $gte?: Date; $lte?: Date } | undefined = undefined;
    if (dateRange?.startDate || dateRange?.endDate) {
      dateFilter = {};
      if (dateRange.startDate) {
        dateFilter.$gte = new Date(dateRange.startDate);
      }
      if (dateRange.endDate) {
        const end = new Date(dateRange.endDate);
        if (!dateRange.endDate.includes('T')) {
          end.setHours(23, 59, 59, 999);
        }
        dateFilter.$lte = end;
      }
    }

    const [facetResult] = await this.repository.aggregateStats(dateFilter);

    const orderStats = facetResult?.orderStats?.[0] || {};
    const customerStats = facetResult?.customerStats?.[0] || {};
    const topCustomers = facetResult?.topCustomers || [];

    const totalOrders = orderStats.totalOrders || 0;
    const totalRevenue = orderStats.totalRevenue || 0;
    const totalCustomers = customerStats.totalCustomers || 0;
    const repeatCustomers = customerStats.repeatCustomers || 0;

    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

    return {
      totalOrders,
      totalRevenue,
      pendingOrders: orderStats.pendingOrders || 0,
      confirmedOrders: orderStats.confirmedOrders || 0,
      processingOrders: orderStats.processingOrders || 0,
      shippingOrders: orderStats.shippingOrders || 0,
      deliveredOrders: orderStats.deliveredOrders || 0,
      cancelledOrders: orderStats.cancelledOrders || 0,
      paidOrders: orderStats.paidOrders || 0,
      unpaidOrders: orderStats.unpaidOrders || 0,
      // Các chỉ số tính từ dữ liệu người dùng
      totalCustomers,
      repeatCustomers,
      repeatRate,
      averageOrderValue,
      memberOrders: orderStats.memberOrders || 0,
      guestOrders: orderStats.guestOrders || 0,
      topCustomers,
    };
  }

  /**
   * 7. Cập nhật trạng thái thanh toán (PAID / PENDING / FAILED / REFUNDED)
   */
  async updatePaymentStatus(
    orderId: string,
    newPaymentStatus: PaymentStatus,
    changedBy?: string | Types.ObjectId,
    note?: string
  ): Promise<IOrder> {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw AppError.NotFound('Order not found', 'ORDER_NOT_FOUND');
    }

    const oldStatus = order.paymentStatus;
    order.paymentStatus = newPaymentStatus;

    if (newPaymentStatus === 'PAID' && !order.paidAt) {
      order.paidAt = new Date();
    }

    order.statusHistory.push({
      status: order.orderStatus,
      changedAt: new Date(),
      changedBy: changedBy ? changedBy.toString() : 'ADMIN',
      note:
        note ||
        `Đổi trạng thái thanh toán từ ${oldStatus} sang ${newPaymentStatus}`,
    });

    await order.save();
    return order;
  }

  /**
   * 8. Xoá đơn hàng (Quản trị viên)
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw AppError.NotFound('Order not found', 'ORDER_NOT_FOUND');
    }

    await this.repository.deleteById(orderId);
    return true;
  }
}

export const orderService = new OrderService();
