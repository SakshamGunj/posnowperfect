import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { MenuItem, Category, MenuItemVariant } from '@/types';
import VariantManager from '@/components/restaurant/VariantManager';

interface ItemDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    item: MenuItem | null;
    categories: Category[];
    register: any;
    handleSubmit: any;
    watch: any;
    setValue: any;
}

const ItemDialog = ({ isOpen, onClose, onSave, item, categories, register, handleSubmit, watch, setValue }: ItemDialogProps) => {
  const watchedVariants = watch('variants', item?.variants || []);

  const handleVariantsChange = (newVariants: MenuItemVariant[]) => {
    setValue('variants', newVariants);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-lg font-semibold">{item ? 'Edit Item' : 'Create New Item'}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSave)} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Name *</label>
                      <input {...register('name', { required: true })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 px-3 py-2" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Category *</label>
                      <select {...register('category', { required: true })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 px-3 py-2">
                          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                  </div>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea {...register('description')} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 px-3 py-2"></textarea>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Price *</label>
                      <input {...register('price', { required: true, valueAsNumber: true })} type="number" step="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 px-3 py-2" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Preparation Time (minutes)</label>
                      <input {...register('preparationTime', { valueAsNumber: true })} type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 px-3 py-2" />
                  </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Image URL</label>
                <input {...register('image')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 px-3 py-2" />
              </div>

              {/* Dietary Flags */}
              <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Dietary Information</h4>
                  <div className="flex flex-wrap gap-4">
                      <label className="flex items-center"><input type="checkbox" {...register('isAvailable')} className="mr-2 h-4 w-4 rounded border-gray-300"/>Available</label>
                      <label className="flex items-center"><input type="checkbox" {...register('isVegetarian')} className="mr-2 h-4 w-4 rounded border-gray-300"/>Vegetarian</label>
                      <label className="flex items-center"><input type="checkbox" {...register('isVegan')} className="mr-2 h-4 w-4 rounded border-gray-300"/>Vegan</label>
                      <label className="flex items-center"><input type="checkbox" {...register('isGlutenFree')} className="mr-2 h-4 w-4 rounded border-gray-300"/>Gluten-Free</label>
                  </div>
              </div>
            
              {/* Variant Manager */}
              <VariantManager
                variants={watchedVariants}
                onChange={handleVariantsChange}
              />
          </div>

          <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0 z-10">
              <button type="button" onClick={onClose} className="btn btn-secondary py-3">Cancel</button>
              <button type="submit" className="btn btn-primary py-3">{item ? 'Update Item' : 'Create Item'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemDialog; 