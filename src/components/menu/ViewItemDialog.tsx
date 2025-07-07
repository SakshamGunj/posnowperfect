import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { MenuItem } from '@/types';

interface ViewItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem;
  onEdit: () => void;
}

const ViewItemDialog = ({ isOpen, onClose, item, onEdit }: ViewItemDialogProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-screen sm:max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-lg font-semibold">{item.name}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {item.image && <img src={item.image} alt={item.name} className="w-full h-48 object-cover rounded-lg bg-gray-100" />}
          
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">{item.category}</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(item.price)}</p>
            </div>
             <span className={`px-3 py-1 text-sm font-semibold rounded-full ${item.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {item.isAvailable ? 'Available' : 'Unavailable'}
              </span>
          </div>

          {item.description && <p className="text-gray-700">{item.description}</p>}

          {/* Details Section */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Details</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {item.preparationTime && <div><span className="text-gray-500">Prep Time:</span><span className="font-medium ml-2">{item.preparationTime} min</span></div>}
                {item.spiceLevel && <div><span className="text-gray-500">Spice:</span><span className="font-medium ml-2 capitalize">{item.spiceLevel}</span></div>}
                {item.isVegetarian && <div className="flex items-center"><span className="text-green-500 mr-2">✔</span> Vegetarian</div>}
                {item.isVegan && <div className="flex items-center"><span className="text-green-500 mr-2">✔</span> Vegan</div>}
                {item.isGlutenFree && <div className="flex items-center"><span className="text-green-500 mr-2">✔</span> Gluten-Free</div>}
            </div>
          </div>

          {/* Variants Section */}
          {item.variants && item.variants.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Variants</h4>
              <div className="space-y-2">
                {item.variants.map(variant => (
                  <div key={variant.name} className="flex justify-between p-2 bg-gray-50 rounded-md">
                    <span>{variant.name}</span>
                    <span className="font-semibold">{variant.options?.map(opt => opt.name).join(', ') || 'No options'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0 z-10">
          <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
          <button type="button" onClick={onEdit} className="btn btn-primary">Edit Item</button>
        </div>
      </div>
    </div>
  );
};

export default ViewItemDialog; 