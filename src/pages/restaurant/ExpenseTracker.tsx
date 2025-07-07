import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { ExpenseService } from '@/services/expenseService';
import { ExpenseCategoryService } from '@/services/expenseCategoryService';
import { 
  Expense, 
  ExpenseCategory, 
  CreateExpenseRequest, 
  ExpenseFilters,
  ExpenseStats,
  ExpensePaymentMethod,
  ExpenseStatus 
} from '@/types';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Receipt,
  Building,
  Users,
  Package,
  Zap,
  Megaphone,
  Laptop,
  Wrench,
  FileText,
  Shield,
  Truck,
  MoreHorizontal,
  PieChart,
  BarChart3,
  Settings,
  RefreshCw,
  Loader2,
  X
} from 'lucide-react';

// Icon mapping for categories
const ICON_MAP: Record<string, any> = {
  Users,
  Package,
  Zap,
  Building,
  Megaphone,
  Laptop,
  Wrench,
  FileText,
  Shield,
  Truck,
  Receipt,
  MoreHorizontal,
};

interface ExpenseFormData {
  categoryId: string;
  title: string;
  description: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  expenseDate: string;
  dueDate: string;
  vendorName: string;
  vendorContact: string;
  invoiceNumber: string;
  reference: string;
  notes: string;
  tags: string;
  isRecurring: boolean;
}

interface CustomCategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  monthlyLimit: number;
  alertThreshold: number;
}

