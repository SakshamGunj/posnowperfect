import React, { useEffect } from 'react';
import { Printer, X, CheckCircle } from 'lucide-react';

interface VoiceKOTDialogProps {
  isVisible: boolean;
  onClose: () => void;
  onPrintKOT: () => void;
  orderDetails?: {
    orderNumber: string;
    tableNumber: string;
    items: Array<{ name: string; quantity: number }>;
  } | null;
}

export const VoiceKOTDialog: React.FC<VoiceKOTDialogProps> = ({
  isVisible,
  onClose,
  onPrintKOT,
  orderDetails
}) => {
  // Automatically trigger KOT print when dialog opens
  useEffect(() => {
    if (isVisible && orderDetails) {
      // Auto-print KOT immediately and close dialog
      const printTimer = setTimeout(() => {
        onPrintKOT();
        // Close the dialog immediately after triggering print
        setTimeout(() => {
          onClose();
        }, 100);
      }, 300);

      return () => clearTimeout(printTimer);
    }
  }, [isVisible, orderDetails, onPrintKOT, onClose]);

  if (!isVisible) return null;

  const handlePrint = () => {
    onPrintKOT();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Order Placed!</h3>
                <p className="text-sm text-green-100">Voice command completed</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {orderDetails && (
            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Order Number</span>
                  <span className="font-bold text-gray-900">{orderDetails.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Table</span>
                  <span className="font-bold text-gray-900">{orderDetails.tableNumber}</span>
                </div>
                <div className="border-t pt-3">
                  <span className="text-sm font-medium text-gray-600 block mb-2">Items Ordered</span>
                  <div className="space-y-1">
                    {orderDetails.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-gray-900 font-medium">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Message */}
          <div className="text-center mb-6">
            <p className="text-gray-700 mb-2">
              Your order has been placed successfully via voice command.
            </p>
            <p className="text-sm text-green-600 font-medium">
              🖨️ KOT is being sent to kitchen automatically...
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Skip
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
              autoFocus
            >
              <Printer className="w-4 h-4" />
              <span>Print KOT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 