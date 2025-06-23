import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SpinWheelConfig, SpinWheelSegment, CustomerSpin, SpinWheelStats, ApiResponse } from '@/types';

export class GamificationService {
  // Get the base URL for shareable links - always use production domain
  private static getBaseUrl(): string {
    return 'https://pos.tenversemedia.tech';
  }

  // Spin Wheel Configuration Management
  static async createSpinWheel(restaurantId: string, config: Omit<SpinWheelConfig, 'id' | 'createdAt' | 'updatedAt' | 'shareableLink' | 'totalSpins' | 'totalRedemptions'>): Promise<ApiResponse<SpinWheelConfig>> {
    try {
      const now = new Date();
      // Get restaurant slug for the shareable link
      const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
      const restaurantSlug = restaurantDoc.exists() ? restaurantDoc.data().slug : restaurantId;
      
      // Generate shareable link with proper domain handling
      const baseUrl = this.getBaseUrl();
      const shareableLink = baseUrl ? `${baseUrl}/${restaurantSlug}/spin-wheel` : `/${restaurantSlug}/spin-wheel`;
      
      const spinWheelData: Omit<SpinWheelConfig, 'id'> = {
        ...config,
        restaurantId,
        createdAt: now,
        updatedAt: now,
        shareableLink,
        totalSpins: 0,
        totalRedemptions: 0,
      };

      const docRef = await addDoc(collection(db, `restaurants/${restaurantId}/spinWheels`), {
        ...spinWheelData,
        createdAt: Timestamp.fromDate(spinWheelData.createdAt),
        updatedAt: Timestamp.fromDate(spinWheelData.updatedAt),
      });

      const createdSpinWheel: SpinWheelConfig = {
        ...spinWheelData,
        id: docRef.id,
      };

      return {
        success: true,
        data: createdSpinWheel,
        message: 'Spin wheel created successfully'
      };
    } catch (error) {
      console.error('Error creating spin wheel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create spin wheel'
      };
    }
  }

  static async getSpinWheelsForRestaurant(restaurantId: string): Promise<ApiResponse<SpinWheelConfig[]>> {
    try {
      const q = query(
        collection(db, `restaurants/${restaurantId}/spinWheels`),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const spinWheels: SpinWheelConfig[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as SpinWheelConfig;
      });

      return {
        success: true,
        data: spinWheels
      };
    } catch (error) {
      console.error('Error fetching spin wheels:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch spin wheels'
      };
    }
  }

  static async getSpinWheelById(restaurantId: string, spinWheelId: string): Promise<ApiResponse<SpinWheelConfig>> {
    try {
      const docRef = doc(db, `restaurants/${restaurantId}/spinWheels`, spinWheelId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Spin wheel not found'
        };
      }

      const data = docSnap.data();
      const spinWheel: SpinWheelConfig = {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as SpinWheelConfig;

      return {
        success: true,
        data: spinWheel
      };
    } catch (error) {
      console.error('Error fetching spin wheel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch spin wheel'
      };
    }
  }

  static async updateSpinWheel(restaurantId: string, spinWheelId: string, updates: Partial<SpinWheelConfig>): Promise<ApiResponse<SpinWheelConfig>> {
    try {
      const docRef = doc(db, `restaurants/${restaurantId}/spinWheels`, spinWheelId);
      
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      await updateDoc(docRef, updateData);

      const updatedDoc = await getDoc(docRef);
      const data = updatedDoc.data();
      
      const spinWheel: SpinWheelConfig = {
        id: updatedDoc.id,
        ...data,
        createdAt: data?.createdAt?.toDate() || new Date(),
        updatedAt: data?.updatedAt?.toDate() || new Date(),
      } as SpinWheelConfig;

      return {
        success: true,
        data: spinWheel,
        message: 'Spin wheel updated successfully'
      };
    } catch (error) {
      console.error('Error updating spin wheel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update spin wheel'
      };
    }
  }

