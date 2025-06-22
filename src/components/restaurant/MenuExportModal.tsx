import { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Filter,
  X,
  Package,
  CheckCircle,
  AlertCircle,
  BarChart3,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MenuItem, Category } from '@/types';
import { MenuExportService } from '@/services/menuExportService';

interface MenuExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  categories: Category[];
  currentCategory: string;
  currentSearchTerm: string;
  showAvailableOnly: boolean;
}

export default function MenuExportModal({
  isOpen,
  onClose,
  menuItems,
  categories,
  currentCategory,
  currentSearchTerm,
  showAvailableOnly,
}: MenuExportModalProps) {
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
  const [exportCategory, setExportCategory] = useState<string>(currentCategory);
  const [exportSearchTerm, setExportSearchTerm] = useState<string>(currentSearchTerm);
  const [exportAvailableOnly, setExportAvailableOnly] = useState<boolean>(showAvailableOnly);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  // Get filtered items for preview
  const getFilteredItems = () => {
    let filtered = menuItems;

    if (exportCategory !== 'all') {
      filtered = filtered.filter(item => item.category === exportCategory);
    }

    if (exportSearchTerm) {
      const searchLower = exportSearchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        (item.ingredients || []).some(ing => ing.toLowerCase().includes(searchLower))
      );
    }

    if (exportAvailableOnly) {
      filtered = filtered.filter(item => item.isAvailable);
    }

    return filtered;
  };

  const filteredItems = getFilteredItems();
  const exportSummary = MenuExportService.getExportSummary(filteredItems);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const filters = {
        category: exportCategory,
        searchTerm: exportSearchTerm,
        availableOnly: exportAvailableOnly,
      };

      MenuExportService.exportFilteredItems(
        menuItems,
        filters,
        exportFormat
      );

      toast.success(`Menu exported successfully as ${exportFormat.toUpperCase()}!`);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export menu. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    try {
      setIsExporting(true);
      
      if (exportFormat === 'excel') {
        MenuExportService.exportToExcel(menuItems);
      } else {
        MenuExportService.exportToCSV(menuItems);
      }

      toast.success(`Complete menu exported as ${exportFormat.toUpperCase()}!`);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export menu. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Export Menu</h2>
              <p className="text-sm text-gray-600">Download your menu items in CSV or Excel format</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Export Format Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setExportFormat('csv')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  exportFormat === 'csv'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">CSV Format</div>
                    <div className="text-sm text-gray-600">Compatible with spreadsheet apps</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setExportFormat('excel')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  exportFormat === 'excel'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="w-6 h-6 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Excel Format</div>
                    <div className="text-sm text-gray-600">Optimized for Microsoft Excel</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Filter Options */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Filter className="w-5 h-5 text-gray-600" />
              <label className="text-sm font-medium text-gray-700">
                Export Filters
              </label>
            </div>
            
            <div className="space-y-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={exportCategory}
                  onChange={(e) => setExportCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Term
                </label>
                <input
                  type="text"
                  value={exportSearchTerm}
                  onChange={(e) => setExportSearchTerm(e.target.value)}
                  placeholder="Filter by name, description, or ingredients..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Availability Filter */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="availableOnly"
                  checked={exportAvailableOnly}
                  onChange={(e) => setExportAvailableOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="availableOnly" className="ml-2 block text-sm text-gray-700">
                  Export only available items
                </label>
              </div>
            </div>
          </div>

          {/* Export Preview */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Export Preview</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">
                  {exportSummary.totalItems} items will be exported
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">
                  {exportSummary.availableItems} available items
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600">
                  {exportSummary.categoriesCount} categories
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-gray-600">
                  18 data fields per item
                </span>
              </div>
            </div>

            {exportSummary.totalItems === 0 && (
              <div className="mt-3 flex items-center space-x-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">No items match the current filters</span>
              </div>
            )}
          </div>

          {/* Export Fields Info */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exported Fields
            </label>
            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span>• ID & Name</span>
                <span>• Description</span>
                <span>• Category & Price</span>
                <span>• Availability Status</span>
                <span>• Preparation Time</span>
                <span>• Spice Level</span>
                <span>• Dietary Info (Veg/Vegan/Gluten-free)</span>
                <span>• Ingredients & Allergens</span>
                <span>• Tags & Variants</span>
                <span>• Image URL</span>
                <span>• Created & Updated Dates</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-3">
            <button
              onClick={handleExportAll}
              disabled={isExporting || menuItems.length === 0}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Export All ({menuItems.length} items)
            </button>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || filteredItems.length === 0}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export Filtered ({filteredItems.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 