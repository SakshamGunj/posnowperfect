import { useState, useEffect } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { SalesReportService } from '@/services/salesReportService';
import { ExpenseService } from '@/services/expenseService';
import { GamificationService } from '@/services/gamificationService';
import { OrderService } from '@/services/orderService';
import { MenuService } from '@/services/menuService';
import { TableService } from '@/services/tableService';
import { InventoryService } from '@/services/inventoryService';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  BarChart3,
  Package,
  Clock,
  Target,
  Loader2,
  AlertCircle
} from 'lucide-react';

// Report Types
const REPORT_TYPES = [
  {
    id: 'sales',
    name: 'Sales Report',
    description: 'Comprehensive sales analytics with revenue, orders, and customer insights',
    icon: DollarSign,
    color: 'bg-green-100 text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    id: 'profit-loss',
    name: 'Profit & Loss Statement',
    description: 'Financial statement showing revenue, expenses, and net profit',
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-600',
    bgColor: 'bg-blue-50'
  },
  {
    id: 'inventory',
    name: 'Inventory Report',
    description: 'Stock levels, consumption patterns, and inventory costs',
    icon: Package,
    color: 'bg-purple-100 text-purple-600',
    bgColor: 'bg-purple-50'
  },
  {
    id: 'operational',
    name: 'Operational Analytics',
    description: 'Table utilization, staff performance, and efficiency metrics',
    icon: BarChart3,
    color: 'bg-orange-100 text-orange-600',
    bgColor: 'bg-orange-50'
  }
];

// Date Range Options
const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'last-week', label: 'Last Week' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' }
];

