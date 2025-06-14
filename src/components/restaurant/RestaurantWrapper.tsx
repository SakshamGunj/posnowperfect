import React from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import LoadingScreen from '@/components/common/LoadingScreen';
import RestaurantNotFound from '@/pages/restaurant/RestaurantNotFound';

interface RestaurantWrapperProps {
  children: React.ReactNode;
}

export default function RestaurantWrapper({ children }: RestaurantWrapperProps) {
  const { restaurant, loading, error } = useRestaurant();

  if (loading) {
    return <LoadingScreen />;
  }

  if (error || !restaurant) {
    return <RestaurantNotFound />;
  }

  return <>{children}</>;
} 