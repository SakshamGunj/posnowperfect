import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  onSnapshot,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db, handleFirebaseError } from '@/lib/firebase';
import { Order, OrderItem, ApiResponse, SelectedVariant } from '@/types';
import { generateId, generateOrderNumber } from '@/lib/utils';
import { InventoryService } from './inventoryService';

// Cart item interface for local cart management
export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  customizations?: string[];
  variants?: SelectedVariant[];
  notes?: string;
  total: number;
}

// Smart caching system for orders
class OrderCache {
  private static readonly ORDERS_CACHE_KEY = 'tenverse_pos_orders';
  private static readonly CACHE_EXPIRY_KEY = 'tenverse_pos_orders_expiry';
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  
  // Get orders from localStorage
  static getOrders(restaurantId: string): Order[] {
    try {
      const cacheKey = `${this.ORDERS_CACHE_KEY}_${restaurantId}`;
      const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
      
      const cached = localStorage.getItem(cacheKey);
      const expiry = localStorage.getItem(expiryKey);
      
      if (cached && expiry && Date.now() < parseInt(expiry)) {
        console.log('🚀 Orders cache hit for restaurant:', restaurantId);
        return JSON.parse(cached).map(this.parseOrderDates);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get orders from cache:', error);
      return [];
    }
  }
  
  // Store orders in localStorage
  static setOrders(restaurantId: string, orders: Order[]): void {
    try {
      const cacheKey = `${this.ORDERS_CACHE_KEY}_${restaurantId}`;
      const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
      
      localStorage.setItem(cacheKey, JSON.stringify(orders));
      localStorage.setItem(expiryKey, (Date.now() + this.CACHE_DURATION).toString());
      
      console.log('💾 Orders cached for restaurant:', restaurantId, 'Count:', orders.length);
    } catch (error) {
      console.error('Failed to cache orders:', error);
    }
  }
  
  // Add single order to cache
  static addOrder(restaurantId: string, order: Order): void {
    const orders = this.getOrders(restaurantId);
    orders.unshift(order); // Add to beginning for recent orders first
    this.setOrders(restaurantId, orders);
  }
  
  // Update single order in cache
  static updateOrder(restaurantId: string, updatedOrder: Order): void {
    const orders = this.getOrders(restaurantId);
    const index = orders.findIndex(o => o.id === updatedOrder.id);
    
    if (index !== -1) {
      orders[index] = updatedOrder;
      this.setOrders(restaurantId, orders);
    }
  }
  
  // Clear cache for restaurant
  static clearCache(restaurantId: string): void {
    const cacheKey = `${this.ORDERS_CACHE_KEY}_${restaurantId}`;
    const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
    
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(expiryKey);
  }
  
  // Check if cache is fresh
  static isCacheFresh(restaurantId: string): boolean {
    const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
    const expiry = localStorage.getItem(expiryKey);
    
    return expiry ? Date.now() < parseInt(expiry) : false;
  }
  
  // Parse date strings back to Date objects
  private static parseOrderDates(order: any): Order {
    return {
      ...order,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
    };
  }
}

// Cart management class
export class CartManager {
  private static readonly CART_KEY = 'tenverse_pos_cart';
  
  // Get current cart items
  static getCartItems(restaurantId: string, tableId?: string): CartItem[] {
    try {
      const cartKey = `${this.CART_KEY}_${restaurantId}_${tableId || 'general'}`;
      const cart = localStorage.getItem(cartKey);
      return cart ? JSON.parse(cart) : [];
    } catch (error) {
      console.error('Failed to get cart items:', error);
      return [];
    }
  }
  
  // Add item to cart
  static addToCart(restaurantId: string, item: CartItem, tableId?: string): CartItem[] {
    const cartKey = `${this.CART_KEY}_${restaurantId}_${tableId || 'general'}`;
    const cartItems = this.getCartItems(restaurantId, tableId);
    
    // Check if item already exists in cart
    const existingItemIndex = cartItems.findIndex(
      cartItem => 
        cartItem.menuItemId === item.menuItemId &&
        JSON.stringify(cartItem.customizations) === JSON.stringify(item.customizations) &&
        JSON.stringify(cartItem.variants) === JSON.stringify(item.variants)
    );
    
    if (existingItemIndex !== -1) {
      // Update quantity and total
      cartItems[existingItemIndex].quantity += item.quantity;
      cartItems[existingItemIndex].total = cartItems[existingItemIndex].quantity * cartItems[existingItemIndex].price;
    } else {
      // Add new item
      cartItems.push(item);
    }
    
    localStorage.setItem(cartKey, JSON.stringify(cartItems));
    return cartItems;
  }
  
