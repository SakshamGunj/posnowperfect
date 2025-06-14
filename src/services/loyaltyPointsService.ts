import { 
  doc, 
  collection, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  PointsThreshold, 
  PointsConfig, 
  PointsTransaction, 
  CustomerLoyaltyInfo, 
  Customer,
  ApiResponse 
} from '@/types';

export class LoyaltyPointsService {
  
  // Default threshold configurations
  static getDefaultThresholds(): PointsThreshold[] {
    return [
      {
        id: 'bronze',
        name: 'Bronze Member',
        pointsRequired: 0,
        benefits: ['Welcome to loyalty program', 'Spin wheel access'],
        color: '#CD7F32',
        badgeIcon: '🥉',
        description: 'Start your loyalty journey with us!'
      },
      {
        id: 'silver',
        name: 'Silver Member',
        pointsRequired: 100,
        benefits: ['5% extra discount', 'Priority customer support', 'Birthday rewards'],
        color: '#C0C0C0',
        badgeIcon: '🥈',
        description: 'Enjoy enhanced benefits as a valued customer!'
      },
      {
        id: 'gold',
        name: 'Gold Member',
        pointsRequired: 250,
        benefits: ['10% extra discount', 'Free delivery', 'Exclusive offers', 'Early access to new items'],
        color: '#FFD700',
        badgeIcon: '🥇',
        description: 'Premium benefits for our loyal customers!'
      },
      {
        id: 'platinum',
        name: 'Platinum Member',
        pointsRequired: 500,
        benefits: ['15% extra discount', 'Free premium items', 'VIP customer support', 'Personal offers'],
        color: '#E5E4E2',
        badgeIcon: '💎',
        description: 'The ultimate loyalty experience!'
      },
      {
        id: 'diamond',
        name: 'Diamond Member',
        pointsRequired: 1000,
        benefits: ['20% extra discount', 'Complimentary items', 'VIP events access', 'Personal account manager'],
        color: '#B9F2FF',
        badgeIcon: '💍',
        description: 'Elite status with exceptional rewards!'
      }
    ];
  }

  // Create default points configuration
  static getDefaultPointsConfig(): PointsConfig {
    return {
      enabled: true,
      pointsPerSpin: 10,
      thresholds: this.getDefaultThresholds(),
      resetPeriod: 'never'
    };
  }

  // Award points to customer for spin
  static async awardSpinPoints(
    restaurantId: string, 
    customerId: string, 
    spinId: string, 
    pointsToAward: number
  ): Promise<ApiResponse<void>> {
    try {
      // First check if customer exists
      const customerRef = doc(db, `restaurants/${restaurantId}/customers`, customerId);
      const customerSnap = await getDoc(customerRef);
      
      if (!customerSnap.exists()) {
        console.warn(`Customer ${customerId} not found in restaurant ${restaurantId}. Points cannot be awarded to non-existent customer.`);
        return {
          success: false,
          error: 'Customer not found. Cannot award points to non-existent customer.'
        };
      }

      const batch = writeBatch(db);
      
      // Update customer points (customer exists so we can use update)
      batch.update(customerRef, {
        loyaltyPoints: increment(pointsToAward),
        updatedAt: Timestamp.fromDate(new Date())
      });

      // Create points transaction record
      const transactionRef = doc(collection(db, `restaurants/${restaurantId}/pointsTransactions`));
      const transactionData: Omit<PointsTransaction, 'id'> = {
        customerId,
        restaurantId,
        type: 'earned',
        points: pointsToAward,
        source: 'spin_wheel',
        sourceId: spinId,
        description: `Earned ${pointsToAward} points from spin wheel`,
        createdAt: new Date()
      };

      batch.set(transactionRef, {
        ...transactionData,
        createdAt: Timestamp.fromDate(transactionData.createdAt)
      });

      await batch.commit();

      // Update customer threshold if needed
      await this.updateCustomerThreshold(restaurantId, customerId);

      return {
        success: true,
        message: `Awarded ${pointsToAward} points successfully`
      };
    } catch (error) {
      console.error('Error awarding spin points:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to award points'
      };
    }
  }

  // Update customer's current threshold based on points
  static async updateCustomerThreshold(restaurantId: string, customerId: string): Promise<void> {
    try {
      // Get customer current points
      const customerRef = doc(db, `restaurants/${restaurantId}/customers`, customerId);
      const customerSnap = await getDoc(customerRef);
      
      if (!customerSnap.exists()) return;
      
      const customerData = customerSnap.data() as Customer;
      const currentPoints = customerData.loyaltyPoints || 0;

      // Get restaurant's points configuration (from any active spin wheel)
      const spinWheelsQuery = query(
        collection(db, `restaurants/${restaurantId}/spinWheels`),
        where('isActive', '==', true),
        where('pointsConfig.enabled', '==', true),
        limit(1)
      );
      
      const spinWheelsSnap = await getDocs(spinWheelsQuery);
      if (spinWheelsSnap.empty) return;

      const wheelData = spinWheelsSnap.docs[0].data();
      const pointsConfig = wheelData.pointsConfig as PointsConfig;
      
      // Find appropriate threshold
      const eligibleThresholds = pointsConfig.thresholds
        .filter(threshold => currentPoints >= threshold.pointsRequired)
        .sort((a, b) => b.pointsRequired - a.pointsRequired);

      const newThresholdId = eligibleThresholds.length > 0 ? eligibleThresholds[0].id : null;

      // Update if threshold changed
      if (newThresholdId !== customerData.currentThresholdId) {
        await updateDoc(customerRef, {
          currentThresholdId: newThresholdId,
          updatedAt: Timestamp.fromDate(new Date())
        });
      }
    } catch (error) {
      console.error('Error updating customer threshold:', error);
    }
  }

