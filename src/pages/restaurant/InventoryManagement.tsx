import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  BarChart3,
  History,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  PackagePlus,
  PackageCheck,
  PackageX,
  FileDown,
} from 'lucide-react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { InventoryService } from '@/services/inventoryService';
import { MenuItem, InventoryItem, InventoryTransaction, InventoryUnit, Category } from '@/types';
import { InventoryDialog, AdjustmentDialog, HistoryDialog } from '@/components/inventory/InventoryDialogs';
import { cn } from '@/lib/utils';
import { MenuService } from '@/services/menuService';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { InventoryGrid } from '@/components/inventory/InventoryGrid';

type FilterStatus = 'all' | 'tracked' | 'low_stock' | 'out_of_stock';

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [matches, query]);

  return matches;
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  color: { bg: string; text: string; };
}

const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => (
  <div className="bg-white p-4 rounded-lg shadow-sm flex items-center flex-shrink-0 w-64 sm:w-auto">
    <div className={`p-3 rounded-full mr-4 ${color.bg} ${color.text}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);

export default function InventoryManagement() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  
  const [dialogType, setDialogType] = useState<'create' | 'edit' | 'adjust' | 'history' | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<InventoryTransaction[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const { register: registerAdjust, handleSubmit: handleAdjustSubmit, reset: resetAdjust, setValue: setAdjustValue, watch: watchAdjust } = useForm();

  useEffect(() => {
    if (restaurant) {
      loadData();
    }
  }, [restaurant]);

  useEffect(() => {
    filterInventoryItems();
  }, [inventoryItems, searchTerm, filterStatus]);

  const loadData = async () => {
    if (!restaurant) return;
    setIsLoading(true);
    try {
      const [menuResult, inventoryResult] = await Promise.all([
        MenuService.getMenuItemsForRestaurant(restaurant.id),
        InventoryService.getInventoryForRestaurant(restaurant.id),
      ]);
      if (menuResult.success && menuResult.data) setMenuItems(menuResult.data);
      if (inventoryResult.success && inventoryResult.data) setInventoryItems(inventoryResult.data);
    } catch (error) {
      toast.error('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  const filterInventoryItems = () => {
    let filtered = inventoryItems;

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        const itemName = menuItem?.name || item.displayName || item.standaloneItemName || '';
        return itemName.toLowerCase().includes(lowercasedTerm);
      });
    }

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
  
  const stats = useMemo(() => ({
    totalItems: inventoryItems.length,
    lowStock: inventoryItems.filter(item => item.isTracked && item.currentQuantity <= item.minimumThreshold).length,
    outOfStock: inventoryItems.filter(item => item.isTracked && item.currentQuantity === 0).length,
  }), [inventoryItems]);

  const handleCreateItem = () => {
    setSelectedInventory(null);
    setDialogType('create');
    reset({ isTracked: true, autoDeduct: true, consumptionPerOrder: 1 });
  };
  
  const handleEditItem = (inventory: InventoryItem) => {
    setSelectedInventory(inventory);
    setDialogType('edit');
    reset(inventory);
  };
  
  const handleAdjustStock = (inventory: InventoryItem) => {
    setSelectedInventory(inventory);
    setDialogType('adjust');
    resetAdjust({ type: 'restock' });
  };
  
  const handleViewHistory = async (
    inventory: InventoryItem,
    filters?: {
      dateRange?: { from: Date; to: Date };
      type?: 'all' | 'order_deduction' | 'adjustment';
    }
  ) => {
    if (!restaurant) return;
    setSelectedInventory(inventory);
    setDialogType('history');
    setIsSubmitting(true);
    try {
      const history = await InventoryService.getTransactionHistory(inventory.id, restaurant.id, filters);
      setTransactionHistory(history.success && history.data ? history.data : []);
    } catch {
      toast.error('Failed to load transaction history.');
      setTransactionHistory([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveInventory = async (data: any) => {
    if (!restaurant || !user) return;
    setIsSubmitting(true);
    
    const promise = selectedInventory
      ? InventoryService.updateInventoryItem(selectedInventory.id, restaurant.id, data, user.id)
      : InventoryService.createInventoryItem({ ...data, restaurantId: restaurant.id }, user.id);
      
    toast.promise(promise, {
      loading: `${selectedInventory ? 'Updating' : 'Creating'} item...`,
      success: (res) => {
        if (!res.success) throw new Error(res.error);
        loadData();
        setDialogType(null);
        return `Item ${selectedInventory ? 'updated' : 'created'} successfully!`;
      },
      error: (err) => `Error: ${err.message}`,
    }).finally(() => setIsSubmitting(false));
  };
  
  const handleAdjustQuantity = async (data: any) => {
    if (!restaurant || !selectedInventory || !user) return;
    setIsSubmitting(true);
    
    // The 'quantity' from the form can mean different things based on 'type'
    let newQuantity = 0;
    const currentQuantity = selectedInventory.currentQuantity;
    const formQuantity = data.quantity;

    if (data.type === 'correction') {
        newQuantity = formQuantity;
    } else if (data.type === 'restock') {
        newQuantity = currentQuantity + formQuantity;
    } else if (data.type === 'waste') {
        newQuantity = currentQuantity - formQuantity;
    }

    const promise = InventoryService.adjustInventoryQuantity(
      selectedInventory.id,
      restaurant.id,
      newQuantity,
      data.type,
      user.id, // staffId
      data.notes, // reason
      data.notes  // notes
    );
    
    toast.promise(promise, {
      loading: 'Adjusting stock...',
      success: (res) => {
        if (!res.success) throw new Error(res.error);
        loadData();
        setDialogType(null);
        return 'Stock adjusted successfully!';
      },
      error: (err) => `Error: ${err.message}`,
    }).finally(() => setIsSubmitting(false));
  };
  
  const handleDeleteInventory = async (inventoryId: string) => {
    if (!restaurant) return;
    if (!window.confirm("Are you sure you want to delete this inventory item? This action cannot be undone.")) return;

    const promise = InventoryService.deleteInventoryItem(restaurant.id, inventoryId);
    toast.promise(promise, {
      loading: 'Deleting item...',
      success: (res) => {
        if (!res.success) throw new Error(res.error);
        loadData();
        return 'Item deleted successfully!';
      },
      error: (err) => `Error: ${err.message}`,
    });
  };

  const getDisplayName = (item: InventoryItem): string => {
    if (item.isStandaloneItem || item.menuItemId?.startsWith('standalone_')) {
      return item.displayName || item.standaloneItemName || 'Unnamed Item';
    }
    const menuItem = menuItems.find(m => m.id === item.menuItemId);
    return menuItem?.name || 'Unknown Item';
  };

  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isLoading) {
    return <div className="p-8">Loading inventory...</div>;
  }
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
              <p className="text-md text-gray-500 mt-1">Track and manage your stock levels.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => {}} className="btn btn-secondary w-full sm:w-auto">
                <FileDown size={16} className="mr-2" /> Export
              </button>
              <button onClick={handleCreateItem} className="btn btn-primary w-full sm:w-auto">
                <Plus size={16} className="mr-2" /> Add New Item
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex overflow-x-auto space-x-4 pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4 sm:space-x-0 sm:pb-0 mb-6">
          <StatCard title="Total Items" value={stats.totalItems} icon={Package} color={{ bg: 'bg-blue-100', text: 'text-blue-600' }}/>
          <StatCard title="Low Stock" value={stats.lowStock} icon={TrendingDown} color={{ bg: 'bg-yellow-100', text: 'text-yellow-600' }}/>
          <StatCard title="Out of Stock" value={stats.outOfStock} icon={PackageX} color={{ bg: 'bg-red-100', text: 'text-red-600' }}/>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search items by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value as FilterStatus)}
                className="w-full sm:w-auto px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Items</option>
                <option value="tracked">Tracked</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>
        </div>

        {/* Placeholder for Inventory List/Grid */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h2 className="text-xl font-bold mb-4">Inventory Items ({filteredInventory.length})</h2>
          {isDesktop ? (
            <InventoryTable 
              items={filteredInventory}
              menuItems={menuItems}
              onEdit={handleEditItem}
              onDelete={handleDeleteInventory}
              onAdjust={handleAdjustStock}
              onHistory={handleViewHistory}
            />
          ) : (
            <InventoryGrid
              items={filteredInventory}
              menuItems={menuItems}
              onEdit={handleEditItem}
              onDelete={handleDeleteInventory}
              onAdjust={handleAdjustStock}
              onHistory={handleViewHistory}
            />
          )}
        </div>

      </div>

      {dialogType === 'create' && (
        <InventoryDialog
          isOpen={dialogType === 'create'}
          onClose={() => setDialogType(null)}
          onSave={handleSaveInventory}
          inventory={null}
          menuItems={menuItems}
          existingInventory={inventoryItems}
          register={register}
          handleSubmit={handleSubmit}
          setValue={setValue}
          selectedUnit={watch('unit')}
          isSubmitting={isSubmitting}
        />
      )}
      
      {dialogType === 'edit' && selectedInventory && (
         <InventoryDialog
          isOpen={dialogType === 'edit'}
          onClose={() => setDialogType(null)}
          onSave={handleSaveInventory}
          inventory={selectedInventory}
          menuItems={menuItems}
          existingInventory={inventoryItems}
          register={register}
          handleSubmit={handleSubmit}
          setValue={setValue}
          selectedUnit={watch('unit')}
          isSubmitting={isSubmitting}
        />
      )}
      
      {dialogType === 'adjust' && selectedInventory && (
        <AdjustmentDialog
          isOpen={dialogType === 'adjust'}
          onClose={() => setDialogType(null)}
          onSave={handleAdjustQuantity}
          inventory={selectedInventory}
          menuItemName={getDisplayName(selectedInventory)}
          register={registerAdjust}
          handleSubmit={handleAdjustSubmit}
          setValue={setAdjustValue}
          watch={watchAdjust}
          isSubmitting={isSubmitting}
        />
      )}
      
      {dialogType === 'history' && selectedInventory && (
        <HistoryDialog
          isOpen={dialogType === 'history'}
          onClose={() => setDialogType(null)}
          inventory={selectedInventory}
          menuItemName={getDisplayName(selectedInventory)}
          transactions={transactionHistory}
          onRefreshTransactions={(filters: any) => handleViewHistory(selectedInventory, filters)}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
} 