  // Update cart item quantity
  static updateCartItemQuantity(restaurantId: string, menuItemId: string, quantity: number, tableId?: string): CartItem[] {
    const cartKey = `${this.CART_KEY}_${restaurantId}_${tableId || 'general'}`;
    const cartItems = this.getCartItems(restaurantId, tableId);
    
    const itemIndex = cartItems.findIndex(item => item.menuItemId === menuItemId);
    
    if (itemIndex !== -1) {
      if (quantity <= 0) {
        // Remove item if quantity is 0 or negative
        cartItems.splice(itemIndex, 1);
      } else {
        // Update quantity and total
        cartItems[itemIndex].quantity = quantity;
        cartItems[itemIndex].total = quantity * cartItems[itemIndex].price;
      }
    }
    
    localStorage.setItem(cartKey, JSON.stringify(cartItems));
    return cartItems;
  }
  
  // Remove item from cart
  static removeFromCart(restaurantId: string, menuItemId: string, tableId?: string): CartItem[] {
    return this.updateCartItemQuantity(restaurantId, menuItemId, 0, tableId);
  }
  
  // Clear cart
  static clearCart(restaurantId: string, tableId?: string): void {
    const cartKey = `${this.CART_KEY}_${restaurantId}_${tableId || 'general'}`;
    localStorage.removeItem(cartKey);
  }
  
  // Get cart total
  static getCartTotal(restaurantId: string, tableId?: string): { subtotal: number; items: number } {
    const cartItems = this.getCartItems(restaurantId, tableId);
    const subtotal = cartItems.reduce((total, item) => total + item.total, 0);
    const items = cartItems.reduce((count, item) => count + item.quantity, 0);
    
    return { subtotal, items };
  }
  
  // Convert cart items to order items
  static convertCartToOrderItems(cartItems: CartItem[]): OrderItem[] {
    return cartItems.map(cartItem => {
      const orderItem: any = {
        id: generateId(),
        menuItemId: cartItem.menuItemId,
        name: cartItem.name,
        price: cartItem.price,
        quantity: cartItem.quantity,
        total: cartItem.total,
      };
      
      // Only add optional fields if they have values
      if (cartItem.customizations && cartItem.customizations.length > 0) {
        orderItem.customizations = cartItem.customizations;
      }
      
      if (cartItem.variants && cartItem.variants.length > 0) {
        orderItem.variants = cartItem.variants;
      }
      
      if (cartItem.notes && cartItem.notes.trim() !== '') {
        orderItem.notes = cartItem.notes.trim();
      }
      
      return orderItem as OrderItem;
    });
  }
}

export class OrderService {
  private static readonly ORDERS_COLLECTION = 'orders';
  