  // Utility function to fix shareable links for existing spin wheels
  static async fixSpinWheelShareableLinks(restaurantId: string): Promise<ApiResponse<number>> {
    try {
      const wheelsResult = await this.getSpinWheelsForRestaurant(restaurantId);
      if (!wheelsResult.success || !wheelsResult.data) {
        return { success: false, error: 'Failed to load spin wheels' };
      }

      const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
      const restaurantSlug = restaurantDoc.exists() ? restaurantDoc.data().slug : restaurantId;
      
      const baseUrl = this.getBaseUrl();
      const correctShareableLink = baseUrl ? `${baseUrl}/${restaurantSlug}/spin-wheel` : `/${restaurantSlug}/spin-wheel`;
      
      let fixedCount = 0;
      
      for (const wheel of wheelsResult.data) {
        // Check if the link needs fixing (contains wrong domain)
        if (wheel.shareableLink !== correctShareableLink && 
            (wheel.shareableLink.includes('pos.') || wheel.shareableLink.includes('admin.') || wheel.shareableLink.includes('tenversemedia'))) {
          
          const wheelDocRef = doc(db, `restaurants/${restaurantId}/spinWheels`, wheel.id);
          await updateDoc(wheelDocRef, {
            shareableLink: correctShareableLink,
            updatedAt: Timestamp.fromDate(new Date())
          });
          
          fixedCount++;
          console.log(`Fixed shareable link for wheel: ${wheel.name}`);
        }
      }

      return {
        success: true,
        data: fixedCount,
        message: `Fixed ${fixedCount} spin wheel links`
      };
    } catch (error) {
      console.error('Error fixing spin wheel links:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fix spin wheel links'
      };
    }
  }

  static async deleteSpinWheel(restaurantId: string, spinWheelId: string): Promise<ApiResponse<void>> {
    try {
      const docRef = doc(db, `restaurants/${restaurantId}/spinWheels`, spinWheelId);
      await deleteDoc(docRef);

      return {
        success: true,
        message: 'Spin wheel deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting spin wheel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete spin wheel'
      };
    }
  }

  // Customer Spin Management
  static async recordCustomerSpin(spinData: Omit<CustomerSpin, 'id' | 'spinDate'>): Promise<ApiResponse<CustomerSpin>> {
    try {
      const now = new Date();
      
      // Get spin wheel configuration to check for points
      const wheelResult = await this.getSpinWheelById(spinData.restaurantId, spinData.spinWheelId);
      let pointsEarned = 0;
      
      if (wheelResult.success && wheelResult.data?.pointsConfig?.enabled) {
        pointsEarned = wheelResult.data.pointsConfig.pointsPerSpin;
      }

      const customerSpinData: Omit<CustomerSpin, 'id'> = {
        ...spinData,
        pointsEarned,
        spinDate: now,
      };

      const docRef = await addDoc(collection(db, `restaurants/${spinData.restaurantId}/customerSpins`), {
        ...customerSpinData,
        spinDate: Timestamp.fromDate(customerSpinData.spinDate),
        redeemedAt: customerSpinData.redeemedAt ? Timestamp.fromDate(customerSpinData.redeemedAt) : null,
      });

      // Update spin wheel stats
      await this.incrementSpinWheelStats(spinData.restaurantId, spinData.spinWheelId, 'spins');

      const recordedSpin: CustomerSpin = {
        ...customerSpinData,
        id: docRef.id,
      };

      // Award points to customer if applicable
      if (pointsEarned > 0 && spinData.customerId) {
        try {
          const { LoyaltyPointsService } = await import('./loyaltyPointsService');
          const pointsResult = await LoyaltyPointsService.awardSpinPoints(
            spinData.restaurantId,
            spinData.customerId,
            docRef.id,
            pointsEarned
          );
          
          // Log the result but don't fail the spin if points can't be awarded
          if (!pointsResult.success) {
            console.warn('Points could not be awarded:', pointsResult.error);
            console.info('This is normal for gamification users who do not have corresponding customer records in CRM.');
          }
        } catch (error) {
          console.warn('Error awarding points:', error);
          console.info('This is normal for gamification users who do not have corresponding customer records in CRM.');
        }
      }

      return {
        success: true,
        data: recordedSpin,
        message: 'Spin recorded successfully'
      };
    } catch (error) {
      console.error('Error recording customer spin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record spin'
      };
    }
  }

  static async getCustomerSpinsToday(restaurantId: string, customerPhone: string): Promise<ApiResponse<CustomerSpin[]>> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Use the simplest possible query - just filter by phone
      // We'll handle date filtering and sorting in memory
      const q = query(
        collection(db, `restaurants/${restaurantId}/customerSpins`),
        where('customerPhone', '==', customerPhone)
      );