export default function ExpenseTracker() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  
  // State management
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<string>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Form management
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ExpenseFormData>({
    defaultValues: {
      expenseDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      isRecurring: false,
    }
  });

  // Custom category form
  const { register: registerCategory, handleSubmit: handleSubmitCategory, reset: resetCategory, formState: { errors: categoryErrors } } = useForm<CustomCategoryFormData>({
    defaultValues: {
      color: '#3B82F6',
      icon: 'MoreHorizontal',
      alertThreshold: 80,
    }
  });

  // Load data on component mount
  useEffect(() => {
    if (restaurant && user) {
      loadExpenseData();
    }
  }, [restaurant, user]);

  // Load all expense-related data
  const loadExpenseData = async () => {
    if (!restaurant) return;

    try {
      setLoading(true);
      
      const [expensesResult, categoriesResult, statsResult] = await Promise.all([
        ExpenseService.getExpensesForRestaurant(restaurant.id, filters),
        ExpenseCategoryService.getCategoriesForRestaurant(restaurant.id),
        ExpenseService.getExpenseStats(restaurant.id),
      ]);

      if (expensesResult.success && expensesResult.data) {
        setExpenses(expensesResult.data);
      } else {
        toast.error(expensesResult.error || 'Failed to load expenses');
      }

      if (categoriesResult.success && categoriesResult.data) {
        setCategories(categoriesResult.data);
      } else {
        toast.error(categoriesResult.error || 'Failed to load categories');
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }

    } catch (error) {
      console.error('Error loading expense data:', error);
      toast.error('Failed to load expense data');
    } finally {
      setLoading(false);
    }
  };

  // Create new expense
  const handleCreateExpense = async (data: ExpenseFormData) => {
    if (!restaurant || !user) return;

    try {
      const expenseData: CreateExpenseRequest = {
        categoryId: data.categoryId,
        title: data.title,
        description: data.description,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        expenseDate: new Date(data.expenseDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        vendor: data.vendorName ? {
          name: data.vendorName,
          contact: data.vendorContact,
        } : undefined,
        invoiceNumber: data.invoiceNumber,
        reference: data.reference,
        notes: data.notes,
        tags: data.tags ? data.tags.split(',').map(tag => tag.trim()) : [],
        isRecurring: data.isRecurring,
      };

      const result = await ExpenseService.createExpense(restaurant.id, expenseData, user.id);
      
      if (result.success) {
        toast.success('Expense created successfully!');
        setShowAddModal(false);
        reset();
        loadExpenseData();
      } else {
        toast.error(result.error || 'Failed to create expense');
      }
    } catch (error) {
      console.error('Error creating expense:', error);
      toast.error('Failed to create expense');
    }
  };

  // Create custom category
  const handleCreateCustomCategory = async (data: CustomCategoryFormData) => {
    if (!restaurant || !user) return;

    try {
      const categoryData = {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        isActive: true,
        isDefault: false,
        budget: {
          monthlyLimit: data.monthlyLimit,
          alertThreshold: data.alertThreshold,
        },
      };

      const result = await ExpenseCategoryService.createCategory(restaurant.id, categoryData, user.id);
      
      if (result.success) {
        toast.success('Custom category created successfully!');
        setShowAddCategoryModal(false);
        resetCategory();
        loadExpenseData(); // Reload to get updated categories
      } else {
        toast.error(result.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    }
  };

  // Approve expense
  const handleApproveExpense = async (expense: Expense) => {
    if (!restaurant || !user) return;

    try {
      const result = await ExpenseService.approveExpense(restaurant.id, expense.id, user.id);
      
      if (result.success) {
        toast.success('Expense approved successfully!');
        loadExpenseData();
      } else {
        toast.error(result.error || 'Failed to approve expense');
      }
    } catch (error) {
      console.error('Error approving expense:', error);
      toast.error('Failed to approve expense');
    }
  };

  // Mark expense as paid
  const handleMarkAsPaid = async (expense: Expense) => {
    if (!restaurant || !user) return;

    try {
      const result = await ExpenseService.markAsPaid(restaurant.id, expense.id, user.id);
      
      if (result.success) {
        toast.success('Expense marked as paid!');
        loadExpenseData();
      } else {
        toast.error(result.error || 'Failed to mark expense as paid');
      }
    } catch (error) {
      console.error('Error marking expense as paid:', error);
      toast.error('Failed to mark expense as paid');
    }
  };

  // View expense details
  const handleViewExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowViewModal(true);
  };

  // Load analytics data
  const handleShowAnalytics = async () => {
    if (!restaurant) return;
    
    try {
      setAnalyticsLoading(true);
      setShowStatsModal(true);
      
      const result = await ExpenseService.getExpenseAnalytics(restaurant.id);
      if (result.success && result.data) {
        setAnalytics(result.data);
      } else {
        toast.error(result.error || 'Failed to load analytics');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Get date range for export
  const getExportDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (exportDateRange) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { start: yesterday, end: today };
      case 'week':
        return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now };
      case '15days':
        return { start: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), end: now };
      case 'month':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
      case '3months':
        return { start: new Date(now.getFullYear(), now.getMonth() - 3, 1), end: now };
      case '6months':
        return { start: new Date(now.getFullYear(), now.getMonth() - 6, 1), end: now };
      case '12months':
        return { start: new Date(now.getFullYear(), now.getMonth() - 12, 1), end: now };
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : new Date(now.getFullYear(), 0, 1),
          end: customEndDate ? new Date(customEndDate) : now
        };
      default:
        return { start: new Date(0), end: now };
    }
  };

  // Get filtered analytics data for export
  const getFilteredAnalyticsData = () => {
    if (!analytics) return null;

    const { start, end } = getExportDateRange();
    
    // Filter expenses by date range
    const filteredExpenses = expenses.filter(expense => {
      const expenseDate = expense.expenseDate;
      return expenseDate >= start && expenseDate <= end;
    });

    // Recalculate analytics for filtered data
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    // Category breakdown for filtered data
    const categoryMap = new Map<string, { amount: number; count: number }>();
    filteredExpenses.forEach(expense => {
      const key = expense.categoryId;
      const current = categoryMap.get(key) || { amount: 0, count: 0 };
      categoryMap.set(key, {
        amount: current.amount + expense.amount,
        count: current.count + 1,
      });
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([categoryId, data]) => {
      const expense = filteredExpenses.find(e => e.categoryId === categoryId);
      return {
        categoryId,
        categoryName: expense?.categoryName || categoryId,
        amount: data.amount,
        percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
        count: data.count,
      };
    }).sort((a, b) => b.amount - a.amount);

    // Top vendors for filtered data
    const vendorMap = new Map<string, { amount: number; count: number }>();
    filteredExpenses.forEach(expense => {
      if (expense.vendor?.name) {
        const current = vendorMap.get(expense.vendor.name) || { amount: 0, count: 0 };
        vendorMap.set(expense.vendor.name, {
          amount: current.amount + expense.amount,
          count: current.count + 1,
        });
      }
    });

    const topVendors = Array.from(vendorMap.entries())
      .map(([vendorName, data]) => ({
        vendorName,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Payment method breakdown for filtered data
    const paymentMethodMap = new Map<string, { amount: number; count: number }>();
    filteredExpenses.forEach(expense => {
      const current = paymentMethodMap.get(expense.paymentMethod) || { amount: 0, count: 0 };
      paymentMethodMap.set(expense.paymentMethod, {
        amount: current.amount + expense.amount,
        count: current.count + 1,
      });
    });

    const paymentMethodBreakdown = Array.from(paymentMethodMap.entries()).map(([method, data]) => ({
      method: method as any,
      amount: data.amount,
      percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
      count: data.count,
    }));

    return {
      totalExpenses,
      expenseCount: filteredExpenses.length,
      categoryBreakdown,
      topVendors,
      paymentMethodBreakdown,
      dateRange: { start, end },
      expenses: filteredExpenses
    };
  };

  // Export to PDF function
  const handleExportPDF = async () => {
    if (!restaurant) return;
    
    const filteredData = getFilteredAnalyticsData();
    if (!filteredData) return;

    try {
      setIsExporting(true);
      toast.loading('Preparing PDF export...');
      
      const dateRangeText = exportDateRange === 'custom' 
        ? `${customStartDate} to ${customEndDate}`
        : exportDateRange.charAt(0).toUpperCase() + exportDateRange.slice(1);

      // Create a comprehensive HTML report
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Expense Report - ${restaurant.name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              color: #333;
              line-height: 1.6;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #4F46E5; 
              padding-bottom: 20px; 
              margin-bottom: 30px;
            }
            .header h1 { 
              color: #4F46E5; 
              margin: 0;
              font-size: 28px;
            }
            .header p { 
              color: #666; 
              margin: 5px 0;
              font-size: 16px;
            }
            .date-range { 
              color: #2563eb; 
              font-weight: bold; 
              margin-top: 5px; 
            }
            .summary-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
              gap: 20px; 
              margin-bottom: 30px;
            }
            .summary-card { 
              background: #F8FAFC; 
              border: 1px solid #E2E8F0; 
              border-radius: 8px; 
              padding: 20px; 
              text-align: center;
            }
            .summary-card h3 { 
              margin: 0 0 10px 0; 
              color: #64748B; 
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .summary-card .amount { 
              font-size: 24px; 
              font-weight: bold; 
              color: #1E293B;
            }
            .section { 
              margin-bottom: 40px;
            }
            .section h2 { 
              color: #1E293B; 
              border-bottom: 1px solid #E2E8F0; 
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px;
            }
            th, td { 
              padding: 12px; 
              text-align: left; 
              border-bottom: 1px solid #E2E8F0;
            }
            th { 
              background-color: #F1F5F9; 
              font-weight: 600;
              color: #475569;
            }
            .category-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px 0;
              border-bottom: 1px solid #F1F5F9;
            }
            .category-name {
              font-weight: 500;
              color: #1E293B;
            }
            .category-amount {
              font-weight: 600;
              color: #059669;
            }
            .footer { 
              margin-top: 50px; 
              text-align: center; 
              color: #64748B; 
              font-size: 12px;
              border-top: 1px solid #E2E8F0;
              padding-top: 20px;
            }
            @media print {
              .no-print { display: none; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${restaurant.name}</h1>
            <p>Expense Analytics Report</p>
            <div class="date-range">Period: ${dateRangeText}</div>
            <p>Generated on ${new Date().toLocaleDateString('en-GB', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}</p>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <h3>Total Expenses</h3>
              <div class="amount">${formatCurrency(filteredData.totalExpenses)}</div>
            </div>
            <div class="summary-card">
              <h3>Total Transactions</h3>
              <div class="amount">${filteredData.expenseCount}</div>
            </div>
            <div class="summary-card">
              <h3>Average per Transaction</h3>
              <div class="amount">${filteredData.expenseCount > 0 ? formatCurrency(filteredData.totalExpenses / filteredData.expenseCount) : formatCurrency(0)}</div>
            </div>
          </div>

          <div class="section">
            <h2>Expenses by Category</h2>
            ${filteredData.categoryBreakdown.map((category: any) => {
              const categoryInfo = getCategoryById(category.categoryId);
              return `
                <div class="category-item">
                  <div>
                    <div class="category-name">${categoryInfo?.name || category.categoryName}</div>
                    <div style="color: #64748B; font-size: 14px;">${category.count} expenses</div>
                  </div>
                  <div>
                    <div class="category-amount">${formatCurrency(category.amount)}</div>
                    <div style="color: #64748B; font-size: 14px;">${category.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          ${filteredData.topVendors.length > 0 ? `
            <div class="section">
              <h2>Top Vendors</h2>
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredData.topVendors.map((vendor: any) => `
                    <tr>
                      <td>${vendor.vendorName}</td>
                      <td>${formatCurrency(vendor.amount)}</td>
                      <td>${vendor.count}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="section">
            <h2>Payment Methods</h2>
            <table>
              <thead>
                <tr>
                  <th>Payment Method</th>
                  <th>Amount</th>
                  <th>Percentage</th>
                  <th>Transactions</th>
                </tr>
              </thead>
              <tbody>
                ${filteredData.paymentMethodBreakdown.map((method: any) => `
                  <tr>
                    <td style="text-transform: capitalize;">${method.method.replace('_', ' ')}</td>
                    <td>${formatCurrency(method.amount)}</td>
                    <td>${method.percentage.toFixed(1)}%</td>
                    <td>${method.count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>This report was generated automatically by ${restaurant.name}'s expense management system.</p>
            <p>Report ID: EXP-${Date.now()}</p>
          </div>
        </body>
        </html>
      `;

      // Create and download PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load then print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 1000);
        };
      }
      
      toast.dismiss();
      toast.success(`${dateRangeText} expense report exported successfully!`);
      setShowExportModal(false);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.dismiss();
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Get category by ID
  const getCategoryById = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId);
  };

  // Get status color
  const getStatusColor = (status: ExpenseStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon
  const getStatusIcon = (status: ExpenseStatus) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'paid': return <DollarSign className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // Filter expenses based on search, category, and date range
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = !searchTerm || 
      expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vendor?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategoryFilter || expense.categoryId === selectedCategoryFilter;
    
    const matchesDateRange = (() => {
      if (selectedDateRange === 'all') return true;
      
      const now = new Date();
      const expenseDate = expense.expenseDate;
      
      // Create proper date boundaries for accurate filtering
      switch (selectedDateRange) {
        case 'today':
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          return expenseDate >= todayStart && expenseDate <= todayEnd;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          weekAgo.setHours(0, 0, 0, 0);
          return expenseDate >= weekAgo;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          return expenseDate >= monthStart;
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          return expenseDate >= yearStart;
        default:
          return true;
      }
    })();
    
    return matchesSearch && matchesCategory && matchesDateRange;
  });

  // Calculate enhanced stats for filtered expenses
  const getFilteredExpenseStats = () => {
    if (filteredExpenses.length === 0) {
      return {
        totalAmount: 0,
        averageAmount: 0,
        categoryBreakdown: {},
        paymentMethodBreakdown: {},
        statusBreakdown: {},
        dateRange: selectedDateRange
      };
    }

    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const averageAmount = totalAmount / filteredExpenses.length;

    // Category breakdown with proper names
    const categoryBreakdown = filteredExpenses.reduce((acc: { [key: string]: { amount: number; count: number } }, expense) => {
      const categoryName = expense.categoryName || expense.categoryId || 'Unknown';
      const current = acc[categoryName] || { amount: 0, count: 0 };
      acc[categoryName] = {
        amount: current.amount + expense.amount,
        count: current.count + 1
      };
      return acc;
    }, {});

    // Payment method breakdown
    const paymentMethodBreakdown = filteredExpenses.reduce((acc: { [key: string]: { amount: number; count: number } }, expense) => {
      const method = expense.paymentMethod;
      const current = acc[method] || { amount: 0, count: 0 };
      acc[method] = {
        amount: current.amount + expense.amount,
        count: current.count + 1
      };
      return acc;
    }, {});

    // Status breakdown
    const statusBreakdown = filteredExpenses.reduce((acc: { [key: string]: { amount: number; count: number } }, expense) => {
      const status = expense.status;
      const current = acc[status] || { amount: 0, count: 0 };
      acc[status] = {
        amount: current.amount + expense.amount,
        count: current.count + 1
      };
      return acc;
    }, {});

    return {
      totalAmount,
      averageAmount,
      categoryBreakdown,
      paymentMethodBreakdown,
      statusBreakdown,
      dateRange: selectedDateRange
    };
  };

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 bg-indigo-100 rounded-lg sm:rounded-xl">
                  <Receipt className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600" />
                  </div>
                  <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Expense Tracker</h1>
                  <p className="text-gray-600 text-sm sm:text-base">
                    <span className="hidden sm:inline">Manage and track all business expenses for </span>
                    <span className="sm:hidden">Track expenses for </span>
                    {restaurant.name}
                    </p>
                  </div>
                </div>
              </div>
              
            <div className="w-full sm:w-auto flex flex-col gap-2 lg:hidden">
                <button
                onClick={() => setShowAddModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-indigo-600 text-white rounded-lg sm:rounded-xl hover:bg-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl font-semibold text-base sm:text-lg"
                >
                <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                <span>Add Expense</span>
                </button>
                
                <button
                onClick={() => setShowAddCategoryModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-gray-100 text-gray-700 rounded-lg sm:rounded-xl hover:bg-gray-200 transition-all duration-300 text-sm sm:text-base"
              >
                <Plus className="h-4 w-4" />
                <span>New Category</span>
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3 sm:p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 text-center">
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500">Total Expense</p>
                <p className="mt-1 text-base sm:text-lg font-semibold text-gray-900">{formatCurrency(stats?.yearExpenses || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500">This Month</p>
                <p className="mt-1 text-base sm:text-lg font-semibold text-gray-900">{formatCurrency(stats.monthExpenses)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500">Pending</p>
                <p className="mt-1 text-base sm:text-lg font-semibold text-orange-600">{stats.pendingExpenses}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Button Row */}
      <div className="hidden lg:flex max-w-full mx-auto px-6 xl:px-8 pb-4 gap-3">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg font-semibold"
        >
          <Plus className="h-5 w-5" />
          Add Expense
        </button>
        <button
          onClick={() => setShowAddCategoryModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium"
        >
          <Plus className="h-4 w-4" />
          New Category
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 pb-6 sm:pb-8 lg:pb-12">
        {/* Filters and Search */}
        <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg border border-gray-200 mb-3 sm:mb-4 lg:mb-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-2.5 lg:py-3 w-full border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base"
              />
            </div>
            
            <div className="flex flex-wrap xl:flex-nowrap gap-2 overflow-x-auto xl:overflow-visible scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {/* Category Filter */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base min-w-[140px]"
              >
                <option value="">All Categories</option>
                {categories.filter(cat => cat.isActive).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} {!category.isDefault ? '(Custom)' : ''}
                  </option>
                ))}
              </select>

              {/* Date Range Filter */}
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base min-w-[120px]"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
              
              <button 
                onClick={loadExpenseData}
                disabled={loading}
                className="flex-shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 bg-indigo-600 text-white rounded-lg sm:rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm sm:text-base min-w-[80px] sm:min-w-[100px]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {/* Clear Filters */}
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategoryFilter('');
                  setSelectedDateRange('all');
                }}
                className="flex-shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 border border-gray-300 rounded-lg sm:rounded-xl hover:bg-gray-50 transition-colors text-sm sm:text-base min-w-[70px] sm:min-w-[110px]"
              >
                <XCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>

            {/* Filter Summary */}
            {(searchTerm || selectedCategoryFilter || selectedDateRange !== 'all') && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-sm text-gray-600">Active filters:</span>
                {searchTerm && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Search: "{searchTerm}"
                  </span>
                )}
                {selectedCategoryFilter && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    Category: {getCategoryById(selectedCategoryFilter)?.name}
                  </span>
                )}
                {selectedDateRange !== 'all' && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                    Range: {selectedDateRange.charAt(0).toUpperCase() + selectedDateRange.slice(1)}
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  ({filteredExpenses.length} of {expenses.length} expenses)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Summary for Filtered Results */}
        {(searchTerm || selectedCategoryFilter || selectedDateRange !== 'all') && filteredExpenses.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg sm:rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 mb-3 sm:mb-4 lg:mb-6 border border-indigo-200">
            <h3 className="text-base sm:text-lg font-semibold text-indigo-900 mb-2 sm:mb-4">Filtered Results Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="text-center">
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-indigo-600">
                  {filteredExpenses.length}
                </p>
                <p className="text-xs sm:text-sm text-indigo-700">Expenses Found</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600">
                  {formatCurrency(filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0))}
                </p>
                <p className="text-xs sm:text-sm text-purple-700">Total Amount</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-pink-600">
                  {formatCurrency(filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0) / Math.max(filteredExpenses.length, 1))}
                </p>
                <p className="text-xs sm:text-sm text-pink-700">Average Amount</p>
              </div>
            </div>
          </div>
        )}

        {/* Expenses List */}
        <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl shadow-lg border border-gray-200">
          <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
              <div>
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">Recent Expenses</h2>
                <p className="text-xs sm:text-sm lg:text-base text-gray-600">Manage and track all your business expenses</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleShowAnalytics}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-xs sm:text-sm"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </button>
                
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs sm:text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>

              {filteredExpenses.length > 0 && (
                <button
                  onClick={() => {
                    const csvData = filteredExpenses
                      .map(exp => {
                        const cat = getCategoryById(exp.categoryId);
                        return `"${exp.title}","${cat?.name || 'Unknown'}",${exp.amount},"${exp.paymentMethod}","${exp.expenseDate.toLocaleDateString()}","${exp.status}","${exp.vendor?.name || ''}"`;
                      })
                      .join('\n');
                    const csvContent = `Title,Category,Amount,Payment Method,Date,Status,Vendor\n${csvData}`;
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${restaurant?.name}-expenses-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Expense list exported!');
                  }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm"
                >
                  <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">CSV</span>
                </button>
              )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 sm:p-12 text-center">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto text-indigo-600 mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-gray-600">Loading expenses...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Receipt className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No expenses found</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Get started by adding your first expense</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-lg sm:rounded-xl hover:bg-indigo-700 transition-colors text-sm sm:text-base"
              >
                <Plus className="h-4 w-4" />
                Add First Expense
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expense Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                  {filteredExpenses.map((expense) => {
                    const category = getCategoryById(expense.categoryId);
                    const IconComponent = category ? ICON_MAP[category.icon] : Receipt;
                    
                    return (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{expense.title}</div>
                            {expense.description && (
                              <div className="text-sm text-gray-500">{expense.description}</div>
                            )}
                            {expense.vendor && (
                              <div className="text-xs text-gray-400 mt-1">Vendor: {expense.vendor.name}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {category && (
                            <div className="flex items-center gap-2">
                              <div 
                                className="p-2 rounded-lg" 
                                style={{ backgroundColor: `${category.color}20` }}
                              >
                                <IconComponent 
                                  className="h-4 w-4" 
                                  style={{ color: category.color }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-900">{category.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{formatCurrency(expense.amount)}</div>
                          <div className="text-xs text-gray-500 capitalize">{expense.paymentMethod.replace('_', ' ')}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                            {getStatusIcon(expense.status)}
                            {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{expense.expenseDate.toLocaleDateString()}</div>
                          {expense.dueDate && (
                            <div className="text-xs text-gray-500">Due: {expense.dueDate.toLocaleDateString()}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewExpense(expense)}
                              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            
                            {expense.status === 'approved' && (
                              <button
                                onClick={() => handleMarkAsPaid(expense)}
                                className="p-2 text-blue-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                title="Mark as Paid"
                              >
                                <DollarSign className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden">
              <div className="space-y-2 sm:space-y-3 p-3 sm:p-4">
                {filteredExpenses.map((expense) => {
                  const category = getCategoryById(expense.categoryId);
                  const IconComponent = category ? ICON_MAP[category.icon] : Receipt;
                  
                  return (
                    <div key={expense.id} className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{expense.title}</h3>
                          {expense.description && (
                            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 line-clamp-2">{expense.description}</p>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)} whitespace-nowrap flex-shrink-0`}>
                          {getStatusIcon(expense.status)}
                          <span className="hidden xs:inline">{expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}</span>
                        </span>
                      </div>

                      {/* Amount and Category */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          {category && (
                            <div 
                              className="p-1.5 sm:p-2 rounded-lg flex-shrink-0" 
                              style={{ backgroundColor: `${category.color}20` }}
                            >
                              <IconComponent 
                                className="h-4 w-4" 
                                style={{ color: category.color }}
                              />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">{category?.name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500 capitalize truncate">{expense.paymentMethod.replace('_', ' ')}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm sm:text-base lg:text-lg font-bold text-gray-900">{formatCurrency(expense.amount)}</div>
                          <div className="text-xs text-gray-500">{expense.expenseDate.toLocaleDateString()}</div>
                        </div>
                      </div>

                      {/* Vendor and Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <div className="text-xs sm:text-sm text-gray-600 truncate flex-1 pr-2">
                          {expense.vendor ? (
                            <span>Vendor: {expense.vendor.name}</span>
                          ) : (
                            <span>No vendor specified</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleViewExpense(expense)}
                            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          {expense.status === 'approved' && (
                            <button
                              onClick={() => handleMarkAsPaid(expense)}
                              className="p-1.5 sm:p-2 text-blue-400 hover:text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Mark as Paid"
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto px-2 sm:px-4 py-4 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh]">
            {/* Drag handle & Header */}
            <div className="py-2 flex flex-col items-center border-b border-gray-200 relative">
              <span className="w-12 h-1.5 bg-gray-300 rounded-full"></span>
              <h2 className="mt-2 text-base sm:text-lg font-semibold text-gray-900">Add New Expense</h2>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); reset(); }}
                className="absolute right-4 top-2 p-2 text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="text-xs text-gray-500">Record a new business expense</p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4">
            <form id="expenseForm" onSubmit={handleSubmit(handleCreateExpense)} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCategoryModal(true)}
                      className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      + Add Custom Category
                    </button>
                  </div>
                  <select
                    {...register('categoryId', { required: 'Category is required' })}
                  className="w-full p-2 sm:p-2.5 lg:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select Category</option>
                    {categories.filter(cat => cat.isActive).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} {!category.isDefault ? '(Custom)' : ''}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p className="mt-1 text-xs sm:text-sm text-red-600">{errors.categoryId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('amount', { 
                      required: 'Amount is required',
                      min: { value: 0, message: 'Amount must be positive' }
                    })}
                  className="w-full p-2 sm:p-2.5 lg:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    placeholder="0.00"
                  />
                  {errors.amount && (
                    <p className="mt-1 text-xs sm:text-sm text-red-600">{errors.amount.message}</p>
                  )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  {...register('title')}
                  className="w-full p-2 sm:p-2.5 lg:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="e.g., Office supplies, Staff salaries..."
                />
                {errors.title && (
                  <p className="mt-1 text-xs sm:text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full p-2 sm:p-2.5 lg:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Additional details about this expense..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method *
                  </label>
                  <select
                    {...register('paymentMethod', { required: 'Payment method is required' })}
                    className="w-full p-2 sm:p-2.5 lg:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    {...register('expenseDate', { required: 'Expense date is required' })}
                    className="w-full p-2 sm:p-2.5 lg:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    {...register('vendorName')}
                    className="w-full p-2 sm:p-2.5 lg:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    placeholder="Vendor or supplier name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    {...register('invoiceNumber')}
                    className="w-full p-2 sm:p-2.5 lg:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    placeholder="Invoice or receipt number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  {...register('tags')}
                  className="w-full p-2 sm:p-2.5 lg:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Separate tags with commas (e.g., urgent, monthly, equipment)"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('isRecurring')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  This is a recurring expense
                </label>
              </div>
            </form>
              </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-white flex gap-3 sticky bottom-0">
                <button
                  type="button"
                onClick={() => { setShowAddModal(false); reset(); }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                form="expenseForm"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Add Expense
                </button>
              </div>
          </div>
        </div>
      )}

      {/* View Expense Modal */}
      {showViewModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">{selectedExpense.title}</h2>
                  <p className="text-xs sm:text-sm lg:text-base text-gray-600">Expense Details</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(selectedExpense.status)}`}>
                  {getStatusIcon(selectedExpense.status)}
                  {selectedExpense.status.charAt(0).toUpperCase() + selectedExpense.status.slice(1)}
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Amount</label>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(selectedExpense.amount)}</p>
                  <p className="text-xs sm:text-sm text-gray-500 capitalize">{selectedExpense.paymentMethod.replace('_', ' ')}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Category</label>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const category = getCategoryById(selectedExpense.categoryId);
                      const IconComponent = category ? ICON_MAP[category.icon] : Receipt;
                      return category ? (
                        <>
                          <div 
                            className="p-1.5 sm:p-2 rounded-lg" 
                            style={{ backgroundColor: `${category.color}20` }}
                          >
                            <IconComponent 
                              className="h-4 w-4" 
                              style={{ color: category.color }}
                            />
                          </div>
                          <span className="font-medium text-gray-900">{category.name}</span>
                        </>
                      ) : (
                        <span className="font-medium text-gray-900">{selectedExpense.categoryName}</span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {selectedExpense.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
                  <p className="text-gray-900">{selectedExpense.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Expense Date</label>
                  <p className="text-gray-900">{selectedExpense.expenseDate.toLocaleDateString()}</p>
                </div>
                
                {selectedExpense.dueDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Due Date</label>
                    <p className="text-gray-900">{selectedExpense.dueDate.toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {selectedExpense.vendor && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Vendor</label>
                  <p className="text-gray-900">{selectedExpense.vendor.name}</p>
                  {selectedExpense.vendor.contact && (
                    <p className="text-sm text-gray-600">{selectedExpense.vendor.contact}</p>
                  )}
                </div>
              )}

              {selectedExpense.invoiceNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Invoice Number</label>
                  <p className="text-gray-900">{selectedExpense.invoiceNumber}</p>
                </div>
              )}

              {selectedExpense.tags && selectedExpense.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedExpense.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedExpense.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                  <p className="text-gray-900">{selectedExpense.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 text-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Created</label>
                  <p className="text-gray-900">{selectedExpense.createdAt.toLocaleDateString()}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Last Updated</label>
                  <p className="text-gray-900">{selectedExpense.updatedAt.toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 lg:p-6 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {selectedExpense.status === 'approved' && (
                  <button
                    onClick={() => {
                      handleMarkAsPaid(selectedExpense);
                      setShowViewModal(false);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                  >
                    <DollarSign className="h-4 w-4" />
                    Mark as Paid
                  </button>
                )}
              </div>
              
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 sm:px-6 py-2 sm:py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto px-2 sm:px-4 py-4 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[95vh]">
            {/* Drag handle & Header */}
            <div className="py-2 flex flex-col items-center border-b border-gray-200 relative">
              <span className="w-12 h-1.5 bg-gray-300 rounded-full"></span>
              <h2 className="mt-2 text-base sm:text-lg font-semibold text-gray-900">Add Custom Category</h2>
              <button
                type="button"
                onClick={() => { setShowAddCategoryModal(false); resetCategory(); }}
                className="absolute right-4 top-2 p-2 text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="text-xs text-gray-500">Create a new expense category for your restaurant</p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
              <form id="categoryForm" onSubmit={handleSubmitCategory(handleCreateCustomCategory)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  {...registerCategory('name', { required: 'Category name is required' })}
                    className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="e.g., Office Supplies"
                />
                {categoryErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{categoryErrors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  {...registerCategory('description')}
                  rows={3}
                    className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Brief description of this category"
                />
              </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <input
                    type="color"
                    {...registerCategory('color')}
                      className="w-full h-10 sm:h-12 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon
                  </label>
                  <select
                    {...registerCategory('icon')}
                      className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  >
                    <option value="MoreHorizontal">Default</option>
                    <option value="Users">People</option>
                    <option value="Package">Package</option>
                    <option value="Zap">Energy</option>
                    <option value="Building">Building</option>
                    <option value="Megaphone">Marketing</option>
                    <option value="Laptop">Technology</option>
                    <option value="Wrench">Tools</option>
                    <option value="FileText">Documents</option>
                    <option value="Shield">Security</option>
                    <option value="Truck">Transport</option>
                    <option value="Receipt">Receipt</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Budget Limit (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  {...registerCategory('monthlyLimit', { 
                    required: 'Monthly limit is required',
                    min: { value: 0, message: 'Amount must be positive' }
                  })}
                    className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="e.g., 10000"
                />
                {categoryErrors.monthlyLimit && (
                  <p className="mt-1 text-sm text-red-600">{categoryErrors.monthlyLimit.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  {...registerCategory('alertThreshold')}
                    className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="e.g., 80"
                />
                <p className="mt-1 text-xs text-gray-500">Get notified when spending reaches this percentage of the budget</p>
                </div>
              </form>
              </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-white flex gap-3 sticky bottom-0">
                <button
                  type="button"
                onClick={() => { setShowAddCategoryModal(false); resetCategory(); }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                form="categoryForm"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Create Category
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">Expense Analytics</h2>
                  <p className="text-xs sm:text-sm lg:text-base text-gray-600">Detailed insights into your restaurant's expenses</p>
                </div>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4 lg:p-6">
              {analyticsLoading ? (
                <div className="text-center py-8 sm:py-12">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto text-indigo-600 mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-gray-600">Loading analytics...</p>
                </div>
              ) : analytics ? (
                <div className="space-y-4 sm:space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-blue-600 text-xs sm:text-sm font-medium">Total Expenses</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900">{formatCurrency(analytics.totalExpenses)}</p>
                        </div>
                        <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-green-600 text-xs sm:text-sm font-medium">This Month</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-900">{formatCurrency(analytics.monthlyExpenses)}</p>
                        </div>
                        <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-purple-600 text-xs sm:text-sm font-medium">This Year</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-900">{formatCurrency(analytics.yearlyExpenses)}</p>
                        </div>
                        <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-orange-600 text-xs sm:text-sm font-medium">Avg Monthly</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-900">{formatCurrency(analytics.averageMonthlyExpense)}</p>
                        </div>
                        <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
                      </div>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 lg:p-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Expenses by Category</h3>
                    <div className="space-y-3 sm:space-y-4">
                      {analytics.categoryBreakdown.slice(0, 8).map((category: any, index: number) => {
                        const categoryInfo = getCategoryById(category.categoryId);
                        const IconComponent = categoryInfo ? ICON_MAP[categoryInfo.icon] : Receipt;
                        
                        return (
                          <div key={category.categoryId} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                {categoryInfo && (
                                  <div 
                                    className="p-1.5 sm:p-2 rounded-lg flex-shrink-0" 
                                    style={{ backgroundColor: `${categoryInfo.color}20` }}
                                  >
                                    <IconComponent 
                                      className="h-4 w-4" 
                                      style={{ color: categoryInfo.color }}
                                    />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{categoryInfo?.name || category.categoryName}</p>
                                  <p className="text-xs sm:text-sm text-gray-500">{category.count} expenses</p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-semibold text-gray-900 text-sm sm:text-base">{formatCurrency(category.amount)}</p>
                                <p className="text-xs sm:text-sm text-gray-500">{category.percentage.toFixed(1)}%</p>
                              </div>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full transition-all duration-500" 
                                style={{ 
                                  width: `${category.percentage}%`,
                                  backgroundColor: categoryInfo?.color || '#6B7280'
                                }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Show All Categories Button */}
                    {analytics.categoryBreakdown.length > 8 && (
                      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                        <p className="text-xs sm:text-sm text-gray-500 text-center">
                          Showing top 8 of {analytics.categoryBreakdown.length} categories
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Monthly Trends */}
                  <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 lg:p-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Monthly Trends (Last 6 Months)</h3>
                    <div className="space-y-2 sm:space-y-3">
                      {analytics.monthlyTrends.slice(-6).map((trend: any, index: number) => (
                        <div key={index} className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-gray-900 text-sm sm:text-base">{trend.month}</p>
                            <p className="text-xs sm:text-sm text-gray-500">{trend.count} expenses</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 text-sm sm:text-base">{formatCurrency(trend.amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Vendors */}
                  {analytics.topVendors.length > 0 && (
                    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 lg:p-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Top Vendors</h3>
                      <div className="space-y-2 sm:space-y-3">
                        {analytics.topVendors.slice(0, 5).map((vendor: any, index: number) => (
                          <div key={index} className="flex items-center justify-between py-2">
                            <div>
                              <p className="font-medium text-gray-900 text-sm sm:text-base">{vendor.vendorName}</p>
                              <p className="text-xs sm:text-sm text-gray-500">{vendor.count} transactions</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900 text-sm sm:text-base">{formatCurrency(vendor.amount)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment Methods */}
                  <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 lg:p-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Payment Methods</h3>
                    <div className="space-y-2 sm:space-y-3">
                      {analytics.paymentMethodBreakdown.map((method: any, index: number) => (
                        <div key={index} className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-gray-900 capitalize text-sm sm:text-base">{method.method.replace('_', ' ')}</p>
                            <p className="text-xs sm:text-sm text-gray-500">{method.count} transactions</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 text-sm sm:text-base">{formatCurrency(method.amount)}</p>
                            <p className="text-xs sm:text-sm text-gray-500">{method.percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-gray-600">No analytics data available</p>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 lg:p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => {
                      setShowStatsModal(false);
                      setShowExportModal(true);
                    }}
                    disabled={!analytics}
                    className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-xs sm:text-sm lg:text-base"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export Report</span>
                    <span className="sm:hidden">Export</span>
                  </button>

                  <button
                    onClick={() => {
                      if (analytics) {
                        const csvData = analytics.categoryBreakdown
                          .map((cat: any) => `${getCategoryById(cat.categoryId)?.name || cat.categoryName},${cat.amount},${cat.count}`)
                          .join('\n');
                        const csvContent = `Category,Amount,Count\n${csvData}`;
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${restaurant?.name}-expense-analytics-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Analytics CSV exported successfully!');
                      }
                    }}
                    disabled={!analytics}
                    className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-xs sm:text-sm lg:text-base"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export Analytics CSV</span>
                    <span className="sm:hidden">CSV</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowStatsModal(false)}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm lg:text-base"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Export Expense Report</h2>
                  <p className="text-sm sm:text-base text-gray-600">Select date range for your expense report</p>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="space-y-4">
                {/* Date Range Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Date Range
                  </label>
                  <select
                    value={exportDateRange}
                    onChange={(e) => setExportDateRange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Last 1 Week</option>
                    <option value="15days">Last 15 Days</option>
                    <option value="month">Last 1 Month</option>
                    <option value="3months">Last 3 Months</option>
                    <option value="6months">Last 6 Months</option>
                    <option value="12months">Last 12 Months</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                {/* Custom Date Range */}
                {exportDateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Preview Data */}
                {(() => {
                  const filteredData = getFilteredAnalyticsData();
                  return filteredData ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Report Preview</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Total Expenses:</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(filteredData.totalExpenses)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Transactions:</p>
                          <p className="font-semibold text-gray-900">{filteredData.expenseCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Categories:</p>
                          <p className="font-semibold text-gray-900">{filteredData.categoryBreakdown.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Vendors:</p>
                          <p className="font-semibold text-gray-900">{filteredData.topVendors.length}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm">No data available for the selected date range.</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting || !getFilteredAnalyticsData()}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isExporting ? 'Exporting...' : 'Export PDF'}
                  </button>

                  <button
                    onClick={() => {
                      const filteredData = getFilteredAnalyticsData();
                      if (filteredData && restaurant) {
                        const csvData = filteredData.expenses
                          .map((exp: any) => 
                            `${exp.expenseDate.toLocaleDateString()},${exp.title},${exp.categoryName},${exp.amount},${exp.paymentMethod},${exp.vendor?.name || 'N/A'}`
                          )
                          .join('\n');
                        const csvContent = `Date,Title,Category,Amount,Payment Method,Vendor\n${csvData}`;
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const dateRangeText = exportDateRange === 'custom' 
                          ? `${customStartDate}-to-${customEndDate}`
                          : exportDateRange;
                        a.download = `${restaurant.name.replace(/\s+/g, '-').toLowerCase()}-expenses-${dateRangeText}-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Expense list CSV exported successfully!');
                      }
                    }}
                    disabled={!getFilteredAnalyticsData()}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                </div>

                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 