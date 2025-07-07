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
  AlertCircle,
  Receipt
} from 'lucide-react';
import { SalesAnalytics } from '@/services/salesReportService'; // Import the type

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
  },
  {
    id: 'expense',
    name: 'Expense Report',
    description: 'Detailed breakdown of all business expenses.',
    icon: Receipt,
    color: 'bg-red-100 text-red-600',
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
  const [reportData, setReportData] = useState<SalesAnalytics | null>(null);

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

  // Refactor generateReportData to be the single source of truth
  const handleGenerateReport = async () => {
    if (!restaurant) return;

    setIsGenerating(true);
    setReportData(null); // Clear previous report
    try {
      const { start, end } = getDateRange();
      
      const analyticsRes = await SalesReportService.generateSalesAnalytics(
        restaurant.id, 
        start, 
        end
      );
 
      if (analyticsRes.success && analyticsRes.data) {
        setReportData(analyticsRes.data);
        toast.success('Report generated successfully!');
      } else {
        throw new Error(analyticsRes.error || 'Failed to generate analytics');
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  // Simplified PDF Export
  const handleGeneratePDF = async () => {
    if (!reportData || !restaurant) {
      toast.error('Please generate a report first.');
      return;
    }
    setIsGenerating(true); // Re-use isGenerating state
 
    try {
      const { start, end } = getDateRange();
      const dateRangeLabel = selectedDateRange === 'custom'
        ? `${customStartDate} to ${customEndDate}`
        : DATE_RANGES.find(dr => dr.value === selectedDateRange)?.label || 'Report';

      let pdfBlob: Blob;
      let reportName: string;

      switch (selectedReportType) {
        case 'sales':
          pdfBlob = await SalesReportService.generatePDFReport(
            reportData,
            { startDate: start, endDate: end, label: dateRangeLabel },
            restaurant.name,
            { 
              simple: true,
              includeOrderDetails: true,
              includeMenuItemSales: true,
              includePaymentMethodAnalysis: true,
              includeGraphs: false,
              includeMenuAnalysis: false,
              includeTableAnalysis: false,
              includeCustomerAnalysis: false,
              includePerformanceMetrics: false,
              includeComparativeAnalysis: false,
              includeExpenseAnalysis: false,
            } as any
          );
          reportName = 'Sales_Report';
          break;
        case 'inventory':
          // This service function will be created in the next step.
          pdfBlob = await InventoryService.generateInventoryReportPDF(
            restaurant.id,
            { start, end },
            restaurant.name
          );
          reportName = 'Inventory_Report';
          break;
        case 'profit-loss':
          // Assuming a similar structure for other reports might be needed in future
          // For now, let's just use the sales service as a placeholder
           pdfBlob = await SalesReportService.generatePDFReport(
            reportData,
            { startDate: start, endDate: end, label: dateRangeLabel },
            restaurant.name,
            { 
              simple: true,
              includeOrderDetails: false,
              includeMenuItemSales: false,
              includePaymentMethodAnalysis: false,
              includeGraphs: false,
              includeMenuAnalysis: false,
              includeTableAnalysis: false,
              includeCustomerAnalysis: false,
              includePerformanceMetrics: false,
              includeComparativeAnalysis: false,
              includeExpenseAnalysis: false,
            } as any
          );
          reportName = 'Profit_Loss_Report';
          break;
        case 'expense':
          pdfBlob = await ExpenseService.generateExpenseReportPDF(
            restaurant.id,
            { start, end },
            restaurant.name
          );
          reportName = 'Expense_Report';
          break;
        default:
          toast.error('This report type does not support PDF export yet.');
          return;
      }
      
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = blobUrl;
      link.download = `${restaurant.name.replace(/[^a-zA-Z0-9]/g, '_')}_${reportName}_${timestamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
 
      toast.success(`${reportName.replace(/_/g, ' ')} exported successfully!`);
      
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Business Reports</h1>
          <p className="text-gray-500 mt-1">
                      Comprehensive analytics and insights for {restaurant.name}
                    </p>
              </div>
              
        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Reports Generated', value: quickStats.totalReports, icon: FileText },
            { label: 'Reports This Month', value: quickStats.reportsThisMonth, icon: Calendar },
            { label: 'Available Report Types', value: REPORT_TYPES.length, icon: BarChart3 },
            { label: 'Last Generated', value: quickStats.lastReportGenerated ? quickStats.lastReportGenerated.toLocaleDateString() : 'N/A', icon: Clock },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Icon className="h-5 sm:h-6 w-5 sm:w-6" />
                </div>
                <div>
                  <p className="text-lg md:text-2xl font-semibold text-gray-800">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
                </div>
            );
          })}
      </div>

        {/* Main Content Area */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-8 space-y-8 lg:space-y-0">
          {/* Left Column: Report Selection */}
          <div className="lg:col-span-1 bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Select Report Type</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {REPORT_TYPES.map((reportType) => {
            const IconComponent = reportType.icon;
            const isSelected = selectedReportType === reportType.id;
            return (
              <div
                key={reportType.id}
                onClick={() => setSelectedReportType(reportType.id)}
                    className={`p-3 sm:p-4 rounded-lg cursor-pointer transition-all duration-200 border-2 flex items-center gap-3 sm:gap-4 ${
                  isSelected 
                        ? 'bg-indigo-50 border-indigo-500 shadow-sm'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-200'
                }`}
                    tabIndex={0}
              >
                    <div className={`p-2 rounded-md ${reportType.color}`}>
                      <IconComponent className="h-5 w-5" />
                  </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">{reportType.name}</h3>
                      <p className="text-xs text-gray-500 hidden sm:block">{reportType.description}</p>
                </div>
              </div>
            );
          })}
            </div>
        </div>

          {/* Right Column: Configuration & Generation */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">2. Configure Report</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              >
                {DATE_RANGES.map((range) => (
                      <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>
            </div>
            {selectedDateRange === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:col-span-2">
                <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
                  </div>
            )}
              </div>
          </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">3. Generate & Export</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
                  className="flex w-full sm:w-auto items-center justify-center gap-3 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <BarChart3 className="h-5 w-5" />
              )}
                  {isGenerating ? 'Generating...' : 'Generate Report'}
            </button>

            {reportData && (
              <button
                onClick={handleGeneratePDF}
                disabled={isGenerating || !reportData}
                    className="flex w-full sm:w-auto items-center justify-center gap-3 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                    {isGenerating ? 'Exporting...' : 'Export as PDF'}
              </button>
            )}
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        {reportData && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6 lg:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {REPORT_TYPES.find(r => r.id === selectedReportType)?.name}
                </h2>
                <p className="text-gray-500">
                  Generated on {(reportData as any).generatedAt?.toLocaleString()} for the period: {(reportData as any).dateRange?.start?.toLocaleDateString()} - {(reportData as any).dateRange?.end?.toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Report Content Preview */}
            <div className="prose prose-lg max-w-none">
              {/* Dynamically generated content will be less structured, this is a placeholder summary */}
              {selectedReportType === 'sales' && (reportData as any).summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 not-prose">
                  <div className="bg-gray-50 rounded-xl p-4 text-center border">
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency((reportData as any).summary.totalRevenue)}
                    </p>
                    </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border">
                    <p className="text-sm text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {(reportData as any).summary.totalOrders}
                    </p>
                    </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border">
                    <p className="text-sm text-gray-600">Avg. Order Value</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency((reportData as any).summary.averageOrderValue)}
                    </p>
                    </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border">
                    <p className="text-sm text-gray-600">Items Sold</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {(reportData as any).summary.totalItems}
                    </p>
                  </div>
                </div>
              )}
              {selectedReportType === 'profit-loss' && (reportData as any).profitability && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 not-prose">
                  <div className="bg-gray-50 rounded-xl p-4 text-center border">
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency((reportData as any).revenue?.totalRevenue)}</p>
                    </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border">
                     <p className="text-sm text-gray-600">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency((reportData as any).costs?.operatingExpenses)}</p>
                  </div>
                   <div className="bg-gray-50 rounded-xl p-4 text-center border">
                    <p className="text-sm text-gray-600">Net Profit</p>
                    <p className={`text-2xl font-bold ${(reportData as any).profitability.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatCurrency((reportData as any).profitability.netProfit)}
                    </p>
                    </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border">
                    <p className="text-sm text-gray-600">Profit Margin</p>
                    <p className={`text-2xl font-bold ${(reportData as any).profitability.netProfitMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {(reportData as any).profitability.netProfitMargin.toFixed(1)}%
                    </p>
                  </div>
                    </div>
              )}
              {/* Fallback for other reports */}
              {!['sales', 'profit-loss'].includes(selectedReportType) && (
                <div className="text-center py-10 border-dashed border-2 rounded-lg">
                   <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Report Generated</h3>
                  <p className="mt-1 text-sm text-gray-500">A detailed preview for this report type is available in the exported PDF.</p>
                  </div>
              )}
                    </div>
                  </div>
        )}

        {!reportData && !isGenerating && (
          <div className="mt-8 text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">Your Report Will Appear Here</h3>
            <p className="mt-1 text-sm text-gray-500">
              Select a report type, choose a date range, and click "Generate Report" to see your data.
            </p>
                </div>
              )}

        {isGenerating && (
          <div className="mt-8 text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <Loader2 className="mx-auto h-12 w-12 text-indigo-600 animate-spin" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Generating Your Report...</h3>
            <p className="mt-1 text-sm text-gray-500">
              Please wait while we gather and analyze your data. This might take a moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 