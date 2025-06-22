import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  MarketplaceProduct, 
  MarketplaceOrder, 
  MarketplaceOrderItem, 
  MarketplaceCartItem,
  Supplier, 
  MarketplaceOrderStatus,
  MarketplaceCategory,
  PricingTier,
  SupplierReview,
  MarketplaceAnalytics,
  MarketplaceNotification,
  OrderStatusHistory
} from '@/types';

// Collections
const SUPPLIERS_COLLECTION = 'marketplace_suppliers';
const PRODUCTS_COLLECTION = 'marketplace_products';
const ORDERS_COLLECTION = 'marketplace_orders';
const REVIEWS_COLLECTION = 'marketplace_reviews';
const CONTRACTS_COLLECTION = 'marketplace_contracts';
const NOTIFICATIONS_COLLECTION = 'marketplace_notifications';

// Marketplace Categories with metadata
export const MARKETPLACE_CATEGORIES = [
  {
    id: 'meat' as MarketplaceCategory,
    name: 'Meat & Poultry',
    icon: '🥩',
    subcategories: ['Fresh Chicken', 'Fresh Beef', 'Fresh Pork', 'Fresh Lamb', 'Frozen Meat', 'Processed Meat']
  },
  {
    id: 'vegetables' as MarketplaceCategory,
    name: 'Vegetables & Produce',
    icon: '🥬',
    subcategories: ['Fresh Vegetables', 'Organic Produce', 'Frozen Vegetables', 'Herbs & Spices', 'Root Vegetables']
  },
  {
    id: 'dairy' as MarketplaceCategory,
    name: 'Dairy & Eggs',
    icon: '🥛',
    subcategories: ['Milk & Cream', 'Cheese', 'Yogurt', 'Butter', 'Eggs']
  },
  {
    id: 'grains' as MarketplaceCategory,
    name: 'Grains & Staples',
    icon: '🌾',
    subcategories: ['Rice', 'Wheat', 'Flour', 'Pasta', 'Bread', 'Cereals']
  },
  {
    id: 'spices' as MarketplaceCategory,
    name: 'Spices & Seasonings',
    icon: '🌶️',
    subcategories: ['Whole Spices', 'Ground Spices', 'Spice Blends', 'Salt', 'Seasonings']
  },
  {
    id: 'equipment' as MarketplaceCategory,
    name: 'Kitchen Equipment',
    icon: '🔧',
    subcategories: ['Cooking Equipment', 'Storage', 'Small Appliances', 'Utensils', 'Safety Equipment']
  },
  {
    id: 'packaging' as MarketplaceCategory,
    name: 'Packaging & Supplies',
    icon: '📦',
    subcategories: ['Food Containers', 'Bags', 'Wrapping', 'Labels', 'Disposables']
  },
  {
    id: 'cleaning' as MarketplaceCategory,
    name: 'Cleaning Supplies',
    icon: '🧽',
    subcategories: ['Detergents', 'Sanitizers', 'Paper Products', 'Cleaning Tools', 'Industrial Cleaners']
  },
  {
    id: 'beverages' as MarketplaceCategory,
    name: 'Beverages',
    icon: '🥤',
    subcategories: ['Soft Drinks', 'Juices', 'Coffee & Tea', 'Water', 'Alcoholic Beverages']
  },
  {
    id: 'frozen' as MarketplaceCategory,
    name: 'Frozen Foods',
    icon: '❄️',
    subcategories: ['Frozen Vegetables', 'Frozen Meat', 'Frozen Seafood', 'Ice Cream', 'Frozen Ready Meals']
  }
];

// Order status configurations
export const ORDER_STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'gray', icon: '📝' },
  submitted: { label: 'Submitted', color: 'blue', icon: '📋' },
  confirmed: { label: 'Confirmed', color: 'green', icon: '✅' },
  processing: { label: 'Processing', color: 'yellow', icon: '⚙️' },
  dispatched: { label: 'Dispatched', color: 'orange', icon: '🚛' },
  in_transit: { label: 'In Transit', color: 'purple', icon: '🚚' },
  delivered: { label: 'Delivered', color: 'green', icon: '📦' },
  cancelled: { label: 'Cancelled', color: 'red', icon: '❌' },
  refunded: { label: 'Refunded', color: 'gray', icon: '💰' }
};

