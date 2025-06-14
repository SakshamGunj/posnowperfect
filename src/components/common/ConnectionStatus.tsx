import React, { useState, useEffect } from 'react';
import { WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { getFirestoreConnectionStatus, checkFirestoreConnection } from '@/lib/firebase';

interface ConnectionStatusProps {
  showDetails?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  showDetails = false, 
  className = '' 
}) => {
  const [connectionStatus, setConnectionStatus] = useState({ connected: true, retryCount: 0 });
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  useEffect(() => {
    // Initial status check
    updateConnectionStatus();

    // Set up periodic status checks
    const interval = setInterval(() => {
      updateConnectionStatus();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const updateConnectionStatus = () => {
    const status = getFirestoreConnectionStatus();
    setConnectionStatus(status);
    setLastChecked(new Date());
  };

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    try {
      console.log('🔄 Connection retry requested - refreshing page...');
      
      // Show brief message before refresh
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error('Manual retry failed:', error);
    } finally {
      // Don't set isRetrying to false since we're refreshing
    }
  };

  const handleCheckConnection = async () => {
    setIsRetrying(true);
    try {
      await checkFirestoreConnection();
      updateConnectionStatus();
    } catch (error) {
      console.error('Connection check failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  if (!showDetails && connectionStatus.connected) {
    return null; // Don't show anything if connection is good and details not requested
  }

  const getStatusIcon = () => {
    if (isRetrying) {
      return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />;
    }
    
    if (connectionStatus.connected) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    if (connectionStatus.retryCount > 0) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
    
    return <WifiOff className="w-4 h-4 text-red-500" />;
  };

  const getStatusText = () => {
    if (isRetrying) return 'Checking connection...';
    if (connectionStatus.connected) return 'Connected';
    if (connectionStatus.retryCount > 0) return `Retrying (${connectionStatus.retryCount})`;
    return 'Connection issue';
  };

  const getStatusColor = () => {
    if (connectionStatus.connected) return 'text-green-600 bg-green-50 border-green-200';
    if (connectionStatus.retryCount > 0) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className={`${className}`}>
      {showDetails ? (
        <div className={`inline-flex items-center px-3 py-2 rounded-lg border text-sm ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="ml-2">{getStatusText()}</span>
          
          {!connectionStatus.connected && !isRetrying && (
            <button
              onClick={handleRetryConnection}
              className="ml-3 px-2 py-1 text-xs bg-current bg-opacity-10 rounded hover:bg-opacity-20 transition-colors"
            >
              Refresh
            </button>
          )}
          
          {connectionStatus.connected && (
            <button
              onClick={handleCheckConnection}
              className="ml-3 px-2 py-1 text-xs bg-current bg-opacity-10 rounded hover:bg-opacity-20 transition-colors"
            >
              Check
            </button>
          )}
        </div>
      ) : (
        // Minimal status indicator
        <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="ml-1">{getStatusText()}</span>
        </div>
      )}
      
      {showDetails && (
        <div className="text-xs text-gray-500 mt-1">
          Last checked: {lastChecked.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus; 