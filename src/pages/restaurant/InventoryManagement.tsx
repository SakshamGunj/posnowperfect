import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Package,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  BarChart3,
  History,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { MenuService } from '@/services/menuService';
import { InventoryService } from '@/services/inventoryService';
import { MenuItem, InventoryItem, InventoryTransaction, InventoryUnit } from '@/types';
// Removed unused formatCurrency import
import { InventoryDialog, AdjustmentDialog, HistoryDialog } from '@/components/inventory/InventoryDialogs';

interface InventoryForm {
  menuItemId: string;
  currentQuantity: number;
  unit: InventoryUnit;
  customUnit?: string;
  minimumThreshold: number;
  consumptionPerOrder: number;
  maxCapacity?: number;
  costPerUnit?: number;
  supplier?: string;
  isTracked: boolean;
  autoDeduct: boolean;
}

interface AdjustmentForm {
  newQuantity: number;
  type: 'restock' | 'manual_adjustment' | 'waste';
  reason?: string;
  notes?: string;
}

export default function InventoryManagement() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const [searchParams] = useSearchParams();
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'tracked' | 'low_stock' | 'out_of_stock'>('all');
  
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'edit' | 'adjust' | 'history'>('create');
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<InventoryTransaction[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, watch } = useForm<InventoryForm>();
  const { register: registerAdjust, handleSubmit: handleAdjustSubmit, reset: resetAdjust } = useForm<AdjustmentForm>();

  const selectedUnit = watch('unit');

  useEffect(() => {
    if (restaurant) {
      loadData();
    }
  }, [restaurant]);

  useEffect(() => {
    filterInventoryItems();
  }, [inventoryItems, searchTerm, filterStatus]);

  // Handle URL parameter for direct menu item inventory management
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (itemId && menuItems.length > 0 && inventoryItems.length >= 0) {
      const existingInventory = inventoryItems.find(inv => inv.menuItemId === itemId);
      
      if (existingInventory) {
        // Edit existing inventory
        handleEditInventory(existingInventory);
      } else {
        // Create new inventory for this menu item
        const menuItem = menuItems.find(item => item.id === itemId);
        if (menuItem) {
          setSelectedInventory(null);
          setDialogType('create');
          reset({
            menuItemId: itemId,
            currentQuantity: 0,
            unit: 'pieces',
            minimumThreshold: 5,
            consumptionPerOrder: 1,
            isTracked: true,
            autoDeduct: true,
          });
          setShowDialog(true);
        }
      }
    }
  }, [searchParams, menuItems, inventoryItems]);

  const loadData = async () => {
    if (!restaurant) return;

    try {
      setIsLoading(true);

      const [menuResult, inventoryResult] = await Promise.all([
        MenuService.getMenuItemsForRestaurant(restaurant.id),
        InventoryService.getInventoryForRestaurant(restaurant.id),
      ]);

      if (menuResult.success && menuResult.data) {
        setMenuItems(menuResult.data);
      }

      if (inventoryResult.success && inventoryResult.data) {
        setInventoryItems(inventoryResult.data);
      }
    } catch (error) {
      toast.error('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  const filterInventoryItems = () => {
    let filtered = inventoryItems;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item => {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        const itemName = menuItem?.name || '';
        return itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               item.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Filter by status
    switch (filterStatus) {
      case 'tracked':
        filtered = filtered.filter(item => item.isTracked);
        break;
      case 'low_stock':
        filtered = filtered.filter(item => item.isTracked && item.currentQuantity <= item.minimumThreshold);
        break;
      case 'out_of_stock':
        filtered = filtered.filter(item => item.isTracked && item.currentQuantity === 0);
        break;
    }

    setFilteredInventory(filtered);
  };

  const handleCreateInventory = () => {
    const availableMenuItems = menuItems.filter(item => 
      !inventoryItems.some(inv => inv.menuItemId === item.id)
    );

    if (availableMenuItems.length === 0) {
      toast.error('All menu items already have inventory setup');
      return;
    }

    setSelectedInventory(null);
    setDialogType('create');
    reset({
      menuItemId: availableMenuItems[0]?.id || '',
      currentQuantity: 0,
      unit: 'pieces',
      minimumThreshold: 5,
      consumptionPerOrder: 1,
      isTracked: true,
      autoDeduct: true,
    });
    setShowDialog(true);
  };

  const handleEditInventory = (inventory: InventoryItem) => {
    setSelectedInventory(inventory);
    setDialogType('edit');
    setValue('menuItemId', inventory.menuItemId);
    setValue('currentQuantity', inventory.currentQuantity);
    setValue('unit', inventory.unit);
    setValue('customUnit', inventory.customUnit);
    setValue('minimumThreshold', inventory.minimumThreshold);
    setValue('consumptionPerOrder', inventory.consumptionPerOrder);
    setValue('maxCapacity', inventory.maxCapacity);
    setValue('costPerUnit', inventory.costPerUnit);
    setValue('supplier', inventory.supplier);
    setValue('isTracked', inventory.isTracked);
    setValue('autoDeduct', inventory.autoDeduct);
    setShowDialog(true);
  };

  const handleAdjustInventory = (inventory: InventoryItem) => {
    setSelectedInventory(inventory);
    setDialogType('adjust');
    resetAdjust({
      newQuantity: inventory.currentQuantity,
      type: 'manual_adjustment',
    });
    setShowDialog(true);
  };

  const handleViewHistory = async (inventory: InventoryItem) => {
    if (!restaurant) return;

    try {
      setSelectedInventory(inventory);
      setDialogType('history');
      
      const result = await InventoryService.getTransactionHistory(inventory.id, restaurant.id);
      
      if (result.success && result.data) {
        setTransactionHistory(result.data);
      } else {
        setTransactionHistory([]);
        toast.error('Failed to load transaction history');
      }
      
      setShowDialog(true);
    } catch (error) {
      toast.error('Failed to load transaction history');
    }
  };

  const handleSaveInventory = async (data: InventoryForm) => {
    if (!restaurant || !user) return;

    try {
      setIsSubmitting(true);

      if (selectedInventory) {
        // Update existing inventory
        const result = await InventoryService.updateInventoryItem(selectedInventory.id, restaurant.id, data);
        
        if (result.success) {
          toast.success('Inventory updated successfully');
          await loadData();
        } else {
          toast.error(result.error || 'Failed to update inventory');
        }
      } else {
        // Create new inventory
        const result = await InventoryService.createInventoryItem({
          ...data,
          restaurantId: restaurant.id,
        });
        
        if (result.success) {
          toast.success('Inventory created successfully');
          await loadData();
        } else {
          toast.error(result.error || 'Failed to create inventory');
        }
      }

      setShowDialog(false);
      setSelectedInventory(null);
    } catch (error) {
      toast.error('Failed to save inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustQuantity = async (data: AdjustmentForm) => {
    if (!restaurant || !user || !selectedInventory) return;

    try {
      setIsSubmitting(true);

      const result = await InventoryService.adjustInventoryQuantity(
        selectedInventory.id,
        restaurant.id,
        data.newQuantity,
        data.type,
        user.id,
        data.reason,
        data.notes
      );

      if (result.success) {
        toast.success('Inventory adjusted successfully');
        await loadData();
        setShowDialog(false);
        setSelectedInventory(null);
      } else {
        toast.error(result.error || 'Failed to adjust inventory');
      }
    } catch (error) {
      toast.error('Failed to adjust inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInventory = async (inventory: InventoryItem) => {
    if (!restaurant || !confirm('Are you sure you want to delete this inventory item?')) {
      return;
    }

    try {
      const result = await InventoryService.deleteInventoryItem(inventory.id, restaurant.id);
      
      if (result.success) {
        toast.success('Inventory deleted successfully');
        await loadData();
      } else {
        toast.error(result.error || 'Failed to delete inventory');
      }
    } catch (error) {
      toast.error('Failed to delete inventory');
    }
  };

  const getMenuItemName = (menuItemId: string): string => {
    const menuItem = menuItems.find(item => item.id === menuItemId);
    return menuItem?.name || 'Unknown Item';
  };

  const getStockStatus = (inventory: InventoryItem): { status: string; color: string; icon: React.ReactNode } => {
    if (!inventory.isTracked) {
      return { status: 'Not Tracked', color: 'text-gray-500', icon: <EyeOff className="w-4 h-4" /> };
    }

    if (inventory.currentQuantity === 0) {
      return { status: 'Out of Stock', color: 'text-red-600', icon: <AlertTriangle className="w-4 h-4" /> };
    }

    if (inventory.currentQuantity <= inventory.minimumThreshold) {
      return { status: 'Low Stock', color: 'text-yellow-600', icon: <TrendingDown className="w-4 h-4" /> };
    }

    return { status: 'In Stock', color: 'text-green-600', icon: <TrendingUp className="w-4 h-4" /> };
  };

  // Removed unused getUnitDisplay function (duplicate exists in component)

  const stats = {
    totalItems: inventoryItems.length,
    trackedItems: inventoryItems.filter(item => item.isTracked).length,
    lowStockItems: inventoryItems.filter(item => item.isTracked && item.currentQuantity <= item.minimumThreshold).length,
    outOfStockItems: inventoryItems.filter(item => item.isTracked && item.currentQuantity === 0).length,
  };

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
              <p className="text-gray-600">Track and manage your restaurant inventory</p>
            </div>
            
            <button
              onClick={handleCreateInventory}
              className="btn btn-theme-primary"
              disabled={menuItems.filter(item => !inventoryItems.some(inv => inv.menuItemId === item.id)).length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Inventory
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
              </div>
            </div>
          </div>
          
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Tracked</p>
                <p className="text-2xl font-bold text-gray-900">{stats.trackedItems}</p>
              </div>
            </div>
          </div>
          
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-gray-900">{stats.lowStockItems}</p>
              </div>
            </div>
          </div>
          
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-gray-900">{stats.outOfStockItems}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search inventory items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Items</option>
                  <option value="tracked">Tracked Only</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>
              
              <button
                onClick={loadData}
                className="btn btn-secondary"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Inventory List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading inventory...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInventory.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory items found</h3>
                <p className="text-gray-600 mb-4">
                  {inventoryItems.length === 0
                    ? 'Start by adding inventory tracking for your menu items'
                    : 'Try adjusting your search or filter settings'
                  }
                </p>
                {inventoryItems.length === 0 && (
                  <button
                    onClick={handleCreateInventory}
                    className="btn btn-theme-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Inventory Item
                  </button>
                )}
              </div>
            ) : (
              filteredInventory.map(inventory => (
                <InventoryItemCard
                  key={inventory.id}
                  inventory={inventory}
                  menuItemName={getMenuItemName(inventory.menuItemId)}
                  stockStatus={getStockStatus(inventory)}
                  onEdit={handleEditInventory}
                  onAdjust={handleAdjustInventory}
                  onHistory={handleViewHistory}
                  onDelete={handleDeleteInventory}
                />
              ))
            )}
          </div>
        )}
      </main>

      {/* Dialogs */}
      {showDialog && (dialogType === 'create' || dialogType === 'edit') && (
        <InventoryDialog
          isOpen={true}
          onClose={() => setShowDialog(false)}
          onSave={handleSaveInventory}
          inventory={selectedInventory}
          menuItems={menuItems}
          existingInventory={inventoryItems}
          register={register}
          handleSubmit={handleSubmit}
          selectedUnit={selectedUnit}
          isSubmitting={isSubmitting}
        />
      )}

      {showDialog && dialogType === 'adjust' && selectedInventory && (
        <AdjustmentDialog
          isOpen={true}
          onClose={() => setShowDialog(false)}
          onSave={handleAdjustQuantity}
          inventory={selectedInventory}
          menuItemName={getMenuItemName(selectedInventory.menuItemId)}
          register={registerAdjust}
          handleSubmit={handleAdjustSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {showDialog && dialogType === 'history' && selectedInventory && (
        <HistoryDialog
          isOpen={true}
          onClose={() => setShowDialog(false)}
          inventory={selectedInventory}
          menuItemName={getMenuItemName(selectedInventory.menuItemId)}
          transactions={transactionHistory}
        />
      )}
    </div>
  );
}

// Inventory Item Card Component
interface InventoryItemCardProps {
  inventory: InventoryItem;
  menuItemName: string;
  stockStatus: { status: string; color: string; icon: React.ReactNode };
  onEdit: (inventory: InventoryItem) => void;
  onAdjust: (inventory: InventoryItem) => void;
  onHistory: (inventory: InventoryItem) => void;
  onDelete: (inventory: InventoryItem) => void;
}

function InventoryItemCard({
  inventory,
  menuItemName,
  stockStatus,
  onEdit,
  onAdjust,
  onHistory,
  onDelete,
}: InventoryItemCardProps) {
  const getUnitDisplay = (unit: InventoryUnit, customUnit?: string): string => {
    return unit === 'custom' && customUnit ? customUnit : unit;
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="font-semibold text-gray-900 text-lg">{menuItemName}</h3>
            <div className={`flex items-center space-x-1 ${stockStatus.color}`}>
              {stockStatus.icon}
              <span className="text-sm font-medium">{stockStatus.status}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Current Stock:</span>
              <p className="font-medium">
                {inventory.currentQuantity} {getUnitDisplay(inventory.unit, inventory.customUnit)}
              </p>
            </div>
            
            <div>
              <span className="text-gray-600">Minimum:</span>
              <p className="font-medium">
                {inventory.minimumThreshold} {getUnitDisplay(inventory.unit, inventory.customUnit)}
              </p>
            </div>
            
            <div>
              <span className="text-gray-600">Per Order:</span>
              <p className="font-medium">
                {inventory.consumptionPerOrder} {getUnitDisplay(inventory.unit, inventory.customUnit)}
              </p>
            </div>
            
            {inventory.supplier && (
              <div>
                <span className="text-gray-600">Supplier:</span>
                <p className="font-medium">{inventory.supplier}</p>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4 mt-3">
            {inventory.isTracked ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <Eye className="w-3 h-3 mr-1" />
                Tracked
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                <EyeOff className="w-3 h-3 mr-1" />
                Not Tracked
              </span>
            )}
            
            {inventory.autoDeduct && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Auto Deduct
              </span>
            )}
            
            {inventory.lastRestockedAt && (
              <span className="text-xs text-gray-500">
                Last restocked: {new Date(inventory.lastRestockedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex space-x-2 ml-4">
          <button
            onClick={() => onHistory(inventory)}
            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg"
            title="View History"
          >
            <History className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onAdjust(inventory)}
            className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg"
            title="Adjust Quantity"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onEdit(inventory)}
            className="p-2 bg-yellow-100 text-yellow-600 hover:bg-yellow-200 rounded-lg"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onDelete(inventory)}
            className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
} 