// Helper function to convert Firestore timestamps
const convertTimestamps = (data: any) => {
  if (!data) return data;
  
  const converted = { ...data };
  
  // Convert Timestamp fields to Date objects
  const timestampFields = ['createdAt', 'updatedAt', 'joinedAt', 'lastActiveAt', 'requestedDeliveryDate', 'estimatedDeliveryDate', 'actualDeliveryDate', 'paidAt', 'startDate', 'endDate'];
  
  timestampFields.forEach(field => {
    if (converted[field] && converted[field].toDate) {
      converted[field] = converted[field].toDate();
    }
  });
  
  // Convert nested timestamp arrays (like statusHistory)
  if (converted.statusHistory) {
    converted.statusHistory = converted.statusHistory.map((item: any) => ({
      ...item,
      timestamp: item.timestamp?.toDate ? item.timestamp.toDate() : item.timestamp
    }));
  }
  
  return converted;
};

// Generate unique order number
const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MP-${timestamp.slice(-6)}${random}`;
};

// Calculate best pricing tier for quantity
export const calculateBestPricingTier = (pricingTiers: PricingTier[], quantity: number): PricingTier => {
  const applicableTiers = pricingTiers.filter(tier => 
    quantity >= tier.minQuantity && 
    (!tier.maxQuantity || quantity <= tier.maxQuantity)
  );
  
  if (applicableTiers.length === 0) {
    return pricingTiers[0]; // Return first tier as fallback
  }
  
  // Return the tier with the lowest price per unit
  return applicableTiers.reduce((best, current) => 
    current.pricePerUnit < best.pricePerUnit ? current : best
  );
};

// Alias function for backward compatibility
export const getBestPriceForQuantity = calculateBestPricingTier;

// Calculate cart item pricing
export const calculateCartItemPricing = (product: MarketplaceProduct, quantity: number): MarketplaceCartItem => {
  const selectedTier = calculateBestPricingTier(product.pricingTiers, quantity);
  const unitPrice = selectedTier.pricePerUnit;
  const totalPrice = unitPrice * quantity;
  
  return {
    id: `${product.id}-${Date.now()}`,
    productId: product.id,
    productName: product.name,
    productImage: product.images[0] || '',
    category: product.category,
    supplierId: product.supplierId,
    supplierName: product.supplierName,
    unit: product.unit,
    unitPrice,
    quantity,
    appliedDiscount: selectedTier.discountPercentage || 0,
    totalPrice,
    product
  };
};

// =============================================================================
// SUPPLIER MANAGEMENT
// =============================================================================

export const createSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, SUPPLIERS_COLLECTION), {
      ...supplierData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating supplier:', error);
    throw new Error('Failed to create supplier');
  }
};

export const getSuppliers = async (filters?: {
  category?: MarketplaceCategory;
  city?: string;
  isVerified?: boolean;
  isActive?: boolean;
}): Promise<Supplier[]> => {
  try {
    let q = query(collection(db, SUPPLIERS_COLLECTION));
    
    if (filters?.category) {
      q = query(q, where('categories', 'array-contains', filters.category));
    }
    
    if (filters?.city) {
      q = query(q, where('address.city', '==', filters.city));
    }
    
    if (filters?.isVerified !== undefined) {
      q = query(q, where('isVerified', '==', filters.isVerified));
    }
    
    if (filters?.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Supplier[];
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    throw new Error('Failed to fetch suppliers');
  }
};

export const getSupplier = async (supplierId: string): Promise<Supplier | null> => {
  try {
    const docRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as Supplier;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching supplier:', error);
    throw new Error('Failed to fetch supplier');
  }
};

// =============================================================================
// PRODUCT MANAGEMENT
// =============================================================================

export const createProduct = async (productData: Omit<MarketplaceProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
      ...productData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating product:', error);
    throw new Error('Failed to create product');
  }
};

export const getProducts = async (filters?: {
  category?: MarketplaceCategory;
  supplierId?: string;
  isAvailable?: boolean;
  searchTerm?: string;
  sortBy?: 'name' | 'price' | 'rating' | 'newest';
  limit?: number;
}): Promise<MarketplaceProduct[]> => {
  try {
    let q = query(collection(db, PRODUCTS_COLLECTION));
    
    if (filters?.category) {
      q = query(q, where('category', '==', filters.category));
    }
    
    if (filters?.supplierId) {
      q = query(q, where('supplierId', '==', filters.supplierId));
    }
    
    if (filters?.isAvailable !== undefined) {
      q = query(q, where('isAvailable', '==', filters.isAvailable));
    }
    
    if (filters?.limit) {
      q = query(q, limit(filters.limit));
    }
    
    const snapshot = await getDocs(q);
    let products = snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as MarketplaceProduct[];
    
    // Client-side filtering for search term
    if (filters?.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      products = products.filter(product => 
        product.name.toLowerCase().includes(searchLower) ||
        product.description.toLowerCase().includes(searchLower) ||
        product.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Client-side sorting
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case 'name':
          products.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'price':
          products.sort((a, b) => a.pricingTiers[0].pricePerUnit - b.pricingTiers[0].pricePerUnit);
          break;
        case 'newest':
          products.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          break;
      }
    }
    
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw new Error('Failed to fetch products');
  }
};

export const getProduct = async (productId: string): Promise<MarketplaceProduct | null> => {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, productId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as MarketplaceProduct;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching product:', error);
    throw new Error('Failed to fetch product');
  }
};

export const getFeaturedProducts = async (limitCount: number = 12): Promise<MarketplaceProduct[]> => {
  try {
    // Simplified query to avoid composite index requirement
    // First try to get all available products, then filter and sort in memory
    const q = query(
      collection(db, PRODUCTS_COLLECTION),
      where('isAvailable', '==', true)
    );
    
    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as MarketplaceProduct[];
    
    // Sort by createdAt in memory and apply limit
    const sortedProducts = products
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limitCount);
    
    return sortedProducts;
  } catch (error) {
    console.error('Error fetching featured products:', error);
    throw new Error('Failed to fetch featured products');
  }
};

// =============================================================================
// ORDER MANAGEMENT
// =============================================================================

export const createOrder = async (orderData: Omit<MarketplaceOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const orderNumber = generateOrderNumber();
    const initialStatusHistory: OrderStatusHistory = {
      status: orderData.status,
      timestamp: new Date(),
      notes: 'Order created'
    };
    
    const docRef = await addDoc(collection(db, ORDERS_COLLECTION), {
      ...orderData,
      orderNumber,
      statusHistory: [initialStatusHistory],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating order:', error);
    throw new Error('Failed to create order');
  }
};

export const getOrders = async (restaurantId: string, filters?: {
  status?: MarketplaceOrderStatus;
  supplierId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<MarketplaceOrder[]> => {
  try {
    let q = query(
      collection(db, ORDERS_COLLECTION),
      where('restaurantId', '==', restaurantId)
    );
    
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    
    if (filters?.supplierId) {
      q = query(q, where('supplierId', '==', filters.supplierId));
    }
    
    const snapshot = await getDocs(q);
    let orders = snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as MarketplaceOrder[];
    
    // Client-side date filtering
    if (filters?.dateFrom || filters?.dateTo) {
      orders = orders.filter(order => {
        const orderDate = order.createdAt;
        if (filters?.dateFrom && orderDate < filters.dateFrom) return false;
        if (filters?.dateTo && orderDate > filters.dateTo) return false;
        return true;
      });
    }
    
    // Sort by creation date (newest first)
    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return orders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw new Error('Failed to fetch orders');
  }
};

export const getOrder = async (orderId: string): Promise<MarketplaceOrder | null> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as MarketplaceOrder;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching order:', error);
    throw new Error('Failed to fetch order');
  }
};

export const updateOrderStatus = async (
  orderId: string, 
  newStatus: MarketplaceOrderStatus, 
  notes?: string,
  updatedBy?: string
): Promise<void> => {
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }
    
    const currentOrder = orderSnap.data() as MarketplaceOrder;
    const newStatusHistory: OrderStatusHistory = {
      status: newStatus,
      timestamp: new Date(),
      notes,
      updatedBy
    };
    
    const updatedStatusHistory = [...(currentOrder.statusHistory || []), newStatusHistory];
    
    await updateDoc(orderRef, {
      status: newStatus,
      statusHistory: updatedStatusHistory,
      updatedAt: Timestamp.now()
    });
    
    // Create notification for status update
    await createNotification(currentOrder.restaurantId, {
      type: newStatus === 'delivered' ? 'order_delivered' : 'order_dispatched',
      title: `Order ${currentOrder.orderNumber} ${ORDER_STATUS_CONFIG[newStatus].label}`,
      message: `Your order has been ${ORDER_STATUS_CONFIG[newStatus].label.toLowerCase()}`,
      orderId
    });
    
  } catch (error) {
    console.error('Error updating order status:', error);
    throw new Error('Failed to update order status');
  }
};

// =============================================================================
// CART & CHECKOUT
// =============================================================================

export const calculateOrderTotals = (
  items: MarketplaceCartItem[],
  deliveryFee: number = 0,
  taxRate: number = 0.08,
  discount: number = 0
): {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
} => {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = Math.min(discount, subtotal);
  const taxableAmount = subtotal - discountAmount;
  const tax = taxableAmount * taxRate;
  const total = subtotal + tax + deliveryFee - discountAmount;
  
  return {
    subtotal,
    tax,
    deliveryFee,
    discount: discountAmount,
    total
  };
};

export const processCheckout = async (
  restaurantId: string,
  restaurantName: string,
  cartItems: MarketplaceCartItem[],
  deliveryAddress: MarketplaceOrder['deliveryAddress'],
  requestedDeliveryDate: Date,
  orderNotes?: string,
  deliveryInstructions?: string
): Promise<string> => {
  try {
    // Group items by supplier
    const itemsBySupplier = cartItems.reduce((groups, item) => {
      const supplierId = item.product.supplierId;
      if (!groups[supplierId]) {
        groups[supplierId] = {
          supplier: item.product.supplierName,
          items: []
        };
      }
      groups[supplierId].items.push(item);
      return groups;
    }, {} as Record<string, { supplier: string; items: MarketplaceCartItem[] }>);
    
    const orderIds: string[] = [];
    
    // Create separate orders for each supplier
    for (const [supplierId, { supplier, items }] of Object.entries(itemsBySupplier)) {
      const orderItems: MarketplaceOrderItem[] = items.map(item => ({
        id: generateOrderItemId(),
        productId: item.productId,
        productName: item.product.name,
        productImage: item.product.images[0] || '',
        category: item.product.category,
        unit: item.product.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        specifications: {
          ...item.product.specifications,
          certifications: item.product.specifications.certifications?.join(', ') || ''
        }
      }));
      
      // Calculate totals for this supplier's order
      const totals = calculateOrderTotals(items, 0); // No delivery fee for now
      
      const orderData: Omit<MarketplaceOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'statusHistory'> = {
        restaurantId,
        restaurantName,
        supplierId,
        supplierName: supplier,
        items: orderItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        deliveryFee: totals.deliveryFee,
        discount: totals.discount,
        total: totals.total,
        status: 'submitted',
        paymentStatus: 'pending',
        deliveryAddress,
        requestedDeliveryDate,
        orderNotes,
        deliveryInstructions,
        isContractOrder: false,
        placedBy: restaurantId, // For now, using restaurantId as user ID
        // statusHistory: []
      };
      
      const orderId = await createOrder(orderData);
      orderIds.push(orderId);
    }
    
    return orderIds[0]; // Return first order ID for now
  } catch (error) {
    console.error('Error processing checkout:', error);
    throw new Error('Failed to process checkout');
  }
};

// =============================================================================
// REVIEWS & RATINGS
// =============================================================================

export const createReview = async (reviewData: Omit<SupplierReview, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), {
      ...reviewData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    // Update supplier rating
    await updateSupplierRating(reviewData.supplierId);
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating review:', error);
    throw new Error('Failed to create review');
  }
};

export const getSupplierReviews = async (supplierId: string): Promise<SupplierReview[]> => {
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('supplierId', '==', supplierId),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as SupplierReview[];
  } catch (error) {
    console.error('Error fetching supplier reviews:', error);
    throw new Error('Failed to fetch supplier reviews');
  }
};

const updateSupplierRating = async (supplierId: string): Promise<void> => {
  try {
    const reviews = await getSupplierReviews(supplierId);
    
    if (reviews.length === 0) return;
    
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    
    const supplierRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
    await updateDoc(supplierRef, {
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
      totalReviews: reviews.length,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating supplier rating:', error);
  }
};

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export const createNotification = async (
  userId: string,
  notificationData: Omit<MarketplaceNotification, 'id' | 'userId' | 'isRead' | 'createdAt'>
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
      ...notificationData,
      userId,
      isRead: false,
      createdAt: Timestamp.now()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw new Error('Failed to create notification');
  }
};

export const getUserNotifications = async (userId: string): Promise<MarketplaceNotification[]> => {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as MarketplaceNotification[];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw new Error('Failed to fetch notifications');
  }
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await updateDoc(notificationRef, {
      isRead: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw new Error('Failed to mark notification as read');
  }
};

// =============================================================================
// ANALYTICS & INSIGHTS
// =============================================================================

export const getMarketplaceAnalytics = async (restaurantId: string): Promise<MarketplaceAnalytics> => {
  try {
    const orders = await getOrders(restaurantId);
    const completedOrders = orders.filter(order => order.status === 'delivered');
    
    const totalOrders = completedOrders.length;
    const totalSpent = completedOrders.reduce((sum, order) => sum + order.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    
    // Top suppliers analysis
    const supplierStats = completedOrders.reduce((stats, order) => {
      if (!stats[order.supplierId]) {
        stats[order.supplierId] = {
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          totalSpent: 0,
          orderCount: 0
        };
      }
      stats[order.supplierId].totalSpent += order.total;
      stats[order.supplierId].orderCount += 1;
      return stats;
    }, {} as Record<string, any>);
    
    const topSuppliers = Object.values(supplierStats)
      .sort((a: any, b: any) => b.totalSpent - a.totalSpent)
      .slice(0, 5);
    
    // Top categories analysis
    const categoryStats = completedOrders.reduce((stats, order) => {
      order.items.forEach(item => {
        if (!stats[item.category]) {
          stats[item.category] = {
            category: item.category,
            totalSpent: 0,
            orderCount: 0
          };
        }
        stats[item.category].totalSpent += item.totalPrice;
        stats[item.category].orderCount += 1;
      });
      return stats;
    }, {} as Record<string, any>);
    
    const topCategories = Object.values(categoryStats)
      .sort((a: any, b: any) => b.totalSpent - a.totalSpent)
      .slice(0, 5);
    
    // Monthly spending analysis
    const monthlyStats = completedOrders.reduce((stats, order) => {
      const monthKey = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!stats[monthKey]) {
        stats[monthKey] = { month: monthKey, amount: 0, orderCount: 0 };
      }
      stats[monthKey].amount += order.total;
      stats[monthKey].orderCount += 1;
      return stats;
    }, {} as Record<string, any>);
    
    const monthlySpending = Object.values(monthlyStats)
      .sort((a: any, b: any) => a.month.localeCompare(b.month));
    
    // Delivery performance
    const deliveredOrders = orders.filter(order => order.status === 'delivered' && order.actualDeliveryDate);
    const onTimeDeliveries = deliveredOrders.filter(order => 
      order.actualDeliveryDate! <= order.estimatedDeliveryDate!
    ).length;
    
    const totalDeliveryDays = deliveredOrders.reduce((sum, order) => {
      const deliveryTime = order.actualDeliveryDate!.getTime() - order.createdAt.getTime();
      return sum + (deliveryTime / (1000 * 60 * 60 * 24)); // Convert to days
    }, 0);
    
    const averageDeliveryDays = deliveredOrders.length > 0 ? totalDeliveryDays / deliveredOrders.length : 0;
    
    return {
      totalOrders,
      totalSpent,
      averageOrderValue,
      topSuppliers,
      topCategories,
      monthlySpending,
      deliveryPerformance: {
        onTimeDeliveries,
        totalDeliveries: deliveredOrders.length,
        averageDeliveryDays: Math.round(averageDeliveryDays * 10) / 10
      },
      costSavings: {
        totalSavings: 0, // TODO: Implement savings calculation
        savingsPercentage: 0,
        bulkDiscountSavings: 0,
        contractSavings: 0
      }
    };
  } catch (error) {
    console.error('Error generating marketplace analytics:', error);
    throw new Error('Failed to generate marketplace analytics');
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export const searchProducts = async (searchTerm: string): Promise<MarketplaceProduct[]> => {
  try {
    const products = await getProducts({ searchTerm, isAvailable: true });
    return products;
  } catch (error) {
    console.error('Error searching products:', error);
    throw new Error('Failed to search products');
  }
};

export const getRecommendedProducts = async (restaurantId: string): Promise<MarketplaceProduct[]> => {
  try {
    // Get order history to analyze purchasing patterns
    const orders = await getOrders(restaurantId);
    const purchasedCategories = new Set<MarketplaceCategory>();
    
    orders.forEach(order => {
      order.items.forEach(item => {
        purchasedCategories.add(item.category);
      });
    });
    
    // Get products from frequently purchased categories
    const recommendedProducts: MarketplaceProduct[] = [];
    
    for (const category of Array.from(purchasedCategories).slice(0, 3)) {
      const categoryProducts = await getProducts({ 
        category, 
        isAvailable: true, 
        sortBy: 'newest',
        limit: 4 
      });
      recommendedProducts.push(...categoryProducts);
    }
    
    // If no order history, return featured products
    if (recommendedProducts.length === 0) {
      return await getFeaturedProducts(12);
    }
    
    return recommendedProducts.slice(0, 12);
  } catch (error) {
    console.error('Error getting recommended products:', error);
    throw new Error('Failed to get recommended products');
  }
};

export const validateOrderMinimums = (cartItems: MarketplaceCartItem[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check individual product minimums
  cartItems.forEach(item => {
    if (item.quantity < item.product.minimumOrderQuantity) {
      errors.push(`${item.product.name}: Minimum order quantity is ${item.product.minimumOrderQuantity} ${item.product.unit}`);
    }
    
    if (item.product.maximumOrderQuantity && item.quantity > item.product.maximumOrderQuantity) {
      errors.push(`${item.product.name}: Maximum order quantity is ${item.product.maximumOrderQuantity} ${item.product.unit}`);
    }
  });
  
  // Check supplier minimums
  const itemsBySupplier = cartItems.reduce((groups, item) => {
    const supplierId = item.product.supplierId;
    if (!groups[supplierId]) {
      groups[supplierId] = {
        supplierName: item.product.supplierName,
        total: 0,
        minimum: 0 // Will be fetched from supplier data
      };
    }
    groups[supplierId].total += item.totalPrice;
    return groups;
  }, {} as Record<string, any>);
  
  // TODO: Fetch actual supplier minimum order amounts and validate
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Helper function to generate unique order item IDs
const generateOrderItemId = (): string => {
  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}; 