import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Coupon,
  CouponUsage,
  CouponValidationResult,
  CouponApplication,
  ApiResponse,
  MenuItem,
  PaymentMethod,
} from '@/types';
import { CartItem } from '@/services/orderService';

export class CouponService {
  // Updated to use subcollection under restaurants
  private static getCouponsCollection(restaurantId: string) {
    return collection(db, `restaurants/${restaurantId}/coupons`);
  }
  
  private static usageCollection = 'coupon_usage';

  // COUPON CRUD OPERATIONS
  static async createCoupon(
    restaurantId: string,
    couponData: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>
  ): Promise<ApiResponse<Coupon>> {
    try {
      const coupon: Omit<Coupon, 'id'> = {
        ...couponData,
        restaurantId,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(this.getCouponsCollection(restaurantId), {
        ...coupon,
        createdAt: Timestamp.fromDate(coupon.createdAt),
        updatedAt: Timestamp.fromDate(coupon.updatedAt),
        validity: {
          ...coupon.validity,
          startDate: Timestamp.fromDate(coupon.validity.startDate),
          endDate: Timestamp.fromDate(coupon.validity.endDate),
        },
      });

      const createdCoupon: Coupon = {
        ...coupon,
        id: docRef.id,
      };

      return {
        success: true,
        data: createdCoupon,
        message: 'Coupon created successfully',
      };
    } catch (error) {
      console.error('Error creating coupon:', error);
      return {
        success: false,
        error: 'Failed to create coupon',
      };
    }
  }

  static async getCouponsForRestaurant(restaurantId: string): Promise<ApiResponse<Coupon[]>> {
    try {
      // Using subcollection - no need to filter by restaurantId since it's implicit
      const querySnapshot = await getDocs(this.getCouponsCollection(restaurantId));
      const coupons: Coupon[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        coupons.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          validity: {
            ...data.validity,
            startDate: data.validity.startDate?.toDate() || new Date(),
            endDate: data.validity.endDate?.toDate() || new Date(),
          },
        } as Coupon);
      });

