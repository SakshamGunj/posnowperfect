import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  Upload,
  Package,
  DollarSign,
  Tag,
  Image as ImageIcon,
  Grid,
  List,
  Download,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { MenuService } from '@/services/menuService';
import { MenuItem, Category, MenuItemVariant } from '@/types';
import { formatCurrency } from '@/lib/utils';
import CategoryManagement from './CategoryManagement';
import VariantManager from '@/components/restaurant/VariantManager';
import BulkMenuImport from '@/components/restaurant/BulkMenuImport';
import MenuExportModal from '@/components/restaurant/MenuExportModal';

interface MenuItemForm {
  name: string;
  description: string;
  category: string;
  price: number;
  image?: string;
  isAvailable: boolean;
  preparationTime?: number;
  allergens?: string[];
  spiceLevel?: 'none' | 'mild' | 'medium' | 'hot' | 'very_hot';
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  tags?: string[];
  variants?: MenuItemVariant[];
}



type ViewMode = 'grid' | 'list';
type DialogType = 'item' | 'category' | 'view' | 'bulk-import' | 'export' | null;
type TabType = 'items' | 'categories';

export default function MenuManagement() {
  const { restaurant } = useRestaurant();
  
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [viewingItem, setViewingItem] = useState<MenuItem | null>(null);

  const { register: registerItem, handleSubmit: handleItemSubmit, reset: resetItem, setValue: setItemValue, watch: watchItem } = useForm<MenuItemForm>();

  // Load data
  useEffect(() => {
    if (restaurant) {
      loadMenuData();
    }
  }, [restaurant]);

  // Filter items based on search and category
  useEffect(() => {
    let filtered = menuItems;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by availability
    if (showAvailableOnly) {
      filtered = filtered.filter(item => item.isAvailable);
    }

    setFilteredItems(filtered);
  }, [menuItems, selectedCategory, searchTerm, showAvailableOnly]);

  const loadMenuData = async () => {
    if (!restaurant) return;

    try {
      setIsLoading(true);

      const [itemsResult, categoriesResult] = await Promise.all([
        MenuService.getMenuItemsForRestaurant(restaurant.id),
        MenuService.getCategoriesForRestaurant(restaurant.id),
      ]);

      if (itemsResult.success && itemsResult.data) {
        setMenuItems(itemsResult.data);
      }

      if (categoriesResult.success && categoriesResult.data) {
        setCategories(categoriesResult.data);
      }
    } catch (error) {
      toast.error('Failed to load menu data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateItem = () => {
    setEditingItem(null);
    resetItem({
      name: '',
      description: '',
      category: categories[0]?.name || '',
      price: 0,
      isAvailable: true,
      preparationTime: 0,
      allergens: [],
      spiceLevel: 'none',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
      tags: [],
      variants: [],
    });
    setDialogType('item');
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemValue('name', item.name);
    setItemValue('description', item.description || '');
    setItemValue('category', item.category);
    setItemValue('price', item.price);
    setItemValue('image', item.image || '');
    setItemValue('isAvailable', item.isAvailable);
    setItemValue('preparationTime', item.preparationTime || 0);
    setItemValue('allergens', item.allergens || []);
    setItemValue('spiceLevel', item.spiceLevel || 'none');
    setItemValue('isVegetarian', item.isVegetarian || false);
    setItemValue('isVegan', item.isVegan || false);
    setItemValue('isGlutenFree', item.isGlutenFree || false);
    setItemValue('tags', item.tags || []);
    setItemValue('variants', item.variants || []);
    setDialogType('item');
  };

  const handleViewItem = (item: MenuItem) => {
    setViewingItem(item);
    setDialogType('view');
  };

  const handleSaveItem = async (data: MenuItemForm) => {
    if (!restaurant) return;

    try {
      if (editingItem) {
        // Update existing item
        const result = await MenuService.updateMenuItem(editingItem.id, restaurant.id, {
          name: data.name,
          description: data.description,
          category: data.category,
          price: data.price,
          image: data.image,
          isAvailable: data.isAvailable,
          preparationTime: data.preparationTime,
          allergens: data.allergens,
          spiceLevel: data.spiceLevel,
          isVegetarian: data.isVegetarian,
          isVegan: data.isVegan,
          isGlutenFree: data.isGlutenFree,
          tags: data.tags,
          variants: data.variants,
        });

        if (result.success) {
          toast.success('Menu item updated successfully');
          await loadMenuData();
        } else {
          toast.error(result.error || 'Failed to update menu item');
        }
      } else {
        // Create new item
        const selectedCategory = categories.find(c => c.name === data.category);
        const result = await MenuService.createMenuItem({
          restaurantId: restaurant.id,
          name: data.name,
          description: data.description,
          category: data.category,
          categoryId: selectedCategory?.id || '',
          categoryName: selectedCategory?.name || data.category,
          price: data.price,
          image: data.image,
          isAvailable: data.isAvailable,
          preparationTime: data.preparationTime,
          allergens: data.allergens,
          spiceLevel: data.spiceLevel,
          isVegetarian: data.isVegetarian,
          isVegan: data.isVegan,
          isGlutenFree: data.isGlutenFree,
          tags: data.tags,
          variants: data.variants
        });

        if (result.success) {
          toast.success('Menu item created successfully');
          await loadMenuData();
        } else {
          toast.error(result.error || 'Failed to create menu item');
        }
      }

      setDialogType(null);
      setEditingItem(null);
    } catch (error) {
      toast.error('Failed to save menu item');
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!restaurant || !confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    try {
      const result = await MenuService.deleteMenuItem(item.id, restaurant.id);
      
      if (result.success) {
        toast.success('Menu item deleted successfully');
        await loadMenuData();
      } else {
        toast.error(result.error || 'Failed to delete menu item');
      }
    } catch (error) {
      toast.error('Failed to delete menu item');
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    if (!restaurant) return;

    try {
      const result = await MenuService.updateMenuItem(item.id, restaurant.id, {
        isAvailable: !item.isAvailable,
      });

      if (result.success) {
        toast.success(`${item.name} ${!item.isAvailable ? 'enabled' : 'disabled'}`);
        await loadMenuData();
      } else {
        toast.error(result.error || 'Failed to update availability');
      }
    } catch (error) {
      toast.error('Failed to update availability');
    }
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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Menu Management</h1>
              <p className="text-gray-600 text-sm sm:text-base">Manage your restaurant's menu items and categories</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-6">
          <div className="card p-3 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <Package className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Total Items</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{menuItems.length}</p>
              </div>
            </div>
          </div>
          
          <div className="card p-3 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                <Eye className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Available</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {menuItems.filter(item => item.isAvailable).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="card p-3 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg">
                <Tag className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Categories</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{categories.length}</p>
              </div>
            </div>
          </div>
          
          <div className="card p-3 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Avg. Price</p>
                <p className="text-sm sm:text-2xl font-bold text-gray-900">
                  {menuItems.length > 0
                    ? formatCurrency(menuItems.reduce((sum, item) => sum + item.price, 0) / menuItems.length)
                    : formatCurrency(0)
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="card mb-4 sm:mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 px-3 sm:px-6">
              <button
                onClick={() => setActiveTab('items')}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm ${
                  activeTab === 'items'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 inline" />
                Menu Items ({menuItems.length})
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm ${
                  activeTab === 'categories'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 inline" />
                Categories ({categories.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'items' && (
          <>
            {/* Filters and Search */}
            <div className="card p-3 sm:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 sm:pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAvailableOnly}
                      onChange={(e) => setShowAvailableOnly(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs sm:text-sm text-gray-700">Available only</span>
                  </label>
                  
                  <div className="flex items-center bg-white rounded-lg border border-gray-200">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                    >
                      <Grid className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                    >
                      <List className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => setDialogType('export')}
                    disabled={menuItems.length === 0}
                    className="btn btn-secondary text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Export Menu</span>
                    <span className="sm:hidden">Export</span>
                  </button>
                  
                  <button
                    onClick={() => setDialogType('bulk-import')}
                    className="btn btn-secondary text-xs sm:text-sm"
                  >
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Bulk Import</span>
                    <span className="sm:hidden">Import</span>
                  </button>
                  
                  <button
                    onClick={handleCreateItem}
                    className="btn btn-theme-primary text-xs sm:text-sm"
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Add Item</span>
                    <span className="sm:hidden">Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600 text-sm sm:text-base">Loading menu items...</p>
              </div>
            ) : (
              <>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                    {filteredItems.map(item => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                        onView={handleViewItem}
                        onToggleAvailability={handleToggleAvailability}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {filteredItems.map(item => (
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                        onView={handleViewItem}
                        onToggleAvailability={handleToggleAvailability}
                      />
                    ))}
                  </div>
                )}
                
                {filteredItems.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No menu items found</h3>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      {searchTerm || selectedCategory !== 'all' || showAvailableOnly
                        ? 'Try adjusting your filters or search terms'
                        : 'Get started by adding your first menu item'
                      }
                    </p>
                    {!searchTerm && selectedCategory === 'all' && !showAvailableOnly && (
                      <button
                        onClick={handleCreateItem}
                        className="btn btn-theme-primary text-sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Menu Item
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'categories' && (
          <CategoryManagement
            categories={categories}
            onCategoriesUpdated={loadMenuData}
          />
        )}
      </main>

      {/* Item Dialog */}
      {dialogType === 'item' && (
        <ItemDialog
          isOpen={true}
          onClose={() => setDialogType(null)}
          onSave={handleSaveItem}
          item={editingItem}
          categories={categories}
          register={registerItem}
          handleSubmit={handleItemSubmit}
          watch={watchItem}
          setValue={setItemValue}
        />
      )}

      {/* View Item Dialog */}
      {dialogType === 'view' && viewingItem && (
        <ViewItemDialog
          isOpen={true}
          onClose={() => setDialogType(null)}
          item={viewingItem}
          onEdit={() => {
            handleEditItem(viewingItem);
            setViewingItem(null);
          }}
        />
      )}

      {/* Bulk Import Dialog */}
      {dialogType === 'bulk-import' && restaurant && (
        <BulkMenuImport
          isOpen={true}
          onClose={() => setDialogType(null)}
          onSuccess={() => {
            setDialogType(null);
            loadMenuData(); // Reload menu data after successful import
          }}
          restaurantId={restaurant.id}
          categories={categories.map(cat => ({ id: cat.id, name: cat.name }))}
        />
      )}

      {/* Export Menu Dialog */}
      {dialogType === 'export' && (
        <MenuExportModal
          isOpen={true}
          onClose={() => setDialogType(null)}
          menuItems={menuItems}
          categories={categories}
          currentCategory={selectedCategory}
          currentSearchTerm={searchTerm}
          showAvailableOnly={showAvailableOnly}
        />
      )}
    </div>
  );
}

// Menu Item Card Component
interface MenuItemCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onView: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
}

function MenuItemCard({ item, onEdit, onDelete, onView, onToggleAvailability }: MenuItemCardProps) {
  const spiceLevel = item.spiceLevel ? getSpiceLevelDisplay(item.spiceLevel) : null;

  return (
    <div className={`card hover:shadow-lg transition-all duration-200 ${!item.isAvailable ? 'opacity-60' : ''}`}>
      <div className="relative">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-32 sm:h-48 object-cover rounded-t-xl"
          />
        ) : (
          <div className="w-full h-32 sm:h-48 bg-gray-200 rounded-t-xl flex items-center justify-center">
            <ImageIcon className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400" />
          </div>
        )}
        
        <div className="absolute top-2 sm:top-3 right-2 sm:right-3">
          <button
            onClick={() => onToggleAvailability(item)}
            className={`p-1.5 sm:p-2 rounded-full ${item.isAvailable ? 'bg-green-600' : 'bg-gray-600'} text-white`}
          >
            {item.isAvailable ? <Eye className="w-3 h-3 sm:w-4 sm:h-4" /> : <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />}
          </button>
        </div>
        
        {!item.isAvailable && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-t-xl flex items-center justify-center">
            <span className="text-white font-medium text-sm">Unavailable</span>
          </div>
        )}
      </div>
      
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-lg truncate pr-2">{item.name}</h3>
          <div className="text-sm sm:text-lg font-bold flex-shrink-0" style={{ color: 'var(--color-primary)' }}>
            {formatCurrency(item.price)}
          </div>
        </div>
        
        <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2">
          {item.description || 'No description provided'}
        </p>
        
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 truncate">
            {item.category}
          </span>
          
          {spiceLevel && (
            <span className="inline-flex items-center text-xs text-gray-600 flex-shrink-0">
              <span className="mr-1">{spiceLevel.icon}</span>
              <span className="hidden sm:inline">{spiceLevel.label}</span>
            </span>
          )}
        </div>
        
        <div className="flex items-center flex-wrap gap-1 mb-3 sm:mb-4">
          {item.isVegetarian && (
            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-100 text-green-800 text-xs rounded">🥬 Veg</span>
          )}
          {item.isVegan && (
            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-100 text-green-800 text-xs rounded">🌱 Vegan</span>
          )}
          {item.isGlutenFree && (
            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-100 text-yellow-800 text-xs rounded">🌾 GF</span>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {/* First Row */}
          <button
            onClick={() => onView(item)}
            className="btn btn-secondary btn-sm text-xs"
          >
            <Eye className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">View</span>
            <span className="sm:hidden">👁</span>
          </button>
          <button
            onClick={() => window.location.href = `/${window.location.pathname.split('/')[1]}/inventory?item=${item.id}`}
            className="btn bg-green-600 text-white hover:bg-green-700 btn-sm text-xs"
            title="Manage Inventory"
          >
            <Package className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Stock</span>
            <span className="sm:hidden">📦</span>
          </button>
          
          {/* Second Row */}
          <button
            onClick={() => onEdit(item)}
            className="btn btn-theme-primary btn-sm text-xs"
          >
            <Edit className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Edit</span>
            <span className="sm:hidden">✏️</span>
          </button>
          <button
            onClick={() => onDelete(item)}
            className="btn bg-red-600 text-white hover:bg-red-700 btn-sm text-xs"
            title="Delete Item"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Delete</span>
            <span className="sm:hidden">🗑️</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Menu Item Row Component (List View)
function MenuItemRow({ item, onEdit, onDelete, onView, onToggleAvailability }: MenuItemCardProps) {
  const spiceLevel = item.spiceLevel ? getSpiceLevelDisplay(item.spiceLevel) : null;

  return (
    <div className={`card p-3 sm:p-4 ${!item.isAvailable ? 'opacity-60' : ''}`}>
      <div className="flex items-center space-x-3 sm:space-x-4">
        <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-4 h-4 sm:w-6 sm:h-6 text-gray-400" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-1">
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{item.name}</h3>
            <div className="flex items-center space-x-2 mt-1 sm:mt-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {item.category}
            </span>
            {spiceLevel && (
              <span className="inline-flex items-center text-xs text-gray-600">
                <span className="mr-1">{spiceLevel.icon}</span>
                  <span className="hidden sm:inline">{spiceLevel.label}</span>
              </span>
            )}
            </div>
          </div>
          
          <p className="text-gray-600 text-xs sm:text-sm mb-2 line-clamp-1 sm:line-clamp-2">
            {item.description || 'No description provided'}
          </p>
          
          <div className="flex items-center space-x-1 sm:space-x-2">
            {item.isVegetarian && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-100 text-green-800 text-xs rounded">🥬 Veg</span>
            )}
            {item.isVegan && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-100 text-green-800 text-xs rounded">🌱 Vegan</span>
            )}
            {item.isGlutenFree && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-100 text-yellow-800 text-xs rounded">🌾 GF</span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="text-right">
            <div className="text-sm sm:text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
              {formatCurrency(item.price)}
            </div>
            <div className={`text-xs sm:text-sm ${item.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
              {item.isAvailable ? 'Available' : 'Unavailable'}
            </div>
          </div>
          
          <div className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => onToggleAvailability(item)}
              className={`p-1.5 sm:p-2 rounded-lg ${item.isAvailable ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {item.isAvailable ? <Eye className="w-3 h-3 sm:w-4 sm:h-4" /> : <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />}
            </button>
            
            <button
              onClick={() => onView(item)}
              className="p-1.5 sm:p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg"
            >
              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            
            <button
              onClick={() => window.location.href = `/${window.location.pathname.split('/')[1]}/inventory?item=${item.id}`}
              className="p-1.5 sm:p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg"
              title="Manage Inventory"
            >
              <Package className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 sm:p-2 bg-yellow-100 text-yellow-600 hover:bg-yellow-200 rounded-lg"
            >
              <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            
            <button
              onClick={() => onDelete(item)}
              className="p-1.5 sm:p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg"
            >
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Item Dialog Component
interface ItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MenuItemForm) => void;
  item: MenuItem | null;
  categories: Category[];
  register: any;
  handleSubmit: any;
  watch: any;
  setValue: any;
}

function ItemDialog({ isOpen, onClose, onSave, item, categories, register, handleSubmit, watch, setValue }: ItemDialogProps) {
  if (!isOpen) return null;

  const variants = watch('variants') || [];

  const handleVariantsChange = (newVariants: MenuItemVariant[]) => {
    setValue('variants', newVariants);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {item ? 'Edit Menu Item' : 'Add Menu Item'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Name *
              </label>
              <input
                {...register('name', { required: 'Item name is required' })}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter item name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                {...register('category', { required: 'Category is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price *
              </label>
              <input
                {...register('price', { 
                  required: 'Price is required',
                  min: { value: 0, message: 'Price must be positive' }
                })}
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preparation Time (minutes)
              </label>
              <input
                {...register('preparationTime')}
                type="number"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe this menu item..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image URL
            </label>
            <input
              {...register('image')}
              type="url"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/image.jpg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Spice Level
            </label>
            <select
              {...register('spiceLevel')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="none">🟢 No Spice</option>
              <option value="mild">🟡 Mild</option>
              <option value="medium">🟠 Medium</option>
              <option value="hot">🔴 Hot</option>
              <option value="very_hot">🌶️ Very Hot</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                {...register('isAvailable')}
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Available</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                {...register('isVegetarian')}
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">🥬 Vegetarian</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                {...register('isVegan')}
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">🌱 Vegan</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                {...register('isGlutenFree')}
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">🌾 Gluten Free</span>
            </label>
          </div>
          
          {/* Variants Section */}
          <div className="border-t pt-6">
            <VariantManager
              variants={variants}
              onChange={handleVariantsChange}
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4 mr-2 inline" />
              {item ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// View Item Dialog Component
interface ViewItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem;
  onEdit: () => void;
}

function ViewItemDialog({ isOpen, onClose, item, onEdit }: ViewItemDialogProps) {
  if (!isOpen) return null;

  const spiceLevel = item.spiceLevel ? getSpiceLevelDisplay(item.spiceLevel) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">{item.name}</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {item.image && (
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-64 object-cover rounded-lg mb-6"
            />
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Basic Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-medium">{formatCurrency(item.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <span className="font-medium">{item.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${item.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {item.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                {item.preparationTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Prep Time:</span>
                    <span className="font-medium">{item.preparationTime} min</span>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Dietary Information</h3>
              <div className="flex flex-wrap gap-2">
                {item.isVegetarian && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">🥬 Vegetarian</span>
                )}
                {item.isVegan && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">🌱 Vegan</span>
                )}
                {item.isGlutenFree && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">🌾 Gluten Free</span>
                )}
                {spiceLevel && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                    {spiceLevel.icon} {spiceLevel.label}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {item.description && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600">{item.description}</p>
            </div>
          )}
          
          {item.allergens && item.allergens.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Allergens</h3>
              <div className="flex flex-wrap gap-2">
                {item.allergens.map((allergen, index) => (
                  <span key={index} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                    {allergen}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {item.variants && item.variants.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Available Variants</h3>
              <div className="space-y-3">
                {item.variants.map((variant) => (
                  <div key={variant.id} className="border border-gray-200 rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">
                      {variant.name}
                      {variant.required && <span className="text-red-500 ml-1">*</span>}
                      <span className="text-xs text-gray-500 ml-2">
                        ({variant.type === 'single' ? 'Single Choice' : 'Multiple Choice'})
                      </span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {variant.options.map((option) => (
                        <div key={option.id} className="flex justify-between items-center text-sm">
                          <span className="text-gray-700">
                            {option.name}
                            {option.isDefault && variant.type === 'single' && (
                              <span className="text-blue-600 ml-1">(Default)</span>
                            )}
                          </span>
                          <div className="flex flex-col items-end">
                          <span className="text-gray-600">
                              {option.pricingType === 'standalone' ? '' : option.priceModifier > 0 && '+'}
                            {option.priceModifier !== 0 && formatCurrency(option.priceModifier)}
                          </span>
                            <span className="text-xs text-gray-500">
                              {option.pricingType === 'standalone' ? 'Standalone' : 'Additive'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onEdit}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4 mr-2 inline" />
              Edit Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function for spice level display
function getSpiceLevelDisplay(level?: string) {
  const levels = {
    none: { label: 'No Spice', icon: '🟢' },
    mild: { label: 'Mild', icon: '🟡' },
    medium: { label: 'Medium', icon: '🟠' },
    hot: { label: 'Hot', icon: '🔴' },
    very_hot: { label: 'Very Hot', icon: '🌶️' },
  };
  return levels[level as keyof typeof levels] || levels.none;
} 