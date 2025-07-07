import { Edit, Eye, EyeOff, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { MenuItem } from '@/types';

interface MenuItemGridProps {
  items: MenuItem[];
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
}

const MenuItemGrid = ({ items, onEdit, onDelete, onToggleAvailability }: MenuItemGridProps) => (
  <div className="grid grid-cols-2 gap-3">
    {items.map((item) => (
      <div key={item.id} className="bg-white border rounded-lg shadow-sm flex flex-col">
        <button onClick={() => onEdit(item)} className="flex-grow text-left">
          <div className="h-32 bg-gray-100">
             {item.image ? 
               <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-t-lg"/> :
               <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 rounded-t-lg">
                  <Eye size={32} />
               </div>
             }
          </div>
          <div className="p-3 flex-grow">
            <h3 className="text-sm font-semibold text-gray-800 line-clamp-2">{item.name}</h3>
            <p className="text-xs text-gray-500">{item.category}</p>
            <div className="flex justify-between items-center mt-2">
               <p className="text-sm font-bold text-gray-900">{formatCurrency(item.price)}</p>
            </div>
          </div>
        </button>
        <div className="px-2 py-1 border-t bg-gray-50 flex justify-between items-center">
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleAvailability(item); }} 
              className={`p-2 rounded-md hover:bg-gray-200 ${item.isAvailable ? 'text-gray-600' : 'text-green-600'}`}
              aria-label={item.isAvailable ? "Mark as unavailable" : "Mark as available"}
            >
              {item.isAvailable ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {item.isAvailable ? 'Available' : 'Unavailable'}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(item); }} 
              className="p-2 rounded-md hover:bg-gray-200 text-gray-600"
              aria-label="Delete item"
            >
              <Trash2 size={16}/>
            </button>
        </div>
      </div>
    ))}
  </div>
);

export default MenuItemGrid; 