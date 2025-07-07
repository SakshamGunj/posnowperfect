import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MenuItem } from '@/types';

interface MenuExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: MenuItem[];
}

const MenuExportModal = ({ isOpen, onClose, items }: MenuExportModalProps) => {
    const handleExport = () => {
        if(!items || items.length === 0) {
            toast.error("No items to export.");
            return;
        }
        const csvContent = "data:text/csv;charset=utf-8," 
            + "Name,Category,Price,Description,IsAvailable\n"
            + items.map(e => `"${e.name}","${e.category}",${e.price},"${e.description || ''}",${e.isAvailable}`).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "menu_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Menu exported successfully!");
        onClose();
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Export Menu</h3>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={20} /></button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600">This will export the currently filtered {items.length} menu items to a CSV file.</p>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
              <button onClick={onClose} className="btn btn-secondary">Cancel</button>
              <button onClick={handleExport} className="btn btn-primary">Export Items</button>
            </div>
          </div>
        </div>
    )
}

export default MenuExportModal; 