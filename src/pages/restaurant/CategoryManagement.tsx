import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Tag,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { MenuService } from '@/services/menuService';
import { Category } from '@/types';

interface CategoryForm {
  name: string;
  description?: string;
  isActive: boolean;
}

interface CategoryManagementProps {
  categories: Category[];
  onCategoriesUpdated: () => void;
}

export default function CategoryManagement({ categories, onCategoriesUpdated }: CategoryManagementProps) {
  const { restaurant } = useRestaurant();
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm<CategoryForm>();

  const handleCreateCategory = () => {
    setEditingCategory(null);
    reset({
      name: '',
      description: '',
      isActive: true,
    });
    setShowDialog(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setValue('name', category.name);
    setValue('description', category.description || '');
    setValue('isActive', category.isActive);
    setShowDialog(true);
  };

  const handleSaveCategory = async (data: CategoryForm) => {
    if (!restaurant) return;

    try {
      setIsLoading(true);

      if (editingCategory) {
        // Update existing category
        const result = await MenuService.updateCategory(editingCategory.id, restaurant.id, {
          name: data.name,
          description: data.description,
          isActive: data.isActive,
        });

        if (result.success) {
          toast.success('Category updated successfully');
          onCategoriesUpdated();
        } else {
          toast.error(result.error || 'Failed to update category');
        }
      } else {
        // Create new category
        const result = await MenuService.createCategory({
          restaurantId: restaurant.id,
          name: data.name,
          description: data.description,
          sortOrder: categories.length,
          isActive: data.isActive,
        });

        if (result.success) {
          toast.success('Category created successfully');
          onCategoriesUpdated();
        } else {
          toast.error(result.error || 'Failed to create category');
        }
      }

      setShowDialog(false);
      setEditingCategory(null);
    } catch (error) {
      toast.error('Failed to save category');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!restaurant || !confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    try {
      const result = await MenuService.deleteCategory(category.id, restaurant.id);
      
      if (result.success) {
        toast.success('Category deleted successfully');
        onCategoriesUpdated();
      } else {
        toast.error(result.error || 'Failed to delete category');
      }
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const handleToggleActive = async (category: Category) => {
    if (!restaurant) return;

    try {
      const result = await MenuService.updateCategory(category.id, restaurant.id, {
        isActive: !category.isActive,
      });

      if (result.success) {
        toast.success(`Category ${!category.isActive ? 'enabled' : 'disabled'}`);
        onCategoriesUpdated();
      } else {
        toast.error(result.error || 'Failed to update category');
      }
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  const handleReorderCategory = async (category: Category, direction: 'up' | 'down') => {
    if (!restaurant) return;

    const currentIndex = categories.findIndex(c => c.id === category.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= categories.length) return;

    try {
      // Update both categories' sortOrder
      const updates = [
        MenuService.updateCategory(category.id, restaurant.id, { sortOrder: newIndex }),
        MenuService.updateCategory(categories[newIndex].id, restaurant.id, { sortOrder: currentIndex }),
      ];

      await Promise.all(updates);
      
      toast.success('Category order updated');
      onCategoriesUpdated();
    } catch (error) {
      toast.error('Failed to reorder categories');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
          <p className="text-sm text-gray-600">Organize your menu into categories</p>
        </div>
        
        <button
          onClick={handleCreateCategory}
          className="btn btn-theme-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </button>
      </div>

      {/* Categories List */}
      <div className="space-y-3">
        {categories.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h3>
            <p className="text-gray-600 mb-4">Create your first category to organize your menu</p>
            <button
              onClick={handleCreateCategory}
              className="btn btn-theme-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Category
            </button>
          </div>
        ) : (
          categories.map((category, index) => (
            <div
              key={category.id}
              className={`card p-4 ${!category.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => handleReorderCategory(category, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleReorderCategory(category, 'down')}
                      disabled={index === categories.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                    {category.description && (
                      <p className="text-sm text-gray-600">{category.description}</p>
                    )}
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-gray-500">
                        Order: {category.sortOrder}
                      </span>
                      <span className={`text-xs ${category.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleActive(category)}
                    className={`p-2 rounded-lg ${category.isActive ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {category.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Category Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h2>
                <button
                  onClick={() => setShowDialog(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit(handleSaveCategory)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name *
                </label>
                <input
                  {...register('name', { required: 'Category name is required' })}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter category name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe this category (optional)"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  {...register('isActive')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Active (visible in menu)
                </label>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDialog(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2 inline" />
                      {editingCategory ? 'Update Category' : 'Create Category'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 