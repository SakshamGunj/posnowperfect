import React from 'react';
import { Mic, Clock, CheckCircle } from 'lucide-react';

interface VoiceLoadingOverlayProps {
  isVisible: boolean;
  stage: 'processing' | 'placing' | 'completed';
  message?: string;
}

export const VoiceLoadingOverlay: React.FC<VoiceLoadingOverlayProps> = ({
  isVisible,
  stage,
  message
}) => {
  if (!isVisible) return null;

  const getStageInfo = () => {
    switch (stage) {
      case 'processing':
        return {
          icon: <Mic className="w-8 h-8 text-blue-500 animate-pulse" />,
          title: 'Processing Voice Command',
          description: message || 'Analyzing your order...',
          bgColor: 'from-blue-50 to-blue-100',
          borderColor: 'border-blue-200'
        };
      case 'placing':
        return {
          icon: <Clock className="w-8 h-8 text-orange-500 animate-spin" />,
          title: 'Placing Order',
          description: message || 'Adding items and creating order...',
          bgColor: 'from-orange-50 to-orange-100',
          borderColor: 'border-orange-200'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-8 h-8 text-green-500" />,
          title: 'Order Placed Successfully',
          description: message || 'Preparing KOT...',
          bgColor: 'from-green-50 to-green-100',
          borderColor: 'border-green-200'
        };
    }
  };

  const stageInfo = getStageInfo();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className={`bg-gradient-to-br ${stageInfo.bgColor} ${stageInfo.borderColor} border-2 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl`}>
        <div className="text-center space-y-6">
          {/* Voice Wave Animation */}
          <div className="relative">
            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center shadow-lg">
              {stageInfo.icon}
            </div>
            
            {/* Pulsing rings for processing/placing states */}
            {(stage === 'processing' || stage === 'placing') && (
              <>
                <div className="absolute inset-0 w-20 h-20 mx-auto border-4 border-blue-200 rounded-full animate-ping opacity-20"></div>
                <div className="absolute inset-0 w-20 h-20 mx-auto border-4 border-blue-300 rounded-full animate-ping opacity-30 animation-delay-300"></div>
              </>
            )}
          </div>
          
          {/* Content */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-gray-800">
              {stageInfo.title}
            </h3>
            <p className="text-gray-600 font-medium">
              {stageInfo.description}
            </p>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                stage === 'processing' ? 'w-1/3 bg-blue-500' :
                stage === 'placing' ? 'w-2/3 bg-orange-500' :
                'w-full bg-green-500'
              }`}
            />
          </div>
          
          {/* Voice indicator dots */}
          {stage === 'processing' && (
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce animation-delay-150"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce animation-delay-300"></div>
            </div>
          )}
        </div>
      </div>
      
      {/* Custom CSS for animation delays */}
      <style>{`
        .animation-delay-150 { animation-delay: 150ms; }
        .animation-delay-300 { animation-delay: 300ms; }
      `}</style>
    </div>
  );
}; 