      const querySnapshot = await getDocs(q);
      const allSpins: CustomerSpin[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          spinDate: data.spinDate?.toDate() || new Date(),
          redeemedAt: data.redeemedAt?.toDate(),
        } as CustomerSpin;
      });

      // Filter for today's spins in memory
      const todaySpins = allSpins.filter(spin => {
        const spinDate = new Date(spin.spinDate);
        spinDate.setHours(0, 0, 0, 0);
        return spinDate.getTime() === today.getTime();
      });

      return {
        success: true,
        data: todaySpins
      };
    } catch (error) {
      console.error('Error fetching customer spins today:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customer spins'
      };
    }
  }

  static async redeemSpin(restaurantId: string, spinId: string): Promise<ApiResponse<void>> {
    try {
      const docRef = doc(db, `restaurants/${restaurantId}/customerSpins`, spinId);
      await updateDoc(docRef, {
        isRedeemed: true,
        redeemedAt: Timestamp.fromDate(new Date()),
      });

      // Get spin data to update wheel stats
      const spinDoc = await getDoc(docRef);
      if (spinDoc.exists()) {
        const spinData = spinDoc.data() as CustomerSpin;
        await this.incrementSpinWheelStats(restaurantId, spinData.spinWheelId, 'redemptions');
      }

      return {
        success: true,
        message: 'Spin redeemed successfully'
      };
    } catch (error) {
      console.error('Error redeeming spin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to redeem spin'
      };
    }
  }

  static async claimSpinReward(
    restaurantId: string, 
    spinId: string, 
    claimData: {
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      couponCode: string;
    }
  ): Promise<ApiResponse<void>> {
    try {
      const docRef = doc(db, `restaurants/${restaurantId}/customerSpins`, spinId);
      await updateDoc(docRef, {
        customerName: claimData.customerName,
        customerPhone: claimData.customerPhone,
        customerEmail: claimData.customerEmail || null,
        couponCode: claimData.couponCode,
        isClaimed: true,
        claimedAt: Timestamp.fromDate(new Date()),
      });

      return {
        success: true,
        message: 'Reward claimed successfully'
      };
    } catch (error) {
      console.error('Error claiming reward:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim reward'
      };
    }
  }

  static async getCustomerSpinsByPhone(_customerPhone: string): Promise<ApiResponse<CustomerSpin[]>> {
    try {
      // This is a cross-restaurant query, so we need to implement differently
      // For now, we'll get spins from a specific restaurant
      // In production, you might want to create a separate collection for cross-restaurant customer data
      
      // For demo purposes, we'll assume we have a way to identify the restaurant
      // In real implementation, you'd pass the restaurantId or search across all restaurants
      
      return {
        success: false,
        error: 'This method needs restaurant context. Use getCustomerSpinsFromRestaurant instead.'
      };
    } catch (error) {
      console.error('Error fetching customer spins:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customer spins'
      };
    }
  }

  static async getCustomerSpinsFromRestaurant(restaurantId: string, customerPhone: string): Promise<ApiResponse<CustomerSpin[]>> {
    try {
      // Use the simplest possible query - just filter by phone
      const q = query(
        collection(db, `restaurants/${restaurantId}/customerSpins`),
        where('customerPhone', '==', customerPhone)
      );

      const querySnapshot = await getDocs(q);
      const allSpins: CustomerSpin[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          spinDate: data.spinDate?.toDate() || new Date(),
          redeemedAt: data.redeemedAt?.toDate(),
        } as CustomerSpin;
      });

      // Sort by spinDate in memory and limit to recent 50
      const sortedSpins = allSpins
        .sort((a, b) => b.spinDate.getTime() - a.spinDate.getTime())
        .slice(0, 50);

      return {
        success: true,
        data: sortedSpins
      };
    } catch (error) {
      console.error('Error fetching customer spins from restaurant:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customer spins'
      };
    }
  }

  // Simple method to count today's spins for a specific spin wheel
  static async getCustomerSpinsCountToday(restaurantId: string, customerPhone: string, spinWheelId?: string): Promise<ApiResponse<number>> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Build query with phone filter and optional spinWheelId filter
      let q = query(
        collection(db, `restaurants/${restaurantId}/customerSpins`),
        where('customerPhone', '==', customerPhone)
      );
      
      // If spinWheelId is provided, filter by it to get spin count for specific wheel only
      if (spinWheelId) {
        q = query(
          collection(db, `restaurants/${restaurantId}/customerSpins`),
          where('customerPhone', '==', customerPhone),
          where('spinWheelId', '==', spinWheelId)
        );
      }

      const querySnapshot = await getDocs(q);
      
      // Count today's spins in memory
      let todayCount = 0;
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const spinDate = data.spinDate?.toDate() || new Date();
        spinDate.setHours(0, 0, 0, 0);
        
        if (spinDate.getTime() === today.getTime()) {
          todayCount++;
        }
      });

      return {
        success: true,
        data: todayCount
      };
    } catch (error) {
      console.error('Error counting customer spins today:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count customer spins'
      };
    }
  }

  // Analytics and Stats
  static async getSpinWheelStats(restaurantId: string, spinWheelId: string): Promise<ApiResponse<SpinWheelStats>> {
    try {
      const q = query(
        collection(db, `restaurants/${restaurantId}/customerSpins`),
        where('spinWheelId', '==', spinWheelId)
      );

      const querySnapshot = await getDocs(q);
      const spins: CustomerSpin[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          spinDate: data.spinDate?.toDate() || new Date(),
          redeemedAt: data.redeemedAt?.toDate(),
        } as CustomerSpin;
      });

      const totalSpins = spins.length;
      const totalRedemptions = spins.filter(spin => spin.isRedeemed).length;
      const redemptionRate = totalSpins > 0 ? (totalRedemptions / totalSpins) * 100 : 0;

      // Calculate popular segments
      const segmentCounts: { [key: string]: { count: number; label: string } } = {};
      spins.forEach(spin => {
        if (!segmentCounts[spin.resultSegmentId]) {
          segmentCounts[spin.resultSegmentId] = { count: 0, label: spin.resultMessage };
        }
        segmentCounts[spin.resultSegmentId].count++;
      });

      const popularSegments = Object.entries(segmentCounts)
        .map(([segmentId, data]) => ({ segmentId, count: data.count, label: data.label }))
        .sort((a, b) => b.count - a.count);

      // Calculate daily spins for last 30 days
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const dailySpins = last30Days.map(date => {
        const count = spins.filter(spin => 
          spin.spinDate.toISOString().split('T')[0] === date
        ).length;
        return { date, count };
      });

      const stats: SpinWheelStats = {
        totalSpins,
        totalRedemptions,
        redemptionRate,
        popularSegments,
        dailySpins,
        customerEngagement: totalSpins > 0 ? (new Set(spins.map(s => s.customerPhone || s.customerEmail)).size / totalSpins) * 100 : 0,
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error fetching spin wheel stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stats'
      };
    }
  }

  // Helper Methods
  private static async incrementSpinWheelStats(restaurantId: string, spinWheelId: string, type: 'spins' | 'redemptions'): Promise<void> {
    try {
      const docRef = doc(db, `restaurants/${restaurantId}/spinWheels`, spinWheelId);
      const field = type === 'spins' ? 'totalSpins' : 'totalRedemptions';
      
      const currentDoc = await getDoc(docRef);
      if (currentDoc.exists()) {
        const currentValue = currentDoc.data()[field] || 0;
        await updateDoc(docRef, {
          [field]: currentValue + 1,
          updatedAt: Timestamp.fromDate(new Date()),
        });
      }
    } catch (error) {
      console.error(`Error incrementing ${type}:`, error);
    }
  }

  // Generate default 8 segments for new spin wheel
  static getDefaultSegments(): SpinWheelSegment[] {
    return [
      {
        id: '1',
        label: '10% Off',
        value: '10% discount on your next order',
        color: '#FF6B6B',
        probability: 20,
        rewardType: 'discount_percentage',
        rewardValue: 10,
      },
      {
        id: '2',
        label: 'Free Drink',
        value: 'Free beverage with any meal',
        color: '#4ECDC4',
        probability: 15,
        rewardType: 'custom',
        customMessage: 'Free drink with any meal purchase',
      },
      {
        id: '3',
        label: '5% Off',
        value: '5% discount on your order',
        color: '#45B7D1',
        probability: 25,
        rewardType: 'discount_percentage',
        rewardValue: 5,
      },
      {
        id: '4',
        label: '$5 Off',
        value: '$5 discount on orders over $25',
        color: '#96CEB4',
        probability: 15,
        rewardType: 'discount_fixed',
        rewardValue: 5,
      },
      {
        id: '5',
        label: 'Better Luck',
        value: 'Try again tomorrow!',
        color: '#FFEAA7',
        probability: 10,
        rewardType: 'custom',
        customMessage: 'Better luck next time! Come back tomorrow.',
      },
      {
        id: '6',
        label: '15% Off',
        value: '15% discount on your next order',
        color: '#DDA0DD',
        probability: 8,
        rewardType: 'discount_percentage',
        rewardValue: 15,
      },
      {
        id: '7',
        label: 'Free Appetizer',
        value: 'Free appetizer with main course',
        color: '#98D8C8',
        probability: 5,
        rewardType: 'custom',
        customMessage: 'Free appetizer with any main course order',
      },
      {
        id: '8',
        label: '20% Off',
        value: '20% discount - Lucky you!',
        color: '#F7DC6F',
        probability: 2,
        rewardType: 'discount_percentage',
        rewardValue: 20,
      },
    ];
  }
} 