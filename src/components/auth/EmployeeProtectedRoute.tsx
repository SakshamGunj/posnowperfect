import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { Shield, AlertTriangle } from 'lucide-react';

interface EmployeeProtectedRouteProps {
  children: ReactNode;
  moduleId: string;
  fallbackPath?: string;
}

export default function EmployeeProtectedRoute({ 
  children, 
  moduleId, 
  fallbackPath 
}: EmployeeProtectedRouteProps) {
  const { restaurant } = useRestaurant();
  const { canAccess, isOwner } = useEmployeePermissions();

  // If no restaurant, redirect to login
  if (!restaurant) {
    return <Navigate to="/admin/login" replace />;
  }

  // Owners have access to everything
  if (isOwner) {
    return <>{children}</>;
  }

  // Check if employee has permission for this module
  if (!canAccess(moduleId)) {
    const redirectPath = fallbackPath || `/${restaurant.slug}`;
    
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h2>
          
          <div className="mb-6">
            <div className="flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
              <span className="text-sm font-medium text-amber-700">Insufficient Permissions</span>
            </div>
            <p className="text-gray-600">
              You don't have permission to access this feature. Please contact your manager if you need access.
            </p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full btn btn-secondary"
            >
              Go Back
            </button>
            
            <button
              onClick={() => window.location.href = redirectPath}
              className="w-full btn btn-theme-primary"
            >
              Return to Dashboard
            </button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Required permission: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{moduleId}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Higher-order component for easy wrapping
export function withEmployeePermission(moduleId: string, fallbackPath?: string) {
  return function WrappedComponent(Component: React.ComponentType<any>) {
    return function PermissionWrappedComponent(props: any) {
      return (
        <EmployeeProtectedRoute moduleId={moduleId} fallbackPath={fallbackPath}>
          <Component {...props} />
        </EmployeeProtectedRoute>
      );
    };
  };
} 