  // Get customer loyalty information
  static async getCustomerLoyaltyInfo(
    restaurantId: string, 
    customerId: string
  ): Promise<ApiResponse<CustomerLoyaltyInfo>> {
    try {
      // Get customer data
      const customerRef = doc(db, `restaurants/${restaurantId}/customers`, customerId);
      const customerSnap = await getDoc(customerRef);
      
      if (!customerSnap.exists()) {
        return {
          success: false,
          error: 'Customer not found'
        };
      }

      const customerData = customerSnap.data() as Customer;
      const currentPoints = customerData.loyaltyPoints || 0;

      // Get points configuration
      const spinWheelsQuery = query(
        collection(db, `restaurants/${restaurantId}/spinWheels`),
        where('isActive', '==', true),
        where('pointsConfig.enabled', '==', true),
        limit(1)
      );
      
      const spinWheelsSnap = await getDocs(spinWheelsQuery);
      if (spinWheelsSnap.empty) {
        return {
          success: false,
          error: 'No active points program found'
        };
      }

      const wheelData = spinWheelsSnap.docs[0].data();
      const pointsConfig = wheelData.pointsConfig as PointsConfig;

      // Calculate current and next thresholds
      const sortedThresholds = pointsConfig.thresholds
        .sort((a, b) => a.pointsRequired - b.pointsRequired);

      const currentThreshold = sortedThresholds
        .filter(t => currentPoints >= t.pointsRequired)
        .sort((a, b) => b.pointsRequired - a.pointsRequired)[0] || sortedThresholds[0];

      const nextThreshold = sortedThresholds
        .find(t => t.pointsRequired > currentPoints) || null;

      // Calculate progress
      let progressToNext = 0;
      let pointsToNext = 0;
      
      if (nextThreshold) {
        const currentThresholdPoints = currentThreshold?.pointsRequired || 0;
        const totalNeeded = nextThreshold.pointsRequired - currentThresholdPoints;
        const progressMade = currentPoints - currentThresholdPoints;
        progressToNext = Math.min(100, (progressMade / totalNeeded) * 100);
        pointsToNext = nextThreshold.pointsRequired - currentPoints;
      }

      // Get customer stats
      const spinsQuery = query(
        collection(db, `restaurants/${restaurantId}/customerSpins`),
        where('customerId', '==', customerId)
      );
      const spinsSnap = await getDocs(spinsQuery);
      
      const totalSpins = spinsSnap.size;
      const totalPointsEarned = spinsSnap.docs.reduce((total, doc) => {
        const data = doc.data();
        return total + (data.pointsEarned || 0);
      }, 0);

      const loyaltyInfo: CustomerLoyaltyInfo = {
        currentPoints,
        currentThreshold,
        nextThreshold,
        progressToNext,
        pointsToNext,
        totalSpins,
        totalPointsEarned,
        memberSince: customerData.createdAt instanceof Date ? customerData.createdAt : new Date()
      };

      return {
        success: true,
        data: loyaltyInfo
      };
    } catch (error) {
      console.error('Error getting customer loyalty info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get loyalty info'
      };
    }
  }

  // Get customer points transactions
  static async getCustomerPointsHistory(
    restaurantId: string, 
    customerId: string, 
    limitCount: number = 50
  ): Promise<ApiResponse<PointsTransaction[]>> {
    try {
      const q = query(
        collection(db, `restaurants/${restaurantId}/pointsTransactions`),
        where('customerId', '==', customerId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const transactions: PointsTransaction[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PointsTransaction;
      });

      return {
        success: true,
        data: transactions
      };
    } catch (error) {
      console.error('Error getting points history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get points history'
      };
    }
  }

  // Get loyalty analytics for restaurant
  static async getLoyaltyAnalytics(restaurantId: string): Promise<ApiResponse<{
    totalCustomersInProgram: number;
    totalPointsAwarded: number;
    averagePointsPerCustomer: number;
    thresholdDistribution: { [thresholdId: string]: number };
    recentActivity: PointsTransaction[];
  }>> {
    try {
      // Get all customers with loyalty points
      const customersQuery = query(
        collection(db, `restaurants/${restaurantId}/customers`),
        where('loyaltyPoints', '>', 0)
      );
      const customersSnap = await getDocs(customersQuery);
      
      // Get recent points transactions
      const transactionsQuery = query(
        collection(db, `restaurants/${restaurantId}/pointsTransactions`),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const transactionsSnap = await getDocs(transactionsQuery);

      const recentActivity: PointsTransaction[] = transactionsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PointsTransaction;
      });

      // Calculate analytics
      let totalPointsAwarded = 0;
      const thresholdDistribution: { [thresholdId: string]: number } = {};
      
      customersSnap.docs.forEach(doc => {
        const customer = doc.data() as Customer;
        totalPointsAwarded += customer.loyaltyPoints || 0;
        
        const thresholdId = customer.currentThresholdId || 'bronze';
        thresholdDistribution[thresholdId] = (thresholdDistribution[thresholdId] || 0) + 1;
      });

      const analytics = {
        totalCustomersInProgram: customersSnap.size,
        totalPointsAwarded,
        averagePointsPerCustomer: customersSnap.size > 0 ? totalPointsAwarded / customersSnap.size : 0,
        thresholdDistribution,
        recentActivity
      };

      return {
        success: true,
        data: analytics
      };
    } catch (error) {
      console.error('Error getting loyalty analytics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analytics'
      };
    }
  }
} 