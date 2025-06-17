import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import EmployeeManagement from '@/components/employee/EmployeeManagement';
import { Navigate } from 'react-router-dom';
import { Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EmployeePage() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();

  // Only owners can access employee management
  if (!user || user.role !== 'owner') {
    return <Navigate to={`/${restaurant?.slug}/login`} replace />;
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Restaurant Not Found</h2>
          <p className="text-gray-600">Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                to={`/${restaurant.slug}`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center">
                <Users className="w-5 h-5 text-gray-600 mr-2" />
                <h1 className="text-lg font-semibold text-gray-900">Employee Management</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {restaurant.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EmployeeManagement />
      </main>
    </div>
  );
} 