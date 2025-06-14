// Firebase imports removed as this service primarily uses other services
// and doesn't directly interact with Firestore
import { CustomerService } from './customerService';
import { CouponService } from './couponService';
import { Customer, GamificationUser, SpinWheelSegment, CustomerSpin } from '@/types';
import { GamificationService } from './gamificationService';

export class GamificationIntegrationService {
  
  /**
   * Main integration function called when a user claims a spin reward
   * This adds the user to CRM and creates a coupon in the coupon system
   */
  static async integrateSpinReward(
    restaurantId: string,
    user: GamificationUser,
    spinResult: SpinWheelSegment,
    couponCode: string,
    spinRecord: CustomerSpin
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log('🔄 Starting gamification integration...', {
        restaurantId,
        userId: user.id,
        userName: user.name,
        userPhone: user.phone,
        couponCode,
        spinResult: spinResult.label
      });

      // Step 1: Add/Update customer in CRM (this is critical!)
      const crmResult = await this.addUserToCRM(restaurantId, user);
      if (!crmResult.success) {
        console.error('❌ CRM integration failed:', crmResult.error);
        return {
          success: false,
          error: `Failed to add user to CRM: ${crmResult.error}`
        };
      }

      console.log('✅ User added to CRM successfully:', {
        customerId: crmResult.customer?.id,
        customerName: crmResult.customer?.name,
        customerPhone: crmResult.customer?.phone,
        preferences: crmResult.customer?.preferences
      });

      // Step 2: Create coupon in coupon system
      const couponResult = await this.createGamificationCoupon(
        restaurantId,
        user,
        spinResult,
        couponCode,
        spinRecord
      );

      if (!couponResult.success) {
        console.error('❌ Coupon creation failed:', couponResult.error);
        return {
          success: false,
          error: couponResult.error || 'Failed to create coupon'
        };
      }

      console.log('✅ Coupon created successfully:', {
        couponCode,
        type: spinResult.rewardType,
        value: spinResult.value
      });

      console.log('🎉 Integration completed successfully!');
      console.log('📋 Next steps: Check CRM customers tab and coupon dashboard');

      return {
        success: true,
        message: 'Reward integrated successfully into CRM and coupon system'
      };

    } catch (error) {
      console.error('Error integrating spin reward:', error);
      return {
        success: false,
        error: 'Failed to integrate reward'
      };
    }
  }

  /**
   * Add or update gamification user in the CRM system
   */
  private static async addUserToCRM(
    restaurantId: string,
    user: GamificationUser
  ): Promise<{ success: boolean; customer?: Customer; error?: string }> {
    try {
      console.log('🔍 Checking if customer exists in CRM...', {
        restaurantId,
        userPhone: user.phone,
        userName: user.name
      });

      // Check if customer already exists by phone
      const existingCustomers = await CustomerService.searchCustomers(restaurantId, user.phone);

      console.log('🔍 Customer search result:', {
        success: existingCustomers.success,
        found: existingCustomers.data?.length || 0,
        error: existingCustomers.error
      });
      
      let customer: Customer;

      if (existingCustomers.success && existingCustomers.data && existingCustomers.data.length > 0) {
        // Update existing customer
        const existingCustomer = existingCustomers.data[0];
        
        const updateData: Partial<Customer> = {
          name: user.name, // Update name in case it changed
          email: user.email || existingCustomer.email, // Update email if provided
          lastVisit: new Date(), // Update last visit to today
          preferences: [...(existingCustomer.preferences || []), 'gamification_user'] // Add gamification tag
        };

        const updateResult = await CustomerService.updateCustomer(
          existingCustomer.id,
          restaurantId,
          updateData
        );

        if (updateResult.success && updateResult.data) {
          customer = updateResult.data;
        } else {
          return { success: false, error: 'Failed to update existing customer' };
        }
      } else {
        // Create new customer
        console.log('➕ Creating new customer in CRM...');
        const customerData: Partial<Customer> = {
          name: user.name,
          email: user.email || '',
          phone: user.phone,
          address: '', // Will be filled later if user provides
          preferences: ['gamification_user'], // Tag as gamification user
          totalSpent: 0,
          visitCount: 1,
          lastVisit: new Date()
        };

        console.log('📝 New customer data:', customerData);
        const createResult = await CustomerService.createCustomer(restaurantId, customerData);
        console.log('💾 Customer creation result:', {
          success: createResult.success,
          customerId: createResult.data?.id,
          error: createResult.error
        });
        
        if (createResult.success && createResult.data) {
          customer = createResult.data;
        } else {
          return { success: false, error: 'Failed to create customer' };
        }
      }

      return { success: true, customer };

    } catch (error) {
      console.error('Error adding user to CRM:', error);
      return { success: false, error: 'Failed to add user to CRM' };
    }
  }

  /**
   * Create a coupon in the coupon system from gamification reward
   */
  private static async createGamificationCoupon(
    restaurantId: string,
    user: GamificationUser,
    spinResult: SpinWheelSegment,
    couponCode: string,
    spinRecord: CustomerSpin
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Determine coupon type and configuration based on spin result
      const couponConfig = this.createCouponFromSpinResult(spinResult, couponCode, user, spinRecord);

      // Create the coupon using existing coupon service
      const result = await CouponService.createCoupon(restaurantId, couponConfig);

      return {
        success: result.success,
        error: result.error
      };

    } catch (error) {
      console.error('Error creating gamification coupon:', error);
      return {
        success: false,
        error: 'Failed to create coupon'
      };
    }
  }

  /**
   * Convert spin wheel segment to coupon configuration
   */
  private static createCouponFromSpinResult(
    spinResult: SpinWheelSegment,
    couponCode: string,
    user: GamificationUser,
    spinRecord: CustomerSpin
  ): any {
    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days validity

    // Base coupon configuration
    const baseCoupon = {
      name: `${spinResult.label} - Spin Wheel Reward`,
      description: `Reward from spin wheel game: ${spinResult.value}. Winner: ${user.name} (${user.phone})`,
      code: couponCode.toUpperCase(),
      status: 'active' as const,
      validity: {
        startDate: now,
        endDate: expiryDate,
        usageLimit: 1, // Single use
        perCustomerLimit: 1,
        validDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      targeting: {
        customerSegments: ['all'],
        minOrderValue: 0,
        applicableCategories: [],
        excludedCategories: [],
        paymentMethodRestriction: 'all' as const
      },
      metadata: {
        source: 'gamification_spin_wheel',
        spinRecordId: spinRecord.id,
        userId: user.id,
        userName: user.name,
        userPhone: user.phone,
        spinDate: spinRecord.spinDate,
        segmentId: spinResult.id,
        segmentColor: spinResult.color
      }
    };

    // Configure based on reward type
    switch (spinResult.rewardType) {
      case 'discount_percentage':
        // Extract percentage from value (e.g., "15% off" -> 15)
        const percentageMatch = spinResult.value.match(/(\d+)%/);
        const percentage = percentageMatch ? parseInt(percentageMatch[1]) : 10;
        
        return {
          ...baseCoupon,
          type: 'percentage_discount' as const,
          config: {
            percentage: percentage,
            maxDiscountAmount: 1000 // Cap at ₹1000
          }
        };

      case 'free_item':
        return {
          ...baseCoupon,
          type: 'free_item' as const,
          config: {
            freeItemName: spinResult.label,
            freeItemValue: spinResult.value
          }
        };

      case 'points':
        // Convert points to fixed amount discount
        const pointsMatch = spinResult.value.match(/(\d+)/);
        const points = pointsMatch ? parseInt(pointsMatch[1]) : 50;
        
        return {
          ...baseCoupon,
          type: 'fixed_amount' as const,
          config: {
            discountAmount: Math.min(points, 500) // Cap points at ₹500
          }
        };

      case 'custom':
      default:
        // Default to 10% discount for custom rewards
        return {
          ...baseCoupon,
          type: 'percentage_discount' as const,
          config: {
            percentage: 10,
            maxDiscountAmount: 500
          }
        };
    }
  }

  /**
   * Search for gamification coupons in the coupon system
   */
  static async searchGamificationCoupons(
    restaurantId: string,
    searchTerm: string
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      console.log('🔍 Searching for gamification coupons...', {
        restaurantId,
        searchTerm
      });

      const couponsResult = await CouponService.getCouponsForRestaurant(restaurantId);
      
      console.log('📋 All coupons fetch result:', {
        success: couponsResult.success,
        totalCoupons: couponsResult.data?.length || 0,
        error: couponsResult.error
      });

      if (!couponsResult.success || !couponsResult.data) {
        return { success: false, error: 'Failed to fetch coupons' };
      }

      // Log all coupons for debugging
      console.log('📄 All coupons in system:', couponsResult.data.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        source: c.metadata?.source,
        hasMetadata: !!c.metadata,
        metadataKeys: c.metadata ? Object.keys(c.metadata) : []
      })));

      // Filter for gamification coupons and search term
      const gamificationCoupons = couponsResult.data.filter(coupon => {
        const isGamificationCoupon = coupon.metadata?.source === 'gamification_spin_wheel';
        
        console.log(`🎯 Checking coupon ${coupon.code}:`, {
          hasMetadata: !!coupon.metadata,
          source: coupon.metadata?.source,
          isGamificationCoupon
        });

        if (!isGamificationCoupon) return false;

        if (!searchTerm.trim()) return true;

        const searchLower = searchTerm.toLowerCase();
        const matches = (
          coupon.code.toLowerCase().includes(searchLower) ||
          coupon.metadata?.userName?.toLowerCase().includes(searchLower) ||
          coupon.metadata?.userPhone?.includes(searchTerm) ||
          coupon.name.toLowerCase().includes(searchLower)
        );

        console.log(`🔎 Search match for ${coupon.code}:`, {
          searchTerm: searchLower,
          code: coupon.code.toLowerCase(),
          userName: coupon.metadata?.userName?.toLowerCase(),
          userPhone: coupon.metadata?.userPhone,
          name: coupon.name.toLowerCase(),
          matches
        });

        return matches;
      });

      console.log('🎰 Gamification coupons found:', {
        total: gamificationCoupons.length,
        coupons: gamificationCoupons.map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          userName: c.metadata?.userName,
          userPhone: c.metadata?.userPhone
        }))
      });

      return {
        success: true,
        data: gamificationCoupons
      };

    } catch (error) {
      console.error('Error searching gamification coupons:', error);
      return {
        success: false,
        error: 'Failed to search coupons'
      };
    }
  }

  /**
   * Redeem a gamification coupon
   */
  static async redeemGamificationCoupon(
    restaurantId: string,
    couponCode: string,
    orderId?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // Mark coupon as used
      const coupons = await CouponService.getCouponsForRestaurant(restaurantId);
      
      if (!coupons.success || !coupons.data) {
        return { success: false, error: 'Failed to fetch coupons' };
      }

      const coupon = coupons.data.find(c => 
        c.code.toUpperCase() === couponCode.toUpperCase() && 
        c.metadata?.source === 'gamification_spin_wheel'
      );

      if (!coupon) {
        return { success: false, error: 'Coupon not found' };
      }

      if (coupon.usageCount >= 1) {
        return { success: false, error: 'Coupon already redeemed' };
      }

      // Mark as used
      const result = await CouponService.markCouponAsUsed(coupon.id, restaurantId);
      
      if (result.success) {
        // Record usage if order ID provided
        if (orderId) {
          await CouponService.recordCouponUsage(
            coupon.id,
            restaurantId,
            orderId,
            this.calculateDiscountAmount(coupon),
            0, // Will be filled by POS system
            0, // Will be filled by POS system
            coupon.metadata?.userId
          );
        }

        return {
          success: true,
          message: `Coupon redeemed successfully! ${coupon.name}`
        };
      }

      return result;

    } catch (error) {
      console.error('Error redeeming gamification coupon:', error);
      return {
        success: false,
        error: 'Failed to redeem coupon'
      };
    }
  }

  /**
   * Calculate discount amount from coupon configuration
   */
  private static calculateDiscountAmount(coupon: any): number {
    switch (coupon.type) {
      case 'percentage_discount':
        return coupon.config?.percentage || 0;
      case 'fixed_amount':
        return coupon.config?.discountAmount || 0;
      default:
        return 0;
    }
  }

  /**
   * Get gamification coupon statistics
   */
  static async getGamificationCouponStats(
    restaurantId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const couponsResult = await CouponService.getCouponsForRestaurant(restaurantId);
      
      if (!couponsResult.success || !couponsResult.data) {
        return { success: false, error: 'Failed to fetch coupons' };
      }

      const gamificationCoupons = couponsResult.data.filter(coupon => 
        coupon.metadata?.source === 'gamification_spin_wheel'
      );

      const stats = {
        totalCoupons: gamificationCoupons.length,
        redeemedCoupons: gamificationCoupons.filter(c => c.usageCount > 0).length,
        activeCoupons: gamificationCoupons.filter(c => c.status === 'active' && c.usageCount === 0).length,
        redemptionRate: gamificationCoupons.length > 0 
          ? (gamificationCoupons.filter(c => c.usageCount > 0).length / gamificationCoupons.length) * 100 
          : 0,
        totalDiscountGiven: gamificationCoupons
          .filter(c => c.usageCount > 0)
          .reduce((sum, coupon) => sum + this.calculateDiscountAmount(coupon), 0)
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('Error fetching gamification coupon stats:', error);
      return {
        success: false,
        error: 'Failed to fetch stats'
      };
    }
  }

  /**
   * Get customer's gamification history including spins and coupons
   */
  /**
   * Get customer loyalty information including points and threshold status
   */
  static async getCustomerLoyaltyInfo(
    restaurantId: string,
    customerPhone: string
  ): Promise<{ 
    success: boolean; 
    data?: {
      loyaltyInfo: any; // CustomerLoyaltyInfo
      customer: any; // Customer
    }; 
    error?: string; 
  }> {
    try {
      // First get customer from CRM
      const customersResult = await CustomerService.searchCustomers(restaurantId, customerPhone);
      
      if (!customersResult.success || !customersResult.data || customersResult.data.length === 0) {
        return {
          success: false,
          error: 'Customer not found in CRM'
        };
      }

      const customer = customersResult.data[0];

      // Get loyalty information using the loyalty service
      const { LoyaltyPointsService } = await import('./loyaltyPointsService');
      const loyaltyResult = await LoyaltyPointsService.getCustomerLoyaltyInfo(restaurantId, customer.id);

      if (!loyaltyResult.success) {
        return {
          success: false,
          error: loyaltyResult.error || 'Failed to get loyalty info'
        };
      }

      return {
        success: true,
        data: {
          loyaltyInfo: loyaltyResult.data,
          customer
        }
      };

    } catch (error) {
      console.error('Error getting customer loyalty info:', error);
      return {
        success: false,
        error: 'Failed to get loyalty information'
      };
    }
  }

  static async getCustomerGamificationHistory(
    restaurantId: string,
    customerPhone: string
  ): Promise<{ 
    success: boolean; 
    data?: {
      spins: any[];
      coupons: any[];
      stats: {
        totalSpins: number;
        totalCoupons: number;
        redeemedCoupons: number;
        totalDiscountEarned: number;
        totalDiscountUsed: number;
        firstSpinDate?: Date;
        lastSpinDate?: Date;
      };
    }; 
    error?: string; 
  }> {
    try {
      console.log('🎯 Fetching gamification history for customer:', {
        restaurantId,
        customerPhone
      });

      // Get customer's spin history from gamification service
      const spinsResult = await GamificationService.getCustomerSpinsFromRestaurant(restaurantId, customerPhone);
      
      console.log('🎰 Customer spins result:', {
        success: spinsResult.success,
        spinsCount: spinsResult.data?.length || 0,
        error: spinsResult.error
      });

      const spins = spinsResult.success && spinsResult.data ? spinsResult.data : [];

      // Get customer's gamification coupons
      const couponsResult = await CouponService.getCouponsForRestaurant(restaurantId);
      
      let customerCoupons: any[] = [];
      if (couponsResult.success && couponsResult.data) {
        customerCoupons = couponsResult.data.filter(coupon => 
          coupon.metadata?.source === 'gamification_spin_wheel' &&
          coupon.metadata?.userPhone === customerPhone
        );
      }

      console.log('🎟️ Customer coupons found:', {
        total: customerCoupons.length,
        redeemed: customerCoupons.filter(c => c.usageCount > 0).length
      });

      // Calculate statistics
      const totalDiscountEarned = customerCoupons.reduce((sum, coupon) => {
        return sum + this.calculateDiscountAmount(coupon);
      }, 0);

      const totalDiscountUsed = customerCoupons
        .filter(c => c.usageCount > 0)
        .reduce((sum, coupon) => {
          return sum + this.calculateDiscountAmount(coupon);
        }, 0);

      const spinDates = spins.map(spin => new Date(spin.spinDate)).sort((a, b) => a.getTime() - b.getTime());

      const stats = {
        totalSpins: spins.length,
        totalCoupons: customerCoupons.length,
        redeemedCoupons: customerCoupons.filter(c => c.usageCount > 0).length,
        totalDiscountEarned,
        totalDiscountUsed,
        firstSpinDate: spinDates.length > 0 ? spinDates[0] : undefined,
        lastSpinDate: spinDates.length > 0 ? spinDates[spinDates.length - 1] : undefined
      };

      console.log('📊 Gamification stats for customer:', stats);

      return {
        success: true,
        data: {
          spins: spins.map(spin => ({
            ...spin,
            spinDate: new Date(spin.spinDate),
            // Add restaurant context if needed
            restaurantName: 'Current Restaurant' // Could be enhanced to fetch actual name
          })),
          coupons: customerCoupons.map(coupon => ({
            ...coupon,
            createdAt: new Date(coupon.createdAt),
            validity: {
              ...coupon.validity,
              startDate: new Date(coupon.validity.startDate),
              endDate: new Date(coupon.validity.endDate)
            }
          })),
          stats
        }
      };

    } catch (error) {
      console.error('Error fetching customer gamification history:', error);
      return {
        success: false,
        error: 'Failed to fetch gamification history'
      };
    }
  }
} 