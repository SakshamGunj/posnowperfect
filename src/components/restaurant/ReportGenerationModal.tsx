import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  X,
  Download,
  Calendar,
  FileText,
  BarChart3,
  TrendingUp,
  Clock,
  Loader2,
  CheckCircle
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { SalesReportService, DateRange, ReportConfiguration } from '@/services/salesReportService';
import { MenuService } from '@/services/menuService';
import { TableService } from '@/services/tableService';
import { CustomerService } from '@/services/customerService';
import { formatDate } from '@/lib/utils';

interface ReportGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReportForm {
  timePeriod: 'yesterday' | '1week' | '15days' | '1month' | '3months' | '6months' | '1year' | 'custom';
  startDate?: string;
  endDate?: string;
  includeMenuAnalysis: boolean;
  includeTableAnalysis: boolean;
  includeCustomerAnalysis: boolean;
  includePaymentAnalysis: boolean;
  includeCreditAnalysis: boolean;
  includeTimeAnalysis: boolean;
  includePeakHours: boolean;
  includeStaffPerformance: boolean;
  reportTitle: string;
  additionalNotes: string;
}

const TIME_PERIOD_OPTIONS = [
  { value: 'yesterday', label: 'Yesterday', description: 'Previous day analysis' },
  { value: '1week', label: '1 Week', description: 'Last 7 days analysis' },
  { value: '15days', label: '15 Days', description: 'Last 15 days analysis' },
  { value: '1month', label: '1 Month', description: 'Last 30 days analysis' },
  { value: '3months', label: '3 Months', description: 'Last 90 days analysis' },
  { value: '6months', label: '6 Months', description: 'Last 180 days analysis' },
  { value: '1year', label: '1 Year', description: 'Last 365 days analysis' },
  { value: 'custom', label: 'Custom Range', description: 'Select specific date range' },
];

