// Removed React import since it's not needed in React 18+ with automatic JSX runtime
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({ 
  message = 'Loading...', 
  fullScreen = true 
}: LoadingScreenProps) {
  const containerClasses = fullScreen 
    ? 'fixed inset-0 z-50 bg-gradient-to-br from-blue-50 to-blue-100'
    : 'w-full h-32';

  return (
    <div className={`${containerClasses} flex items-center justify-center`}>
      <div className="text-center space-y-4 animate-fade-in">
        {/* Logo and Spinner */}
        <div className="relative">
          <div className="w-16 h-16 mx-auto bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          
          {/* Pulsing ring effect */}
          <div className="absolute inset-0 w-16 h-16 mx-auto border-4 border-blue-200 rounded-2xl animate-ping opacity-20"></div>
        </div>
        
        {/* Loading Message */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-800">
            {fullScreen ? 'TenVerse POS' : ''}
          </h3>
          <p className="text-sm text-gray-600 font-medium">
            {message}
          </p>
        </div>
        
        {/* Progress Bar */}
        <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-gradient-primary rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
} 