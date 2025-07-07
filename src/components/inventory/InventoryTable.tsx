import { useState } from 'react';
import { InventoryItem, MenuItem } from "@/types";
import { MoreVertical, Edit, Trash2, History, BarChart3 } from "lucide-react";

interface InventoryTableProps {
  items: InventoryItem[];
  menuItems: MenuItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onAdjust: (item: InventoryItem) => void;
  onHistory: (item: InventoryItem) => void;
}

const getStockStatus = (item: InventoryItem) => {
  if (!item.isTracked) {
    return { text: "Not Tracked", color: "bg-gray-200 text-gray-700" };
  }
  if (item.currentQuantity <= 0) {
    return { text: "Out of Stock", color: "bg-red-100 text-red-700" };
  }
  if (item.currentQuantity <= item.minimumThreshold) {
    return { text: "Low Stock", color: "bg-yellow-100 text-yellow-700" };
  }
  return { text: "In Stock", color: "bg-green-100 text-green-700" };
};

const getDisplayName = (item: InventoryItem, menuItems: MenuItem[]) => {
  if (item.isStandaloneItem || item.menuItemId?.startsWith('standalone_')) {
    return item.displayName || item.standaloneItemName || 'Standalone Item';
  }
  const menuItem = menuItems.find(m => m.id === item.menuItemId);
  return menuItem?.name || 'Unknown Item';
};

const getUnitLabel = (unit: string, customUnit?: string) => {
    if (unit === 'custom' && customUnit) return customUnit;
    return unit.charAt(0).toUpperCase() + unit.slice(1);
}

const ActionsMenu = ({ item, onEdit, onDelete, onAdjust, onHistory }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full hover:bg-gray-100">
                <MoreVertical className="h-5 w-5" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                    <button onClick={() => { onAdjust(item); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                        <BarChart3 className="mr-2 h-4 w-4" />Adjust Stock
                    </button>
                    <button onClick={() => { onHistory(item); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                        <History className="mr-2 h-4 w-4" />View History
                    </button>
                    <button onClick={() => { onEdit(item); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                        <Edit className="mr-2 h-4 w-4" />Edit Item
                    </button>
                    <button onClick={() => { onDelete(item.id); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center">
                        <Trash2 className="mr-2 h-4 w-4" />Delete
                    </button>
                </div>
            )}
        </div>
    )
}

export const InventoryTable = ({ items, menuItems, onEdit, onDelete, onAdjust, onHistory }: InventoryTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Level</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item) => {
            const status = getStockStatus(item);
            const itemName = getDisplayName(item, menuItems);
            
            return (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{itemName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.color}`}>
                    {status.text}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{item.currentQuantity} / {item.minimumThreshold} {getUnitLabel(item.unit, item.customUnit)}</div>
                  <div className="text-xs text-gray-500">Current / Threshold</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.costPerUnit ? `$${item.costPerUnit.toFixed(2)} per ${getUnitLabel(item.unit, item.customUnit)}` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.supplier || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                   <ActionsMenu item={item} onEdit={onEdit} onDelete={onDelete} onAdjust={onAdjust} onHistory={onHistory} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );
}; 