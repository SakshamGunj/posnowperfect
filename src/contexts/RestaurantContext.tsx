import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Restaurant, RestaurantContextType } from '@/types';
import { RestaurantService } from '@/services/restaurantService';
import { getThemeConfig } from '@/lib/utils';
import toast from 'react-hot-toast';

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

interface RestaurantProviderProps {
  children: React.ReactNode;
}

export function RestaurantProvider({ children }: RestaurantProviderProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Extract restaurant slug from URL path
  const getSlugFromPath = useCallback((): string | null => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    
    // Check if it's a restaurant-specific route (e.g., /pizzapalace/...)
    if (pathSegments.length > 0 && !['admin', 'auth', 'create-restaurant'].includes(pathSegments[0])) {
      return pathSegments[0];
    }
    
    return null;
  }, [location.pathname]);

  // Apply theme to document root
  const applyTheme = useCallback((businessType: Restaurant['businessType']) => {
    const themeConfig = getThemeConfig(businessType);
    const root = document.documentElement;
    
    // Set CSS custom properties for dynamic theming
    root.style.setProperty('--color-primary', themeConfig.colors.primary);
    root.style.setProperty('--color-secondary', themeConfig.colors.secondary);
    root.style.setProperty('--color-accent', themeConfig.colors.accent);
    root.style.setProperty('--color-background', themeConfig.colors.background);
    root.style.setProperty('--color-surface', themeConfig.colors.surface);
    root.style.setProperty('--color-text', themeConfig.colors.text);
    root.style.setProperty('--gradient-primary', themeConfig.gradients.primary);
    root.style.setProperty('--gradient-secondary', themeConfig.gradients.secondary);
    
    // Update theme-color meta tag
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', themeConfig.colors.primary);
    }
  }, []);

  // Switch to a different restaurant
  const switchRestaurant = useCallback(async (slug: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setIsSubscribed(false); // Reset subscription state

      const result = await RestaurantService.getRestaurantBySlug(slug);
      
      if (result.success && result.data) {
        setRestaurant(result.data);
        
        // Apply theme based on business type
        applyTheme(result.data.businessType);
        
        // Navigate to restaurant POS if not already there
            if (!location.pathname.startsWith(`/${slug}`) || location.pathname === `/${slug}/spin-wheel`) {
      // Don't redirect if we're on spin-wheel or already in the restaurant section
      if (!location.pathname.startsWith(`/${slug}/login`) && location.pathname !== `/${slug}/spin-wheel`) {
        navigate(`/${slug}`);
      }
        }
      } else {
        setError(result.error || 'Restaurant not found');
        setRestaurant(null);
        
        // Don't redirect to admin - just show error in restaurant context
        console.error('Restaurant not found:', slug, result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load restaurant');
      setRestaurant(null);
      console.error('Error loading restaurant:', err);
    } finally {
      setLoading(false);
    }
  }, [navigate, location.pathname, applyTheme]);

  // Update restaurant data
  const updateRestaurant = useCallback(async (updates: Partial<Restaurant>): Promise<void> => {
    if (!restaurant) {
      throw new Error('No restaurant loaded');
    }

    try {
      const result = await RestaurantService.updateRestaurant(restaurant.id, updates);
      
      if (result.success && result.data) {
        setRestaurant(result.data);
        
        // Apply new theme if business type changed
        if (updates.businessType) {
          applyTheme(updates.businessType);
        }
        
        toast.success('Restaurant updated successfully');
      } else {
        throw new Error(result.error || 'Failed to update restaurant');
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
      throw err;
    }
  }, [restaurant, applyTheme]);

  // Refresh restaurant data
  const refreshRestaurant = useCallback(async (): Promise<void> => {
    if (!restaurant) return;

    try {
      const result = await RestaurantService.getRestaurantBySlug(restaurant.slug);
      
      if (result.success && result.data) {
        setRestaurant(result.data);
      }
    } catch (err: any) {
      console.error('Failed to refresh restaurant:', err);
    }
  }, [restaurant]);

  // Load restaurant on route change
  useEffect(() => {
    const slug = getSlugFromPath();
    
    if (slug) {
      // Only switch if it's a different restaurant
      if (!restaurant || restaurant.slug !== slug) {
        switchRestaurant(slug);
      }
    } else {
      // Clear restaurant if not on a restaurant-specific route
      setRestaurant(null);
      setLoading(false);
      setError(null);
      setIsSubscribed(false); // Reset subscription state
      
      // Reset to default theme
      const root = document.documentElement;
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-secondary');
      root.style.removeProperty('--color-accent');
      root.style.removeProperty('--color-background');
      root.style.removeProperty('--color-surface');
      root.style.removeProperty('--color-text');
      root.style.removeProperty('--gradient-primary');
      root.style.removeProperty('--gradient-secondary');
    }
  }, [location.pathname]);

  // Set up real-time listener for restaurant updates
  useEffect(() => {
    if (!restaurant || isSubscribed) return;

    // Clear any existing timeout
    if (subscriptionTimeoutRef.current) {
      clearTimeout(subscriptionTimeoutRef.current);
    }

    let unsubscribeFunction: (() => void) | null = null;

    // Add a small delay to prevent rapid subscription recreation
    subscriptionTimeoutRef.current = setTimeout(() => {
      console.log('🔄 Setting up restaurant subscription for:', restaurant.slug);
      setIsSubscribed(true);

      unsubscribeFunction = RestaurantService.subscribeToRestaurant(
        restaurant.slug,
        (updatedRestaurant) => {
          if (updatedRestaurant) {
            setRestaurant(updatedRestaurant);
            applyTheme(updatedRestaurant.businessType);
          } else {
            setRestaurant(null);
            setError('Restaurant not found or has been deactivated');
            console.error('Restaurant subscription lost:', restaurant.slug);
            setIsSubscribed(false);
          }
        }
      );

      subscriptionTimeoutRef.current = null;
    }, 100); // 100ms delay

    // Cleanup function
    return () => {
      // Clear timeout if still pending
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }

      // Cleanup subscription if it was created
      if (unsubscribeFunction) {
        console.log('🛑 Cleaning up restaurant subscription for:', restaurant.slug);
        unsubscribeFunction();
        setIsSubscribed(false);
      }
    };
  }, [restaurant?.slug]);

  const contextValue: RestaurantContextType = {
    restaurant,
    loading,
    error,
    switchRestaurant,
    updateRestaurant,
    refreshRestaurant,
  };

  return (
    <RestaurantContext.Provider value={contextValue}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant(): RestaurantContextType {
  const context = useContext(RestaurantContext);
  
  if (context === undefined) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  
  return context;
}

export { RestaurantContext }; 