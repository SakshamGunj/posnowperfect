import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Settings as SettingsIcon,
  Building2,
  MapPin,
  Users,
  Plus,
  Edit3,
  Trash2,
  Save,
  ArrowLeft,
  FileText,
  Phone,
  Mail,
  Globe,
  Hash,
  Building,
  QrCode,
  CreditCard,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { TableAreaService } from '@/services/tableAreaService';
import { TableService } from '@/services/tableService';
import { RestaurantService } from '@/services/restaurantService';
import { TableArea, Table } from '@/types';

interface BusinessInfoForm {
  address?: string;
  phone?: string;
  email?: string;
  taxRate: number;
  gstin?: string;
  fssaiNumber?: string;
  businessAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  website?: string;
  upiId?: string;
  enableQRCode: boolean;
}

interface TableAreaForm {
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

interface TableForm {
  number: string;
  areaId: string;
  capacity: number;
  description?: string;
  isActive: boolean;
}

export default function Settings() {
  const { restaurant, updateRestaurant } = useRestaurant();
  
  const [activeTab, setActiveTab] = useState<'business' | 'tables'>('business');
  const [tableAreas, setTableAreas] = useState<TableArea[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Area management states
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [editingArea, setEditingArea] = useState<TableArea | null>(null);

  // Table management states
  const [showTableForm, setShowTableForm] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>('all');

  const { register: registerBusiness, handleSubmit: handleBusinessSubmit, reset: resetBusiness, formState: { errors: businessErrors } } = useForm<BusinessInfoForm>();
  const { register: registerArea, handleSubmit: handleAreaSubmit, reset: resetArea, setValue: setAreaValue } = useForm<TableAreaForm>();
  const { register: registerTable, handleSubmit: handleTableSubmit, reset: resetTable, setValue: setTableValue } = useForm<TableForm>();

  useEffect(() => {
    if (restaurant) {
      loadData();
      resetBusinessForm();
    }
  }, [restaurant]);

  const loadData = async () => {
    if (!restaurant) return;

    try {
      setIsLoading(true);
      console.log('🔍 Loading settings data for restaurant:', restaurant.id);

      const [areasResult, tablesResult] = await Promise.all([
        TableAreaService.getTableAreasForRestaurant(restaurant.id),
        TableService.getTablesForRestaurant(restaurant.id),
      ]);

      console.log('📊 Areas result:', areasResult);
      console.log('📊 Tables result:', tablesResult);

      if (tablesResult.success && tablesResult.data) {
        setTables(tablesResult.data);
        console.log('✅ Set tables:', tablesResult.data.length);
      }

      if (areasResult.success && areasResult.data && areasResult.data.length > 0) {
        setTableAreas(areasResult.data);
        console.log('✅ Set table areas:', areasResult.data.length);
      } else {
        console.log('❌ No formal table areas found, extracting from existing tables...');
        // Extract areas from existing tables and create virtual TableArea objects for display
        if (tablesResult.success && tablesResult.data && tablesResult.data.length > 0) {
          const uniqueAreaNames = [...new Set(tablesResult.data.map(table => table.area).filter(Boolean))];
          console.log('🔧 Found area names from tables:', uniqueAreaNames);
          
          const virtualAreas: TableArea[] = uniqueAreaNames.map((name, index) => ({
            id: `virtual-${name.toLowerCase().replace(/\s+/g, '-')}`,
            restaurantId: restaurant.id,
            name: name,
            description: `${name} seating area`,
            isActive: true,
            sortOrder: index + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
          
          setTableAreas(virtualAreas);
          console.log('✅ Created virtual table areas from existing tables:', virtualAreas.length);
        } else {
          setTableAreas([]);
          console.log('🎯 No tables found either');
        }
      }
    } catch (error) {
      console.error('❌ Error loading settings data:', error);
      toast.error('Failed to load settings data');
    } finally {
      setIsLoading(false);
    }
  };

  const createTableAreasFromExistingTables = async (tables: Table[]) => {
    if (!restaurant) return;

    try {
      console.log('🔧 [Settings] Starting migration: Creating table areas from existing tables...', tables.length);
      
      // Get unique area names from tables (ignore areaId since TableArea entities don't exist yet)
      const uniqueAreaNames = [...new Set(tables.map(table => table.area).filter(Boolean))];
      console.log('🔧 [Settings] Unique area names found:', uniqueAreaNames);

      const uniqueAreas = uniqueAreaNames.map(name => ({ name }));
      console.log('🔧 [Settings] Unique areas to create:', uniqueAreas);

      const createdAreas: TableArea[] = [];

      for (let i = 0; i < uniqueAreas.length; i++) {
        const area = uniqueAreas[i];
        console.log('🔧 [Settings] Creating area:', area.name);
        
        const result = await TableAreaService.createTableArea(restaurant.id, {
          name: area.name,
          description: `${area.name} seating area`,
          isActive: true,
          sortOrder: i + 1,
        });

        console.log('🔧 [Settings] Create area result:', result);

        if (result.success && result.data) {
          createdAreas.push(result.data);
        } else {
          console.error('Failed to create area:', area.name, result.error);
        }
      }

      if (createdAreas.length > 0) {
        setTableAreas(createdAreas);
        console.log('✅ [Settings] Created TableArea entities:', createdAreas.length);
        toast.success(`Created ${createdAreas.length} table area(s) from existing tables`);
      } else {
        console.error('❌ [Settings] No areas were created successfully');
        toast.error('Failed to create table areas from existing tables');
      }
    } catch (error) {
      console.error('Failed to create table areas from existing tables:', error);
      toast.error('Migration failed: ' + (error as Error).message);
    }
  };

  const handleInitializeDefaults = async () => {
    if (!restaurant) return;

    try {
      setIsLoading(true);
      console.log('🎯 Initializing default tables and areas...');

      const result = await TableService.initializeDefaultTables(restaurant.id);
      
      if (result.success && result.data) {
        // Reload all data
        await loadData();
        toast.success('Default tables and areas created successfully!');
      } else {
        toast.error(result.error || 'Failed to initialize default tables');
      }
    } catch (error) {
      console.error('Failed to initialize defaults:', error);
      toast.error('Failed to initialize default tables');
    } finally {
      setIsLoading(false);
    }
  };

  const resetBusinessForm = () => {
    if (!restaurant) return;

    resetBusiness({
      address: restaurant.settings.address || '',
      phone: restaurant.settings.phone || '',
      email: restaurant.settings.email || '',
      taxRate: restaurant.settings.taxRate || 18,
      gstin: restaurant.settings.businessInfo?.gstin || '',
      fssaiNumber: restaurant.settings.businessInfo?.fssaiNumber || '',
      businessAddress: restaurant.settings.businessInfo?.businessAddress || '',
      city: restaurant.settings.businessInfo?.city || '',
      state: restaurant.settings.businessInfo?.state || '',
      pincode: restaurant.settings.businessInfo?.pincode || '',
      country: restaurant.settings.businessInfo?.country || 'India',
      website: restaurant.settings.businessInfo?.website || '',
      upiId: restaurant.settings.upiSettings?.upiId || '',
      enableQRCode: restaurant.settings.upiSettings?.enableQRCode || false,
    });
  };

  const handleBusinessInfoSubmit = async (data: BusinessInfoForm) => {
    if (!restaurant) return;

    try {
      setIsSubmitting(true);

      const updatedSettings = {
        ...restaurant.settings,
        address: data.address,
        phone: data.phone,
        email: data.email,
        taxRate: data.taxRate,
        businessInfo: {
          ...restaurant.settings.businessInfo,
          gstin: data.gstin,
          fssaiNumber: data.fssaiNumber,
          businessAddress: data.businessAddress,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country,
          website: data.website,
        },
        upiSettings: {
          ...restaurant.settings.upiSettings,
          upiId: data.upiId,
          enableQRCode: data.enableQRCode,
        },
      };

      const result = await RestaurantService.updateRestaurant(restaurant.id, {
        settings: updatedSettings,
      });

      if (result.success) {
        await updateRestaurant({ settings: updatedSettings });
        toast.success('Business information updated successfully');
      } else {
        toast.error(result.error || 'Failed to update business information');
      }
    } catch (error) {
      toast.error('Failed to update business information');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateArea = () => {
    setEditingArea(null);
    resetArea({
      name: '',
      description: '',
      isActive: true,
      sortOrder: tableAreas.length + 1,
    });
    setShowAreaForm(true);
  };

  const handleEditArea = (area: TableArea) => {
    setEditingArea(area);
    setAreaValue('name', area.name);
    setAreaValue('description', area.description || '');
    setAreaValue('isActive', area.isActive);
    setAreaValue('sortOrder', area.sortOrder);
    setShowAreaForm(true);
  };

  const onAreaSubmit = async (data: TableAreaForm) => {
    if (!restaurant) return;

    try {
      let result;

      if (editingArea) {
        result = await TableAreaService.updateTableArea(restaurant.id, editingArea.id, data);
      } else {
        result = await TableAreaService.createTableArea(restaurant.id, data);
      }

      if (result.success) {
        await loadData();
        setShowAreaForm(false);
        setEditingArea(null);
        resetArea();
        toast.success(result.message || 'Area saved successfully');
      } else {
        toast.error(result.error || 'Failed to save area');
      }
    } catch (error) {
      toast.error('Failed to save area');
    }
  };

  const handleDeleteArea = async (area: TableArea) => {
    if (!restaurant) return;

    // Check if area has tables
    const areaTables = tables.filter(t => t.areaId === area.id);
    if (areaTables.length > 0) {
      toast.error(`Cannot delete area. It has ${areaTables.length} table(s). Please move or delete the tables first.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete the area "${area.name}"?`)) {
      return;
    }

    try {
      const result = await TableAreaService.deleteTableArea(restaurant.id, area.id);

      if (result.success) {
        await loadData();
        toast.success(result.message || 'Area deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete area');
      }
    } catch (error) {
      toast.error('Failed to delete area');
    }
  };

  const handleCreateTable = () => {
    if (tableAreas.length === 0) {
      toast.error('Please create at least one table area first');
      return;
    }
    
    setEditingTable(null);
    resetTable({
      number: '',
      areaId: tableAreas[0]?.id || '',
      capacity: 4,
      description: '',
      isActive: true,
    });
    setShowTableForm(true);
  };

  const handleEditTable = (table: Table) => {
    setEditingTable(table);
    setTableValue('number', table.number);
    setTableValue('areaId', table.areaId);
    setTableValue('capacity', table.capacity);
    setTableValue('description', table.description || '');
    setTableValue('isActive', table.isActive);
    setShowTableForm(true);
  };

  const onTableSubmit = async (data: TableForm) => {
    if (!restaurant) return;

    try {
      const area = tableAreas.find(a => a.id === data.areaId);
      if (!area) {
        toast.error('Please select a valid area');
        return;
      }

      const tableData = {
        ...data,
        area: area.name,
        status: 'available' as const,
        restaurantId: restaurant.id,
      };

      let result;

      if (editingTable) {
        result = await TableService.updateTable(editingTable.id, restaurant.id, tableData);
      } else {
        result = await TableService.createTable(tableData);
      }

      if (result.success) {
        await loadData();
        setShowTableForm(false);
        setEditingTable(null);
        resetTable();
        toast.success(result.message || 'Table saved successfully');
      } else {
        toast.error(result.error || 'Failed to save table');
      }
    } catch (error) {
      toast.error('Failed to save table');
    }
  };

  const handleDeleteTable = async (table: Table) => {
    if (!restaurant) return;

    if (table.status === 'occupied') {
      toast.error('Cannot delete an occupied table');
      return;
    }

    if (!confirm(`Are you sure you want to delete Table ${table.number}?`)) {
      return;
    }

    try {
      const result = await TableService.deleteTable(table.id, restaurant.id);

      if (result.success) {
        await loadData();
        toast.success(result.message || 'Table deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete table');
      }
    } catch (error) {
      toast.error('Failed to delete table');
    }
  };

  const filteredTables = selectedArea === 'all' || tableAreas.length === 0
    ? tables 
    : tables.filter(table => table.areaId === selectedArea);

  if (!restaurant) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => window.history.back()}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <SettingsIcon className="w-6 h-6" />
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Restaurant Settings</h1>
                <p className="text-gray-600">Manage your restaurant configuration</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('business')}
              className={`flex-1 px-6 py-4 text-sm font-medium rounded-l-lg transition-colors ${
                activeTab === 'business'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5 mr-2 inline" />
              Business Information
            </button>
            
            <button
              onClick={() => setActiveTab('tables')}
              className={`flex-1 px-6 py-4 text-sm font-medium rounded-r-lg transition-colors ${
                activeTab === 'tables'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5 mr-2 inline" />
              Table Management
            </button>
          </div>
        </div>

        {/* Business Information Tab */}
        {activeTab === 'business' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Business Information</h2>
              <p className="text-gray-600">Update your restaurant's business details for bills and receipts</p>
            </div>

            <form onSubmit={handleBusinessSubmit(handleBusinessInfoSubmit)} className="space-y-8">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Restaurant Name
                    </label>
                    <input
                      type="text"
                      value={restaurant.name}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Restaurant name cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Type
                    </label>
                    <input
                      type="text"
                      value={restaurant.businessType.charAt(0).toUpperCase() + restaurant.businessType.slice(1)}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        {...registerBusiness('phone')}
                        type="tel"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        {...registerBusiness('email')}
                        type="email"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="restaurant@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        {...registerBusiness('website')}
                        type="url"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://restaurant.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tax Rate (%)
                    </label>
                    <input
                      {...registerBusiness('taxRate', { 
                        required: 'Tax rate is required',
                        min: { value: 0, message: 'Tax rate cannot be negative' },
                        max: { value: 100, message: 'Tax rate cannot exceed 100%' }
                      })}
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="18.00"
                    />
                    {businessErrors.taxRate && (
                      <p className="text-red-600 text-sm mt-1">{businessErrors.taxRate.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Business Registration */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Business Registration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GSTIN Number
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        {...registerBusiness('gstin')}
                        type="text"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="22AAAAA0000A1Z5"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">GST Identification Number for tax compliance</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      FSSAI License Number
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        {...registerBusiness('fssaiNumber')}
                        type="text"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="12345678901234"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Food Safety and Standards Authority of India License</p>
                  </div>
                </div>
              </div>

              {/* Business Address */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Business Address</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Business Address
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <textarea
                        {...registerBusiness('businessAddress')}
                        rows={3}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter complete business address for bills and legal documents"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City
                      </label>
                      <input
                        {...registerBusiness('city')}
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Mumbai"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State
                      </label>
                      <input
                        {...registerBusiness('state')}
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Maharashtra"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        PIN Code
                      </label>
                      <input
                        {...registerBusiness('pincode')}
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="400001"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      {...registerBusiness('country')}
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="India"
                    />
                  </div>
                </div>
              </div>

              {/* UPI Payment Settings */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">UPI Payment Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UPI ID
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        {...registerBusiness('upiId')}
                        type="text"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="restaurant@paytm or 9876543210@ybl"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Enter your UPI ID for customer payments (e.g., yourname@paytm, phone@ybl)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      QR Code Display
                    </label>
                    <div className="flex items-center space-x-3 mt-3">
                      <input
                        {...registerBusiness('enableQRCode')}
                        type="checkbox"
                        className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <div className="flex items-center space-x-2">
                        <QrCode className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-700">Show UPI QR code on bills and receipts</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">When enabled, customers can scan the QR code to pay directly via UPI</p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Business Information
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table Management Tab */}
        {activeTab === 'tables' && (
          <div className="space-y-6">
            {/* Table Areas Management */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Table Areas</h2>
                  <p className="text-gray-600">Manage dining areas for better table organization</p>
                </div>
                
                <button
                  onClick={handleCreateArea}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Area
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading areas...</p>
                </div>
              ) : tableAreas.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No table areas</h3>
                  <p className="text-gray-600 mb-4">Create your first dining area to organize tables</p>
                  <div className="flex items-center justify-center space-x-3">
                    {tables.length === 0 && (
                      <button
                        onClick={handleInitializeDefaults}
                        className="btn btn-primary"
                        disabled={isLoading}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Setup Default Tables
                      </button>
                    )}
                    <button
                      onClick={handleCreateArea}
                      className="btn btn-secondary"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Area
                    </button>
                  </div>

                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tableAreas.map((area) => {
                    const areaTableCount = tables.filter(t => t.areaId === area.id).length;
                    
                    return (
                      <div
                        key={area.id}
                        className={`p-4 border rounded-lg ${
                          area.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium text-gray-900">{area.name}</h3>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditArea(area)}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteArea(area)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {area.description && (
                          <p className="text-sm text-gray-600 mb-2">{area.description}</p>
                        )}
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{areaTableCount} tables</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            area.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {area.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tables Management */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Tables</h2>
                  <p className="text-gray-600">Manage individual tables and their settings</p>
                </div>
                
                <div className="flex items-center space-x-4">
                  {tableAreas.length > 0 && (
                    <select
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Areas</option>
                      {tableAreas.map(area => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  <button
                    onClick={handleCreateTable}
                    className="btn btn-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Table
                  </button>
                </div>
              </div>

              {tableAreas.length === 0 && tables.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <div className="text-yellow-600 text-sm">
                      ⚠️ You have {tables.length} tables but no table areas configured. Consider organizing your tables into areas.
                    </div>
                    <button
                      onClick={() => createTableAreasFromExistingTables(tables)}
                      className="ml-4 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                      disabled={isLoading}
                    >
                      Fix Table Areas Now
                    </button>
                  </div>
                </div>
              )}

              {tables.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tables found</h3>
                  <p className="text-gray-600 mb-4">Get started by setting up your restaurant tables</p>
                  
                  <button
                    onClick={handleInitializeDefaults}
                    className="btn btn-primary"
                    disabled={isLoading}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Setup Default Tables & Areas
                  </button>
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tables found</h3>
                  <p className="text-gray-600">
                    {selectedArea === 'all' 
                      ? 'Add your first table to get started'
                      : 'No tables in the selected area'
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Table
                        </th>
                        <th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Area
                        </th>
                        <th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Capacity
                        </th>
                        <th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTables.map((table) => (
                        <tr key={table.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">Table {table.number}</div>
                              {table.description && (
                                <div className="text-sm text-gray-500">{table.description}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 bg-blue-50">
                            <div className="font-medium text-blue-900">
                              {table.area || 'No Area'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {table.capacity} guests
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col space-y-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                table.status === 'available' ? 'bg-green-100 text-green-800' :
                                table.status === 'occupied' ? 'bg-red-100 text-red-800' :
                                table.status === 'reserved' ? 'bg-yellow-100 text-yellow-800' :
                                table.status === 'cleaning' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {table.status.replace('_', ' ')}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                table.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {table.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditTable(table)}
                                className="p-2 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTable(table)}
                                className="p-2 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                                disabled={table.status === 'occupied'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Area Form Modal */}
        {showAreaForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowAreaForm(false)}></div>
              
              <div className="inline-block w-full max-w-md my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingArea ? 'Edit Area' : 'Create New Area'}
                  </h3>
                </div>

                <form onSubmit={handleAreaSubmit(onAreaSubmit)} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Area Name *
                    </label>
                    <input
                      {...registerArea('name', { required: 'Area name is required' })}
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Main Dining"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      {...registerArea('description')}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Optional description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sort Order
                    </label>
                    <input
                      {...registerArea('sortOrder', { required: true, min: 1 })}
                      type="number"
                      min="1"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      {...registerArea('isActive')}
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm text-gray-700">Active</label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAreaForm(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingArea ? 'Update' : 'Create'} Area
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table Form Modal */}
        {showTableForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowTableForm(false)}></div>
              
              <div className="inline-block w-full max-w-md my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingTable ? 'Edit Table' : 'Create New Table'}
                  </h3>
                </div>

                <form onSubmit={handleTableSubmit(onTableSubmit)} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Table Number *
                    </label>
                    <input
                      {...registerTable('number', { required: 'Table number is required' })}
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Area *
                    </label>
                    <select
                      {...registerTable('areaId', { required: 'Area is required' })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select an area</option>
                      {tableAreas.filter(area => area.isActive).map(area => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Capacity *
                    </label>
                    <input
                      {...registerTable('capacity', { required: 'Capacity is required', min: 1 })}
                      type="number"
                      min="1"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="4"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <input
                      {...registerTable('description')}
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Window table"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      {...registerTable('isActive')}
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm text-gray-700">Active</label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowTableForm(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingTable ? 'Update' : 'Create'} Table
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}