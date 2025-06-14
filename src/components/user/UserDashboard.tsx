import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Ticket,
  Phone,
  Search,
  CheckCircle,
  Clock,
  Gift,
  Copy,
  Calendar,
  Trophy,

  ExternalLink,
  Sparkles
} from 'lucide-react';

import { CustomerSpin } from '@/types';
import { GamificationService } from '@/services/gamificationService';
import { RestaurantService } from '@/services/restaurantService';

interface PhoneSearchForm {
  phone: string;
}

interface RestaurantInfo {
  id: string;
  name: string;
  slug: string;
}

export default function UserDashboard() {
  const [spins, setSpins] = useState<CustomerSpin[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPhone, setCurrentPhone] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<PhoneSearchForm>();

  // Check if user has a phone number in localStorage
  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    if (storedPhone) {
      setCurrentPhone(storedPhone);
      handlePhoneSearch({ phone: storedPhone });
    }
  }, []);

  const handlePhoneSearch = async (data: PhoneSearchForm) => {
    setLoading(true);
    setHasSearched(true);
    setCurrentPhone(data.phone);
    setSpins([]);
    setRestaurants([]);

    try {
      // Get all restaurants (this is a simplified approach)
      // In production, you might want to have a more efficient way to search across restaurants
      const allRestaurantsResult = await RestaurantService.getAllActiveRestaurants();
      
      if (allRestaurantsResult.success && allRestaurantsResult.data) {
        const restaurantSpins: CustomerSpin[] = [];
        const restaurantInfos: RestaurantInfo[] = [];

        // Search spins from each restaurant
        for (const restaurant of allRestaurantsResult.data) {
          try {
            const spinsResult = await GamificationService.getCustomerSpinsFromRestaurant(
              restaurant.id,
              data.phone
            );

            if (spinsResult.success && spinsResult.data && spinsResult.data.length > 0) {
              // Add restaurant info to each spin
              const restaurantSpinsWithInfo = spinsResult.data.map(spin => ({
                ...spin,
                restaurantName: restaurant.name,
                restaurantSlug: restaurant.slug
              }));
              
              restaurantSpins.push(...restaurantSpinsWithInfo);
              
              if (!restaurantInfos.find(r => r.id === restaurant.id)) {
                restaurantInfos.push({
                  id: restaurant.id,
                  name: restaurant.name,
                  slug: restaurant.slug
                });
              }
            }
          } catch (error) {
            console.error(`Error fetching spins from ${restaurant.name}:`, error);
          }
        }

        // Sort by date (newest first)
        restaurantSpins.sort((a, b) => new Date(b.spinDate).getTime() - new Date(a.spinDate).getTime());
        
        setSpins(restaurantSpins);
        setRestaurants(restaurantInfos);

        if (restaurantSpins.length === 0) {
          toast.error('No spins found for this phone number');
        } else {
          toast.success(`Found ${restaurantSpins.length} spins from ${restaurantInfos.length} restaurants`);
        }
      }
    } catch (error) {
      console.error('Error searching spins:', error);
      toast.error('Failed to search for spins. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Coupon code copied!');
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getSpinStatusBadge = (spin: CustomerSpin) => {
    if (spin.isRedeemed) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Redeemed
        </span>
      );
    } else if (spin.couponCode) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Ticket className="w-3 h-3 mr-1" />
          Claimed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <Clock className="w-3 h-3 mr-1" />
          Not Claimed
        </span>
      );
    }
  };

  const claimedSpins = spins.filter(spin => spin.couponCode);
  const totalSpins = spins.length;
  const redeemedCount = spins.filter(spin => spin.isRedeemed).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">My Rewards</h1>
            <Sparkles className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-purple-200 text-lg">
            Track your coupons and rewards from all your favorite restaurants
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Find Your Rewards</h2>
          
          <form onSubmit={handleSubmit(handlePhoneSearch)} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  {...register('phone', {
                    required: 'Phone number is required',
                    pattern: {
                      value: /^[\d\s\-\(\)\+]+$/,
                      message: 'Please enter a valid phone number'
                    }
                  })}
                  className="w-full pl-12 pr-4 py-3 text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your phone number"
                  defaultValue={currentPhone}
                />
              </div>
              {errors.phone && (
                <p className="text-red-400 text-sm mt-1">{errors.phone.message}</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4" />
                  <span>Search Rewards</span>
                </div>
              )}
            </button>
          </form>
        </div>

        {hasSearched && (
          <>
            {/* Stats Cards */}
            {totalSpins > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-200 text-sm">Total Spins</p>
                      <p className="text-3xl font-bold text-white">{totalSpins}</p>
                    </div>
                    <Trophy className="w-8 h-8 text-yellow-400" />
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-200 text-sm">Claimed Rewards</p>
                      <p className="text-3xl font-bold text-white">{claimedSpins.length}</p>
                    </div>
                    <Ticket className="w-8 h-8 text-blue-400" />
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-200 text-sm">Redeemed</p>
                      <p className="text-3xl font-bold text-white">{redeemedCount}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                </div>
              </div>
            )}

            {/* Restaurants */}
            {restaurants.length > 0 && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-8">
                <h3 className="text-xl font-semibold text-white mb-4">Your Restaurants</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {restaurants.map((restaurant) => (
                    <div key={restaurant.id} className="bg-white/10 rounded-lg p-4 border border-white/10">
                      <h4 className="font-medium text-white">{restaurant.name}</h4>
                      <p className="text-purple-200 text-sm">/{restaurant.slug}</p>
                      <p className="text-purple-300 text-xs mt-1">
                        {spins.filter(s => s.restaurantId === restaurant.id).length} spins
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spins List */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
              <div className="p-6 border-b border-white/20">
                <h3 className="text-xl font-semibold text-white">Your Rewards History</h3>
                <p className="text-purple-200 text-sm mt-1">
                  All your spins and rewards from participating restaurants
                </p>
              </div>

              {spins.length === 0 ? (
                <div className="p-8 text-center">
                  <Gift className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-white mb-2">No rewards found</h4>
                  <p className="text-purple-200">
                    No spins found for this phone number. Start playing spin the wheel games to earn rewards!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {spins.map((spin) => (
                    <div key={`${spin.restaurantId}-${spin.id}`} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-white">{(spin as any).restaurantName}</h4>
                            {getSpinStatusBadge(spin)}
                          </div>
                          
                          <p className="text-purple-200 mb-2">{spin.resultMessage}</p>
                          
                          {spin.couponCode && (
                            <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-3 mb-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-green-300 text-sm font-medium">Coupon Code:</p>
                                  <p className="text-green-400 font-mono font-bold">{spin.couponCode}</p>
                                </div>
                                <button
                                  onClick={() => copyCouponCode(spin.couponCode!)}
                                  className="p-2 text-green-400 hover:text-green-300 transition-colors"
                                  title="Copy coupon code"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center space-x-4 text-sm text-purple-300">
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDate(spin.spinDate)}</span>
                            </span>
                            
                            {spin.redeemedAt && (
                              <span className="flex items-center space-x-1">
                                <Ticket className="w-4 h-4" />
                                <span>Redeemed {formatDate(spin.redeemedAt!)}</span>
                              </span>
                            )}
                            
                            {spin.redeemedAt && (
                              <span className="flex items-center space-x-1">
                                <CheckCircle className="w-4 h-4" />
                                <span>Redeemed {formatDate(spin.redeemedAt)}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="ml-4">
                          <a
                            href={`/${(spin as any).restaurantSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm"
                          >
                            <span>Visit Restaurant</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 