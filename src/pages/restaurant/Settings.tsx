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
  X,
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
  // This new state will control which view is shown on mobile.
  // 'areas' will show the list of areas.
  // 'tables' will show the list of tables for the selected area.
  const [mobileView, setMobileView] = useState<'areas' | 'tables'>('areas');

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
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center gap-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <SettingsIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
              <h1 className="text-2xl font-bold text-gray-900">App Settings</h1>
              <p className="text-sm text-gray-500">Manage your restaurant's configuration and details</p>
              </div>
            </div>
          </div>
        </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="sm:hidden">
            <select
              id="tabs"
              name="tabs"
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as 'business' | 'tables')}
            >
              <option value="business">Business Info</option>
              <option value="tables">Tables & Areas</option>
            </select>
          </div>
          <div className="hidden sm:block">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('business')}
                  className={`${
                activeTab === 'business'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Business Info
            </button>
            <button
              onClick={() => setActiveTab('tables')}
                  className={`${
                activeTab === 'tables'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Tables & Areas
            </button>
              </nav>
          </div>
        </div>
            </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="text-center py-12">
            <p>Loading settings...</p>
          </div>
        ) : (
              <div>
            {activeTab === 'business' && (
              <form onSubmit={handleBusinessSubmit(handleBusinessInfoSubmit)}>
                <div className="space-y-8">
                  {/* Basic Information Section */}
                  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                        <label className="block text-sm font-medium text-gray-700">Restaurant Name</label>
                        <input type="text" value={restaurant.name} disabled className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm" />
                  </div>
                  <div>
                        <label className="block text-sm font-medium text-gray-700">Business Type</label>
                        <input type="text" value={restaurant.businessType.charAt(0).toUpperCase() + restaurant.businessType.slice(1)} disabled className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm" />
                  </div>
                  <div>
                        <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                        <input {...registerBusiness('phone')} type="tel" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                    </div>
                  <div>
                        <label className="block text-sm font-medium text-gray-700">Email Address</label>
                        <input {...registerBusiness('email')} type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                    </div>
                  <div>
                        <label className="block text-sm font-medium text-gray-700">Website</label>
                        <input {...registerBusiness('website')} type="url" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Financial Information Section */}
                  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Financial & Tax</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                        <label className="block text-sm font-medium text-gray-700">Tax Rate (%)</label>
                        <input {...registerBusiness('taxRate', { required: 'Required', min: 0, max: 100 })} type="number" step="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                        {businessErrors.taxRate && <p className="text-red-600 text-xs mt-1">{businessErrors.taxRate.message}</p>}
                  </div>
              <div>
                        <label className="block text-sm font-medium text-gray-700">GSTIN Number</label>
                        <input {...registerBusiness('gstin')} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                    </div>
                  <div>
                        <label className="block text-sm font-medium text-gray-700">FSSAI License Number</label>
                        <input {...registerBusiness('fssaiNumber')} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </div>
                </div>
              </div>

                  {/* Address Information Section */}
                  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Business Address</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Full Business Address</label>
                        <textarea {...registerBusiness('businessAddress')} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">City</label>
                        <input {...registerBusiness('city')} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">State</label>
                        <input {...registerBusiness('state')} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">PIN Code</label>
                        <input {...registerBusiness('pincode')} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                    </div>
                  <div>
                        <label className="block text-sm font-medium text-gray-700">Country</label>
                        <input {...registerBusiness('country')} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </div>
                </div>
              </div>

                  {/* UPI Settings Section */}
                  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">UPI Payments</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                        <label className="block text-sm font-medium text-gray-700">UPI ID</label>
                        <input {...registerBusiness('upiId')} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                    </div>
                      <div className="flex items-center">
                        <input {...registerBusiness('enableQRCode')} type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        <label htmlFor="enableQRCode" className="ml-2 block text-sm text-gray-900">Enable UPI QR Code on Bills</label>
                  </div>
                </div>
              </div>

              {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <button type="submit" disabled={isSubmitting} className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                      <Save className="h-5 w-5 mr-2" />
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
          </div>
              </form>
        )}
        {activeTab === 'tables' && (
                <div>
                {/* Mobile View: Toggle between Areas and Tables */}
                <div className="lg:hidden">
                  {mobileView === 'areas' ? (
                    /* Mobile: Area List */
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border h-full">
                       <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Table Areas</h3>
                        <button onClick={handleCreateArea} className="inline-flex items-center gap-2 px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                          <Plus size={16} /> New Area
                </button>
              </div>
                      {tableAreas.length === 0 ? (
                         <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
                          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No table areas</h3>
                          <p className="mt-1 text-sm text-gray-500">Create areas to organize your tables.</p>
                </div>
              ) : (
                        <div className="space-y-3">
                  {tableAreas.map((area) => {
                    const areaTableCount = tables.filter(t => t.areaId === area.id).length;
                             return(
                              <div key={area.id} className="p-3 rounded-lg border bg-white hover:bg-gray-50">
                                <div className="flex justify-between items-center">
                                  <button onClick={() => { setSelectedArea(area.id); setMobileView('tables'); }} className="text-left flex-grow">
                                    <h4 className="font-semibold text-gray-900">{area.name}</h4>
                                    <p className="text-sm text-gray-600">{areaTableCount} tables</p>
                            </button>
                                  <div className="flex items-center gap-2">
                                     <button onClick={(e) => { e.stopPropagation(); handleEditArea(area);}} className="p-1 text-gray-400 hover:text-indigo-600"><Edit3 size={16} /></button>
                                     <button onClick={(e) => { e.stopPropagation(); handleDeleteArea(area);}} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                          </div>
                        </div>
                        </div>
                             )
                  })}
                </div>
              )}
                    </div>
                  ) : (
                    /* Mobile: Table List for a selected area */
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border h-full">
                       <button onClick={() => setMobileView('areas')} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 mb-4">
                         <ArrowLeft size={16} /> Back to Areas
                       </button>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Tables in {tableAreas.find(a => a.id === selectedArea)?.name}</h3>
                         <button onClick={handleCreateTable} className="inline-flex items-center gap-2 px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                           <Plus size={16} /> New Table
                        </button>
            </div>

                       {tables.filter(t => t.areaId === selectedArea).length === 0 ? (
                         <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
                            <Users className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No tables found</h3>
                            <p className="mt-1 text-sm text-gray-500">Add a table to this area.</p>
                         </div>
                       ) : (
                         <div className="space-y-3">
                           {tables.filter(t => t.areaId === selectedArea).map((table) => (
                              <div key={table.id} className="p-3 rounded-lg border bg-white flex justify-between items-center">
                <div>
                                  <h4 className="font-semibold text-gray-800">Table {table.number}</h4>
                                  <p className="text-sm text-gray-500">Capacity: {table.capacity}</p>
                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEditTable(table)} className="p-1 text-gray-400 hover:text-indigo-600"><Edit3 size={16} /></button>
                                    <button onClick={() => handleDeleteTable(table)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                                </div>
                              </div>
                           ))}
                         </div>
                       )}
                    </div>
                  )}
                </div>

                {/* Desktop View: Two Columns */}
                <div className="hidden lg:grid lg:grid-cols-12 lg:gap-8">
                  {/* Left Column: Table Areas */}
                  <div className="lg:col-span-5 mb-6 lg:mb-0">
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border h-full">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Table Areas</h3>
                        <button onClick={handleCreateArea} className="inline-flex items-center gap-2 px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                          <Plus size={16} /> New Area
                  </button>
              </div>

                      {tableAreas.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
                          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No table areas</h3>
                          <p className="mt-1 text-sm text-gray-500">Create areas to organize your tables.</p>
                    </div>
                      ) : (
                        <div className="space-y-3">
                          {tableAreas.map((area) => {
                             const areaTableCount = tables.filter(t => t.areaId === area.id).length;
                             return(
                              <div key={area.id} className={`p-3 rounded-lg border ${selectedArea === area.id ? 'bg-indigo-50 border-indigo-300' : 'bg-white hover:bg-gray-50'}`}>
                                <div className="flex justify-between items-center">
                                  <button onClick={() => setSelectedArea(area.id)} className="text-left flex-grow">
                                    <h4 className="font-semibold text-gray-900">{area.name}</h4>
                                    <p className="text-sm text-gray-600">{areaTableCount} tables</p>
                    </button>
                                  <div className="flex items-center gap-2">
                                     <button onClick={() => handleEditArea(area)} className="p-1 text-gray-400 hover:text-indigo-600"><Edit3 size={16} /></button>
                                     <button onClick={() => handleDeleteArea(area)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                                </div>
                              </div>
                             )
                          })}
                </div>
              )}
                    </div>
                  </div>

                  {/* Right Column: Tables */}
                  <div className="lg:col-span-7">
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border h-full">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Tables in {tableAreas.find(a => a.id === selectedArea)?.name || 'All Areas'}</h3>
                         <button onClick={handleCreateTable} className="inline-flex items-center gap-2 px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                           <Plus size={16} /> New Table
                  </button>
                </div>
                      
                       {tables.filter(t => selectedArea === 'all' || t.areaId === selectedArea).length === 0 ? (
                         <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
                            <Users className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No tables found</h3>
                            <p className="mt-1 text-sm text-gray-500">Add a table to this area.</p>
                </div>
              ) : (
                         <div className="space-y-3">
                           {tables.filter(t => selectedArea === 'all' || t.areaId === selectedArea).map((table) => (
                              <div key={table.id} className="p-3 rounded-lg border bg-white flex justify-between items-center">
                            <div>
                                  <h4 className="font-semibold text-gray-800">Table {table.number}</h4>
                                  <p className="text-sm text-gray-500">Capacity: {table.capacity}</p>
                            </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEditTable(table)} className="p-1 text-gray-400 hover:text-indigo-600"><Edit3 size={16} /></button>
                                    <button onClick={() => handleDeleteTable(table)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                            </div>
                            </div>
                           ))}
                </div>
              )}
                    </div>
                  </div>
            </div>
          </div>
        )}
          </div>
        )}
      </div>

        {/* Area Form Modal */}
        {showAreaForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg m-0 sm:m-4">
             <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">{editingArea ? 'Edit Area' : 'Create New Area'}</h3>
                <button onClick={() => setShowAreaForm(false)} className="p-1 rounded-full hover:bg-gray-200">
                  <X size={20} />
                </button>
                </div>
              <form onSubmit={handleAreaSubmit(onAreaSubmit)} className="p-4 space-y-4">
                {/* Form fields */}
                  <div>
                  <label className="block text-sm font-medium text-gray-700">Area Name *</label>
                  <input {...registerArea('name', { required: 'Area name is required' })} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                   <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea {...registerArea('description')} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"></textarea>
                  </div>
                  <div>
                  <label className="block text-sm font-medium text-gray-700">Sort Order</label>
                  <input {...registerArea('sortOrder', { required: true, min: 1 })} type="number" min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </div>
                  <div className="flex items-center">
                  <input {...registerArea('isActive')} type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label className="ml-2 text-sm text-gray-700">Active</label>
                  </div>
                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowAreaForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700">{editingArea ? 'Update' : 'Create'} Area</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table Form Modal */}
        {showTableForm && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg m-0 sm:m-4">
             <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
               <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">{editingTable ? 'Edit Table' : 'Create New Table'}</h3>
                <button onClick={() => setShowTableForm(false)} className="p-1 rounded-full hover:bg-gray-200">
                  <X size={20} />
                </button>
                </div>
              <form onSubmit={handleTableSubmit(onTableSubmit)} className="p-4 space-y-4">
                  <div>
                  <label className="block text-sm font-medium text-gray-700">Table Number *</label>
                  <input {...registerTable('number', { required: 'Table number is required' })} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                   <label className="block text-sm font-medium text-gray-700">Area *</label>
                  <select {...registerTable('areaId', { required: 'Area is required' })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                      <option value="">Select an area</option>
                      {tableAreas.filter(area => area.isActive).map(area => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                  <label className="block text-sm font-medium text-gray-700">Capacity *</label>
                  <input {...registerTable('capacity', { required: 'Capacity is required', min: 1 })} type="number" min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <input {...registerTable('description')} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </div>
                  <div className="flex items-center">
                  <input {...registerTable('isActive')} type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label className="ml-2 text-sm text-gray-700">Active</label>
                  </div>
                 <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowTableForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700">{editingTable ? 'Update' : 'Create'} Table</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}