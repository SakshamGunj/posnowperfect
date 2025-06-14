import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import LoadingScreen from '@/components/common/LoadingScreen';

interface RestaurantProtectedRouteProps {
  children: React.ReactNode;
}

export default function RestaurantProtectedRoute({ children }: RestaurantProtectedRouteProps) {
  const { isAuthenticated, loading, user, isPinAuthenticated } = useRestaurantAuth();
  const { slug } = useParams<{ slug: string }>();

  console.log('🛡️ RestaurantProtectedRoute check:', {
    slug,
    isAuthenticated,
    loading,
    hasUser: !!user,
    isPinAuthenticated,
    userName: user?.name
  });

  if (loading) {
    console.log('🔄 RestaurantProtectedRoute: Still loading...');
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    console.log('❌ RestaurantProtectedRoute: Not authenticated, redirecting to login');
    return <Navigate to={`/${slug}/login`} replace />;
  }

  console.log('✅ RestaurantProtectedRoute: Authenticated, allowing access');
  return <>{children}</>;
} 