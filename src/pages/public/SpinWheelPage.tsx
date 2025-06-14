import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';

import { SpinWheelConfig, CustomerSpin } from '@/types';
import { GamificationService } from '@/services/gamificationService';
import { RestaurantService } from '@/services/restaurantService';
import SpinWheelGame from '@/components/gamification/SpinWheelGame';

export default function SpinWheelPage() {
  const { slug } = useParams<{ slug: string }>();
  
  const [wheelConfig, setWheelConfig] = useState<SpinWheelConfig | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [_restaurantId, setRestaurantId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadSpinWheel();
    }
  }, [slug]);

  const loadSpinWheel = async () => {
    if (!slug) return;

    try {
      setIsLoading(true);
      
      // Load restaurant info by slug
      const restaurantResult = await RestaurantService.getRestaurantBySlug(slug);
      if (restaurantResult.success && restaurantResult.data) {
        setRestaurantName(restaurantResult.data.name);
        setRestaurantId(restaurantResult.data.id);

        // Load all spin wheels for restaurant and find the first active one
        const wheelsResult = await GamificationService.getSpinWheelsForRestaurant(restaurantResult.data.id);
        if (wheelsResult.success && wheelsResult.data) {
          // Find the first active wheel
          const activeWheel = wheelsResult.data.find(w => w.isActive);

          if (activeWheel) {
            setWheelConfig(activeWheel);
          } else {
            setError('No active spin wheel found. Please contact the restaurant for more information.');
          }
        } else {
          setError('Unable to load spin wheel. Please try again later.');
        }
      } else {
        setError('Restaurant not found. Please check the URL and try again.');
      }
    } catch (error) {
      console.error('Error loading spin wheel:', error);
      setError('Something went wrong. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpinComplete = (_result: CustomerSpin) => {
    toast.success('Spin recorded successfully!');
    // Could add additional logic here like analytics tracking
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Loading Spin Wheel...</h2>
          <p className="text-purple-200">Preparing your game experience</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Oops!</h2>
          <p className="text-purple-200 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!wheelConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Wheel Not Found</h2>
          <p className="text-purple-200 mb-6">
            No active spin wheel found for this restaurant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SpinWheelGame
        wheelConfig={wheelConfig}
        restaurantName={restaurantName}
        onSpinComplete={handleSpinComplete}
      />
      
      {/* Footer */}
      <div className="fixed bottom-4 right-4">
        <a
                                href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/30 transition-colors"
        >
          <span className="text-sm">Visit {restaurantName} POS</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
} 