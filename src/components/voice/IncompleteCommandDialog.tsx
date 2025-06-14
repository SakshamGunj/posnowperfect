import React from 'react';
import { X, Mic } from 'lucide-react';
import { IncompleteCommandContext } from '@/services/voiceService';

interface IncompleteCommandDialogProps {
  isVisible: boolean;
  context?: IncompleteCommandContext;
  onClose: () => void;
  onRetryVoice?: () => void;
}

export const IncompleteCommandDialog: React.FC<IncompleteCommandDialogProps> = ({
  isVisible,
  context,
  onClose,
  onRetryVoice
}) => {
  if (!isVisible || !context) return null;

  // Generate contextual examples based on missing fields
  const generateExamples = (): string[] => {
    const command = context.command;
    const missingFields = context.missingFields;

    if (missingFields.includes('tableNumber')) {
      if (command.type === 'KOT_PRINT') {
        return ['"Table 5"', '"5"', '"Table number 3"'];
      } else if (command.type === 'PLACE_ORDER') {
        return ['"Table 2"', '"2"', '"Table number 7"'];
      } else if (command.type === 'PAYMENT') {
        return ['"Table 4"', '"4"', '"Table number 1"'];
      } else {
        return ['"Table 3"', '"3"', '"Table number 6"'];
      }
    }

    if (!command.type || command.type === 'UNKNOWN') {
      if (command.tableNumber) {
        return ['"KOT"', '"Order"', '"Payment"'];
      } else {
        return ['"KOT"', '"Order"', '"Payment"'];
      }
    }

    if (missingFields.includes('paymentMethod')) {
      return ['"UPI"', '"Cash"', '"Bank"'];
    }

    if (missingFields.includes('customerName')) {
      return ['"John Smith"', '"Sarah Wilson"', '"Customer name"'];
    }

    if (missingFields.includes('targetTableNumber')) {
      return ['"Table 8"', '"8"', '"Table number 10"'];
    }

    if (missingFields.includes('menuItems')) {
      return ['"Chicken wings"', '"2 burgers"', '"Pizza margherita"'];
    }

    return ['"Continue"', '"Complete"', '"Finish"'];
  };

  const examples = generateExamples();

  return (
    <div className="fixed bottom-36 right-4 z-50 max-w-sm sm:right-6">
      <div className="bg-white border-2 border-orange-200 rounded-lg shadow-xl p-4 animate-in slide-in-from-bottom-4 fade-in duration-300 mx-2 sm:mx-0 relative backdrop-blur-sm">
        {/* Small arrow pointing down to mic */}
        <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r-2 border-b-2 border-orange-200 transform rotate-45 sm:right-8"></div>
        
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-orange-700">Voice Command Incomplete</span>
            </div>
            
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              {context.contextualMessage}
            </p>

            <div className="bg-gray-50 rounded-md p-3 mb-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Examples:</p>
              <div className="space-y-1">
                {examples.map((example, index) => (
                  <div key={index} className="text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded border">
                    {example}
                  </div>
                ))}
              </div>
            </div>

                         {onRetryVoice && (
               <button
                 onClick={onRetryVoice}
                 className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2.5 px-3 rounded-md transition-all duration-200 hover:shadow-md active:scale-95"
               >
                 <Mic className="w-4 h-4 animate-pulse" />
                 Press to continue
               </button>
             )}
          </div>
          
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}; 