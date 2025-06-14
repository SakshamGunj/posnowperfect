import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { MenuService } from '@/services/menuService';
import { MenuItem, MenuItemVariant, MenuItemVariantOption } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface BulkMenuImportProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurantId: string;
  categories: { id: string; name: string }[];
}

interface ImportRow {
  name: string;
  description?: string;
  category: string;
  price: number;
  image?: string;
  isAvailable?: boolean;
  preparationTime?: number;
  allergens?: string;
  spiceLevel?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  tags?: string;
  // Variant columns
  variantName1?: string;
  variantOptions1?: string;
  variantName2?: string;
  variantOptions2?: string;
  variantName3?: string;
  variantOptions3?: string;
}

interface ImportResult {
  success: boolean;
  data?: MenuItem[];
  errors?: string[];
  warnings?: string[];
}

const SAMPLE_DATA = [
  {
    name: 'Margherita Pizza',
    description: 'Classic pizza with fresh mozzarella, tomatoes, and basil',
    category: 'Main Course',
    price: 299,
    image: '',
    isAvailable: true,
    preparationTime: 20,
    allergens: 'Gluten, Dairy',
    spiceLevel: 'none',
    isVegetarian: true,
    isVegan: false,
    isGlutenFree: false,
    tags: 'Pizza, Italian, Popular',
    variantName1: 'Size',
    variantOptions1: 'Small:249:standalone,Medium:299:standalone,Large:349:standalone',
    variantName2: 'Crust',
    variantOptions2: 'Thin:0:additive,Thick:25:additive,Stuffed:50:additive',
    variantName3: '',
    variantOptions3: ''
  },
  {
    name: 'Chicken Biryani',
    description: 'Aromatic basmati rice with tender chicken and spices',
    category: 'Main Course',
    price: 249,
    image: '',
    isAvailable: true,
    preparationTime: 30,
    allergens: '',
    spiceLevel: 'medium',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: true,
    tags: 'Biryani, Chicken, Spicy',
    variantName1: 'Portion',
    variantOptions1: 'Half:199:standalone,Full:249:standalone,Jumbo:299:standalone',
    variantName2: '',
    variantOptions2: '',
    variantName3: '',
    variantOptions3: ''
  },
  {
    name: 'Caesar Salad',
    description: 'Fresh romaine lettuce with Caesar dressing and croutons',
    category: 'Appetizers',
    price: 149,
    image: '',
    isAvailable: true,
    preparationTime: 10,
    allergens: 'Dairy',
    spiceLevel: 'none',
    isVegetarian: true,
    isVegan: false,
    isGlutenFree: false,
    tags: 'Salad, Healthy, Light',
    variantName1: '',
    variantOptions1: '',
    variantName2: '',
    variantOptions2: '',
    variantName3: '',
    variantOptions3: ''
  }
];

