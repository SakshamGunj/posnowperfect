import { Order } from '@/types';
import { CreditService } from './creditService';

export interface RevenueCalculation {
  totalOrderValue: number;
  actualRevenue: number;
  creditAmount: number;
  pendingCreditAmount: number;
}

export class RevenueService {
  /**
   * Calculate actual revenue for a single order, accounting for credits
   */
  static async calculateOrderRevenue(order: Order, restaurantId: string): Promise<RevenueCalculation> {
    try {
      // Get credit transactions for this specific order
      const creditResult = await CreditService.getCreditTransactions(restaurantId);
      
      if (!creditResult.success || !creditResult.data) {
        // No credits found, full order value is revenue
        return {
          totalOrderValue: order.total,
          actualRevenue: order.total,
          creditAmount: 0,
          pendingCreditAmount: 0
        };
      }

      // Find credit transaction for this order
      const orderCredit = creditResult.data.find(credit => credit.orderId === order.id);
      
      if (!orderCredit) {
        // No credit for this order, full order value is revenue
        return {
          totalOrderValue: order.total,
          actualRevenue: order.total,
          creditAmount: 0,
          pendingCreditAmount: 0
        };
      }

      // Calculate amounts
      const totalPaid = orderCredit.amountReceived + 
        (orderCredit.paymentHistory || []).reduce((sum, payment) => sum + payment.amount, 0);
      
      const remainingCredit = orderCredit.totalAmount - totalPaid;
      const creditAmount = orderCredit.totalAmount - orderCredit.amountReceived;

      return {
        totalOrderValue: order.total,
        actualRevenue: totalPaid,
        creditAmount: creditAmount,
        pendingCreditAmount: remainingCredit
      };

    } catch (error) {
      console.error('Error calculating order revenue:', error);
      // Fallback to full order value if calculation fails
      return {
        totalOrderValue: order.total,
        actualRevenue: order.total,
        creditAmount: 0,
        pendingCreditAmount: 0
      };
    }
  }

  /**
   * Calculate actual revenue for multiple orders, accounting for credits
   */
  static async calculateOrdersRevenue(orders: Order[], restaurantId: string): Promise<{
    totalOrderValue: number;
    actualRevenue: number;
    totalCreditAmount: number;
    pendingCreditAmount: number;
    ordersWithCredits: number;
  }> {
    try {
      // Get all credit transactions for the restaurant
      const creditResult = await CreditService.getCreditTransactions(restaurantId);
      
      if (!creditResult.success || !creditResult.data) {
        // No credits found, full order values are revenue
        const totalOrderValue = orders.reduce((sum, order) => sum + order.total, 0);
        return {
          totalOrderValue,
          actualRevenue: totalOrderValue,
          totalCreditAmount: 0,
          pendingCreditAmount: 0,
          ordersWithCredits: 0
        };
      }

      const credits = creditResult.data;
      let totalOrderValue = 0;
      let actualRevenue = 0;
      let totalCreditAmount = 0;
      let pendingCreditAmount = 0;
      let ordersWithCredits = 0;

      orders.forEach(order => {
        totalOrderValue += order.total;

        // Find credit for this order
        const orderCredit = credits.find(credit => credit.orderId === order.id);
        
        if (orderCredit) {
          // Order has credit
          ordersWithCredits++;
          
          const totalPaid = orderCredit.amountReceived + 
            (orderCredit.paymentHistory || []).reduce((sum, payment) => sum + payment.amount, 0);
          
          const remainingCredit = orderCredit.totalAmount - totalPaid;
          const creditAmount = orderCredit.totalAmount - orderCredit.amountReceived;

          actualRevenue += totalPaid;
          totalCreditAmount += creditAmount;
          pendingCreditAmount += remainingCredit;
        } else {
          // No credit, full order value is revenue
          actualRevenue += order.total;
        }
      });

      return {
        totalOrderValue,
        actualRevenue,
        totalCreditAmount,
        pendingCreditAmount,
        ordersWithCredits
      };

    } catch (error) {
      console.error('Error calculating orders revenue:', error);
      // Fallback to full order values if calculation fails
      const totalOrderValue = orders.reduce((sum, order) => sum + order.total, 0);
      return {
        totalOrderValue,
        actualRevenue: totalOrderValue,
        totalCreditAmount: 0,
        pendingCreditAmount: 0,
        ordersWithCredits: 0
      };
    }
  }

  /**
   * Get revenue summary with credit breakdown
   */
  static async getRevenueSummary(orders: Order[], restaurantId: string): Promise<{
    totalOrders: number;
    totalOrderValue: number;
    actualRevenue: number;
    totalCreditAmount: number;
    pendingCreditAmount: number;
    ordersWithCredits: number;
    revenueCollectionRate: number; // Percentage of revenue actually collected
  }> {
    const revenueData = await this.calculateOrdersRevenue(orders, restaurantId);
    
    const revenueCollectionRate = revenueData.totalOrderValue > 0 
      ? (revenueData.actualRevenue / revenueData.totalOrderValue) * 100 
      : 100;

    return {
      totalOrders: orders.length,
      ...revenueData,
      revenueCollectionRate
    };
  }
} 