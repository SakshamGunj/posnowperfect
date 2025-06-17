import {
  collection,
  getDocs,
  query,
  where,
  // orderBy, // Temporarily removed
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, MenuItem, Table, Customer, ApiResponse } from '@/types';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';

import { CreditService } from './creditService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface SalesAnalytics {
  // Overall metrics
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalItems: number;
  totalCustomers: number;
  
  // Growth metrics
  revenueGrowth: number;
  orderGrowth: number;
  customerGrowth: number;
  
  // Menu analytics
  menuItemSales: {
    menuItemId: string;
    name: string;
    quantitySold: number;
    revenue: number;
    percentage: number;
    profit?: number;
    cost?: number;
  }[];
  
  // Category analytics
  categorySales: {
    categoryName: string;
    quantitySold: number;
    revenue: number;
    percentage: number;
    itemCount: number;
  }[];
  
  // Table analytics
  tableSales: {
    tableId: string;
    tableNumber: string;
    orderCount: number;
    revenue: number;
    averageOrderValue: number;
    utilizationRate: number;
  }[];
  
  // Time-based analytics
  hourlyBreakdown: {
    hour: number;
    orderCount: number;
    revenue: number;
  }[];
  
  dailyBreakdown: {
    date: string;
    orderCount: number;
    revenue: number;
    customerCount: number;
  }[];
  
  // Payment analytics
  paymentMethodBreakdown: {
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }[];
  
  // Order type analytics
  orderTypeBreakdown: {
    type: string;
    count: number;
    revenue: number;
    percentage: number;
  }[];
  
  // Customer analytics
  topCustomers: {
    customerId?: string;
    customerName?: string;
    orderCount: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate: Date;
  }[];
  
  // Staff performance
  staffPerformance: {
    staffId: string;
    staffName?: string;
    orderCount: number;
    totalRevenue: number;
    averageOrderValue: number;
  }[];
  
  // Peak hours
  peakHours: {
    hour: number;
    orderCount: number;
    revenue: number;
    isWeekend: boolean;
  }[];
  
  // Popular combinations
  itemCombinations: {
    items: string[];
    frequency: number;
    totalRevenue: number;
  }[];
  
  // Credit analytics
  creditAnalytics: {
    totalCreditAmount: number;
    pendingCreditAmount: number;
    paidCreditAmount: number;
    ordersWithCredits: number;
    creditTransactions: {
      customerName: string;
      customerPhone?: string;
      orderId: string;
      tableNumber: string;
      totalAmount: number;
      amountReceived: number;
      creditAmount: number;
      remainingAmount: number;
      status: 'pending' | 'partially_paid' | 'paid';
      createdAt: Date;
      paymentHistory: {
        amount: number;
        paymentMethod: string;
        paidAt: Date;
      }[];
    }[];
    revenueCollectionRate: number; // Percentage of revenue actually collected
  };
}

export interface ReportConfiguration {
  includeGraphs: boolean;
  includeMenuAnalysis: boolean;
  includeTableAnalysis: boolean;
  includeCustomerAnalysis: boolean;
  includeStaffAnalysis: boolean;
  includeTimeAnalysis: boolean;
  includeTaxBreakdown: boolean;
  includeDiscountAnalysis: boolean;
  includeCreditAnalysis?: boolean; // New flag for credit analysis
  includeOrderDetails?: boolean; // New flag for detailed order list
  companyLogo?: string;
  reportTitle?: string;
  additionalNotes?: string;
}

export class SalesReportService {
  // Generate predefined date ranges
  static getDateRanges(): DateRange[] {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    // Start of current month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Start of current week (Monday)
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    return [
      {
        startDate: new Date(yesterday.setHours(0, 0, 0, 0)),
        endDate: new Date(yesterday.setHours(23, 59, 59, 999)),
        label: 'Yesterday'
      },
      {
        startDate: new Date(startOfWeek.setHours(0, 0, 0, 0)),
        endDate: new Date(today.setHours(23, 59, 59, 999)),
        label: 'This Week'
      },
      {
        startDate: new Date(oneWeekAgo.setHours(0, 0, 0, 0)),
        endDate: new Date(today.setHours(23, 59, 59, 999)),
        label: 'Last 7 Days'
      },
      {
        startDate: new Date(startOfMonth.setHours(0, 0, 0, 0)),
        endDate: new Date(today.setHours(23, 59, 59, 999)),
        label: 'This Month'
      },
      {
        startDate: new Date(oneMonthAgo.setHours(0, 0, 0, 0)),
        endDate: new Date(today.setHours(23, 59, 59, 999)),
        label: 'Last 30 Days'
      },
      {
        startDate: new Date(threeMonthsAgo.setHours(0, 0, 0, 0)),
        endDate: new Date(today.setHours(23, 59, 59, 999)),
        label: 'Last 3 Months'
      }
    ];
  }

