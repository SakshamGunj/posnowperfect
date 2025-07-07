import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MenuService } from '@/services/menuService';

interface BulkMenuImportProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    restaurantId: string;
}

const BulkMenuImport = ({ isOpen, onClose, onSuccess, restaurantId }: BulkMenuImportProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !restaurantId) return;
    setIsUploading(true);
    try {
      // TODO: Implement importMenuFromCSV function in MenuService
      // const result = await MenuService.importMenuFromCSV(restaurantId, file);
      
      // Temporary placeholder - show message that feature is not implemented
      toast.error('CSV import feature is not yet implemented. Please add menu items manually.');
      
    } catch (err) {
      toast.error('An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">Bulk Import Menu</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> CSV import feature is currently under development. Please add menu items manually for now.
            </p>
          </div>
          <p className="text-sm text-gray-600">Upload a CSV file to import multiple menu items at once. The file should have columns: `name`, `category`, `price`, `description`.</p>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange} 
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            disabled
          />
          <a href="/menu-import-template.csv" download className="text-sm text-indigo-600 hover:underline">Download CSV Template</a>
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button 
            onClick={handleUpload} 
            disabled={!file || isUploading || true} 
            className="btn btn-primary opacity-50 cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Upload & Import (Coming Soon)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkMenuImport;