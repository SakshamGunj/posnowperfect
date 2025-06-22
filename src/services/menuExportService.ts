import Papa from 'papaparse';
import { MenuItem, MenuItemVariant } from '@/types';

export interface MenuItemExport {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  isAvailable: string;
  preparationTime: number;
  spiceLevel: string;
  isVegetarian: string;
  isVegan: string;
  isGlutenFree: string;
  ingredients: string;
  allergens: string;
  tags: string;
  variants: string;
  image: string;
  createdAt: string;
  updatedAt: string;
}

export class MenuExportService {
  // Convert menu items to export format
  static prepareMenuItemsForExport(menuItems: MenuItem[]): MenuItemExport[] {
    return menuItems.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      category: item.category,
      price: item.price,
      isAvailable: item.isAvailable ? 'Yes' : 'No',
      preparationTime: item.preparationTime || 0,
      spiceLevel: item.spiceLevel || 'none',
      isVegetarian: item.isVegetarian ? 'Yes' : 'No',
      isVegan: item.isVegan ? 'Yes' : 'No',
      isGlutenFree: item.isGlutenFree ? 'Yes' : 'No',
      ingredients: (item.ingredients || []).join(', '),
      allergens: (item.allergens || []).join(', '),
      tags: (item.tags || []).join(', '),
      variants: this.formatVariants(item.variants || []),
      image: item.image || '',
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  // Format variants for export
  private static formatVariants(variants: MenuItemVariant[]): string {
    if (!variants || variants.length === 0) return '';
    
    return variants.map(variant => {
      const optionsText = variant.options.map(option => 
        `${option.name}: ₹${option.priceModifier} (${option.pricingType || 'additive'})`
      ).join(', ');
      
      return `${variant.name} [${variant.type}${variant.required ? ', required' : ''}]: ${optionsText}`;
    }).join(' | ');
  }

  // Export to CSV
  static exportToCSV(menuItems: MenuItem[], filename?: string): void {
    try {
      const exportData = this.prepareMenuItemsForExport(menuItems);
      
      const csv = Papa.unparse(exportData, {
        header: true,
        columns: [
          'id',
          'name', 
          'description',
          'category',
          'price',
          'isAvailable',
          'preparationTime',
          'spiceLevel',
          'isVegetarian',
          'isVegan',
          'isGlutenFree',
          'ingredients',
          'allergens',
          'tags',
          'variants',
          'image',
          'createdAt',
          'updatedAt'
        ]
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename || `menu-export-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw new Error('Failed to export menu to CSV');
    }
  }

  // Export to Excel (CSV format that Excel can open)
  static exportToExcel(menuItems: MenuItem[], filename?: string): void {
    try {
      const exportData = this.prepareMenuItemsForExport(menuItems);
      
      // Create CSV with UTF-8 BOM for better Excel compatibility
      const csv = Papa.unparse(exportData, {
        header: true,
        columns: [
          'id',
          'name', 
          'description',
          'category',
          'price',
          'isAvailable',
          'preparationTime',
          'spiceLevel',
          'isVegetarian',
          'isVegan',
          'isGlutenFree',
          'ingredients',
          'allergens',
          'tags',
          'variants',
          'image',
          'createdAt',
          'updatedAt'
        ]
      });

      // Add UTF-8 BOM for Excel compatibility
      const csvWithBOM = '\uFEFF' + csv;
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename || `menu-export-${new Date().toISOString().split('T')[0]}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw new Error('Failed to export menu to Excel');
    }
  }

  // Export filtered items (for category or search-based exports)
  static exportFilteredItems(
    menuItems: MenuItem[], 
    filters: {
      category?: string;
      searchTerm?: string;
      availableOnly?: boolean;
    }, 
    format: 'csv' | 'excel' = 'csv',
    filename?: string
  ): void {
    let filteredItems = menuItems;

    // Apply category filter
    if (filters.category && filters.category !== 'all') {
      filteredItems = filteredItems.filter(item => item.category === filters.category);
    }

    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filteredItems = filteredItems.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        (item.ingredients || []).some(ing => ing.toLowerCase().includes(searchLower))
      );
    }

    // Apply availability filter
    if (filters.availableOnly) {
      filteredItems = filteredItems.filter(item => item.isAvailable);
    }

    // Generate filename with filter info
    let exportFilename = filename;
    if (!exportFilename) {
      const timestamp = new Date().toISOString().split('T')[0];
      const filterSuffix = [];
      
      if (filters.category && filters.category !== 'all') {
        filterSuffix.push(filters.category.toLowerCase().replace(/\s+/g, '-'));
      }
      if (filters.searchTerm) {
        filterSuffix.push('search');
      }
      if (filters.availableOnly) {
        filterSuffix.push('available');
      }
      
      const suffix = filterSuffix.length > 0 ? `-${filterSuffix.join('-')}` : '';
      exportFilename = `menu-export${suffix}-${timestamp}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    }

    if (format === 'excel') {
      this.exportToExcel(filteredItems, exportFilename);
    } else {
      this.exportToCSV(filteredItems, exportFilename);
    }
  }

  // Get export summary
  static getExportSummary(menuItems: MenuItem[]): {
    totalItems: number;
    availableItems: number;
    categoriesCount: number;
    categories: string[];
  } {
    const categories = [...new Set(menuItems.map(item => item.category))];
    
    return {
      totalItems: menuItems.length,
      availableItems: menuItems.filter(item => item.isAvailable).length,
      categoriesCount: categories.length,
      categories
    };
  }

  // Validate menu data for import (future feature)
  static validateMenuImportData(csvData: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parsed = Papa.parse(csvData, { header: true });
      
      if (parsed.errors.length > 0) {
        errors.push(...parsed.errors.map(err => err.message));
      }

      const requiredColumns = ['name', 'category', 'price'];
      const headers = parsed.meta.fields || [];
      
      for (const required of requiredColumns) {
        if (!headers.includes(required)) {
          errors.push(`Missing required column: ${required}`);
        }
      }

      const data = parsed.data as any[];
      
      data.forEach((row, index) => {
        if (!row.name || row.name.trim() === '') {
          errors.push(`Row ${index + 1}: Name is required`);
        }
        
        if (!row.category || row.category.trim() === '') {
          errors.push(`Row ${index + 1}: Category is required`);
        }
        
        if (!row.price || isNaN(parseFloat(row.price))) {
          errors.push(`Row ${index + 1}: Valid price is required`);
        }
        
        if (row.price && parseFloat(row.price) < 0) {
          warnings.push(`Row ${index + 1}: Price should not be negative`);
        }
      });

    } catch (error) {
      errors.push('Invalid CSV format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
} 