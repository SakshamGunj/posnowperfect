import { Edit, Eye, EyeOff, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { MenuItem } from '@/types';

interface MenuItemTableProps {
  items: MenuItem[];
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
}

const MenuItemTable = ({ items, onEdit, onDelete, onToggleAvailability }: MenuItemTableProps) => (
  <div className="bg-white shadow-sm border rounded-lg overflow-hidden">
    <table className="w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {items.map((item) => (
          <tr key={item.id}>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10">
                  <img className="h-10 w-10 rounded-full object-cover" src={item.image || `https://ui-avatars.com/api/?name=${item.name}&background=random`} alt="" />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.category}</div>
                </div>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{formatCurrency(item.price)}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {item.isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button onClick={() => onToggleAvailability(item)} className="p-1.5 rounded-md hover:bg-gray-100 mr-2">{item.isAvailable ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              <button onClick={() => onEdit(item)} className="p-1.5 rounded-md hover:bg-gray-100 mr-2"><Edit size={16}/></button>
              <button onClick={() => onDelete(item)} className="p-1.5 rounded-md hover:bg-gray-100"><Trash2 size={16}/></button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default MenuItemTable; 