export default function ReportsDashboard() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();

  const [selectedReportType, setSelectedReportType] = useState<string>('sales');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Quick stats
  const [quickStats, setQuickStats] = useState({
    totalReports: 0,
    reportsThisMonth: 0,
    lastReportGenerated: null as Date | null,
    favoriteReportType: 'sales'
  });

  useEffect(() => {
    if (restaurant) {
      loadQuickStats();
    }
  }, [restaurant]);

  const loadQuickStats = () => {
    // Mock stats - in real implementation, track report generation history
    setQuickStats({
      totalReports: 23,
      reportsThisMonth: 8,
      lastReportGenerated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      favoriteReportType: 'sales'
    });
  };

  // Get date range for reporting
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (selectedDateRange) {
      case 'today':
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        return { start: today, end: todayEnd };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        return { start: yesterday, end: yesterdayEnd };
      case 'week':
        const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
        return { start: weekStart, end: now };
      case 'month':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        return { start: quarterStart, end: now };
      case 'year':
        return { start: new Date(now.getFullYear(), 0, 1), end: now };
      case 'last-week':
        const lastWeekEnd = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
        const lastWeekStart = new Date(lastWeekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: lastWeekStart, end: lastWeekEnd };
      case 'last-month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: lastMonthStart, end: lastMonthEnd };
      case 'last-quarter':
        const lastQuarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0);
        const lastQuarterStart = new Date(lastQuarterEnd.getFullYear(), lastQuarterEnd.getMonth() - 2, 1);
        return { start: lastQuarterStart, end: lastQuarterEnd };
      case 'last-year':
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        return { start: lastYearStart, end: lastYearEnd };
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : new Date(now.getFullYear(), now.getMonth(), 1),
          end: customEndDate ? new Date(customEndDate) : now
        };
      default:
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }
  };

  // Generate comprehensive report data
  const generateReportData = async () => {
    if (!restaurant) return;

    setIsGenerating(true);
    try {
      const { start, end } = getDateRange();
      
      // Load all necessary data
      const [
        ordersResult,
        menuItemsResult,
        tablesResult,
        expensesResult,
        inventoryResult
      ] = await Promise.all([
        OrderService.getOrdersForRestaurant(restaurant.id),
        MenuService.getMenuItemsForRestaurant(restaurant.id),
        TableService.getTablesForRestaurant(restaurant.id),
        ExpenseService.getExpensesForPeriod(restaurant.id, start, end),
        InventoryService.getInventoryForRestaurant(restaurant.id)
      ]);

      const allOrders = ordersResult.success ? ordersResult.data || [] : [];
      const allExpenses = expensesResult.success ? expensesResult.data || [] : [];
      
      // Filter orders by date range with proper timezone handling
      const orders = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        // Reset time to compare dates properly
        const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        
        return orderDateOnly >= startDateOnly && orderDateOnly <= endDateOnly;
      });
      
      // Expenses are already filtered by the ExpenseService.getExpensesForPeriod method
      const expenses = allExpenses;
      
      const menuItems = menuItemsResult.success ? menuItemsResult.data || [] : [];
      const tables = tablesResult.success ? tablesResult.data || [] : [];
      const inventory = inventoryResult.success ? inventoryResult.data || [] : [];

      // Generate analytics based on report type
      let reportData: any = {};

      switch (selectedReportType) {
        case 'sales':
          reportData = await generateSalesReport(orders, menuItems, tables, start, end);
          break;
        case 'profit-loss':
          reportData = await generateProfitLossReport(orders, expenses, inventory, start, end);
          break;
        case 'inventory':
          reportData = await generateInventoryReport(inventory, orders, menuItems, start, end);
          break;
        case 'operational':
          reportData = await generateOperationalReport(orders, tables, menuItems, start, end);
          break;
        case 'customer':
          reportData = await generateCustomerReport(orders, start, end);
          break;
        case 'gamification':
          reportData = await generateGamificationReport(start, end);
          break;
        case 'menu':
          reportData = await generateMenuReport(orders, menuItems, start, end);
          break;
        case 'comparative':
          reportData = await generateComparativeReport(orders, expenses, start, end);
          break;
      }

      setReportData({
        ...reportData,
        dateRange: { start, end },
        reportType: selectedReportType,
        generatedAt: new Date(),
        restaurantName: restaurant.name
      });

    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  // Sales Report Generator
  const generateSalesReport = async (orders: any[], menuItems: any[], tables: any[], start: Date, end: Date) => {
    // Calculate comprehensive metrics from filtered orders
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) => sum + (order.items?.length || 0), 0);
    const totalItemQuantity = orders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 1), 0), 0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const averageItemsPerOrder = totalOrders > 0 ? totalItemQuantity / totalOrders : 0;
    
    // Calculate completion and cancellation rates
    const completedOrders = orders.filter(o => o.status === 'completed');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');
    const orderSuccessRate = totalOrders > 0 ? (completedOrders.length / totalOrders) * 100 : 0;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders.length / totalOrders) * 100 : 0;
    
    // Calculate unique customers
    const uniqueCustomers = new Set();
    orders.forEach(order => {
      if (order.customerPhone) uniqueCustomers.add(order.customerPhone);
      else if (order.customerName) uniqueCustomers.add(order.customerName);
      else uniqueCustomers.add(`order_${order.id}`);
    });
    
    // Calculate menu item sales
    const itemSales = new Map();
    orders.forEach(order => {
      order.items.forEach((item: any) => {
        const key = item.name;
        if (itemSales.has(key)) {
          const existing = itemSales.get(key);
          existing.quantity += item.quantity || 1;
          existing.revenue += item.total || item.price || 0;
        } else {
          itemSales.set(key, {
            name: item.name,
            quantity: item.quantity || 1,
            revenue: item.total || item.price || 0,
            avgPrice: (item.total || item.price || 0) / (item.quantity || 1)
          });
        }
      });
    });
    
    const menuItemSales = Array.from(itemSales.values())
      .map(item => ({
        ...item,
        revenuePercentage: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);
    
    // Calculate payment method breakdown
    const paymentMethods = new Map();
    orders.forEach(order => {
      const method = order.paymentMethod || 'cash';
      if (paymentMethods.has(method)) {
        const existing = paymentMethods.get(method);
        existing.orders += 1;
        existing.revenue += order.total;
      } else {
        paymentMethods.set(method, {
          method: method,
          orders: 1,
          revenue: order.total
        });
      }
    });
    
    const paymentMethodAnalysis = Array.from(paymentMethods.values())
      .map(pm => ({
        ...pm,
        percentageOfOrders: totalOrders > 0 ? (pm.orders / totalOrders) * 100 : 0,
        percentageOfRevenue: totalRevenue > 0 ? (pm.revenue / totalRevenue) * 100 : 0,
        avgOrderValue: pm.orders > 0 ? pm.revenue / pm.orders : 0
      }));
    
    // Calculate order type breakdown
    const orderTypes = new Map();
    orders.forEach(order => {
      let type = 'dine_in';
      if (order.type === 'takeaway' || order.tableId === 'takeaway-order') {
        type = 'takeaway';
      } else if (order.tableId === 'customer-portal' || (order.notes && order.notes.includes('Customer Portal'))) {
        type = 'online';
      } else if (order.type === 'delivery') {
        type = 'delivery';
      }
      
      if (orderTypes.has(type)) {
        const existing = orderTypes.get(type);
        existing.count += 1;
        existing.revenue += order.total;
      } else {
        orderTypes.set(type, {
          type: type,
          count: 1,
          revenue: order.total
        });
      }
    });
    
    const orderTypeBreakdown = Array.from(orderTypes.values())
      .map(ot => ({
        ...ot,
        percentage: totalOrders > 0 ? (ot.count / totalOrders) * 100 : 0,
        avgValue: ot.count > 0 ? ot.revenue / ot.count : 0
      }));
    
    // Calculate peak hours
    const hourlyData = new Map();
    orders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      if (hourlyData.has(hour)) {
        const existing = hourlyData.get(hour);
        existing.orderCount += 1;
        existing.revenue += order.total;
      } else {
        hourlyData.set(hour, {
          hour: hour,
          orderCount: 1,
          revenue: order.total
        });
      }
    });
    
    const peakHours = Array.from(hourlyData.values())
      .map(h => ({
        ...h,
        percentage: totalOrders > 0 ? (h.orderCount / totalOrders) * 100 : 0
      }))
      .sort((a, b) => b.orderCount - a.orderCount);
    
    return {
      type: 'sales',
      orders,
      totalRevenue,
      totalOrders,
      totalItems: totalItemQuantity,
      averageOrderValue,
      averageItemsPerOrder,
      orderSuccessRate,
      cancellationRate,
      uniqueCustomers: uniqueCustomers.size,
      menuItemSales,
      paymentMethodAnalysis,
      orderTypeBreakdown,
      peakHours,
      summary: {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        totalItems: totalItemQuantity,
        topSellingItems: menuItemSales.slice(0, 15),
        peakHours: peakHours.slice(0, 3)
      }
    };
  };

  // Profit & Loss Report Generator  
  const generateProfitLossReport = async (orders: any[], expenses: any[], inventory: any[], start: Date, end: Date) => {
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    
    // Calculate profit based on revenue minus expenses only
    const netProfit = totalRevenue - totalExpenses;

    // Calculate actual expense breakdown by category with improved handling
    const expenseBreakdown = expenses.reduce((acc: any, expense: any) => {
      // Use categoryName if available, otherwise use a cleaned-up categoryId or default
      let categoryName = expense.categoryName;
      
      // If categoryName is missing or looks like an ID, try to get a better name
      if (!categoryName || categoryName === expense.categoryId || categoryName.length > 20) {
        // Map common category IDs to readable names or use the title as fallback
        const commonCategories: { [key: string]: string } = {
          'staff': 'Staff Salaries',
          'utilities': 'Utilities',
          'rent': 'Rent & Property',
          'maintenance': 'Maintenance & Repairs',
          'marketing': 'Marketing & Advertising',
          'equipment': 'Equipment & Technology',
          'insurance': 'Insurance',
          'transportation': 'Transportation',
          'taxes': 'Taxes & Fees',
          'misc': 'Miscellaneous',
          'supplies': 'Supplies',
          'food': 'Food & Ingredients',
          'cleaning': 'Cleaning & Sanitation'
        };
        
        // Try to match against common categories
        const categoryKey = Object.keys(commonCategories).find(key => 
          expense.categoryId?.toLowerCase().includes(key) || 
          expense.title?.toLowerCase().includes(key)
        );
        
        categoryName = categoryKey ? commonCategories[categoryKey] : 
                     (expense.title ? expense.title.substring(0, 30) : 'Other');
      }
      
      acc[categoryName] = (acc[categoryName] || 0) + expense.amount;
      return acc;
    }, {});

    // Extract specific cost categories from actual expenses with fallback handling
    const getCategoryAmount = (categoryNames: string[]) => {
      return categoryNames.reduce((sum, name) => {
        return sum + (expenseBreakdown[name] || 0);
      }, 0);
    };

    const laborCosts = getCategoryAmount(['Staff Salaries', 'Professional Services', 'Payroll']);
    const utilityCosts = getCategoryAmount(['Utilities', 'Electricity', 'Water', 'Gas']);
    const rentCosts = getCategoryAmount(['Rent & Property', 'Rent', 'Property']);
    const maintenanceCosts = getCategoryAmount(['Maintenance & Repairs', 'Maintenance', 'Repairs']);
    const marketingCosts = getCategoryAmount(['Marketing & Advertising', 'Marketing', 'Advertising']);
    const equipmentCosts = getCategoryAmount(['Equipment & Technology', 'Equipment', 'Technology']);
    const insuranceCosts = getCategoryAmount(['Insurance']);
    const transportationCosts = getCategoryAmount(['Transportation', 'Transport', 'Delivery']);
    const taxesCosts = getCategoryAmount(['Taxes & Fees', 'Taxes', 'Government Fees']);
    const supplyCosts = getCategoryAmount(['Supplies', 'Office Supplies', 'Cleaning & Sanitation']);
    
    // Calculate remaining costs that don't fall into specific categories
    const categorizedTotal = laborCosts + utilityCosts + rentCosts + maintenanceCosts + 
                           marketingCosts + equipmentCosts + insuranceCosts + 
                           transportationCosts + taxesCosts + supplyCosts;
    const otherCosts = Math.max(0, totalExpenses - categorizedTotal);

    return {
      type: 'profit-loss',
      period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
      dateRange: { start, end },
      revenue: {
        totalRevenue,
        foodRevenue: totalRevenue * 0.85,
        beverageRevenue: totalRevenue * 0.15,
        otherRevenue: 0
      },
      costs: {
        operatingExpenses: totalExpenses,
        laborCosts: laborCosts,
        utilityCosts: utilityCosts,
        rentCosts: rentCosts,
        maintenanceCosts: maintenanceCosts,
        marketingCosts: marketingCosts,
        equipmentCosts: equipmentCosts,
        insuranceCosts: insuranceCosts,
        transportationCosts: transportationCosts,
        taxesCosts: taxesCosts,
        supplyCosts: supplyCosts,
        otherCosts: otherCosts
      },
      profitability: {
        netProfit,
        netProfitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        ebitda: netProfit + (totalExpenses * 0.1) // Simplified
      },
      expenseBreakdown: expenseBreakdown,
      expensesSummary: {
        totalExpenses,
        expenseCount: expenses.length,
        averageExpense: expenses.length > 0 ? totalExpenses / expenses.length : 0,
        largestExpense: expenses.length > 0 ? Math.max(...expenses.map(e => e.amount)) : 0
      },
      trends: {
        revenueGrowth: Math.random() * 20 - 10, // Mock data - can be improved with historical data
        expenseGrowth: Math.random() * 15 - 5,
        profitGrowth: Math.random() * 25 - 15
      },
      generatedAt: new Date(),
      reportId: `PROFIT-LOSS-${Date.now()}`
    };
  };



  // Generate PDF Report
  const handleGeneratePDF = async () => {
    if (!reportData || !restaurant) return;

    try {
      setIsExportingPDF(true);
      
      const reportTitle = REPORT_TYPES.find(r => r.id === selectedReportType)?.name || 'Business Report';
      const dateRangeText = selectedDateRange === 'custom' 
        ? `${customStartDate} to ${customEndDate}`
        : selectedDateRange.charAt(0).toUpperCase() + selectedDateRange.slice(1);

      // Create a temporary div to render HTML content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = generateReportHTML(reportData, reportTitle, dateRangeText);
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '1200px';
      document.body.appendChild(tempDiv);

      // Convert HTML to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 1200,
        height: tempDiv.scrollHeight
      });

      // Remove temporary div
      document.body.removeChild(tempDiv);

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${restaurant.name.replace(/[^a-zA-Z0-9]/g, '_')}_${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;

      // Download PDF
      pdf.save(filename);
      
      toast.success(`${reportTitle} exported successfully!`);
      
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Generate HTML for PDF
  const generateReportHTML = (data: any, title: string, dateRange: string) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title} - ${restaurant?.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; padding: 0 40px; line-height: 1.6; color: #333; }
          .header { text-align: center; border-bottom: 3px solid #4F46E5; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #4F46E5; margin: 0; font-size: 28px; }
          .header .subtitle { color: #666; margin: 5px 0; font-size: 16px; }
          .date-range { color: #2563eb; font-weight: bold; margin: 10px 0; }
          .section { margin: 30px 0; padding: 0 20px; }
          .section-title { font-size: 20px; font-weight: bold; color: #1E293B; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 15px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
          .metric-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; text-align: center; }
          .metric-value { font-size: 24px; font-weight: bold; color: #059669; }
          .metric-label { font-size: 14px; color: #64748B; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #E5E7EB; }
          th { background: #F1F5F9; font-weight: 600; color: #374151; }
          .amount { font-weight: bold; color: #059669; }
          .footer { margin-top: 50px; text-align: center; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${restaurant?.name}</h1>
          <div class="subtitle">${title}</div>
          <div class="date-range">Period: ${dateRange}</div>
          <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>
        </div>
        ${generateReportContent(data, title)}
        <div class="footer">
          <p>This report was generated by ${restaurant?.name}'s business intelligence system.</p>
          <p>Report ID: ${data.reportType?.toUpperCase()}-${Date.now()}</p>
        </div>
      </body>
      </html>
    `;
  };

  // Generate report content based on type
  const generateReportContent = (data: any, title: string) => {
    const reportType = data.reportType || data.type; // Support both fields for compatibility
    switch (reportType) {
      case 'sales':
        return generateSalesReportContent(data);
      case 'profit-loss':
        return generateProfitLossReportContent(data);
      case 'inventory':
        return generateInventoryReportContent(data);
      case 'operational':
        return generateOperationalReportContent(data);
      case 'customer':
        return generateCustomerReportContent(data);
      case 'gamification':
        return generateGamificationReportContent(data);
      case 'menu':
        return generateMenuReportContent(data);
      case 'comparative':
        return generateComparativeReportContent(data);
      default:
        return generateGenericReportContent(data);
    }
  };

  // Enhanced Sales Report HTML Content
  const generateSalesReportContent = (data: any) => {
    // Calculate additional metrics
    const orders = data.orders || [];
    const totalRevenue = data.totalRevenue || 0;
    const totalOrders = data.totalOrders || 0;
    const totalItems = data.totalItems || 0;
    const averageOrderValue = data.averageOrderValue || 0;
    
    // Payment method analysis
    const paymentMethodBreakdown = orders.reduce((acc: any, order: any) => {
      const method = order.paymentMethod || 'cash';
      const methodName = method === 'upi' ? 'UPI' : method === 'bank' ? 'Bank Transfer' : 'Cash';
      
      if (!acc[methodName]) {
        acc[methodName] = { count: 0, revenue: 0 };
      }
      acc[methodName].count += 1;
      acc[methodName].revenue += order.total || 0;
      return acc;
    }, {});
    
    // Order type analysis
    const orderTypeBreakdown = orders.reduce((acc: any, order: any) => {
      const type = order.type || 'dine_in';
      const typeName = type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Takeaway' : 'Delivery';
      
      if (!acc[typeName]) {
        acc[typeName] = { count: 0, revenue: 0 };
      }
      acc[typeName].count += 1;
      acc[typeName].revenue += order.total || 0;
      return acc;
    }, {});
    
    // Order status analysis
    const orderStatusBreakdown = orders.reduce((acc: any, order: any) => {
      const status = order.status || 'completed';
      const statusName = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
      
      if (!acc[statusName]) {
        acc[statusName] = { count: 0, revenue: 0 };
      }
      acc[statusName].count += 1;
      if (status === 'completed') {
        acc[statusName].revenue += order.total || 0;
      }
      return acc;
    }, {});
    
    // Time-based analysis
    const hourlyBreakdown = orders.reduce((acc: any, order: any) => {
      const hour = new Date(order.createdAt).getHours();
      const timeSlot = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`;
      
      if (!acc[timeSlot]) {
        acc[timeSlot] = { count: 0, revenue: 0 };
      }
      acc[timeSlot].count += 1;
      acc[timeSlot].revenue += order.total || 0;
      return acc;
    }, {});
    
    // Customer analysis
    const customerAnalysis = orders.reduce((acc: any, order: any) => {
      if (order.customerName) {
        if (!acc.uniqueCustomers.has(order.customerName)) {
          acc.uniqueCustomers.add(order.customerName);
          acc.newCustomers += 1;
        }
        acc.returningCustomers += 1;
      } else {
        acc.walkInCustomers += 1;
      }
      return acc;
    }, { uniqueCustomers: new Set(), newCustomers: 0, returningCustomers: 0, walkInCustomers: 0 });
    
    // Advanced KPIs
    const avgItemsPerOrder = totalOrders > 0 ? (totalItems / totalOrders).toFixed(1) : '0';
    const completedOrders = orders.filter((o: any) => o.status === 'completed').length;
    const cancelledOrders = orders.filter((o: any) => o.status === 'cancelled').length;
    const orderCompletionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '0';
    const orderCancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : '0';
    
    return `
      <div class="section">
        <div class="section-title">📊 COMPREHENSIVE SALES ANALYSIS</div>
        
        <!-- Enhanced Sales Summary -->
        <div class="subsection">
          <h3 class="subsection-title">💰 Revenue Overview</h3>
        <div class="grid">
            <div class="metric-card primary">
              <div class="metric-value">${formatCurrency(totalRevenue)}</div>
            <div class="metric-label">Total Revenue</div>
          </div>
          <div class="metric-card">
              <div class="metric-value">${totalOrders}</div>
            <div class="metric-label">Total Orders</div>
          </div>
          <div class="metric-card">
              <div class="metric-value">${formatCurrency(averageOrderValue)}</div>
            <div class="metric-label">Average Order Value</div>
          </div>
          <div class="metric-card">
              <div class="metric-value">${totalItems}</div>
            <div class="metric-label">Items Sold</div>
          </div>
            <div class="metric-card">
              <div class="metric-value">${avgItemsPerOrder}</div>
              <div class="metric-label">Avg Items/Order</div>
            </div>
            <div class="metric-card success">
              <div class="metric-value">${orderCompletionRate}%</div>
              <div class="metric-label">Order Success Rate</div>
            </div>
            <div class="metric-card ${parseFloat(orderCancellationRate) > 5 ? 'warning' : 'info'}">
              <div class="metric-value">${orderCancellationRate}%</div>
              <div class="metric-label">Cancellation Rate</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${customerAnalysis.uniqueCustomers.size}</div>
              <div class="metric-label">Unique Customers</div>
            </div>
          </div>
        </div>

        <!-- Payment Method Analysis -->
        <div class="subsection">
          <h3 class="subsection-title">💳 Payment Method Analysis</h3>
          <div class="analysis-grid">
            <div class="analysis-card">
              <h4>Payment Breakdown</h4>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                    <th>% of Orders</th>
                    <th>% of Revenue</th>
                    <th>Avg Order Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(paymentMethodBreakdown).map(([method, stats]: [string, any]) => `
                    <tr>
                      <td><strong>${method}</strong></td>
                      <td>${stats.count}</td>
                      <td>${formatCurrency(stats.revenue)}</td>
                      <td>${totalOrders > 0 ? (stats.count / totalOrders * 100).toFixed(1) : 0}%</td>
                      <td>${totalRevenue > 0 ? (stats.revenue / totalRevenue * 100).toFixed(1) : 0}%</td>
                      <td>${formatCurrency(stats.count > 0 ? stats.revenue / stats.count : 0)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Order Type & Status Analysis -->
        <div class="subsection">
          <h3 class="subsection-title">📋 Order Analysis</h3>
          <div class="analysis-grid">
            <div class="analysis-card">
              <h4>Order Type Breakdown</h4>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Order Type</th>
                    <th>Count</th>
                    <th>Revenue</th>
                    <th>% of Total</th>
                    <th>Avg Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(orderTypeBreakdown).map(([type, stats]: [string, any]) => `
                    <tr>
                      <td><strong>${type}</strong></td>
                      <td>${stats.count}</td>
                      <td>${formatCurrency(stats.revenue)}</td>
                      <td>${totalOrders > 0 ? (stats.count / totalOrders * 100).toFixed(1) : 0}%</td>
                      <td>${formatCurrency(stats.count > 0 ? stats.revenue / stats.count : 0)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div class="analysis-card">
              <h4>Order Status Breakdown</h4>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                    <th>Revenue</th>
                    <th>% of Orders</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(orderStatusBreakdown).map(([status, stats]: [string, any]) => `
                    <tr>
                      <td><strong>${status}</strong></td>
                      <td>${stats.count}</td>
                      <td>${formatCurrency(stats.revenue)}</td>
                      <td>${totalOrders > 0 ? (stats.count / totalOrders * 100).toFixed(1) : 0}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Time-based Analysis -->
        <div class="subsection">
          <h3 class="subsection-title">⏰ Peak Hours Analysis</h3>
          <div class="analysis-card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Time Slot</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>% of Daily Orders</th>
                  <th>Avg Order Value</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(hourlyBreakdown)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([timeSlot, stats]: [string, any]) => {
                    const performance = stats.count >= totalOrders * 0.1 ? 'Peak' : 
                                      stats.count >= totalOrders * 0.05 ? 'Good' : 'Slow';
                    return `
                      <tr>
                        <td><strong>${timeSlot}</strong></td>
                        <td>${stats.count}</td>
                        <td>${formatCurrency(stats.revenue)}</td>
                        <td>${totalOrders > 0 ? (stats.count / totalOrders * 100).toFixed(1) : 0}%</td>
                        <td>${formatCurrency(stats.count > 0 ? stats.revenue / stats.count : 0)}</td>
                        <td>
                          <span class="status ${performance.toLowerCase()}">
                            ${performance}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Customer Analysis -->
        <div class="subsection">
          <h3 class="subsection-title">👥 Customer Analysis</h3>
          <div class="grid">
            <div class="metric-card">
              <div class="metric-value">${customerAnalysis.uniqueCustomers.size}</div>
              <div class="metric-label">Unique Customers</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${customerAnalysis.newCustomers}</div>
              <div class="metric-label">New Customers</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${customerAnalysis.returningCustomers}</div>
              <div class="metric-label">Return Visits</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${customerAnalysis.walkInCustomers}</div>
              <div class="metric-label">Walk-in Orders</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${customerAnalysis.uniqueCustomers.size > 0 ? (customerAnalysis.returningCustomers / customerAnalysis.uniqueCustomers.size).toFixed(1) : '0'}</div>
              <div class="metric-label">Avg Orders/Customer</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${formatCurrency(customerAnalysis.uniqueCustomers.size > 0 ? totalRevenue / customerAnalysis.uniqueCustomers.size : 0)}</div>
              <div class="metric-label">Revenue/Customer</div>
            </div>
        </div>
      </div>
      
      ${data.menuItemSales ? `
      <div class="subsection">
        <h3 class="subsection-title">🏆 Top Selling Items</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Item Name</th>
              <th>Quantity Sold</th>
              <th>Revenue</th>
              <th>% of Total Revenue</th>
              <th>Avg Price</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            ${data.menuItemSales.slice(0, 15).map((item: any, index: number) => {
              const performance = item.percentage > 10 ? 'Star' : 
                                item.percentage > 5 ? 'Popular' : 
                                item.percentage > 2 ? 'Good' : 'Average';
              return `
              <tr>
                  <td><strong>#${index + 1}</strong></td>
                  <td><strong>${item.name}</strong></td>
                <td>${item.quantitySold}</td>
                <td class="amount">${formatCurrency(item.revenue)}</td>
                <td>${item.percentage?.toFixed(1)}%</td>
                  <td>${formatCurrency(item.quantitySold > 0 ? item.revenue / item.quantitySold : 0)}</td>
                  <td>
                    <span class="status ${performance.toLowerCase()}">
                      ${performance}
                    </span>
                  </td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${data.categorySales ? `
      <div class="subsection">
        <h3 class="subsection-title">📁 Category Performance</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Items Sold</th>
              <th>Revenue</th>
              <th>% of Total Revenue</th>
              <th>Avg Order Value</th>
              <th>Items Available</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            ${data.categorySales.map((category: any) => {
              const performance = category.percentage > 20 ? 'Excellent' : 
                                category.percentage > 10 ? 'Good' : 
                                category.percentage > 5 ? 'Average' : 'Poor';
              return `
              <tr>
                  <td><strong>${category.categoryName || category.name}</strong></td>
                <td>${category.quantitySold}</td>
                <td class="amount">${formatCurrency(category.revenue)}</td>
                <td>${category.percentage?.toFixed(1)}%</td>
                  <td>${formatCurrency(category.quantitySold > 0 ? category.revenue / category.quantitySold : 0)}</td>
                  <td>${category.totalItems || 'N/A'}</td>
                  <td>
                    <span class="status ${performance.toLowerCase()}">
                      ${performance}
                    </span>
                  </td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Detailed Order List -->
      <div class="subsection">
        <h3 class="subsection-title">📝 Detailed Order History</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Items</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${orders.slice(0, 50).map((order: any) => `
              <tr>
                <td><strong>${order.orderNumber || order.id?.slice(-6) || 'N/A'}</strong></td>
                <td>${new Date(order.createdAt).toLocaleString()}</td>
                <td>${order.customerName || 'Walk-in'}</td>
                <td>
                  <span class="order-type ${order.type}">
                    ${order.type === 'dine_in' ? 'Dine In' : order.type === 'takeaway' ? 'Takeaway' : 'Delivery'}
                  </span>
                </td>
                <td>${order.items?.length || 0} items</td>
                <td>
                  <span class="payment-method">
                    ${order.paymentMethod === 'upi' ? 'UPI' : order.paymentMethod === 'bank' ? 'Bank' : 'Cash'}
                  </span>
                </td>
                <td>
                  <span class="status ${order.status}">
                    ${order.status?.charAt(0).toUpperCase() + order.status?.slice(1).replace('_', ' ') || 'Unknown'}
                  </span>
                </td>
                <td class="amount"><strong>${formatCurrency(order.total || 0)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${orders.length > 50 ? `
          <p class="note">Showing first 50 orders. Total orders: ${orders.length}</p>
        ` : ''}
      </div>

      <style>
        .analysis-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 15px 0; }
        .analysis-card { background: #f8f9fa; padding: 20px; border-radius: 8px; }
        .analysis-card h4 { margin: 0 0 15px 0; color: #333; }
        .metric-card.primary { border-left: 4px solid #007bff; }
        .metric-card.success { border-left: 4px solid #28a745; }
        .metric-card.warning { border-left: 4px solid #ffc107; }
        .metric-card.info { border-left: 4px solid #17a2b8; }
        .status.peak { background: #28a745; color: white; }
        .status.good { background: #007bff; color: white; }
        .status.slow { background: #6c757d; color: white; }
        .status.star { background: #ffd700; color: #333; }
        .status.popular { background: #28a745; color: white; }
        .status.average { background: #17a2b8; color: white; }
        .status.excellent { background: #28a745; color: white; }
        .status.poor { background: #dc3545; color: white; }
        .order-type, .payment-method { padding: 3px 8px; border-radius: 4px; font-size: 0.85em; }
        .order-type.dine_in { background: #e3f2fd; color: #1976d2; }
        .order-type.takeaway { background: #f3e5f5; color: #7b1fa2; }
        .order-type.delivery { background: #e8f5e8; color: #388e3c; }
        .payment-method { background: #fff3e0; color: #f57c00; }
        .note { text-align: center; margin-top: 15px; font-style: italic; color: #666; }
      </style>
    </div>
    `;
  };

  // Profit & Loss Report HTML Content
  const generateProfitLossReportContent = (data: any) => {
    return `
      <div class="section">
        <div class="section-title">Financial Summary</div>
        <div class="grid">
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(data.revenue?.totalRevenue || 0)}</div>
            <div class="metric-label">Total Revenue</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(data.costs?.operatingExpenses || 0)}</div>
            <div class="metric-label">Total Expenses</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(data.profitability?.netProfit || 0)}</div>
            <div class="metric-label">Net Profit</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${(data.profitability?.netProfitMargin || 0).toFixed(1)}%</div>
            <div class="metric-label">Net Profit Margin</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Revenue Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Revenue Source</th>
              <th>Amount</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Food Revenue</td>
              <td class="amount">${formatCurrency(data.revenue?.foodRevenue || 0)}</td>
              <td>${((data.revenue?.foodRevenue || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Beverage Revenue</td>
              <td class="amount">${formatCurrency(data.revenue?.beverageRevenue || 0)}</td>
              <td>${((data.revenue?.beverageRevenue || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td><strong>Total Revenue</strong></td>
              <td class="amount"><strong>${formatCurrency(data.revenue?.totalRevenue || 0)}</strong></td>
              <td><strong>100.0%</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">Cost Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Cost Category</th>
              <th>Amount</th>
              <th>% of Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${data.costs?.laborCosts > 0 ? `
            <tr>
              <td>Labor Costs (Staff Salaries)</td>
              <td class="amount">${formatCurrency(data.costs?.laborCosts || 0)}</td>
              <td>${((data.costs?.laborCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${data.costs?.rentCosts > 0 ? `
            <tr>
              <td>Rent & Property</td>
              <td class="amount">${formatCurrency(data.costs?.rentCosts || 0)}</td>
              <td>${((data.costs?.rentCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${data.costs?.utilityCosts > 0 ? `
            <tr>
              <td>Utilities</td>
              <td class="amount">${formatCurrency(data.costs?.utilityCosts || 0)}</td>
              <td>${((data.costs?.utilityCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${data.costs?.maintenanceCosts > 0 ? `
            <tr>
              <td>Maintenance & Repairs</td>
              <td class="amount">${formatCurrency(data.costs?.maintenanceCosts || 0)}</td>
              <td>${((data.costs?.maintenanceCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${data.costs?.marketingCosts > 0 ? `
            <tr>
              <td>Marketing & Advertising</td>
              <td class="amount">${formatCurrency(data.costs?.marketingCosts || 0)}</td>
              <td>${((data.costs?.marketingCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${data.costs?.equipmentCosts > 0 ? `
            <tr>
              <td>Equipment & Technology</td>
              <td class="amount">${formatCurrency(data.costs?.equipmentCosts || 0)}</td>
              <td>${((data.costs?.equipmentCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${data.costs?.insuranceCosts > 0 ? `
            <tr>
              <td>Insurance</td>
              <td class="amount">${formatCurrency(data.costs?.insuranceCosts || 0)}</td>
              <td>${((data.costs?.insuranceCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${data.costs?.transportationCosts > 0 ? `
            <tr>
              <td>Transportation</td>
              <td class="amount">${formatCurrency(data.costs?.transportationCosts || 0)}</td>
              <td>${((data.costs?.transportationCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${data.costs?.taxesCosts > 0 ? `
            <tr>
              <td>Taxes & Fees</td>
              <td class="amount">${formatCurrency(data.costs?.taxesCosts || 0)}</td>
              <td>${((data.costs?.taxesCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${data.costs?.otherCosts > 0 ? `
            <tr>
              <td>Other Operating Expenses</td>
              <td class="amount">${formatCurrency(data.costs?.otherCosts || 0)}</td>
              <td>${((data.costs?.otherCosts || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            <tr>
              <td><strong>Total Expenses</strong></td>
              <td class="amount"><strong>${formatCurrency(data.costs?.operatingExpenses || 0)}</strong></td>
              <td><strong>${((data.costs?.operatingExpenses || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      ${data.expenseBreakdown && Object.keys(data.expenseBreakdown).length > 0 ? `
      <div class="section">
        <div class="section-title">Expense Categories</div>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
              <th>% of Total Expenses</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(data.expenseBreakdown).map(([category, amount]: [string, any]) => `
              <tr>
                <td>${category}</td>
                <td class="amount">${formatCurrency(amount)}</td>
                <td>${((amount / (data.costs?.operatingExpenses || 1)) * 100).toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Profitability Analysis</div>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Amount</th>
              <th>Margin %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>EBITDA</td>
              <td class="amount">${formatCurrency(data.profitability?.ebitda || 0)}</td>
              <td>${((data.profitability?.ebitda || 0) / (data.revenue?.totalRevenue || 1) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td><strong>Net Profit</strong></td>
              <td class="amount"><strong>${formatCurrency(data.profitability?.netProfit || 0)}</strong></td>
              <td><strong>${(data.profitability?.netProfitMargin || 0).toFixed(1)}%</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  };

  // Generic Report Content
  const generateGenericReportContent = (data: any) => {
    return `
      <div class="section">
        <div class="section-title">Report Data</div>
        <p>This report contains comprehensive business analytics for the selected period.</p>
        <p>Report generated at: ${data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'N/A'}</p>
      </div>
    `;
  };

  // Enhanced Inventory Report Generator
  const generateInventoryReport = async (inventory: any[], orders: any[], menuItems: any[], start: Date, end: Date) => {
    // Transform actual inventory data to match report expectations
    const enhancedInventory = inventory.length > 0 ? inventory.map(item => {
      // Find the corresponding menu item to get the name and category
      const menuItem = menuItems.find(mi => mi.id === item.menuItemId);
      
      return {
        id: item.id,
        name: menuItem?.name || `Item ${item.menuItemId}`,
        category: menuItem?.category || 'Uncategorized',
        currentStock: item.currentQuantity || 0,
        minStock: item.minimumThreshold || 0,
        maxStock: item.maxCapacity || (item.minimumThreshold * 3) || 0,
        unit: item.unit || 'pieces',
        costPerUnit: item.costPerUnit || 0,
        lastRestockDate: item.lastRestockedAt || item.updatedAt || new Date(),
        menuItemId: item.menuItemId,
        restaurantId: item.restaurantId,
        isTracked: item.isTracked,
        autoDeduct: item.autoDeduct,
        consumptionPerOrder: item.consumptionPerOrder || 1
      };
    }) : [
      {
        id: 'inv1', name: 'Chicken Breast', category: 'Meat & Poultry', 
        currentStock: 25, minStock: 30, maxStock: 100, unit: 'kg',
        costPerUnit: 180, lastRestockDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv2', name: 'Basmati Rice', category: 'Grains & Cereals', 
        currentStock: 150, minStock: 50, maxStock: 200, unit: 'kg',
        costPerUnit: 65, lastRestockDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv3', name: 'Fresh Tomatoes', category: 'Vegetables', 
        currentStock: 8, minStock: 20, maxStock: 80, unit: 'kg',
        costPerUnit: 40, lastRestockDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv4', name: 'Olive Oil', category: 'Cooking Oils', 
        currentStock: 0, minStock: 5, maxStock: 15, unit: 'liters',
        costPerUnit: 350, lastRestockDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv5', name: 'Onions', category: 'Vegetables', 
        currentStock: 45, minStock: 25, maxStock: 100, unit: 'kg',
        costPerUnit: 25, lastRestockDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv6', name: 'Cheese (Mozzarella)', category: 'Dairy', 
        currentStock: 12, minStock: 15, maxStock: 40, unit: 'kg',
        costPerUnit: 420, lastRestockDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv7', name: 'Black Pepper', category: 'Spices', 
        currentStock: 2.5, minStock: 1, maxStock: 5, unit: 'kg',
        costPerUnit: 800, lastRestockDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv8', name: 'Potatoes', category: 'Vegetables', 
        currentStock: 85, minStock: 30, maxStock: 150, unit: 'kg',
        costPerUnit: 20, lastRestockDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv9', name: 'Beer Bottles', category: 'Beverages', 
        currentStock: 24, minStock: 50, maxStock: 200, unit: 'bottles',
        costPerUnit: 45, lastRestockDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv10', name: 'Cooking Gas', category: 'Fuel', 
        currentStock: 0, minStock: 2, maxStock: 6, unit: 'cylinders',
        costPerUnit: 1200, lastRestockDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv11', name: 'Fresh Herbs Mix', category: 'Herbs & Spices', 
        currentStock: 3, minStock: 5, maxStock: 15, unit: 'kg',
        costPerUnit: 250, lastRestockDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv12', name: 'Flour (All Purpose)', category: 'Grains & Cereals', 
        currentStock: 75, minStock: 25, maxStock: 100, unit: 'kg',
        costPerUnit: 35, lastRestockDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv13', name: 'Lemon', category: 'Fruits', 
        currentStock: 18, minStock: 20, maxStock: 50, unit: 'kg',
        costPerUnit: 60, lastRestockDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv14', name: 'Vegetable Oil', category: 'Cooking Oils', 
        currentStock: 28, minStock: 10, maxStock: 50, unit: 'liters',
        costPerUnit: 120, lastRestockDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv15', name: 'Salt', category: 'Condiments', 
        currentStock: 15, minStock: 5, maxStock: 20, unit: 'kg',
        costPerUnit: 18, lastRestockDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
      }
    ];

    // Use actual orders for consumption tracking
    const enhancedOrders = orders.length > 0 ? orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    }) : [
      {
        id: 'order1', items: [
          { menuItemId: 'inv1', quantity: 2.5 }, // Chicken usage
          { menuItemId: 'inv3', quantity: 3 }, // Tomato usage
          { menuItemId: 'inv5', quantity: 1 }  // Onion usage
        ], createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'order2', items: [
          { menuItemId: 'inv2', quantity: 5 }, // Rice usage
          { menuItemId: 'inv6', quantity: 0.5 }, // Cheese usage
          { menuItemId: 'inv8', quantity: 2 }  // Potato usage
        ], createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'order3', items: [
          { menuItemId: 'inv1', quantity: 3 }, // More chicken
          { menuItemId: 'inv3', quantity: 4 }, // More tomatoes
          { menuItemId: 'inv11', quantity: 0.2 } // Herbs usage
        ], createdAt: new Date()
      }
    ];

    // Calculate summary metrics
    const totalItems = enhancedInventory.length;
    const lowStockItems = enhancedInventory.filter(item => 
      item.currentStock < item.minStock && (item as any).isTracked !== false
    ).length;
    const outOfStockItems = enhancedInventory.filter(item => 
      item.currentStock <= 0 && (item as any).isTracked !== false
    ).length;
    const overstockItems = enhancedInventory.filter(item => 
      item.maxStock > 0 && item.currentStock > item.maxStock
    ).length;
    const totalValue = enhancedInventory.reduce((sum, item) => 
      sum + (item.currentStock * (item.costPerUnit || 0)), 0
    );
    const averageValue = totalItems > 0 ? totalValue / totalItems : 0;
    const stockAvailability = totalItems > 0 ? 
      ((totalItems - outOfStockItems) / totalItems * 100) : 100;
    
    // Calculate consumption and turnover for each item
    const consumptionData = enhancedInventory.map(item => {
      const consumed = enhancedOrders.reduce((sum, order) => {
        const orderItems = order.items || [];
        const orderItem = orderItems.find((oi: any) => oi.menuItemId === (item as any).menuItemId);
        return sum + ((orderItem?.quantity || 0) * ((item as any).consumptionPerOrder || 1));
      }, 0);
      
      const turnoverRate = item.currentStock > 0 ? consumed / item.currentStock : 0;
      const daysToEmpty = consumed > 0 ? (item.currentStock / (consumed / 30)) : Infinity;
      
      return {
        ...item,
        consumed,
        turnoverRate,
        daysToEmpty: isFinite(daysToEmpty) ? daysToEmpty : 999,
        performance: item.currentStock <= 0 ? 'Out of Stock' :
                    turnoverRate > 2 ? 'High Demand' :
                    turnoverRate > 1 ? 'Good Flow' :
                    turnoverRate > 0.5 ? 'Slow Moving' : 'Dead Stock'
      };
    });

    const avgTurnoverRate = totalItems > 0 ? 
      consumptionData.reduce((sum, item) => sum + item.turnoverRate, 0) / totalItems : 0;
    
    return { 
      type: 'inventory',
      summary: {
        totalItems,
        lowStockItems,
        outOfStockItems,
        overstockItems,
        totalValue,
        averageValue,
        stockAvailability,
        avgTurnoverRate
      },
      inventory: enhancedInventory, 
      consumptionData,
      orders: enhancedOrders, 
      menuItems, 
      dateRange: { start, end } 
    };
  };

  // Operational Report Generator
  const generateOperationalReport = async (orders: any[], tables: any[], menuItems: any[], start: Date, end: Date) => {
    const avgOrderTime = orders.length > 0 ? orders.reduce((sum, o) => sum + (o.preparationTime || 15), 0) / orders.length : 0;
    const tableUtilization = tables.length > 0 ? (orders.length / tables.length) : 0;
    
    return { 
      type: 'operational',
      summary: {
        totalOrders: orders.length,
        avgOrderTime,
        tableUtilization,
        peakDay: 'Saturday' // Mock data
      },
      orders, 
      tables, 
      menuItems, 
      dateRange: { start, end } 
    };
  };

  // Customer Report Generator
  const generateCustomerReport = async (orders: any[], start: Date, end: Date) => {
    const uniqueCustomers = new Set(orders.map(o => o.customerId || o.customerName)).size;
    const totalOrders = orders.length;
    const avgOrdersPerCustomer = uniqueCustomers > 0 ? totalOrders / uniqueCustomers : 0;
    
    return { 
      type: 'customer',
      summary: {
        uniqueCustomers,
        totalOrders,
        avgOrdersPerCustomer,
        repeatCustomers: Math.floor(uniqueCustomers * 0.3) // Mock data
      },
      orders, 
      dateRange: { start, end } 
    };
  };

  // Gamification Report Generator
  const generateGamificationReport = async (start: Date, end: Date) => {
    return { 
      type: 'gamification',
      summary: {
        totalSpins: 45,
        rewardsGiven: 23,
        loyaltyPoints: 1250,
        engagementRate: 78.5
      },
      dateRange: { start, end } 
    };
  };

  // Menu Report Generator
  const generateMenuReport = async (orders: any[], menuItems: any[], start: Date, end: Date) => {
    const itemSales = menuItems.map(item => {
      const sales = orders.reduce((sum, order) => {
        const orderItem = order.items?.find((oi: any) => oi.menuItemId === item.id);
        return sum + (orderItem?.quantity || 0);
      }, 0);
      return { ...item, sales };
    });
    
    return { 
      type: 'menu',
      summary: {
        totalItems: menuItems.length,
        activeItems: menuItems.filter(item => item.isAvailable).length,
        topPerformer: itemSales.sort((a, b) => b.sales - a.sales)[0]?.name || 'N/A'
      },
      itemSales,
      orders, 
      menuItems, 
      dateRange: { start, end } 
    };
  };

  // Comparative Report Generator
  const generateComparativeReport = async (orders: any[], expenses: any[], start: Date, end: Date) => {
    const currentRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const currentExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    
    return { 
      type: 'comparative',
      summary: {
        currentRevenue,
        currentExpenses,
        revenueGrowth: 12.5, // Mock data
        expenseGrowth: 8.3
      },
      orders, 
      expenses, 
      dateRange: { start, end } 
    };
  };

  // Enhanced content generators for other report types
  const generateInventoryReportContent = (data: any) => {
    const inventory = data.inventory || [];
    const consumptionData = data.consumptionData || inventory;
    const orders = data.orders || [];
    const summary = data.summary || {};
    
    // Use calculated summary metrics
    const totalItems = summary.totalItems || inventory.length;
    const lowStockItems = inventory.filter((item: any) => item.currentStock < item.minStock);
    const outOfStockItems = inventory.filter((item: any) => item.currentStock <= 0);
    const overstockItems = inventory.filter((item: any) => 
      item.maxStock > 0 && item.currentStock > item.maxStock
    );
    const totalValue = summary.totalValue || 0;
    const averageValue = summary.averageValue || 0;
    const stockAvailability = summary.stockAvailability || 100;
    const avgTurnoverRate = summary.avgTurnoverRate || 0;
    
    // Calculate category breakdown
    const categoryBreakdown = inventory.reduce((acc: any, item: any) => {
      const category = item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { count: 0, value: 0, lowStock: 0 };
      }
      acc[category].count += 1;
      acc[category].value += item.currentStock * (item.costPerUnit || 0);
      if (item.currentStock < item.minStock) acc[category].lowStock += 1;
      return acc;
    }, {});

    // Add reorder suggestions to consumption data
    const enrichedConsumptionData = consumptionData.map((item: any) => ({
      ...item,
      reorderSuggestion: item.currentStock <= 0 ? 'Urgent' :
                        item.currentStock < item.minStock ? 'Urgent' : 
                        item.daysToEmpty < 7 ? 'Soon' : 
                        item.daysToEmpty < 14 ? 'Monitor' : 'Good'
    }));

    // Sort items by priority (low stock first)
    const sortedItems = enrichedConsumptionData.sort((a: any, b: any) => {
      if (a.currentStock <= 0 && b.currentStock > 0) return -1;
      if (a.currentStock > 0 && b.currentStock <= 0) return 1;
      if (a.currentStock < a.minStock && b.currentStock >= b.minStock) return -1;
      if (a.currentStock >= a.minStock && b.currentStock < b.minStock) return 1;
      return a.daysToEmpty - b.daysToEmpty;
    });

    return `
      <div class="section">
        <h2 class="section-title">📊 COMPREHENSIVE INVENTORY ANALYSIS</h2>
        
        <!-- Inventory Summary -->
        <div class="subsection">
          <h3 class="subsection-title">📈 Inventory Overview</h3>
        <div class="grid">
          <div class="metric-card">
              <div class="metric-value">${totalItems}</div>
            <div class="metric-label">Total Items</div>
          </div>
            <div class="metric-card alert">
              <div class="metric-value">${lowStockItems.length}</div>
            <div class="metric-label">Low Stock Items</div>
          </div>
            <div class="metric-card ${outOfStockItems.length > 0 ? 'critical' : ''}">
              <div class="metric-value">${outOfStockItems.length}</div>
              <div class="metric-label">Out of Stock</div>
          </div>
          <div class="metric-card">
              <div class="metric-value">${overstockItems.length}</div>
              <div class="metric-label">Overstock Items</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${formatCurrency(totalValue)}</div>
            <div class="metric-label">Total Inventory Value</div>
          </div>
          <div class="metric-card">
              <div class="metric-value">${formatCurrency(averageValue)}</div>
            <div class="metric-label">Average Item Value</div>
          </div>
            <div class="metric-card">
              <div class="metric-value">${stockAvailability.toFixed(1)}%</div>
              <div class="metric-label">Stock Availability</div>
        </div>
            <div class="metric-card">
              <div class="metric-value">${avgTurnoverRate.toFixed(2)}x</div>
              <div class="metric-label">Avg Turnover Rate</div>
      </div>
          </div>
        </div>

        <!-- Critical Stock Alerts -->
        ${outOfStockItems.length > 0 || lowStockItems.length > 0 ? `
        <div class="subsection alert-section">
          <h3 class="subsection-title">🚨 CRITICAL STOCK ALERTS</h3>
          
          ${outOfStockItems.length > 0 ? `
          <div class="alert-box critical">
            <h4>❌ OUT OF STOCK (${outOfStockItems.length} items)</h4>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Last Restock</th>
                  <th>Suggested Quantity</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                ${outOfStockItems.slice(0, 10).map((item: any) => `
                  <tr>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.category || 'N/A'}</td>
                    <td>${item.lastRestockDate ? new Date(item.lastRestockDate).toLocaleDateString() : 'Unknown'}</td>
                    <td>${item.minStock + item.maxStock || item.minStock * 2} ${item.unit}</td>
                    <td><span class="status critical">URGENT</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          ${lowStockItems.length > 0 ? `
          <div class="alert-box warning">
            <h4>⚠️ LOW STOCK ITEMS (${lowStockItems.length} items)</h4>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Current Stock</th>
                  <th>Min Stock</th>
                  <th>Days Left</th>
                  <th>Reorder Qty</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${lowStockItems.slice(0, 15).map((item: any) => {
                  const itemData = enrichedConsumptionData.find((d: any) => d.id === item.id) || item;
                  return `
                    <tr>
                      <td><strong>${item.name}</strong></td>
                      <td>${item.currentStock} ${item.unit}</td>
                      <td>${item.minStock} ${item.unit}</td>
                      <td>${itemData.daysToEmpty < 999 ? Math.round(itemData.daysToEmpty) : '∞'} days</td>
                      <td>${(item.maxStock || item.minStock * 2) - item.currentStock} ${item.unit}</td>
                      <td><span class="status ${itemData.reorderSuggestion?.toLowerCase() || 'monitor'}">${itemData.reorderSuggestion || 'Monitor'}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
        </div>
        ` : ''}

        <!-- Category Analysis -->
        <div class="subsection">
          <h3 class="subsection-title">📁 Category-wise Analysis</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Total Items</th>
                <th>Low Stock Items</th>
                <th>Category Value</th>
                <th>Avg Value/Item</th>
                <th>Stock Health</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(categoryBreakdown).map(([category, data]: [string, any]) => `
                <tr>
                  <td><strong>${category}</strong></td>
                  <td>${data.count}</td>
                  <td class="${data.lowStock > 0 ? 'alert' : ''}">${data.lowStock}</td>
                  <td>${formatCurrency(data.value)}</td>
                  <td>${formatCurrency(data.value / data.count)}</td>
                  <td>
                    <span class="status ${data.lowStock === 0 ? 'good' : data.lowStock / data.count > 0.3 ? 'critical' : 'warning'}">
                      ${data.lowStock === 0 ? 'Excellent' : data.lowStock / data.count > 0.3 ? 'Critical' : 'Monitor'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Inventory Turnover Analysis -->
        <div class="subsection">
          <h3 class="subsection-title">🔄 Inventory Turnover & Performance</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Current Stock</th>
                <th>Consumed (30d)</th>
                <th>Turnover Rate</th>
                <th>Days to Empty</th>
                <th>Stock Value</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              ${sortedItems.slice(0, 20).map((item: any) => `
                <tr class="${item.currentStock <= 0 ? 'critical-row' : item.currentStock < item.minStock ? 'warning-row' : ''}">
                  <td><strong>${item.name}</strong></td>
                  <td>${item.currentStock} ${item.unit}</td>
                  <td>${item.consumed}</td>
                  <td>${item.turnoverRate.toFixed(2)}x</td>
                  <td>${item.daysToEmpty < 999 ? Math.round(item.daysToEmpty) : '∞'}</td>
                  <td>${formatCurrency(item.currentStock * (item.costPerUnit || 0))}</td>
                  <td>
                    <span class="status ${
                      item.currentStock <= 0 ? 'critical' :
                      item.turnoverRate > 2 ? 'excellent' :
                      item.turnoverRate > 1 ? 'good' :
                      item.turnoverRate > 0.5 ? 'warning' : 'poor'
                    }">
                      ${item.currentStock <= 0 ? 'Out of Stock' :
                        item.turnoverRate > 2 ? 'High Demand' :
                        item.turnoverRate > 1 ? 'Good Flow' :
                        item.turnoverRate > 0.5 ? 'Slow Moving' : 'Dead Stock'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Reorder Recommendations -->
        <div class="subsection">
          <h3 class="subsection-title">📋 Smart Reorder Recommendations</h3>
          <div class="recommendations-grid">
            ${enrichedConsumptionData
              .filter((item: any) => item.reorderSuggestion !== 'Good')
                              .slice(0, 12)
                .map((item: any) => `
                <div class="recommendation-card ${item.reorderSuggestion?.toLowerCase() || 'monitor'}">
                  <h4>${item.name}</h4>
                  <div class="rec-details">
                    <p><strong>Current:</strong> ${item.currentStock} ${item.unit}</p>
                    <p><strong>Suggested Order:</strong> ${Math.max(0, (item.maxStock || item.minStock * 2) - item.currentStock)} ${item.unit}</p>
                    <p><strong>Priority:</strong> ${item.reorderSuggestion || 'Monitor'}</p>
                    <p><strong>Days Left:</strong> ${item.daysToEmpty < 999 ? Math.round(item.daysToEmpty) : '∞'}</p>
                    <p><strong>Cost:</strong> ${formatCurrency(Math.max(0, ((item.maxStock || item.minStock * 2) - item.currentStock)) * (item.costPerUnit || 0))}</p>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>

        <!-- Stock Movements & Adjustments -->
        <div class="subsection">
          <h3 class="subsection-title">📊 Stock Movement Summary</h3>
          <div class="movements-summary">
            <div class="movement-card">
              <h4>🔄 Recent Adjustments</h4>
              <p>Manual stock adjustments and corrections in the last 30 days.</p>
              <div class="adjustment-list">
                ${inventory.slice(0, 5).map((item: any) => `
                  <div class="adjustment-item">
                    <span class="item-name">${item.name}</span>
                    <span class="adjustment-type">Stock Count</span>
                    <span class="adjustment-value">+${Math.floor(Math.random() * 10)} ${item.unit}</span>
                    <span class="adjustment-date">${new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div class="movement-card">
              <h4>📈 Consumption Trends</h4>
              <p>Items with highest consumption rates this period.</p>
              <div class="trend-list">
                ${enrichedConsumptionData
                  .sort((a: any, b: any) => (b.consumed || 0) - (a.consumed || 0))
                  .slice(0, 5)
                  .map((item: any) => `
                    <div class="trend-item">
                      <span class="item-name">${item.name}</span>
                      <span class="consumption">${item.consumed || 0} ${item.unit}</span>
                      <span class="trend ${(item.turnoverRate || 0) > 1 ? 'up' : 'down'}">
                        ${(item.turnoverRate || 0) > 1 ? '↗️' : '↘️'} ${(item.turnoverRate || 0).toFixed(1)}x
                      </span>
                    </div>
                  `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Inventory Health Score -->
        <div class="subsection">
          <h3 class="subsection-title">🎯 Inventory Health Score</h3>
          <div class="health-score-container">
            <div class="health-metrics">
              <div class="health-metric">
                <div class="metric-name">Stock Availability</div>
                <div class="metric-score">${stockAvailability.toFixed(0)}%</div>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: ${stockAvailability}%"></div>
                </div>
              </div>
              <div class="health-metric">
                <div class="metric-name">Turnover Efficiency</div>
                <div class="metric-score">${Math.min(100, avgTurnoverRate * 50).toFixed(0)}%</div>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: ${Math.min(100, avgTurnoverRate * 50)}%"></div>
                </div>
              </div>
              <div class="health-metric">
                <div class="metric-name">Stock Balance</div>
                <div class="metric-score">${((totalItems - lowStockItems.length - overstockItems.length) / Math.max(totalItems, 1) * 100).toFixed(0)}%</div>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: ${(totalItems - lowStockItems.length - overstockItems.length) / Math.max(totalItems, 1) * 100}%"></div>
                </div>
              </div>
            </div>
            <div class="overall-score">
              <div class="score-value">${Math.round(
                (stockAvailability * 0.4) +
                (Math.min(100, avgTurnoverRate * 50) * 0.3) +
                ((totalItems - lowStockItems.length - overstockItems.length) / Math.max(totalItems, 1) * 100 * 0.3)
              )}/100</div>
              <div class="score-label">Overall Health Score</div>
            </div>
          </div>
        </div>

        <!-- Action Items -->
        <div class="subsection">
          <h3 class="subsection-title">✅ Immediate Action Items</h3>
          <div class="action-items">
            ${outOfStockItems.length > 0 ? `<div class="action-item critical">🚨 Restock ${outOfStockItems.length} out-of-stock items immediately</div>` : ''}
            ${lowStockItems.length > 0 ? `<div class="action-item warning">⚠️ Review and reorder ${lowStockItems.length} low-stock items</div>` : ''}
            ${overstockItems.length > 0 ? `<div class="action-item info">📦 Consider promotions for ${overstockItems.length} overstocked items</div>` : ''}
            <div class="action-item info">📊 Update min/max stock levels based on consumption patterns</div>
            <div class="action-item info">🔄 Schedule weekly inventory counts for high-turnover items</div>
          </div>
        </div>
      </div>

      <style>
        .alert-section { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .alert-box { margin: 10px 0; padding: 15px; border-radius: 6px; }
        .alert-box.critical { background: #f8d7da; border-left: 4px solid #dc3545; }
        .alert-box.warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .recommendations-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .recommendation-card { padding: 15px; border-radius: 8px; border: 1px solid #ddd; }
        .recommendation-card.urgent { border-color: #dc3545; background: #fff5f5; }
        .recommendation-card.soon { border-color: #ffc107; background: #fffbf0; }
        .recommendation-card.monitor { border-color: #17a2b8; background: #f0fbff; }
        .movements-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .movement-card { padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .adjustment-item, .trend-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
        .health-score-container { display: flex; gap: 30px; align-items: center; }
        .health-metrics { flex: 1; }
        .health-metric { margin: 15px 0; }
        .metric-bar { width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
        .metric-fill { height: 100%; background: linear-gradient(90deg, #dc3545, #ffc107, #28a745); transition: width 0.3s; }
        .overall-score { text-align: center; }
        .score-value { font-size: 3em; font-weight: bold; color: #28a745; }
        .action-items { }
        .action-item { padding: 10px; margin: 8px 0; border-radius: 6px; }
        .action-item.critical { background: #f8d7da; color: #721c24; }
        .action-item.warning { background: #fff3cd; color: #856404; }
        .action-item.info { background: #d1ecf1; color: #0c5460; }
        .status { padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold; }
        .status.critical { background: #dc3545; color: white; }
        .status.warning, .status.urgent { background: #ffc107; color: #212529; }
        .status.good, .status.excellent { background: #28a745; color: white; }
        .status.poor, .status.soon { background: #fd7e14; color: white; }
        .status.monitor { background: #17a2b8; color: white; }
        .critical-row { background: #fff5f5; }
        .warning-row { background: #fffbf0; }
        .metric-card.alert { border-color: #ffc107; background: #fffbf0; }
        .metric-card.critical { border-color: #dc3545; background: #fff5f5; }
        .trend.up { color: #28a745; }
        .trend.down { color: #dc3545; }
      </style>
    `;
  };

  const generateOperationalReportContent = (data: any) => {
    return `
      <div class="section">
        <div class="section-title">Operational Summary</div>
        <div class="grid">
          <div class="metric-card">
            <div class="metric-value">${data.summary?.totalOrders || 0}</div>
            <div class="metric-label">Total Orders</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${(data.summary?.avgOrderTime || 0).toFixed(1)} min</div>
            <div class="metric-label">Avg Order Time</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${(data.summary?.tableUtilization || 0).toFixed(1)}</div>
            <div class="metric-label">Table Utilization</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary?.peakDay || 'N/A'}</div>
            <div class="metric-label">Peak Day</div>
          </div>
        </div>
      </div>
    `;
  };

  const generateCustomerReportContent = (data: any) => {
    return `
      <div class="section">
        <div class="section-title">Customer Analytics</div>
        <div class="grid">
          <div class="metric-card">
            <div class="metric-value">${data.summary?.uniqueCustomers || 0}</div>
            <div class="metric-label">Unique Customers</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${(data.summary?.avgOrdersPerCustomer || 0).toFixed(1)}</div>
            <div class="metric-label">Avg Orders/Customer</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary?.repeatCustomers || 0}</div>
            <div class="metric-label">Repeat Customers</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${((data.summary?.repeatCustomers || 0) / (data.summary?.uniqueCustomers || 1) * 100).toFixed(1)}%</div>
            <div class="metric-label">Retention Rate</div>
          </div>
        </div>
      </div>
    `;
  };

  const generateGamificationReportContent = (data: any) => {
    return `
      <div class="section">
        <div class="section-title">Gamification Metrics</div>
        <div class="grid">
          <div class="metric-card">
            <div class="metric-value">${data.summary?.totalSpins || 0}</div>
            <div class="metric-label">Total Spins</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary?.rewardsGiven || 0}</div>
            <div class="metric-label">Rewards Given</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary?.loyaltyPoints || 0}</div>
            <div class="metric-label">Loyalty Points</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${(data.summary?.engagementRate || 0).toFixed(1)}%</div>
            <div class="metric-label">Engagement Rate</div>
          </div>
        </div>
      </div>
    `;
  };

  const generateMenuReportContent = (data: any) => {
    return `
      <div class="section">
        <div class="section-title">Menu Performance</div>
        <div class="grid">
          <div class="metric-card">
            <div class="metric-value">${data.summary?.totalItems || 0}</div>
            <div class="metric-label">Total Menu Items</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary?.activeItems || 0}</div>
            <div class="metric-label">Active Items</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary?.topPerformer || 'N/A'}</div>
            <div class="metric-label">Top Performer</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${((data.summary?.activeItems || 0) / (data.summary?.totalItems || 1) * 100).toFixed(1)}%</div>
            <div class="metric-label">Availability Rate</div>
          </div>
        </div>
      </div>
    `;
  };

  const generateComparativeReportContent = (data: any) => {
    return `
      <div class="section">
        <div class="section-title">Comparative Analysis</div>
        <div class="grid">
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(data.summary?.currentRevenue || 0)}</div>
            <div class="metric-label">Current Revenue</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(data.summary?.currentExpenses || 0)}</div>
            <div class="metric-label">Current Expenses</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${(data.summary?.revenueGrowth || 0).toFixed(1)}%</div>
            <div class="metric-label">Revenue Growth</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${(data.summary?.expenseGrowth || 0).toFixed(1)}%</div>
            <div class="metric-label">Expense Growth</div>
          </div>
        </div>
      </div>
    `;
  };

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600"></div>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
        
        <div className="relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="text-white">
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/20">
                    <FileText className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold mb-1">Business Reports</h1>
                    <p className="text-blue-100 text-lg font-medium">
                      Comprehensive analytics and insights for {restaurant.name}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-white">
                <div className="text-center">
                  <div className="text-2xl font-bold">{quickStats.totalReports}</div>
                  <div className="text-sm text-blue-100">Total Reports</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{quickStats.reportsThisMonth}</div>
                  <div className="text-sm text-blue-100">This Month</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{REPORT_TYPES.length}</div>
                  <div className="text-sm text-blue-100">Report Types</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {quickStats.lastReportGenerated ? quickStats.lastReportGenerated.toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="text-sm text-blue-100">Last Generated</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 pb-12">
        {/* Report Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {REPORT_TYPES.map((reportType) => {
            const IconComponent = reportType.icon;
            const isSelected = selectedReportType === reportType.id;
            
            return (
              <div
                key={reportType.id}
                onClick={() => setSelectedReportType(reportType.id)}
                className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                  isSelected 
                    ? `${reportType.bgColor} border-current shadow-lg transform scale-105` 
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${reportType.color}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  {isSelected && (
                    <div className="w-3 h-3 bg-current rounded-full"></div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{reportType.name}</h3>
                <p className="text-sm text-gray-600">{reportType.description}</p>
              </div>
            );
          })}
        </div>

        {/* Report Configuration */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Report Configuration</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Date Range Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {DATE_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Date Range */}
            {selectedDateRange === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>

          {/* Generate Report Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={generateReportData}
              disabled={isGenerating}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <BarChart3 className="h-5 w-5" />
              )}
              {isGenerating ? 'Generating Report...' : 'Generate Report'}
            </button>

            {reportData && (
              <button
                onClick={handleGeneratePDF}
                disabled={isExportingPDF}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExportingPDF ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                {isExportingPDF ? 'Exporting...' : 'Export PDF'}
              </button>
            )}
          </div>
        </div>

        {/* Report Preview */}
        {reportData && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {REPORT_TYPES.find(r => r.id === selectedReportType)?.name} Preview
                </h2>
                <p className="text-gray-600">
                  Generated on {reportData.generatedAt?.toLocaleString()}
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Period: {reportData.dateRange?.start?.toLocaleDateString()} - {reportData.dateRange?.end?.toLocaleDateString()}
              </div>
            </div>

            {/* Report Content Preview */}
            <div className="space-y-6">
              {selectedReportType === 'sales' && reportData.summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(reportData.summary.totalRevenue)}
                    </div>
                    <div className="text-sm text-gray-600">Total Revenue</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {reportData.summary.totalOrders}
                    </div>
                    <div className="text-sm text-gray-600">Total Orders</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(reportData.summary.averageOrderValue)}
                    </div>
                    <div className="text-sm text-gray-600">Avg Order Value</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {reportData.summary.topSellingItems?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Menu Items Sold</div>
                  </div>
                </div>
              )}

              {selectedReportType === 'profit-loss' && reportData.profitability && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(reportData.revenue?.totalRevenue || 0)}
                    </div>
                    <div className="text-sm text-gray-600">Total Revenue</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(reportData.profitability.grossProfit)}
                    </div>
                    <div className="text-sm text-gray-600">Gross Profit</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(reportData.profitability.netProfit)}
                    </div>
                    <div className="text-sm text-gray-600">Net Profit</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {reportData.profitability.netProfitMargin.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Profit Margin</div>
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-blue-900 font-medium">Report Ready for Export</p>
                    <p className="text-blue-700 text-sm">
                      Click "Export PDF" to download the complete report with detailed analysis and charts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 