export default function ReportGenerationModal({ isOpen, onClose }: ReportGenerationModalProps) {
  const { restaurant } = useRestaurant();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');

  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<ReportForm>({
    defaultValues: {
      timePeriod: '1week',
      includeMenuAnalysis: true,
      includeTableAnalysis: true,
      includeCustomerAnalysis: true,
      includePaymentAnalysis: true,
      includeCreditAnalysis: true,
      includeTimeAnalysis: true,
      includePeakHours: true,
      includeStaffPerformance: true,
      reportTitle: `${restaurant?.name || 'Restaurant'} Sales Report`,
      additionalNotes: ''
    }
  });

  const selectedTimePeriod = watch('timePeriod');

  // Calculate date range based on time period
  const getDateRange = (timePeriod: string, customStart?: string, customEnd?: string): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (timePeriod) {
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: new Date(yesterday.setHours(0, 0, 0, 0)),
          endDate: new Date(yesterday.setHours(23, 59, 59, 999)),
          label: 'Yesterday'
        };
      }
      case '1week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return {
          startDate: new Date(weekAgo.setHours(0, 0, 0, 0)),
          endDate: new Date(today.setHours(23, 59, 59, 999)),
          label: 'Last 7 Days'
        };
      }
      case '15days': {
        const fifteenDaysAgo = new Date(today);
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        return {
          startDate: new Date(fifteenDaysAgo.setHours(0, 0, 0, 0)),
          endDate: new Date(today.setHours(23, 59, 59, 999)),
          label: 'Last 15 Days'
        };
      }
      case '1month': {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return {
          startDate: new Date(monthAgo.setHours(0, 0, 0, 0)),
          endDate: new Date(today.setHours(23, 59, 59, 999)),
          label: 'Last 30 Days'
        };
      }
      case '3months': {
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return {
          startDate: new Date(threeMonthsAgo.setHours(0, 0, 0, 0)),
          endDate: new Date(today.setHours(23, 59, 59, 999)),
          label: 'Last 3 Months'
        };
      }
      case '6months': {
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return {
          startDate: new Date(sixMonthsAgo.setHours(0, 0, 0, 0)),
          endDate: new Date(today.setHours(23, 59, 59, 999)),
          label: 'Last 6 Months'
        };
      }
      case '1year': {
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        return {
          startDate: new Date(yearAgo.setHours(0, 0, 0, 0)),
          endDate: new Date(today.setHours(23, 59, 59, 999)),
          label: 'Last 1 Year'
        };
      }
      case 'custom': {
        if (!customStart || !customEnd) {
          throw new Error('Custom date range requires start and end dates');
        }
        const startDate = new Date(customStart);
        const endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
        return {
          startDate: new Date(startDate.setHours(0, 0, 0, 0)),
          endDate,
          label: `${formatDate(startDate)} - ${formatDate(endDate)}`
        };
      }
      default:
        return {
          startDate: new Date(today.setHours(0, 0, 0, 0)),
          endDate: new Date(today.setHours(23, 59, 59, 999)),
          label: 'Today'
        };
    }
  };

  const generateComprehensiveReport = async (data: ReportForm) => {
    if (!restaurant) return;

    setIsGenerating(true);
    setGenerationStep('Initializing report generation...');

    try {
      // Get date range
      let dateRange: DateRange;
      try {
        dateRange = getDateRange(data.timePeriod, data.startDate, data.endDate);
      } catch (error) {
        toast.error('Invalid date range selected');
        return;
      }

      setGenerationStep('Loading menu items...');
      // Load required data in parallel
      const [menuResult, tablesResult, customersResult] = await Promise.all([
        MenuService.getMenuItemsForRestaurant(restaurant.id),
        TableService.getTablesForRestaurant(restaurant.id),
        CustomerService.getCustomersForRestaurant(restaurant.id)
      ]);

      const menuItems = menuResult.success ? menuResult.data || [] : [];
      const tables = tablesResult.success ? tablesResult.data || [] : [];
      const customers = customersResult.success ? customersResult.data || [] : [];

      setGenerationStep('Analyzing sales data...');
      // Generate comprehensive analytics
      const analyticsResult = await SalesReportService.generateSalesAnalytics(
        restaurant.id,
        dateRange.startDate,
        dateRange.endDate,
        menuItems,
        tables,
        customers
      );

      if (!analyticsResult.success || !analyticsResult.data) {
        toast.error(analyticsResult.error || 'Failed to generate analytics');
        return;
      }

      const analytics = analyticsResult.data;

      setGenerationStep('Generating comprehensive PDF report...');
      // Configure report options
      const reportConfig: ReportConfiguration = {
        includeGraphs: true,
        includeMenuAnalysis: data.includeMenuAnalysis,
        includeTableAnalysis: data.includeTableAnalysis,
        includeCustomerAnalysis: data.includeCustomerAnalysis,
        includeStaffAnalysis: data.includeStaffPerformance,
        includeTimeAnalysis: data.includeTimeAnalysis,
        includeTaxBreakdown: true,
        includeDiscountAnalysis: true,
        includeCreditAnalysis: data.includeCreditAnalysis,
        reportTitle: data.reportTitle,
        additionalNotes: data.additionalNotes
      };

      // Generate PDF report
      const pdfBlob = await SalesReportService.generatePDFReport(
        analytics,
        dateRange,
        restaurant.name,
        reportConfig
      );

      setGenerationStep('Downloading report...');
      // Download the PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${restaurant.name}_Comprehensive_Report_${dateRange.label.replace(/\s+/g, '_')}_${formatDate(new Date())}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Comprehensive report generated successfully!');
      onClose();
      reset();
    } catch (error) {
      console.error('Error generating comprehensive report:', error);
      toast.error('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <FileText className="w-7 h-7 text-blue-600 mr-3" />
                Generate Comprehensive Report
              </h2>
              <p className="text-gray-600 mt-1">
                Create detailed analytics report with customizable insights
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(generateComprehensiveReport)} className="p-6 space-y-8">
          {/* Time Period Selection */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Time Period</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {TIME_PERIOD_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-300 ${
                    selectedTimePeriod === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    value={option.value}
                    {...register('timePeriod', { required: 'Please select a time period' })}
                    className="sr-only"
                  />
                  <span className="font-medium text-gray-900">{option.label}</span>
                  <span className="text-sm text-gray-600 mt-1">{option.description}</span>
                  {selectedTimePeriod === option.value && (
                    <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-blue-600" />
                  )}
                </label>
              ))}
            </div>
            {errors.timePeriod && (
              <p className="text-red-600 text-sm">{errors.timePeriod.message}</p>
            )}
          </div>

          {/* Custom Date Range */}
          {selectedTimePeriod === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  {...register('startDate', {
                    required: selectedTimePeriod === 'custom' ? 'Start date is required' : false
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.startDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.startDate.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  {...register('endDate', {
                    required: selectedTimePeriod === 'custom' ? 'End date is required' : false
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.endDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.endDate.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Report Configuration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Report Sections</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Analysis Options */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-800 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
                  Business Analytics
                </h4>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('includeMenuAnalysis')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Menu Item Performance</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('includeTableAnalysis')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Table Revenue Analysis</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('includeCustomerAnalysis')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Customer Insights</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('includePaymentAnalysis')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Payment Method Breakdown</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('includeCreditAnalysis')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Credit Analysis & Tracking</span>
                </label>
              </div>
              
              {/* Operational Options */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-800 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-purple-600" />
                  Operational Insights
                </h4>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('includeTimeAnalysis')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Time-based Analysis</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('includePeakHours')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Peak Hours Analysis</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('includeStaffPerformance')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Staff Performance</span>
                </label>
              </div>
            </div>
          </div>

          {/* Report Customization */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Report Customization</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Title
                </label>
                <input
                  type="text"
                  {...register('reportTitle', { required: 'Report title is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter custom report title"
                />
                {errors.reportTitle && (
                  <p className="text-red-600 text-sm mt-1">{errors.reportTitle.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  {...register('additionalNotes')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any additional notes or context for this report..."
                />
              </div>
            </div>
          </div>

          {/* Generation Status */}
          {isGenerating && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <div>
                  <p className="font-medium text-blue-900">Generating Report...</p>
                  <p className="text-sm text-blue-700">{generationStep}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="btn btn-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="btn btn-primary disabled:opacity-50 flex items-center"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 