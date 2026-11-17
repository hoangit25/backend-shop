import { Types } from 'mongoose';
import { AppError } from '../../common/appError';
import OrderModel, {
  IOrder,
  IOrderItem,
  IShippingAddress,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './order.model';
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
}

export interface GetOrdersQuery {
  userId?: string;
  guestId?: string;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  page?: number;
  limit?: number;
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

    // 6. Khởi tạo đơn hàng trong cơ sở dữ liệu
    const newOrder = new OrderModel({
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

    await newOrder.save();
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
    const order = await OrderModel.findById(orderId);
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
    const order = await OrderModel.findById(orderId);
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
    const isObjectId = Types.ObjectId.isValid(orderIdentifier);
    const filter = isObjectId
      ? { $or: [{ _id: new Types.ObjectId(orderIdentifier) }, { orderCode: orderIdentifier.toUpperCase() }] }
      : { orderCode: orderIdentifier.toUpperCase() };

    const order = await OrderModel.findOne(filter).populate('items.productId').exec();
    if (!order) {
      throw AppError.NotFound('Order not found', 'ORDER_NOT_FOUND');
    }

    // Kiểm tra quyền xem đơn hàng
    if (identity && identity.role !== 'ADMIN') {
      const isOwner =
        (identity.userId && order.userId?.toString() === identity.userId.toString()) ||
        (identity.guestId && order.guestId === identity.guestId);

      if (!isOwner) {
        throw AppError.Forbidden('You do not have access to this order', 'FORBIDDEN');
      }
    }

    return order;
  }

  /**
   * 5. Lấy danh sách đơn hàng có phân trang và bộ lọc
   */
  async getOrders(query: GetOrdersQuery) {
    const {
      userId,
      guestId,
      orderStatus,
      paymentStatus,
      search,
      page = 1,
      limit = 10,
    } = query;

    const filter: Record<string, any> = {};

    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    } else if (guestId) {
      filter.guestId = guestId.trim();
    }

    if (orderStatus) {
      filter.orderStatus = orderStatus;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (search) {
      filter.$or = [
        { orderCode: { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, page) - 1) * limit;

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      OrderModel.countDocuments(filter),
    ]);

    return {
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const orderService = new OrderService();
