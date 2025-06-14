import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RestaurantService } from '@/services/restaurantService';
import { Restaurant } from '@/types';

export default function RestaurantDebug() {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      checkRestaurant();
    }
  }, [slug]);

  const checkRestaurant = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      console.log('🔍 Checking restaurant with slug:', slug);
      
      const result = await RestaurantService.getRestaurantBySlug(slug);
      console.log('📊 Restaurant check result:', result);
      
      if (result.success && result.data) {
        setRestaurant(result.data);
        setError(null);
      } else {
        setError(result.error || 'Restaurant not found');
        setRestaurant(null);
      }
    } catch (err: any) {
      console.error('❌ Error checking restaurant:', err);
      setError(err.message || 'Failed to check restaurant');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Checking Restaurant...</h2>
          <p className="text-gray-600">Slug: {slug}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Restaurant Debug Info</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <p className="text-lg font-mono bg-gray-100 p-2 rounded">{slug}</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {restaurant && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-4">Restaurant Found!</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID</label>
                    <p className="font-mono text-sm bg-white p-2 rounded border">{restaurant.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="font-semibold">{restaurant.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Slug</label>
                    <p className="font-mono text-sm bg-white p-2 rounded border">{restaurant.slug}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business Type</label>
                    <p className="capitalize">{restaurant.businessType}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <p className={`font-semibold ${restaurant.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {restaurant.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Owner ID</label>
                    <p className="font-mono text-sm bg-white p-2 rounded border">{restaurant.ownerId}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created At</label>
                    <p className="text-sm">{restaurant.createdAt.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Updated At</label>
                    <p className="text-sm">{restaurant.updatedAt.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Settings</label>
                  <pre className="bg-white p-4 rounded border text-xs overflow-auto">
                    {JSON.stringify(restaurant.settings, null, 2)}
                  </pre>
                </div>

                <div className="mt-4 flex space-x-4">
                  <a
                    href={`/${restaurant.slug}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Go to Restaurant
                  </a>
                  <a
                    href={`/${restaurant.slug}/login`}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Go to Login
                  </a>
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={checkRestaurant}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Refresh Check
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 