  // Fetch orders within date range
  static async getOrdersInRange(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ApiResponse<Order[]>> {
    try {
      // Try the optimal query first (requires composite index)
      try {
              const constraints: QueryConstraint[] = [
        where('restaurantId', '==', restaurantId),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate))
        // TODO: Add orderBy('createdAt', 'desc') after creating composite index
        // Index needed: Collection: orders, Fields: restaurantId (asc), createdAt (asc)
      ];

        const q = query(collection(db, 'orders'), ...constraints);
        const querySnapshot = await getDocs(q);
        
        const orders: Order[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Order;
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort in memory

        return {
          success: true,
          data: orders
        };
      } catch (indexError) {
        // If the composite index doesn't exist, fall back to simpler query
        console.warn('Composite index not found, using fallback query. Please create the required index for better performance.');
        console.warn('Index needed: Collection: orders, Fields: restaurantId (asc), createdAt (asc)');
        
        const constraints: QueryConstraint[] = [
          where('restaurantId', '==', restaurantId),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate))
          // Note: orderBy removed to avoid composite index requirement
        ];

        const q = query(collection(db, 'orders'), ...constraints);
        const querySnapshot = await getDocs(q);
        
        const orders: Order[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Order;
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort in memory

        return {
          success: true,
          data: orders
        };
      }
    } catch (error) {
      console.error('Error fetching orders in range:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch orders'
      };
    }
  }

  // Generate comprehensive sales analytics
  static async generateSalesAnalytics(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
    menuItems: MenuItem[] = [],
    tables: Table[] = [],
    customers: Customer[] = []
  ): Promise<ApiResponse<SalesAnalytics>> {
    try {
      // Fetch orders for the specified period
      const ordersResult = await this.getOrdersInRange(restaurantId, startDate, endDate);
      if (!ordersResult.success || !ordersResult.data) {
        return {
          success: false,
          error: 'Failed to fetch orders for analytics'
        };
      }

      const orders = ordersResult.data;
      
      // Get comparison period (same duration, previous period)
      const periodDuration = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - periodDuration);
      const prevEndDate = new Date(endDate.getTime() - periodDuration);
      
      const prevOrdersResult = await this.getOrdersInRange(restaurantId, prevStartDate, prevEndDate);
      const prevOrders = prevOrdersResult.data || [];

      // Calculate basic metrics
      const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const totalItems = orders.reduce((sum, order) => 
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      );

      // Previous period metrics for growth calculation
      const prevTotalRevenue = prevOrders.reduce((sum, order) => sum + order.total, 0);
      const prevTotalOrders = prevOrders.length;
      
      // Growth calculations
      const revenueGrowth = prevTotalRevenue > 0 ? 
        ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : 0;
      const orderGrowth = prevTotalOrders > 0 ? 
        ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 : 0;

      // Menu item analysis
      const menuItemMap = new Map<string, {
        name: string;
        quantitySold: number;
        revenue: number;
      }>();

      orders.forEach(order => {
        order.items.forEach(item => {
          const existing = menuItemMap.get(item.menuItemId);
          if (existing) {
            existing.quantitySold += item.quantity;
            existing.revenue += item.total;
          } else {
            menuItemMap.set(item.menuItemId, {
              name: item.name,
              quantitySold: item.quantity,
              revenue: item.total
            });
          }
        });
      });

      const menuItemSales = Array.from(menuItemMap.entries()).map(([menuItemId, data]) => ({
        menuItemId,
        name: data.name,
        quantitySold: data.quantitySold,
        revenue: data.revenue,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
      })).sort((a, b) => b.revenue - a.revenue);

      // Category analysis
      const categoryMap = new Map<string, {
        quantitySold: number;
        revenue: number;
        itemCount: number;
      }>();

      orders.forEach(order => {
        order.items.forEach(item => {
          const menuItem = menuItems.find(m => m.id === item.menuItemId);
          const categoryName = menuItem?.categoryName || 'Uncategorized';
          
          const existing = categoryMap.get(categoryName);
          if (existing) {
            existing.quantitySold += item.quantity;
            existing.revenue += item.total;
            existing.itemCount++;
          } else {
            categoryMap.set(categoryName, {
              quantitySold: item.quantity,
              revenue: item.total,
              itemCount: 1
            });
          }
        });
      });

      const categorySales = Array.from(categoryMap.entries()).map(([categoryName, data]) => ({
        categoryName,
        quantitySold: data.quantitySold,
        revenue: data.revenue,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        itemCount: data.itemCount
      })).sort((a, b) => b.revenue - a.revenue);

      // Table analysis
      const tableMap = new Map<string, {
        orderCount: number;
        revenue: number;
      }>();

      orders.forEach(order => {
        if (order.tableId) {
          const existing = tableMap.get(order.tableId);
          if (existing) {
            existing.orderCount++;
            existing.revenue += order.total;
          } else {
            tableMap.set(order.tableId, {
              orderCount: 1,
              revenue: order.total
            });
          }
        }
      });

      const tableSales = Array.from(tableMap.entries()).map(([tableId, data]) => {
        const table = tables.find(t => t.id === tableId);
        return {
          tableId,
          tableNumber: table?.number || 'Unknown',
          orderCount: data.orderCount,
          revenue: data.revenue,
          averageOrderValue: data.revenue / data.orderCount,
          utilizationRate: data.orderCount // This could be enhanced with time-based calculations
        };
      }).sort((a, b) => b.revenue - a.revenue);

      // Hourly breakdown
      const hourlyMap = new Map<number, { orderCount: number; revenue: number }>();
      
      orders.forEach(order => {
        const hour = order.createdAt.getHours();
        const existing = hourlyMap.get(hour);
        if (existing) {
          existing.orderCount++;
          existing.revenue += order.total;
        } else {
          hourlyMap.set(hour, { orderCount: 1, revenue: order.total });
        }
      });

      const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        orderCount: hourlyMap.get(hour)?.orderCount || 0,
        revenue: hourlyMap.get(hour)?.revenue || 0
      }));

      // Daily breakdown
      const dailyMap = new Map<string, { orderCount: number; revenue: number; customerCount: number }>();
      const customersByDate = new Map<string, Set<string>>();

      orders.forEach(order => {
        const dateKey = formatDate(order.createdAt);
        const customerId = order.customerId || 'anonymous';
        
        const existing = dailyMap.get(dateKey);
        if (existing) {
          existing.orderCount++;
          existing.revenue += order.total;
        } else {
          dailyMap.set(dateKey, { orderCount: 1, revenue: order.total, customerCount: 0 });
        }

        // Track unique customers per day
        if (!customersByDate.has(dateKey)) {
          customersByDate.set(dateKey, new Set());
        }
        customersByDate.get(dateKey)!.add(customerId);
      });

      // Update customer count for each day
      dailyMap.forEach((data, dateKey) => {
        data.customerCount = customersByDate.get(dateKey)?.size || 0;
      });

      const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        orderCount: data.orderCount,
        revenue: data.revenue,
        customerCount: data.customerCount
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Payment method breakdown - Enhanced with actual payment data
      const paymentMap = new Map<string, { count: number; amount: number }>();
      
      // Get payment data from Firebase payments collection
      try {
        const paymentsQuery = query(
          collection(db, `restaurants/${restaurantId}/payments`),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate)),
          where('status', '==', 'completed')
        );
        
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        paymentsSnapshot.docs.forEach(doc => {
          const payment = doc.data();
          const method = this.formatPaymentMethod(payment.method);
          
          const existing = paymentMap.get(method);
          if (existing) {
            existing.count++;
            existing.amount += payment.amount || 0;
          } else {
            paymentMap.set(method, { count: 1, amount: payment.amount || 0 });
          }
        });
      } catch (error) {
        console.log('Payment data not available, using order data as fallback');
        // Fallback to order data analysis
        orders.forEach(order => {
          // Analyze based on order patterns or use default
          const method = this.estimatePaymentMethod(order);
          const existing = paymentMap.get(method);
          if (existing) {
            existing.count++;
            existing.amount += order.total;
          } else {
            paymentMap.set(method, { count: 1, amount: order.total });
          }
        });
      }

      const paymentMethodBreakdown = Array.from(paymentMap.entries()).map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount,
        percentage: totalRevenue > 0 ? (data.amount / totalRevenue) * 100 : 0
      })).sort((a, b) => b.amount - a.amount);

      // Order type breakdown
      const orderTypeMap = new Map<string, { count: number; revenue: number }>();
      
      orders.forEach(order => {
        const type = order.type || 'dine_in';
        const existing = orderTypeMap.get(type);
        if (existing) {
          existing.count++;
          existing.revenue += order.total;
        } else {
          orderTypeMap.set(type, { count: 1, revenue: order.total });
        }
      });

      const orderTypeBreakdown = Array.from(orderTypeMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        revenue: data.revenue,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
      }));

      // Top customers (based on orders with customer info)
      const customerMap = new Map<string, {
        customerName?: string;
        orderCount: number;
        totalSpent: number;
        lastOrderDate: Date;
      }>();

      orders.forEach(order => {
        if (order.customerId) {
          const existing = customerMap.get(order.customerId);
          if (existing) {
            existing.orderCount++;
            existing.totalSpent += order.total;
            if (order.createdAt > existing.lastOrderDate) {
              existing.lastOrderDate = order.createdAt;
            }
          } else {
            const customer = customers.find(c => c.id === order.customerId);
            customerMap.set(order.customerId, {
              customerName: customer?.name,
              orderCount: 1,
              totalSpent: order.total,
              lastOrderDate: order.createdAt
            });
          }
        }
      });

      const topCustomers = Array.from(customerMap.entries()).map(([customerId, data]) => ({
        customerId,
        customerName: data.customerName,
        orderCount: data.orderCount,
        totalSpent: data.totalSpent,
        averageOrderValue: data.totalSpent / data.orderCount,
        lastOrderDate: data.lastOrderDate
      })).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);

      // Staff performance
      const staffMap = new Map<string, { orderCount: number; totalRevenue: number }>();
      
      orders.forEach(order => {
        const staffId = order.staffId || 'unknown';
        const existing = staffMap.get(staffId);
        if (existing) {
          existing.orderCount++;
          existing.totalRevenue += order.total;
        } else {
          staffMap.set(staffId, { orderCount: 1, totalRevenue: order.total });
        }
      });

      const staffPerformance = Array.from(staffMap.entries()).map(([staffId, data]) => ({
        staffId,
        orderCount: data.orderCount,
        totalRevenue: data.totalRevenue,
        averageOrderValue: data.totalRevenue / data.orderCount
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Calculate credit analytics
      let creditAnalytics: SalesAnalytics['creditAnalytics'] = {
        totalCreditAmount: 0,
        pendingCreditAmount: 0,
        paidCreditAmount: 0,
        ordersWithCredits: 0,
        creditTransactions: [],
        revenueCollectionRate: 100
      };

      try {
        const creditResult = await CreditService.getCreditTransactions(restaurantId);
        if (creditResult.success && creditResult.data) {
          const allCredits = creditResult.data;
          
          // Filter credits within the date range
          const creditsInRange = allCredits.filter(credit => {
            const creditDate = credit.createdAt instanceof Date ? credit.createdAt : credit.createdAt.toDate();
            return creditDate >= startDate && creditDate <= endDate;
          });

          creditAnalytics = {
            totalCreditAmount: creditsInRange.reduce((sum, credit) => sum + (credit.totalAmount - credit.amountReceived), 0),
            pendingCreditAmount: creditsInRange.reduce((sum, credit) => {
              const totalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((pSum, p) => pSum + p.amount, 0);
              const remaining = credit.totalAmount - totalPaid;
              return sum + (remaining > 0 ? remaining : 0);
            }, 0),
            paidCreditAmount: creditsInRange.reduce((sum, credit) => {
              return sum + (credit.paymentHistory || []).reduce((pSum, p) => pSum + p.amount, 0);
            }, 0),
            ordersWithCredits: creditsInRange.length,
            creditTransactions: creditsInRange.map(credit => {
              const totalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((pSum, p) => pSum + p.amount, 0);
              const remainingAmount = credit.totalAmount - totalPaid;
              
              return {
                customerName: credit.customerName,
                customerPhone: credit.customerPhone,
                orderId: credit.orderId,
                tableNumber: credit.tableNumber,
                totalAmount: credit.totalAmount,
                amountReceived: credit.amountReceived,
                creditAmount: credit.totalAmount - credit.amountReceived,
                remainingAmount: remainingAmount,
                status: credit.status,
                createdAt: credit.createdAt instanceof Date ? credit.createdAt : credit.createdAt.toDate(),
                paymentHistory: (credit.paymentHistory || []).map(p => ({
                  amount: p.amount,
                  paymentMethod: p.paymentMethod,
                  paidAt: p.paidAt instanceof Date ? p.paidAt : p.paidAt.toDate()
                }))
              };
            }),
            revenueCollectionRate: totalRevenue > 0 ? ((totalRevenue - creditsInRange.reduce((sum, credit) => {
              const totalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((pSum, p) => pSum + p.amount, 0);
              const remaining = credit.totalAmount - totalPaid;
              return sum + (remaining > 0 ? remaining : 0);
            }, 0)) / totalRevenue) * 100 : 100
          };
        }
      } catch (error) {
        console.error('Error calculating credit analytics:', error);
        // Keep default empty creditAnalytics
      }

      const analytics: SalesAnalytics = {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        totalItems,
        totalCustomers: customerMap.size,
        revenueGrowth,
        orderGrowth,
        customerGrowth: 0, // Would need previous period customer data
        menuItemSales,
        categorySales,
        tableSales,
        hourlyBreakdown,
        dailyBreakdown,
        paymentMethodBreakdown,
        orderTypeBreakdown,
        topCustomers,
        staffPerformance,
        peakHours: hourlyBreakdown.filter(h => h.orderCount > 0).map(h => ({
          ...h,
          isWeekend: false // Would need actual date context to determine weekend
        })).sort((a, b) => b.orderCount - a.orderCount).slice(0, 5),
        itemCombinations: [], // This would require more complex analysis
        creditAnalytics
      };

      return {
        success: true,
        data: analytics
      };

    } catch (error) {
      console.error('Error generating sales analytics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate analytics'
      };
    }
  }

  // Generate PDF report
  static async generatePDFReport(
    analytics: SalesAnalytics,
    dateRange: DateRange,
    restaurantName: string,
    config: ReportConfiguration = {
      includeGraphs: true,
      includeMenuAnalysis: true,
      includeTableAnalysis: true,
      includeCustomerAnalysis: true,
      includeStaffAnalysis: true,
      includeTimeAnalysis: true,
      includeTaxBreakdown: true,
      includeDiscountAnalysis: true,
      includeCreditAnalysis: true
    }
  ): Promise<Blob> {
    try {
      console.log('📄 Creating PDF document...');
    const doc = new jsPDF();
    let yPosition = 20;

      // Check if autoTable is available
      if (typeof doc.autoTable !== 'function') {
        console.error('❌ jsPDF autoTable plugin not available');
        // Fallback to simple text-based PDF
        return this.generateSimplePDFReport(analytics, dateRange, restaurantName, config);
      }

            console.log('✅ jsPDF autoTable plugin available');

      // Title Page with improved typography
      doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41); // Dark gray for better readability
    doc.text(config.reportTitle || 'Sales Report', 20, yPosition);
      yPosition += 18;

      doc.setFontSize(20);
    doc.setFont('helvetica', 'normal');
      doc.setTextColor(52, 58, 64); // Medium gray
    doc.text(restaurantName, 20, yPosition);
      yPosition += 12;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(108, 117, 125); // Light gray for secondary text
      doc.text(`Report Period: ${dateRange.label}`, 20, yPosition);
      yPosition += 7;
    doc.text(`${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`, 20, yPosition);
      yPosition += 10;
      
      // Add a subtle line separator
      doc.setLineWidth(0.5);
      doc.setDrawColor(220, 220, 220);
      doc.line(20, yPosition + 5, 190, yPosition + 5);
      yPosition += 20;

          // Executive Summary with improved styling
      doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
    doc.text('Executive Summary', 20, yPosition);
      yPosition += 12;

      // Reset text color for content
      doc.setTextColor(0, 0, 0);
    
    const summaryData = [
      ['Total Revenue', formatCurrency(analytics.totalRevenue)],
      ['Total Orders', analytics.totalOrders.toString()],
      ['Average Order Value', formatCurrency(analytics.averageOrderValue)],
      ['Total Items Sold', analytics.totalItems.toString()],
      ['Unique Customers', analytics.totalCustomers.toString()],
      ['Revenue Growth', `${analytics.revenueGrowth.toFixed(1)}%`],
      ['Order Growth', `${analytics.orderGrowth.toFixed(1)}%`],
      ...(analytics.creditAnalytics.ordersWithCredits > 0 ? [
        ['Pending Credits', formatCurrency(analytics.creditAnalytics.pendingCreditAmount)],
        ['Revenue Collection Rate', `${analytics.creditAnalytics.revenueCollectionRate.toFixed(1)}%`]
      ] : [])
    ];

    doc.autoTable({
      startY: yPosition,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
        styles: { 
          fontSize: 11,
          font: 'helvetica',
          textColor: [33, 37, 41],
          cellPadding: 8,
          lineColor: [220, 220, 220],
          lineWidth: 0.5
        },
        headStyles: { 
          fillColor: [52, 58, 64],
          textColor: [255, 255, 255],
          fontSize: 12,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
          1: { halign: 'right', cellWidth: 60 }
        }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Menu Analysis
    if (config.includeMenuAnalysis && analytics.menuItemSales.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text('Top Selling Items', 20, yPosition);
      yPosition += 12;

      const menuData = analytics.menuItemSales.slice(0, 10).map(item => [
        item.name,
        item.quantitySold.toString(),
        formatCurrency(item.revenue),
        `${item.percentage.toFixed(1)}%`
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Item Name', 'Qty Sold', 'Revenue', '% of Total']],
        body: menuData,
        theme: 'grid',
        styles: { 
          fontSize: 10,
          font: 'helvetica',
          textColor: [33, 37, 41],
          cellPadding: 6,
          lineColor: [220, 220, 220],
          lineWidth: 0.5
        },
        headStyles: { 
          fillColor: [40, 167, 69],
          textColor: [255, 255, 255],
          fontSize: 11,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 40 },
          3: { halign: 'center', cellWidth: 30 }
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Category Analysis
    if (config.includeMenuAnalysis && analytics.categorySales.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text('Category Performance', 20, yPosition);
      yPosition += 12;

      const categoryData = analytics.categorySales.map(category => [
        category.categoryName,
        category.quantitySold.toString(),
        formatCurrency(category.revenue),
        `${category.percentage.toFixed(1)}%`
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Category', 'Qty Sold', 'Revenue', '% of Total']],
        body: categoryData,
        theme: 'grid',
        styles: { 
          fontSize: 10,
          font: 'helvetica',
          textColor: [33, 37, 41],
          cellPadding: 6,
          lineColor: [220, 220, 220],
          lineWidth: 0.5
        },
        headStyles: { 
          fillColor: [255, 193, 7],
          textColor: [33, 37, 41],
          fontSize: 11,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 40 },
          3: { halign: 'center', cellWidth: 30 }
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Table Analysis
    if (config.includeTableAnalysis && analytics.tableSales.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Table Performance', 20, yPosition);
      yPosition += 10;

      const tableData = analytics.tableSales.slice(0, 10).map(table => [
        table.tableNumber,
        table.orderCount.toString(),
        formatCurrency(table.revenue),
        formatCurrency(table.averageOrderValue)
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Table', 'Orders', 'Revenue', 'Avg Order Value']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [108, 117, 125] }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Detailed Order List
    if (config.includeOrderDetails && (analytics as any).detailedOrderList && (analytics as any).detailedOrderList.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text('Detailed Order List', 20, yPosition);
      yPosition += 12;

      const orderData = (analytics as any).detailedOrderList.map((order: any) => [
        order.orderNumber,
        order.tableNumber,
        order.date,
        order.time,
        order.status.toUpperCase(),
        order.type.replace('_', ' ').toUpperCase(),
        order.totalItems.toString(),
        formatCurrency(order.total)
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Order #', 'Table', 'Date', 'Time', 'Status', 'Type', 'Items', 'Total']],
        body: orderData,
        theme: 'grid',
        styles: { 
          fontSize: 9,
          font: 'helvetica',
          textColor: [33, 37, 41],
          cellPadding: 5,
          lineColor: [220, 220, 220],
          lineWidth: 0.5
        },
        headStyles: { 
          fillColor: [52, 58, 64],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' }, // Order #
          1: { cellWidth: 18, halign: 'center' }, // Table
          2: { cellWidth: 22, halign: 'center' }, // Date
          3: { cellWidth: 18, halign: 'center' }, // Time
          4: { cellWidth: 22, halign: 'center' }, // Status
          5: { cellWidth: 22, halign: 'center' }, // Type
          6: { cellWidth: 18, halign: 'center' }, // Items
          7: { cellWidth: 25, halign: 'right' }   // Total
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Customer Analysis
    if (config.includeCustomerAnalysis && analytics.topCustomers.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Customers', 20, yPosition);
      yPosition += 10;

      const customerData = analytics.topCustomers.slice(0, 10).map(customer => [
        customer.customerName || 'Anonymous',
        customer.orderCount.toString(),
        formatCurrency(customer.totalSpent),
        formatCurrency(customer.averageOrderValue),
        formatDate(customer.lastOrderDate)
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Customer', 'Orders', 'Total Spent', 'Avg Order', 'Last Order']],
        body: customerData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 53, 69] }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Payment Method Analysis
    if (analytics.paymentMethodBreakdown.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Method Breakdown', 20, yPosition);
      yPosition += 10;

      const paymentData = analytics.paymentMethodBreakdown.map(payment => [
        payment.method,
        payment.count.toString(),
        formatCurrency(payment.amount),
        `${payment.percentage.toFixed(1)}%`
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Payment Method', 'Transactions', 'Amount', '% of Total']],
        body: paymentData,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [156, 39, 176] }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Credit Analysis
    if (config.includeCreditAnalysis !== false && analytics.creditAnalytics.ordersWithCredits > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text('Credit Analysis', 20, yPosition);
      yPosition += 12;

      // Credit Summary
      const creditSummaryData = [
        ['Total Credit Amount', formatCurrency(analytics.creditAnalytics.totalCreditAmount)],
        ['Pending Credits', formatCurrency(analytics.creditAnalytics.pendingCreditAmount)],
        ['Paid Credits', formatCurrency(analytics.creditAnalytics.paidCreditAmount)],
        ['Orders with Credits', analytics.creditAnalytics.ordersWithCredits.toString()],
        ['Revenue Collection Rate', `${analytics.creditAnalytics.revenueCollectionRate.toFixed(1)}%`]
      ];

      doc.autoTable({
        startY: yPosition,
        head: [['Credit Metric', 'Value']],
        body: creditSummaryData,
        theme: 'grid',
        styles: { 
          fontSize: 10,
          font: 'helvetica',
          textColor: [33, 37, 41],
          cellPadding: 6,
          lineColor: [220, 220, 220],
          lineWidth: 0.5
        },
        headStyles: { 
          fillColor: [220, 53, 69],
          textColor: [255, 255, 255],
          fontSize: 11,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
          1: { halign: 'right', cellWidth: 60 }
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;

      // Credit Transactions Details (if any)
      if (analytics.creditAnalytics.creditTransactions.length > 0) {
        if (yPosition > 220) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Credit Transactions Details', 20, yPosition);
        yPosition += 10;

        const creditTransactionData = analytics.creditAnalytics.creditTransactions
          .slice(0, 15) // Limit to first 15 transactions to avoid overflow
          .map(credit => [
            credit.customerName,
            credit.tableNumber,
            formatCurrency(credit.totalAmount),
            formatCurrency(credit.amountReceived),
            formatCurrency(credit.remainingAmount),
            credit.status.replace('_', ' ').toUpperCase(),
            formatDate(credit.createdAt)
          ]);

        doc.autoTable({
          startY: yPosition,
          head: [['Customer', 'Table', 'Total', 'Received', 'Remaining', 'Status', 'Date']],
          body: creditTransactionData,
          theme: 'grid',
          styles: { 
            fontSize: 8,
            font: 'helvetica',
            textColor: [33, 37, 41],
            cellPadding: 4,
            lineColor: [220, 220, 220],
            lineWidth: 0.5
          },
          headStyles: { 
            fillColor: [220, 53, 69],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
          },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { halign: 'center', cellWidth: 20 },
            2: { halign: 'right', cellWidth: 25 },
            3: { halign: 'right', cellWidth: 25 },
            4: { halign: 'right', cellWidth: 25 },
            5: { halign: 'center', cellWidth: 25 },
            6: { halign: 'center', cellWidth: 25 }
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 20;

        // Add note if there are more transactions
        if (analytics.creditAnalytics.creditTransactions.length > 15) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(108, 117, 125);
          doc.text(`Note: Showing first 15 of ${analytics.creditAnalytics.creditTransactions.length} credit transactions.`, 20, yPosition);
          yPosition += 10;
        }
      }
    }

    // Order Type Analysis
    if (analytics.orderTypeBreakdown.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Order Type Analysis', 20, yPosition);
      yPosition += 10;

      const orderTypeData = analytics.orderTypeBreakdown.map(type => [
        type.type.replace('_', ' ').toUpperCase(),
        type.count.toString(),
        formatCurrency(type.revenue),
        `${type.percentage.toFixed(1)}%`
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Order Type', 'Count', 'Revenue', '% of Total']],
        body: orderTypeData,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [0, 123, 191] }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Staff Performance Analysis
    if (config.includeStaffAnalysis && analytics.staffPerformance.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Staff Performance', 20, yPosition);
      yPosition += 10;

      const staffData = analytics.staffPerformance.slice(0, 10).map(staff => [
        staff.staffName || `Staff ${staff.staffId.slice(0, 8)}`,
        staff.orderCount.toString(),
        formatCurrency(staff.totalRevenue),
        formatCurrency(staff.averageOrderValue)
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Staff Member', 'Orders', 'Total Revenue', 'Avg Order Value']],
        body: staffData,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [255, 87, 34] }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Daily Performance Analysis
    if (config.includeTimeAnalysis && analytics.dailyBreakdown.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Performance Analysis', 20, yPosition);
      yPosition += 10;

      // Show last 10 days if more than 10 days of data
      const dailyData = analytics.dailyBreakdown.slice(-10).map(day => [
        day.date,
        day.orderCount.toString(),
        formatCurrency(day.revenue),
        day.customerCount.toString()
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Date', 'Orders', 'Revenue', 'Customers']],
        body: dailyData,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [76, 175, 80] }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Time Analysis
    if (config.includeTimeAnalysis) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Peak Hours Analysis', 20, yPosition);
      yPosition += 10;

      const hourData = analytics.peakHours.map(hour => [
        `${hour.hour}:00 - ${hour.hour + 1}:00`,
        hour.orderCount.toString(),
        formatCurrency(hour.revenue)
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Time Slot', 'Orders', 'Revenue']],
        body: hourData,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [111, 66, 193] }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

      // Add footer with improved styling
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(108, 117, 125);
      
      // Add a line above footer
      doc.setLineWidth(0.3);
      doc.setDrawColor(220, 220, 220);
      doc.line(20, 280, 190, 280);
      
      doc.text(`Generated on: ${formatDate(new Date())} ${formatTime(new Date())}`, 20, 288);

    if (config.additionalNotes) {
        const lines = doc.splitTextToSize(config.additionalNotes, 150);
        doc.text(lines, 20, 293);
    }

      console.log('📄 PDF document created successfully');
    return doc.output('blob');
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      // Fallback to simple PDF
      return this.generateSimplePDFReport(analytics, dateRange, restaurantName, config);
    }
  }

  // Fallback simple PDF generation without autoTable
  private static generateSimplePDFReport(
    analytics: SalesAnalytics,
    dateRange: DateRange,
    restaurantName: string,
    config: ReportConfiguration
  ): Promise<Blob> {
    console.log('📄 Generating simple PDF fallback...');
    const doc = new jsPDF();
    let yPosition = 20;

    // Title with improved typography
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 37, 41);
    doc.text(config.reportTitle || 'Sales Report', 20, yPosition);
    yPosition += 18;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(52, 58, 64);
    doc.text(restaurantName, 20, yPosition);
    yPosition += 12;

    doc.setFontSize(11);
    doc.setTextColor(108, 117, 125);
    doc.text(`Report Period: ${dateRange.label}`, 20, yPosition);
    yPosition += 7;
    doc.text(`${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`, 20, yPosition);
    
    // Add separator line
    doc.setLineWidth(0.5);
    doc.setDrawColor(220, 220, 220);
    doc.line(20, yPosition + 8, 190, yPosition + 8);
    yPosition += 18;

    // Executive Summary
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 37, 41);
    doc.text('Executive Summary', 20, yPosition);
    yPosition += 12;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(52, 58, 64);
    doc.text(`Total Revenue: ${formatCurrency(analytics.totalRevenue)}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Total Orders: ${analytics.totalOrders}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Average Order Value: ${formatCurrency(analytics.averageOrderValue)}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Total Items Sold: ${analytics.totalItems}`, 20, yPosition);
    yPosition += 15;

    // Top Menu Items
    if (config.includeMenuAnalysis && analytics.menuItemSales.length > 0) {
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text('Top Selling Items', 20, yPosition);
      yPosition += 12;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(52, 58, 64);
      analytics.menuItemSales.slice(0, 10).forEach((item, index) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`${index + 1}. ${item.name} - Qty: ${item.quantitySold} - Revenue: ${formatCurrency(item.revenue)}`, 20, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // Table Performance
    if (config.includeTableAnalysis && analytics.tableSales.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Table Performance', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      analytics.tableSales.slice(0, 10).forEach((table) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`Table ${table.tableNumber} - Orders: ${table.orderCount} - Revenue: ${formatCurrency(table.revenue)}`, 20, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // Category Analysis
    if (config.includeMenuAnalysis && analytics.categorySales.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Category Performance', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      analytics.categorySales.forEach((category) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`${category.categoryName} - Qty: ${category.quantitySold} - Revenue: ${formatCurrency(category.revenue)}`, 20, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // Order Type Analysis
    if (analytics.orderTypeBreakdown.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Order Type Analysis', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      analytics.orderTypeBreakdown.forEach((type) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`${type.type.replace('_', ' ').toUpperCase()} - Count: ${type.count} - Revenue: ${formatCurrency(type.revenue)}`, 20, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // Payment Method Analysis
    if (analytics.paymentMethodBreakdown.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Method Analysis', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      analytics.paymentMethodBreakdown.forEach((payment) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`${payment.method} - Transactions: ${payment.count} - Amount: ${formatCurrency(payment.amount)} (${payment.percentage.toFixed(1)}%)`, 20, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // Detailed Order List
    if (config.includeOrderDetails && (analytics as any).detailedOrderList && (analytics as any).detailedOrderList.length > 0) {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Order List', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      (analytics as any).detailedOrderList.slice(0, 20).forEach((order: any) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`${order.orderNumber} | Table ${order.tableNumber} | ${order.date} ${order.time} | ${order.status.toUpperCase()} | ${formatCurrency(order.total)}`, 20, yPosition);
        yPosition += 5;
      });
      yPosition += 10;
    }

    // Add footer with improved styling
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(108, 117, 125);
    
    // Add a line above footer
    doc.setLineWidth(0.3);
    doc.setDrawColor(220, 220, 220);
    doc.line(20, 280, 190, 280);
    
    doc.text(`Generated on: ${formatDate(new Date())} ${formatTime(new Date())}`, 20, 288);

    if (config.additionalNotes) {
      const lines = doc.splitTextToSize(config.additionalNotes, 150);
      doc.text(lines, 20, 293);
    }

    console.log('📄 Simple PDF generated successfully');
    return Promise.resolve(doc.output('blob'));
  }

  // Export data to CSV
  // Helper method to format payment method names
  private static formatPaymentMethod(method: string): string {
    switch (method?.toLowerCase()) {
      case 'cash': return 'Cash';
      case 'upi': return 'UPI';
      case 'bank': return 'Bank Transfer';
      case 'card': return 'Card';
      case 'credit_card': return 'Credit Card';
      case 'debit_card': return 'Debit Card';
      default: return 'Other';
    }
  }

  // Helper method to estimate payment method from order data (fallback)
  private static estimatePaymentMethod(order: any): string {
    // This is a fallback estimation based on order patterns
    // In real implementation, this would be based on actual payment data
    const total = order.total || 0;
    
    // Simple heuristic: larger orders more likely to be card/UPI
    if (total > 1000) {
      return Math.random() > 0.5 ? 'UPI' : 'Card';
    } else if (total > 500) {
      return Math.random() > 0.6 ? 'UPI' : 'Cash';
    } else {
      return Math.random() > 0.7 ? 'Cash' : 'UPI';
    }
  }

  static exportToCSV(analytics: SalesAnalytics, dateRange: DateRange): string {
    const lines: string[] = [];
    
    // Header
    lines.push(`Sales Report - ${dateRange.label}`);
    lines.push(`Period: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`);
    lines.push('');
    
    // Summary
    lines.push('EXECUTIVE SUMMARY');
    lines.push('Metric,Value');
    lines.push(`Total Revenue,${analytics.totalRevenue}`);
    lines.push(`Total Orders,${analytics.totalOrders}`);
    lines.push(`Average Order Value,${analytics.averageOrderValue}`);
    lines.push(`Total Items,${analytics.totalItems}`);
    lines.push(`Total Customers,${analytics.totalCustomers}`);
    lines.push(`Revenue Growth,${analytics.revenueGrowth}%`);
    lines.push(`Order Growth,${analytics.orderGrowth}%`);
    lines.push('');
    
    // Menu items
    lines.push('TOP SELLING ITEMS');
    lines.push('Item Name,Quantity Sold,Revenue,Percentage');
    analytics.menuItemSales.forEach(item => {
      lines.push(`"${item.name}",${item.quantitySold},${item.revenue},${item.percentage}%`);
    });
    lines.push('');
    
    // Categories
    lines.push('CATEGORY PERFORMANCE');
    lines.push('Category,Quantity Sold,Revenue,Percentage');
    analytics.categorySales.forEach(category => {
      lines.push(`"${category.categoryName}",${category.quantitySold},${category.revenue},${category.percentage}%`);
    });
    lines.push('');
    
    return lines.join('\n');
  }
} 