      return {
        success: true,
        data: coupons,
      };
    } catch (error) {
      console.error('Error fetching coupons:', error);
      return {
        success: false,
        error: 'Failed to fetch coupons',
      };
    }
  }

  static async updateCoupon(
    couponId: string,
    restaurantId: string,
    updates: Partial<Coupon>
  ): Promise<ApiResponse<void>> {
    try {
      const couponRef = doc(db, `restaurants/${restaurantId}/coupons`, couponId);
      
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Handle date fields
      if (updates.validity) {
        updateData.validity = {
          ...updates.validity,
          startDate: updates.validity.startDate ? Timestamp.fromDate(updates.validity.startDate) : undefined,
          endDate: updates.validity.endDate ? Timestamp.fromDate(updates.validity.endDate) : undefined,
        };
      }

      await updateDoc(couponRef, updateData);

      return {
        success: true,
        message: 'Coupon updated successfully',
      };
    } catch (error) {
      console.error('Error updating coupon:', error);
      return {
        success: false,
        error: 'Failed to update coupon',
      };
    }
  }

  static async deleteCoupon(couponId: string, restaurantId: string): Promise<ApiResponse<void>> {
    try {
      await deleteDoc(doc(db, `restaurants/${restaurantId}/coupons`, couponId));
      return {
        success: true,
        message: 'Coupon deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting coupon:', error);
      return {
        success: false,
        error: 'Failed to delete coupon',
      };
    }
  }

  // COUPON VALIDATION AND APPLICATION
  static async validateCoupon(
    code: string,
    restaurantId: string,
    cartItems: CartItem[],
    menuItems: MenuItem[],
    customerId?: string,
    paymentMethod?: PaymentMethod
  ): Promise<CouponValidationResult> {
    try {
      // Find coupon by code in restaurant's coupons subcollection
      const q = query(
        this.getCouponsCollection(restaurantId),
        where('code', '==', code.toUpperCase())
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return {
          isValid: false,
          error: 'Invalid coupon code',
        };
      }

      const couponDoc = querySnapshot.docs[0];
      const couponData = couponDoc.data();
      const coupon: Coupon = {
        id: couponDoc.id,
        ...couponData,
        createdAt: couponData.createdAt?.toDate() || new Date(),
        updatedAt: couponData.updatedAt?.toDate() || new Date(),
        validity: {
          ...couponData.validity,
          startDate: couponData.validity.startDate?.toDate() || new Date(),
          endDate: couponData.validity.endDate?.toDate() || new Date(),
        },
      } as Coupon;

      // Basic validations
      const validationResult = await this.performCouponValidation(
        coupon,
        cartItems,
        menuItems,
        customerId,
        paymentMethod
      );

      return validationResult;
    } catch (error) {
      console.error('Error validating coupon:', error);
      return {
        isValid: false,
        error: 'Failed to validate coupon',
      };
    }
  }

  private static async performCouponValidation(
    coupon: Coupon,
    cartItems: CartItem[],
    menuItems: MenuItem[],
    customerId?: string,
    paymentMethod?: PaymentMethod
  ): Promise<CouponValidationResult> {
    // Check if coupon is active
    if (coupon.status !== 'active') {
      return {
        isValid: false,
        error: 'This coupon is not active',
      };
    }

    // Check validity dates
    const now = new Date();
    if (now < coupon.validity.startDate) {
      return {
        isValid: false,
        error: 'This coupon is not yet valid',
      };
    }

    if (now > coupon.validity.endDate) {
      return {
        isValid: false,
        error: 'This coupon has expired',
      };
    }

    // Check time restrictions
    if (coupon.validity.startTime && coupon.validity.endTime) {
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const startTime = parseInt(coupon.validity.startTime.replace(':', ''));
      const endTime = parseInt(coupon.validity.endTime.replace(':', ''));
      
      if (currentTime < startTime || currentTime > endTime) {
        return {
          isValid: false,
          error: `This coupon is only valid between ${coupon.validity.startTime} and ${coupon.validity.endTime}`,
        };
      }
    }

    // Check valid days
    if (coupon.validity.validDays.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getDay()];
      
      if (!coupon.validity.validDays.includes(currentDay)) {
        return {
          isValid: false,
          error: 'This coupon is not valid today',
        };
      }
    }

    // Check usage limits
    if (coupon.validity.usageLimit && coupon.usageCount >= coupon.validity.usageLimit) {
      return {
        isValid: false,
        error: 'This coupon has reached its usage limit',
      };
    }

    // Check per customer limit
    if (coupon.validity.perCustomerLimit && customerId) {
      const customerUsage = await this.getCustomerCouponUsage(coupon.id, customerId);
      if (customerUsage >= coupon.validity.perCustomerLimit) {
        return {
          isValid: false,
          error: 'You have already used this coupon the maximum number of times',
        };
      }
    }

    // Check payment method restrictions
    if (paymentMethod && coupon.targeting.paymentMethodRestriction !== 'all') {
      const allowed = this.isPaymentMethodAllowed(paymentMethod, coupon.targeting.paymentMethodRestriction);
      if (!allowed) {
        return {
          isValid: false,
          error: `This coupon is not valid for ${paymentMethod} payments`,
        };
      }
    }

    // Check minimum order value
    const orderTotal = cartItems.reduce((sum, item) => sum + item.total, 0);
    if (coupon.targeting.minOrderValue && orderTotal < coupon.targeting.minOrderValue) {
      return {
        isValid: false,
        error: `Minimum order value of ₹${coupon.targeting.minOrderValue} required`,
      };
    }

    // Type-specific validations
    const typeValidation = await this.validateCouponType(coupon, cartItems, menuItems);
    if (!typeValidation.isValid) {
      return typeValidation;
    }

    // Calculate discount and free items
    const application = this.calculateCouponApplication(coupon, cartItems, menuItems);

    return {
      isValid: true,
      coupon,
      applicableItems: application.applicableItems,
      discountAmount: application.discountAmount,
      freeItems: application.freeItems,
    };
  }

  private static async validateCouponType(
    coupon: Coupon,
    cartItems: CartItem[],
    menuItems: MenuItem[]
  ): Promise<CouponValidationResult> {
    switch (coupon.type) {
      case 'buy_x_get_y':
        return this.validateBuyXGetY(coupon, cartItems, menuItems);
      
      case 'free_item':
        return this.validateFreeItem(coupon, cartItems, menuItems);
      
      case 'category_specific':
        return this.validateCategorySpecific(coupon, cartItems, menuItems);
      
      case 'minimum_order':
        const orderTotal = cartItems.reduce((sum, item) => sum + item.total, 0);
        if (orderTotal < (coupon.config.minimumOrderValue || 0)) {
          return {
            isValid: false,
            error: `Minimum order of ₹${coupon.config.minimumOrderValue} required`,
          };
        }
        return { isValid: true };
      
      default:
        return { isValid: true };
    }
  }

  private static validateBuyXGetY(
    coupon: Coupon,
    cartItems: CartItem[],
    menuItems: MenuItem[]
  ): CouponValidationResult {
    const config = coupon.config.buyXGetY;
    if (!config) {
      return { isValid: false, error: 'Invalid coupon configuration' };
    }

    // Check if required items are in cart
    let eligibleQuantity = 0;

    if (config.buyItemId) {
      // Specific item BOGO
      const cartItem = cartItems.find(item => item.menuItemId === config.buyItemId);
      eligibleQuantity = cartItem?.quantity || 0;
    } else if (config.buyCategoryId) {
      // Category BOGO
      eligibleQuantity = cartItems
        .filter(item => {
          const menuItem = menuItems.find(m => m.id === item.menuItemId);
          return menuItem?.categoryId === config.buyCategoryId;
        })
        .reduce((sum, item) => sum + item.quantity, 0);
    } else {
      // Any item BOGO
      eligibleQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    if (eligibleQuantity < config.buyQuantity) {
      return {
        isValid: false,
        error: `You need to buy ${config.buyQuantity} eligible items to use this coupon`,
      };
    }

    return { isValid: true };
  }

  private static validateFreeItem(
    coupon: Coupon,
    _cartItems: CartItem[],
    menuItems: MenuItem[]
  ): CouponValidationResult {
    const freeItemId = coupon.config.freeItemId;


    if (freeItemId) {
      const menuItem = menuItems.find(item => item.id === freeItemId);
      if (!menuItem || !menuItem.isAvailable) {
        return {
          isValid: false,
          error: 'The free item is currently not available',
        };
      }
    }

    return { isValid: true };
  }

  private static validateCategorySpecific(
    coupon: Coupon,
    cartItems: CartItem[],
    menuItems: MenuItem[]
  ): CouponValidationResult {
    const targetCategoryId = coupon.config.targetCategoryId;
    
    if (!targetCategoryId) {
      return { isValid: false, error: 'Invalid coupon configuration' };
    }

    const hasEligibleItems = cartItems.some(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      return menuItem?.categoryId === targetCategoryId;
    });

    if (!hasEligibleItems) {
      return {
        isValid: false,
        error: 'No eligible items in cart for this coupon',
      };
    }

    return { isValid: true };
  }

  private static calculateCouponApplication(
    coupon: Coupon,
    cartItems: CartItem[],
    menuItems: MenuItem[]
  ): CouponApplication {
    let discountAmount = 0;
    const freeItems: CouponApplication['freeItems'] = [];
    let applicableItems: string[] = [];

    switch (coupon.type) {
      case 'percentage_discount':
        const orderTotal = cartItems.reduce((sum, item) => sum + item.total, 0);
        discountAmount = (orderTotal * (coupon.config.percentage || 0)) / 100;
        applicableItems = cartItems.map(item => item.menuItemId);
        break;

      case 'fixed_amount':
        discountAmount = coupon.config.discountAmount || 0;
        applicableItems = cartItems.map(item => item.menuItemId);
        break;

      case 'minimum_order':
        discountAmount = coupon.config.discountAmount || 0;
        applicableItems = cartItems.map(item => item.menuItemId);
        break;

      case 'category_specific':
        const categoryItems = cartItems.filter(item => {
          const menuItem = menuItems.find(m => m.id === item.menuItemId);
          return menuItem?.categoryId === coupon.config.targetCategoryId;
        });
        const categoryTotal = categoryItems.reduce((sum, item) => sum + item.total, 0);
        discountAmount = (categoryTotal * (coupon.config.categoryDiscountPercentage || 0)) / 100;
        applicableItems = categoryItems.map(item => item.menuItemId);
        break;

      case 'buy_x_get_y':
        const bogoResult = this.calculateBuyXGetY(coupon, cartItems, menuItems);
        discountAmount = bogoResult.discountAmount;
        freeItems.push(...bogoResult.freeItems);
        applicableItems = bogoResult.applicableItems;
        break;

      case 'free_item':
        const freeItemResult = this.calculateFreeItem(coupon, menuItems);
        if (freeItemResult) {
          freeItems.push(freeItemResult);
        }
        break;
    }

    return {
      coupon,
      discountAmount,
      freeItems,
      applicableItems,
    };
  }

  private static calculateBuyXGetY(
    coupon: Coupon,
    cartItems: CartItem[],
    menuItems: MenuItem[]
  ): { discountAmount: number; freeItems: CouponApplication['freeItems']; applicableItems: string[] } {
    const config = coupon.config.buyXGetY!;
    let discountAmount = 0;
    const freeItems: CouponApplication['freeItems'] = [];
    const applicableItems: string[] = [];

    // Calculate how many free items customer gets
    let eligibleQuantity = 0;
    
    if (config.buyItemId) {
      const cartItem = cartItems.find(item => item.menuItemId === config.buyItemId);
      eligibleQuantity = cartItem?.quantity || 0;
      if (cartItem) applicableItems.push(cartItem.menuItemId);
    } else if (config.buyCategoryId) {
      const categoryItems = cartItems.filter(item => {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        return menuItem?.categoryId === config.buyCategoryId;
      });
      eligibleQuantity = categoryItems.reduce((sum, item) => sum + item.quantity, 0);
      applicableItems.push(...categoryItems.map(item => item.menuItemId));
    }

    const freeQuantity = Math.floor(eligibleQuantity / config.buyQuantity) * config.getQuantity;
    
    if (freeQuantity > 0) {
      const getItemId = config.getItemId || config.buyItemId;
      if (getItemId) {
        const menuItem = menuItems.find(item => item.id === getItemId);
        if (menuItem) {
          if (config.getDiscountPercentage && config.getDiscountPercentage < 100) {
            // Partial discount (like 50% off)
            discountAmount = (menuItem.price * freeQuantity * config.getDiscountPercentage) / 100;
          } else {
            // Completely free
            freeItems.push({
              menuItemId: getItemId,
              quantity: freeQuantity,
              name: menuItem.name,
              price: menuItem.price,
            });
          }
        }
      }
    }

    return { discountAmount, freeItems, applicableItems };
  }

  private static calculateFreeItem(
    coupon: Coupon,
    menuItems: MenuItem[]
  ): CouponApplication['freeItems'][0] | null {
    const freeItemId = coupon.config.freeItemId;
    
    if (freeItemId) {
      const menuItem = menuItems.find(item => item.id === freeItemId);
      if (menuItem && menuItem.isAvailable) {
        return {
          menuItemId: freeItemId,
          quantity: 1,
          name: menuItem.name,
          price: menuItem.price,
        };
      }
    }

    return null;
  }

  private static isPaymentMethodAllowed(
    paymentMethod: PaymentMethod,
    restriction: string
  ): boolean {
    switch (restriction) {
      case 'all':
        return true;
      case 'cash_only':
        return paymentMethod === 'cash';
      case 'upi_only':
        return paymentMethod === 'upi';
      case 'bank_only':
        return paymentMethod === 'bank';
      case 'exclude_cash':
        return paymentMethod !== 'cash';
      default:
        return true;
    }
  }

  private static async getCustomerCouponUsage(couponId: string, customerId: string): Promise<number> {
    try {
      const q = query(
        collection(db, this.usageCollection),
        where('couponId', '==', couponId),
        where('customerId', '==', customerId)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error fetching customer coupon usage:', error);
      return 0;
    }
  }

  // COUPON USAGE TRACKING
  static async recordCouponUsage(
    couponId: string,
    restaurantId: string,
    orderId: string,
    discountAmount: number,
    originalAmount: number,
    finalAmount: number,
    customerId?: string
  ): Promise<ApiResponse<void>> {
    try {
      const batch = writeBatch(db);

      // Update coupon usage count
      const couponRef = doc(db, `restaurants/${restaurantId}/coupons`, couponId);
      const couponDoc = await getDoc(couponRef);

      if (couponDoc.exists()) {
        const currentUsageCount = couponDoc.data().usageCount || 0;
        batch.update(couponRef, {
          usageCount: currentUsageCount + 1,
          updatedAt: Timestamp.fromDate(new Date()),
        });
      }

      // Create usage record
      const usageData: Omit<CouponUsage, 'id'> = {
        couponId,
        restaurantId,
        orderId,
        customerId,
        discountAmount,
        originalAmount,
        finalAmount,
        usedAt: new Date(),
      };

      const usageRef = doc(collection(db, this.usageCollection));
      batch.set(usageRef, {
        ...usageData,
        usedAt: Timestamp.fromDate(usageData.usedAt),
      });

      await batch.commit();

      return {
        success: true,
        message: 'Coupon usage recorded successfully',
      };
    } catch (error) {
      console.error('Error recording coupon usage:', error);
      return {
        success: false,
        error: 'Failed to record coupon usage',
      };
    }
  }

  // UTILITY METHODS
  static generateCouponCode(prefix: string = ''): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = prefix;
    
    for (let i = 0; i < (8 - prefix.length); i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  static async getCouponAnalytics(restaurantId: string, days: number = 30): Promise<ApiResponse<any>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get all coupons for restaurant
      const couponsResult = await this.getCouponsForRestaurant(restaurantId);
      if (!couponsResult.success || !couponsResult.data) {
        return { success: false, error: 'Failed to fetch coupons' };
      }

      const coupons = couponsResult.data;

      // Get usage data
      const usageQuery = query(
        collection(db, this.usageCollection),
        where('restaurantId', '==', restaurantId),
        where('usedAt', '>=', Timestamp.fromDate(startDate))
      );

      const usageSnapshot = await getDocs(usageQuery);
      const usages: CouponUsage[] = usageSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        usedAt: doc.data().usedAt?.toDate() || new Date(),
      } as CouponUsage));

      // Calculate analytics
      const totalCouponsCreated = coupons.length;
      const totalCouponsUsed = usages.length;
      const totalDiscountGiven = usages.reduce((sum, usage) => sum + usage.discountAmount, 0);
      const averageDiscountPerUsage = totalCouponsUsed > 0 ? totalDiscountGiven / totalCouponsUsed : 0;

      const topCoupons = this.getTopCoupons(usages);

      return {
        success: true,
        data: {
          totalCouponsCreated,
          totalCouponsUsed,
          totalDiscountGiven,
          averageDiscountPerUsage,
          redemptionRate: totalCouponsCreated > 0 ? (totalCouponsUsed / totalCouponsCreated) * 100 : 0,
          topCoupons,
          usageHistory: usages,
        },
      };
    } catch (error) {
      console.error('Error fetching coupon analytics:', error);
      return {
        success: false,
        error: 'Failed to fetch coupon analytics',
      };
    }
  }

  private static getTopCoupons(usages: CouponUsage[]): Array<{ couponId: string; count: number; totalDiscount: number }> {
    const couponStats: { [key: string]: { count: number; totalDiscount: number } } = {};

    usages.forEach(usage => {
      if (!couponStats[usage.couponId]) {
        couponStats[usage.couponId] = { count: 0, totalDiscount: 0 };
      }
      couponStats[usage.couponId].count++;
      couponStats[usage.couponId].totalDiscount += usage.discountAmount;
    });

    return Object.entries(couponStats)
      .map(([couponId, stats]) => ({ couponId, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  static async markCouponAsUsed(couponId: string, restaurantId: string): Promise<ApiResponse<void>> {
    try {
      const couponRef = doc(db, `restaurants/${restaurantId}/coupons`, couponId);
      const couponDoc = await getDoc(couponRef);

      if (!couponDoc.exists()) {
        return {
          success: false,
          error: 'Coupon not found',
        };
      }

      const currentUsageCount = couponDoc.data().usageCount || 0;
      await updateDoc(couponRef, {
        usageCount: currentUsageCount + 1,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      return {
        success: true,
        message: 'Coupon marked as used',
      };
    } catch (error) {
      console.error('Error marking coupon as used:', error);
      return {
        success: false,
        error: 'Failed to mark coupon as used',
      };
    }
  }
} 