  // Get orders for restaurant (with smart caching)
  static async getOrdersForRestaurant(restaurantId: string, limitCount: number = 50): Promise<ApiResponse<Order[]>> {
    try {
      // Try cache first for recent orders
      const cachedOrders = OrderCache.getOrders(restaurantId);
      if (cachedOrders.length > 0 && OrderCache.isCacheFresh(restaurantId)) {
        return {
          success: true,
          data: cachedOrders.slice(0, limitCount),
        };
      }
      
      console.log('🔍 Fetching orders from Firebase for restaurant:', restaurantId);
      
      // Fetch from Firebase
      const q = query(
        collection(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      const orders = querySnapshot.docs.map(doc => 
        this.convertFirestoreOrder(doc.data(), doc.id)
      );
      
      // Cache the results
      OrderCache.setOrders(restaurantId, orders);
      
      console.log('✅ Orders loaded and cached:', orders.length);
      
      return {
        success: true,
        data: orders,
      };
    } catch (error: any) {
      console.error('❌ Failed to get orders:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Create new order from cart
  static async createOrder(
    restaurantId: string,
    tableId: string,
    staffId: string,
    cartItems: CartItem[],
    taxRate: number = 8.5,
    notes?: string
  ): Promise<ApiResponse<Order>> {
    try {
      if (cartItems.length === 0) {
        return {
          success: false,
          error: 'Cart is empty',
        };
      }
      
      const orderId = generateId();
      const orderNumber = generateOrderNumber(restaurantId);
      
      // Convert cart items to order items
      const orderItems = CartManager.convertCartToOrderItems(cartItems);
      
      // Calculate totals
      const subtotal = orderItems.reduce((total, item) => total + item.total, 0);
      const tax = (subtotal * taxRate) / 100;
      const total = subtotal + tax;
      
      const order: Order = {
        id: orderId,
        restaurantId,
        orderNumber,
        tableId,
        type: 'dine_in',
        status: 'placed',
        items: orderItems,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentStatus: 'pending',
        notes,
        staffId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const orderRef = doc(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION, orderId);
      
      // Prepare data for Firestore, filtering out undefined values
      const firestoreData: any = {
        id: orderId,
        restaurantId,
        orderNumber,
        tableId,
        type: 'dine_in',
        status: 'placed',
        items: orderItems,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentStatus: 'pending',
        staffId,
        createdAt: Timestamp.fromDate(order.createdAt),
        updatedAt: Timestamp.fromDate(order.updatedAt),
      };
      
      // Only add optional fields if they have values
      if (notes && notes.trim() !== '') {
        firestoreData.notes = notes.trim();
      }
      
      // Note: customerId is not included since we don't have customer management yet
      
      await setDoc(orderRef, firestoreData);
      
      // Automatically deduct inventory for order items
      // NOTE: Inventory deduction is now handled during order completion to prevent double deduction
      try {

        
        /* COMMENTED OUT TO PREVENT DOUBLE DEDUCTION
        const inventoryOrderItems = orderItems.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        }));
        
        const inventoryResult = await InventoryService.deductInventoryForOrder(
          orderId,
          inventoryOrderItems,
          restaurantId,
          staffId
        );
        
        if (inventoryResult.success) {

        } else {
          console.warn('⚠️ ORDER CREATION - Failed to deduct inventory for order:', inventoryResult.error);
          // Don't fail the order creation, just log the warning
        }
        */
      } catch (inventoryError) {
        console.warn('⚠️ ORDER CREATION - Inventory deduction error (order still created):', inventoryError);
        // Continue with order creation even if inventory deduction fails
      }
      
      // Add to cache
      OrderCache.addOrder(restaurantId, order);
      
      // Clear cart after successful order
      CartManager.clearCart(restaurantId, tableId);
      
      console.log('✅ Order created and cached:', order.orderNumber);
      
      return {
        success: true,
        data: order,
        message: `Order ${order.orderNumber} placed successfully`,
      };
    } catch (error: any) {
      console.error('❌ Failed to create order:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Update order status
  static async updateOrderStatus(
    orderId: string, 
    restaurantId: string, 
    status: Order['status'], 
    additionalData?: Partial<Order>
  ): Promise<ApiResponse<Order>> {
    try {
      const orderRef = doc(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION, orderId);
      
      const updateData: any = {
        status,
        updatedAt: Timestamp.now(),
        ...additionalData,
      };
      
      // Handle payment status update and inventory deduction
      if (status === 'completed') {
        updateData.paymentStatus = 'paid';
        
        // Get the order first to access its items for inventory deduction
        const orderDoc = await getDoc(orderRef);
        if (orderDoc.exists()) {
          const orderData = this.convertFirestoreOrder(orderDoc.data(), orderDoc.id);
          
          // Deduct inventory when order is completed
          try {
            
            
            const inventoryOrderItems = orderData.items.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
            }));
            
            const { InventoryService } = await import('./inventoryService');
            const inventoryResult = await InventoryService.deductInventoryForOrder(
              orderId,
              inventoryOrderItems,
              restaurantId,
              'system' // Using 'system' as staffId for order completion
            );
            
            if (inventoryResult.success) {
  
            } else {
              console.warn('⚠️ ORDER COMPLETION - Failed to deduct inventory for completed order:', inventoryResult.error);
            }
          } catch (inventoryError) {
            console.warn('⚠️ ORDER COMPLETION - Inventory deduction error for completed order:', inventoryError);
          }
        }
      }
      
      await updateDoc(orderRef, updateData);
      
      // Get updated order from cache and update it
      const cachedOrders = OrderCache.getOrders(restaurantId);
      const orderIndex = cachedOrders.findIndex(o => o.id === orderId);
      
      if (orderIndex !== -1) {
        const updatedOrder = {
          ...cachedOrders[orderIndex],
          status,
          updatedAt: new Date(),
          ...additionalData,
        };
        
        // Update payment status if order completed
        if (status === 'completed') {
          updatedOrder.paymentStatus = 'paid';
        }
        
        // If cancelling an order, clear cache to ensure consistency
        if (status === 'cancelled') {
          console.log(`🗑️ OrderService: Clearing cache after cancelling order ${orderId}`);
          OrderCache.clearCache(restaurantId);
        } else {
          OrderCache.updateOrder(restaurantId, updatedOrder);
        }
        
        return {
          success: true,
          data: updatedOrder,
          message: 'Order status updated successfully',
        };
      }
      
      // Fallback: fetch from Firebase
      const result = await this.getOrderById(orderId, restaurantId);
      return result;
      
    } catch (error: any) {
      console.error('❌ Failed to update order status:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get order by ID
  static async getOrderById(orderId: string, restaurantId: string): Promise<ApiResponse<Order>> {
    try {
      // Try cache first
      const cachedOrders = OrderCache.getOrders(restaurantId);
      const cachedOrder = cachedOrders.find(o => o.id === orderId);
      
      if (cachedOrder) {
        return {
          success: true,
          data: cachedOrder,
        };
      }
      
      // Fetch from Firebase
      const orderRef = doc(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION, orderId);
      const docSnap = await getDoc(orderRef);
      
      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Order not found',
        };
      }
      
      const order = this.convertFirestoreOrder(docSnap.data(), docSnap.id);
      
      return {
        success: true,
        data: order,
      };
    } catch (error: any) {
      console.error('❌ Failed to get order by ID:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get multiple orders by IDs
  static async getOrdersByIds(orderIds: string[], restaurantId: string): Promise<ApiResponse<Order[]>> {
    try {
      if (!orderIds || orderIds.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Try cache first
      const cachedOrders = OrderCache.getOrders(restaurantId);
      const foundOrders: Order[] = [];
      const missingOrderIds: string[] = [];

      // Check which orders we have in cache
      orderIds.forEach(orderId => {
        const cachedOrder = cachedOrders.find(o => o.id === orderId);
        if (cachedOrder) {
          foundOrders.push(cachedOrder);
        } else {
          missingOrderIds.push(orderId);
        }
      });

      // Fetch missing orders from Firebase
      for (const orderId of missingOrderIds) {
        try {
          const orderRef = doc(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION, orderId);
          const docSnap = await getDoc(orderRef);
          
          if (docSnap.exists()) {
            const order = this.convertFirestoreOrder(docSnap.data(), docSnap.id);
            foundOrders.push(order);
          }
        } catch (error) {
          console.warn(`Failed to fetch order ${orderId}:`, error);
          // Continue with other orders
        }
      }

      // Sort by creation date (newest first)
      foundOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return {
        success: true,
        data: foundOrders,
      };
    } catch (error: any) {
      console.error('❌ Failed to get orders by IDs:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get orders by table
  static async getOrdersByTable(restaurantId: string, tableId: string): Promise<ApiResponse<Order[]>> {
    try {
      // Simplified query without orderBy to avoid index requirement
      const q = query(
        collection(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION),
        where('tableId', '==', tableId)
      );
      
      const querySnapshot = await getDocs(q);
      const orders = querySnapshot.docs.map(doc => 
        this.convertFirestoreOrder(doc.data(), doc.id)
      );
      
      // Sort by createdAt descending (client-side sorting)
      orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return {
        success: true,
        data: orders,
      };
    } catch (error: any) {
      console.error('❌ Failed to get orders by table:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get active orders (not completed or cancelled)
  static async getActiveOrders(restaurantId: string): Promise<ApiResponse<Order[]>> {
    try {
      // Simplified query without orderBy to avoid index requirement
      const q = query(
        collection(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION),
        where('status', 'in', ['placed', 'confirmed', 'preparing', 'ready'])
      );
      
      const querySnapshot = await getDocs(q);
      const orders = querySnapshot.docs.map(doc => 
        this.convertFirestoreOrder(doc.data(), doc.id)
      );
      
      // Sort by createdAt ascending (client-side sorting)
      orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      return {
        success: true,
        data: orders,
      };
    } catch (error: any) {
      console.error('❌ Failed to get active orders:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Subscribe to order changes (real-time updates)
  static subscribeToOrders(
    restaurantId: string,
    callback: (orders: Order[]) => void,
    limitCount: number = 50
  ): () => void {
    const q = query(
      collection(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    return onSnapshot(
      q,
      (querySnapshot) => {
        const orders = querySnapshot.docs.map(doc =>
          this.convertFirestoreOrder(doc.data(), doc.id)
        );
        
        // Update cache
        OrderCache.setOrders(restaurantId, orders);
        
        callback(orders);
      },
      (error) => {
        console.error('Orders subscription error:', error);
      }
    );
  }
  
  // Subscribe to active orders only
  static subscribeToActiveOrders(
    restaurantId: string,
    callback: (orders: Order[]) => void
  ): () => void {
    // Simplified query without orderBy to avoid index requirement
    const q = query(
      collection(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION),
      where('status', 'in', ['placed', 'confirmed', 'preparing', 'ready'])
    );
    
    return onSnapshot(
      q,
      (querySnapshot) => {
        const orders = querySnapshot.docs.map(doc =>
          this.convertFirestoreOrder(doc.data(), doc.id)
        );
        
        // Sort by createdAt ascending (client-side sorting)
        orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        callback(orders);
      },
      (error) => {
        console.error('Active orders subscription error:', error);
      }
    );
  }
  
  // Transfer orders from one table to another
  static async transferOrders(
    sourceTableId: string,
    targetTableId: string,
    restaurantId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Get all orders for source table
      const sourceOrdersResult = await this.getOrdersByTable(restaurantId, sourceTableId);
      if (!sourceOrdersResult.success || !sourceOrdersResult.data) {
        return {
          success: false,
          error: 'Failed to get source table orders',
        };
      }

      // Update all source table orders to target table
      const sourceOrders = sourceOrdersResult.data.filter(order => 
        ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status)
      );

      for (const order of sourceOrders) {
        await updateDoc(
          doc(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION, order.id),
          {
            tableId: targetTableId,
            updatedAt: Timestamp.now(),
          }
        );
      }

      // Clear cache to refresh data
      this.clearCache(restaurantId);

      return {
        success: true,
        message: `${sourceOrders.length} orders transferred successfully`,
      };
    } catch (error: any) {
      console.error('❌ Failed to transfer orders:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get merged orders from multiple tables
  static async getMergedOrders(
    tableIds: string[],
    restaurantId: string
  ): Promise<ApiResponse<Order[]>> {
    try {
      const allOrders: Order[] = [];

      for (const tableId of tableIds) {
        const result = await this.getOrdersByTable(restaurantId, tableId);
        if (result.success && result.data) {
          const activeOrders = result.data.filter(order => 
            ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status)
          );
          allOrders.push(...activeOrders);
        }
      }

      // Sort by creation date
      allOrders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return {
        success: true,
        data: allOrders,
      };
    } catch (error: any) {
      console.error('❌ Failed to get merged orders:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Update order notes to indicate merged tables
  static async updateOrderForMerge(
    orderId: string,
    restaurantId: string,
    mergedTableNumbers: string[]
  ): Promise<ApiResponse<Order>> {
    try {
      const orderRef = doc(db, 'restaurants', restaurantId, this.ORDERS_COLLECTION, orderId);
      const mergeNote = `Merged tables: ${mergedTableNumbers.join(', ')}`;
      
      await updateDoc(orderRef, {
        notes: mergeNote,
        updatedAt: Timestamp.now(),
      });

      // Get updated order
      const result = await this.getOrderById(orderId, restaurantId);
      return result;
    } catch (error: any) {
      console.error('❌ Failed to update order for merge:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Clear cache for restaurant
  static clearCache(restaurantId: string): void {
    OrderCache.clearCache(restaurantId);
  }
  
  // Convert Firestore document to Order object
  private static convertFirestoreOrder(data: any, id: string): Order {
    return {
      id,
      restaurantId: data.restaurantId,
      orderNumber: data.orderNumber,
      tableId: data.tableId,
      customerId: data.customerId,
      type: data.type,
      status: data.status,
      items: data.items || [],
      subtotal: data.subtotal,
      tax: data.tax,
      discount: data.discount,
      total: data.total,
      paymentStatus: data.paymentStatus,
      notes: data.notes,
      staffId: data.staffId,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
} 