export default function BulkMenuImport({ isOpen, onClose, onSuccess, restaurantId, categories }: BulkMenuImportProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(fileType || '')) {
        toast.error('Please select a CSV or Excel file');
        return;
      }
      processFile(selectedFile);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const fileType = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(fileType || '')) {
        toast.error('Please drop a CSV or Excel file');
        return;
      }
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const fileType = file.name.split('.').pop()?.toLowerCase();
      let data: ImportRow[] = [];

      if (fileType === 'csv') {
        data = await processCSV(file);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        data = await processExcel(file);
      }

      setPreviewData(data);
      setStep('preview');
    } catch (error) {
      toast.error('Failed to process file. Please check the format.');
      console.error('File processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCSV = async (file: File): Promise<ImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csv = e.target?.result as string;
          const lines = csv.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          
          const data: ImportRow[] = [];
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const values = parseCSVLine(lines[i]);
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              data.push(row);
            }
          }
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const processExcel = async (file: File): Promise<ImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          const headers = jsonData[0] as string[];
          const rows: ImportRow[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const rowData = jsonData[i] as any[];
            if (rowData && rowData.some(cell => cell !== undefined && cell !== '')) {
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = rowData[index] || '';
              });
              rows.push(row);
            }
          }
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const validateData = (data: ImportRow[]): { valid: ImportRow[]; errors: string[] } => {
    const valid: ImportRow[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because of header and 0-based index
      
      // Required fields validation
      if (!row.name?.trim()) {
        errors.push(`Row ${rowNumber}: Name is required`);
        return;
      }
      
      if (!row.category?.trim()) {
        errors.push(`Row ${rowNumber}: Category is required`);
        return;
      }
      
      if (!row.price || isNaN(Number(row.price)) || Number(row.price) <= 0) {
        errors.push(`Row ${rowNumber}: Valid price is required`);
        return;
      }

      // Category validation
      const categoryExists = categories.some(cat => 
        cat.name.toLowerCase() === row.category.toLowerCase()
      );
      if (!categoryExists) {
        errors.push(`Row ${rowNumber}: Category "${row.category}" does not exist`);
        return;
      }

      valid.push(row);
    });

    return { valid, errors };
  };

  const convertToMenuItems = (data: ImportRow[]): MenuItem[] => {
    return data.map(row => {
      const variants: MenuItemVariant[] = [];
      
      // Process variants (up to 3 variants per item)
      for (let i = 1; i <= 3; i++) {
        const variantNameKey = `variantName${i}` as keyof ImportRow;
        const variantOptionsKey = `variantOptions${i}` as keyof ImportRow;
        
        const variantName = row[variantNameKey]?.toString().trim();
        const variantOptions = row[variantOptionsKey]?.toString().trim();
        
        if (variantName && variantOptions) {
          const options: MenuItemVariantOption[] = variantOptions
            .split(',')
            .map(option => {
              const parts = option.split(':');
              const name = parts[0]?.trim();
              const priceStr = parts[1]?.trim();
              const pricingTypeStr = parts[2]?.trim()?.toLowerCase();
              
              // Default to additive for backward compatibility
              let pricingType: 'additive' | 'standalone' = 'additive';
              if (pricingTypeStr === 'standalone' || pricingTypeStr === 's') {
                pricingType = 'standalone';
              } else if (pricingTypeStr === 'additive' || pricingTypeStr === 'a') {
                pricingType = 'additive';
              }
              
              return {
                id: `${variantName}-${name}`.toLowerCase().replace(/\s+/g, '-'),
                name: name,
                priceModifier: Number(priceStr) || 0,
                pricingType: pricingType
              };
            })
            .filter(option => option.name);

          if (options.length > 0) {
            variants.push({
              id: variantName.toLowerCase().replace(/\s+/g, '-'),
              name: variantName,
              type: 'single',
              required: true,
              options
            });
          }
        }
      }

      const categoryData = categories.find(cat => 
        cat.name.toLowerCase() === row.category.toLowerCase()
      );

      return {
        id: '', // Will be generated by Firebase
        restaurantId,
        name: row.name,
        description: row.description || '',
        category: row.category,
        categoryId: categoryData?.id || '',
        categoryName: categoryData?.name || row.category,
        price: Number(row.price),
        image: row.image || '',
        isAvailable: row.isAvailable !== false && String(row.isAvailable) !== 'false',
        preparationTime: Number(row.preparationTime) || 0,
        allergens: row.allergens ? row.allergens.split(',').map(a => a.trim()) : [],
        spiceLevel: (row.spiceLevel as any) || 'none',
        isVegetarian: row.isVegetarian === true || String(row.isVegetarian) === 'true',
        isVegan: row.isVegan === true || String(row.isVegan) === 'true',
        isGlutenFree: row.isGlutenFree === true || String(row.isGlutenFree) === 'true',
        tags: row.tags ? row.tags.split(',').map(t => t.trim()) : [],
        variants: variants.length > 0 ? variants : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
  };

  const handleImport = async () => {
    setIsProcessing(true);
    
    try {
      const { valid, errors } = validateData(previewData);
      
      if (errors.length > 0) {
        setImportResult({ success: false, errors });
        setStep('result');
        return;
      }

      const menuItems = convertToMenuItems(valid);
      const results: MenuItem[] = [];
      const importErrors = [];

      for (const item of menuItems) {
        try {
          const result = await MenuService.createMenuItem(item);
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            importErrors.push(`Failed to create "${item.name}": ${result.error}`);
          }
        } catch (error) {
          importErrors.push(`Failed to create "${item.name}": ${error}`);
        }
      }

      setImportResult({
        success: importErrors.length === 0,
        data: results,
        errors: importErrors,
        warnings: []
      });
      
      setStep('result');
      
      if (importErrors.length === 0) {
        toast.success(`Successfully imported ${results.length} menu items!`);
        onSuccess();
      } else if (results.length > 0) {
        toast.success(`Imported ${results.length} items with ${importErrors.length} errors`);
      } else {
        toast.error('Import failed. Please check the errors.');
      }
    } catch (error) {
      setImportResult({
        success: false,
        errors: ['Import failed due to an unexpected error']
      });
      setStep('result');
      toast.error('Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSample = (format: 'csv' | 'excel') => {
    if (format === 'csv') {
      downloadSampleCSV();
    } else {
      downloadSampleExcel();
    }
  };

  const downloadSampleCSV = () => {
    const headers = [
      'name', 'description', 'category', 'price', 'image', 'isAvailable',
      'preparationTime', 'allergens', 'spiceLevel', 'isVegetarian', 'isVegan',
      'isGlutenFree', 'tags', 'variantName1', 'variantOptions1', 'variantName2',
      'variantOptions2', 'variantName3', 'variantOptions3'
    ];

    const csvContent = [
      headers.join(','),
      ...SAMPLE_DATA.map(row => 
        headers.map(header => {
          const value = (row as any)[header] || '';
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu_import_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleExcel = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_DATA);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Menu Items');
    XLSX.writeFile(wb, 'menu_import_sample.xlsx');
  };

  const resetImport = () => {
    setPreviewData([]);
    setImportResult(null);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        
        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Bulk Menu Import
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Import multiple menu items from CSV or Excel files
            </p>
          </div>

          <div className="p-6">
            {step === 'upload' && (
              <div className="space-y-6">
                {/* Sample Download Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">
                    📥 Download Sample File
                  </h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Download a sample file to see the required format and columns
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => downloadSample('csv')}
                      className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Sample CSV
                    </button>
                    <button
                      onClick={() => downloadSample('excel')}
                      className="btn btn-sm bg-green-600 text-white hover:bg-green-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Sample Excel
                    </button>
                  </div>
                </div>

                {/* File Upload Section */}
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragOver 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${
                    isDragOver ? 'text-blue-500' : 'text-gray-400'
                  }`} />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Upload Your Menu File
                  </h4>
                  <p className="text-gray-600 mb-4">
                    {isDragOver 
                      ? 'Drop your CSV or Excel file here' 
                      : 'Drag and drop a CSV or Excel file here, or click to select'
                    }
                  </p>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="btn btn-theme-primary"
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Choose File
                      </>
                    )}
                  </button>
                </div>

                {/* Format Guidelines */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    📋 File Format Guidelines
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                    <div>
                      <h5 className="font-medium mb-2">Required Columns:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>name</strong> - Item name</li>
                        <li>• <strong>category</strong> - Menu category</li>
                        <li>• <strong>price</strong> - Base price (number)</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-2">Optional Columns:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>description</strong> - Item description</li>
                        <li>• <strong>image</strong> - Image URL</li>
                        <li>• <strong>isAvailable</strong> - true/false</li>
                        <li>• <strong>preparationTime</strong> - Minutes</li>
                        <li>• <strong>allergens</strong> - Comma separated</li>
                        <li>• <strong>spiceLevel</strong> - none/mild/medium/hot/very_hot</li>
                        <li>• <strong>isVegetarian/isVegan/isGlutenFree</strong> - true/false</li>
                        <li>• <strong>tags</strong> - Comma separated</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <h5 className="font-medium mb-2">Variant Columns (Optional):</h5>
                    <p className="text-sm text-gray-600 mb-2">
                      Add up to 3 variants per item using these column pairs:
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>variantName1, variantOptions1</strong> - e.g., "Size", "Small:249:standalone,Medium:299:standalone,Large:349:standalone"</li>
                      <li>• <strong>variantName2, variantOptions2</strong> - e.g., "Crust", "Thin:0:additive,Thick:25:additive"</li>
                      <li>• <strong>variantName3, variantOptions3</strong> - Additional variant if needed</li>
                    </ul>
                    <p className="text-xs text-gray-500 mt-2">
                      Format: "OptionName:Price:PricingType" where PricingType is "additive" (adds to base price) or "standalone" (replaces base price). You can use "s" for standalone and "a" for additive as shortcuts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-gray-900">
                    Preview Import Data
                  </h4>
                  <div className="text-sm text-gray-600">
                    {previewData.length} items found
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Category</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Price</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Available</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-900">Variants</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewData.slice(0, 100).map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2 font-medium">{row.name}</td>
                          <td className="px-4 py-2">{row.category}</td>
                          <td className="px-4 py-2">{formatCurrency(Number(row.price) || 0)}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                              row.isAvailable !== false && String(row.isAvailable) !== 'false'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {row.isAvailable !== false && String(row.isAvailable) !== 'false' ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {[1, 2, 3].map(i => {
                              const variantName = (row as any)[`variantName${i}`];
                              return variantName ? (
                                <div key={i} className="text-xs text-gray-600">
                                  {variantName}
                                </div>
                              ) : null;
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewData.length > 100 && (
                  <p className="text-sm text-gray-600 text-center">
                    Showing first 100 items. Total: {previewData.length} items
                  </p>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={resetImport}
                    className="btn btn-secondary"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isProcessing || previewData.length === 0}
                    className="btn btn-theme-primary"
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Import {previewData.length} Items
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 'result' && importResult && (
              <div className="space-y-6">
                <div className="text-center">
                  {importResult.success ? (
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  ) : (
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  )}
                  
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    {importResult.success ? 'Import Successful!' : 'Import Completed with Issues'}
                  </h4>
                  
                  {importResult.data && (
                    <p className="text-gray-600">
                      Successfully imported {importResult.data.length} menu items
                    </p>
                  )}
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h5 className="font-medium text-red-900 mb-2">Errors:</h5>
                    <ul className="text-sm text-red-700 space-y-1">
                      {importResult.errors.slice(0, 10).map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                    {importResult.errors.length > 10 && (
                      <p className="text-sm text-red-600 mt-2">
                        ...and {importResult.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                )}

                {importResult.warnings && importResult.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h5 className="font-medium text-yellow-900 mb-2">Warnings:</h5>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {importResult.warnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={resetImport}
                    className="btn btn-secondary"
                  >
                    Import More
                  </button>
                  <button
                    onClick={onClose}
                    className="btn btn-theme-primary"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
 