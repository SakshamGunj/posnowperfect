import { useState } from 'react';
import { InventoryItem, MenuItem } from "@/types";
import { MoreVertical, Edit, Trash2, History, BarChart3 } from "lucide-react";

interface InventoryGridProps {
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
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0">
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

export const InventoryGrid = ({ items, menuItems, onEdit, onDelete, onAdjust, onHistory }: InventoryGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map((item) => {
        const status = getStockStatus(item);
        const itemName = getDisplayName(item, menuItems);

        return (
          <div key={item.id} className="bg-white rounded-lg shadow-sm border p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <div className="flex-grow">
                  <h3 className="font-bold text-gray-900 pr-2">{itemName}</h3>
                </div>
                <ActionsMenu item={item} onEdit={onEdit} onDelete={onDelete} onAdjust={onAdjust} onHistory={onHistory} />
              </div>
              <span className={`mt-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.color}`}>
                {status.text}
              </span>
               <div className="mt-4 text-sm">
                <span className="font-medium text-gray-800">{item.currentQuantity}</span>
                <span className="text-gray-500"> / {item.minimumThreshold} {getUnitLabel(item.unit, item.customUnit)}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => onAdjust(item)} className="btn btn-secondary btn-sm text-xs justify-center">Adjust</button>
              <button onClick={() => onEdit(item)} className="btn btn-secondary btn-sm text-xs justify-center">Edit</button>
              <button onClick={() => onHistory(item)} className="btn btn-secondary btn-sm text-xs justify-center">History</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}; 