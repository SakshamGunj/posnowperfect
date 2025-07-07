import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Grid,
  List,
  Download,
  Upload,
  Package,
  X
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { MenuService } from '@/services/menuService';
import { MenuItem, Category, MenuItemVariant } from '@/types';
import { formatCurrency } from '@/lib/utils';
import VariantManager from '@/components/restaurant/VariantManager';
import MenuItemTable from '@/components/menu/MenuItemTable';
import MenuItemGrid from '@/components/menu/MenuItemGrid';
import ItemDialog from '@/components/menu/ItemDialog';
import ViewItemDialog from '@/components/menu/ViewItemDialog';
import BulkMenuImport from '@/components/menu/BulkMenuImport';
import MenuExportModal from '@/components/menu/MenuExportModal';


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

export default function MenuManagement() {
  const { restaurant } = useRestaurant();
  
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

  // This will be used for the category form
  const { register: registerCategory, handleSubmit: handleCategorySubmit, reset: resetCategory, setValue: setCategoryValue } = useForm<{ name: string; description: string }>();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);


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

  const handleOpenCategoryModal = (category: Category | null) => {
    setEditingCategory(category);
    if (category) {
      resetCategory({ name: category.name, description: category.description });
    } else {
      resetCategory({ name: '', description: '' });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (data: { name: string; description: string }) => {
    if (!restaurant) return;
    try {
      if (editingCategory) {
        await MenuService.updateCategory(editingCategory.id, restaurant.id, data);
        toast.success('Category updated');
      } else {
        await MenuService.createCategory({
          restaurantId: restaurant.id,
          name: data.name,
          description: data.description || '',
          sortOrder: 0,
          isActive: true
        });
        toast.success('Category created');
      }
      setIsCategoryModalOpen(false);
      loadMenuData();
    } catch (error) {
      toast.error('Failed to save category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!restaurant || !confirm('Are you sure? Deleting a category will not delete its items.')) return;
    try {
      await MenuService.deleteCategory(categoryId, restaurant.id);
      toast.success('Category deleted');
      loadMenuData();
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar for Categories */}
      <aside className="hidden md:flex md:flex-col w-64 border-r border-gray-200 bg-white">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Categories</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="p-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex justify-between items-center ${
                selectedCategory === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>All Items</span>
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{menuItems.length}</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`w-full text-left mt-1 px-3 py-2 rounded-md text-sm font-medium flex justify-between items-center ${
                  selectedCategory === cat.name ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{cat.name}</span>
                 <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{menuItems.filter(i => i.category === cat.name).length}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-2 border-t border-gray-200">
           <button onClick={() => handleOpenCategoryModal(null)} className="w-full btn btn-primary-outline">
            <Plus size={16} className="mr-2"/> New Category
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-x-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-grow">
                <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
                <p className="text-sm text-gray-500">Add, edit, and organize your menu items.</p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => setDialogType('bulk-import')} className="btn btn-secondary justify-center flex-1 sm:flex-initial">
                    <Upload size={16} className="mr-2"/> Bulk Import
                  </button>
                  <button onClick={() => setDialogType('export')} className="btn btn-secondary justify-center flex-1 sm:flex-initial">
                    <Download size={16} className="mr-2"/> Export
                  </button>
                </div>
                <button onClick={handleCreateItem} className="btn btn-primary justify-center py-4">
                  <Plus size={16} className="mr-2"/> Add Item
                </button>
              </div>
            </div>
             {/* Filter and Search Bar */}
            <div className="pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
               <div className="relative w-full sm:max-w-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full bg-gray-100 border-transparent rounded-md pl-10 pr-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                   <div className="flex items-center">
                    <input
                      id="show-available"
                      type="checkbox"
                      checked={showAvailableOnly}
                      onChange={(e) => setShowAvailableOnly(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="show-available" className="ml-2 block text-sm text-gray-900">
                      Available Only
                    </label>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-gray-200 rounded-md">
                      <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'}`}><Grid size={18}/></button>
                      <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}><List size={18}/></button>
                  </div>
                </div>
            </div>
          </div>
        </header>
        
        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredItems.length > 0 ? (
            <>
              <div className="hidden md:block">
                  <MenuItemTable items={filteredItems} onEdit={handleEditItem} onDelete={handleDeleteItem} onToggleAvailability={handleToggleAvailability} />
              </div>
              <div className="block md:hidden">
                  <MenuItemGrid items={filteredItems} onEdit={handleEditItem} onDelete={handleDeleteItem} onToggleAvailability={handleToggleAvailability} />
              </div>
            </>
          ) : (
             <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items found</h3>
                <p className="text-gray-500 mb-4">
                    {searchTerm || selectedCategory !== 'all' || showAvailableOnly
                    ? 'Try adjusting your filters'
                    : 'Get started by adding your first menu item.'
                    }
                </p>
             </div>
          )}
        </div>
      </main>

      {dialogType === 'item' && (
        <ItemDialog
          isOpen={dialogType === 'item'}
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

      {dialogType === 'view' && viewingItem && (
        <ViewItemDialog
          isOpen={dialogType === 'view'}
          onClose={() => setDialogType(null)}
          item={viewingItem}
          onEdit={() => {
            setDialogType(null); // Close view dialog
            setTimeout(() => handleEditItem(viewingItem), 50); // Open edit after a short delay
          }}
        />
      )}

      {dialogType === 'bulk-import' && restaurant && (
        <BulkMenuImport
          isOpen={true}
          onClose={() => setDialogType(null)}
          onSuccess={() => {
            setDialogType(null);
            loadMenuData();
          }}
          restaurantId={restaurant.id}
        />
      )}

      {dialogType === 'export' && (
        <MenuExportModal
          isOpen={true}
          onClose={() => setDialogType(null)}
          items={filteredItems}
        />
      )}
    </div>
  );
} 