import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Firebase initialization
import { initializeFirebaseServices } from '@/lib/firebase';

// Contexts
import { RestaurantProvider } from '@/contexts/RestaurantContext';
import { RestaurantAuthProvider } from '@/contexts/RestaurantAuthContext';
import { VoiceProvider } from '@/contexts/VoiceContext';

// Services
import { RestaurantService } from '@/services/restaurantService';

// Admin Pages
import AdminLogin from '@/pages/admin/AdminLogin';
import AdminDashboard from '@/pages/admin/AdminDashboard';

// Restaurant Pages
import RestaurantDashboard from '@/pages/restaurant/Dashboard';
import RestaurantLogin from '@/pages/restaurant/Login';
import Tables from '@/pages/restaurant/Tables';
import TakeOrder from '@/pages/restaurant/TakeOrder';
import MenuManagement from '@/pages/restaurant/MenuManagement';
import InventoryManagement from '@/pages/restaurant/InventoryManagement';
import OrderDashboard from '@/pages/restaurant/OrderDashboard';
import Settings from '@/pages/restaurant/Settings';
import Customers from '@/pages/restaurant/Customers';
import CouponDashboard from '@/pages/restaurant/CouponDashboard';
import GamificationDashboard from '@/pages/restaurant/GamificationDashboard';
import Credits from '@/pages/restaurant/Credits';
import EmployeePage from '@/pages/restaurant/EmployeePage';
import MarketplacePage from '@/pages/restaurant/MarketplacePage';
import KitchenDisplay from '@/pages/restaurant/KitchenDisplay';
import CustomerMenuPortal from '@/pages/restaurant/CustomerMenuPortal';
import CustomerOrderingPage from '@/pages/public/CustomerOrderingPage';
import CustomerOrderStatus from '@/pages/public/CustomerOrderStatus';
import SpinWheelPage from '@/pages/public/SpinWheelPage';
import UserDashboardPage from '@/pages/public/UserDashboardPage';
import RestaurantDebug from '@/pages/debug/RestaurantDebug';
import NotFoundPage from '@/pages/NotFoundPage';

// Components
import ErrorBoundary from '@/components/common/ErrorBoundary';
import RestaurantProtectedRoute from '@/components/auth/RestaurantProtectedRoute';
import RestaurantWrapper from '@/components/restaurant/RestaurantWrapper';

// Layouts
import RestaurantLayout from '@/components/layouts/RestaurantLayout';

export default function App() {
  useEffect(() => {
    const initApp = async () => {
      console.log('🚀 TenVerse POS initialized successfully');
      
      // Clear any existing subscriptions and queries to prevent Target ID conflicts
      RestaurantService.clearAllSubscriptions();
      RestaurantService.clearAllQueries();
      
      // Note: Removed Firestore reset from initialization as it was causing 
      // internal assertion failures. Reset is now only used on actual errors.
      
      initializeFirebaseServices();
    };
    
    // Global error handler for Firestore assertion failures
    const handleGlobalError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('INTERNAL ASSERTION FAILED') ||
          event.error?.message?.includes('Unexpected state')) {
        console.error('🔥 Global: Firestore assertion failure detected');
        console.log('💡 Global: Auto-refreshing page to fix corrupted state...');
        
        // Auto-refresh the page to fix the corrupted Firestore state
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    };
    
    window.addEventListener('error', handleGlobalError);
    
    initApp();
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Toaster
          position="top-right"
          gutter={12}
          containerStyle={{
            top: 20,
            right: 20,
          }}
          toastOptions={{
            // Reduce duration for less screen time
            duration: 2500,
            style: {
              // Make toasts smaller and more refined
              background: 'rgba(31, 41, 55, 0.95)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '500',
              padding: '12px 16px',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxWidth: '350px',
              wordWrap: 'break-word',
            },
            // Success toast styling
            success: {
              duration: 2000,
              style: {
                background: 'rgba(16, 185, 129, 0.95)',
                color: '#fff',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              },
              iconTheme: {
                primary: '#fff',
                secondary: 'rgba(16, 185, 129, 0.95)',
              },
            },
            // Error toast styling
            error: {
              duration: 3500,
              style: {
                background: 'rgba(239, 68, 68, 0.95)',
                color: '#fff',
                border: '1px solid rgba(248, 113, 113, 0.3)',
              },
              iconTheme: {
                primary: '#fff',
                secondary: 'rgba(239, 68, 68, 0.95)',
              },
            },
            // Loading toast styling
            loading: {
              duration: Infinity,
              style: {
                background: 'rgba(59, 130, 246, 0.95)',
                color: '#fff',
                border: '1px solid rgba(96, 165, 250, 0.3)',
              },
              iconTheme: {
                primary: '#fff',
                secondary: 'rgba(59, 130, 246, 0.95)',
              },
            },
          }}
        />
        
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          
          {/* Old spin wheel route removed - now handled by restaurant root */}
          
          {/* User Dashboard Route */}
          <Route path="/my-rewards" element={<UserDashboardPage />} />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          
          {/* Restaurant Routes */}
          <Route path="/:slug/*" element={
            <RestaurantProvider>
              <RestaurantAuthProvider>
                <VoiceProvider>
                <RestaurantWrapper>
                  <Routes>
                    {/* Public restaurant routes */}
                    <Route path="login" element={<RestaurantLogin />} />
                    
                    {/* Spin Wheel Route */}
                    <Route path="spin-wheel" element={<SpinWheelPage />} />
                    
                    {/* Customer Ordering Portal Route (Public) */}
                    <Route path="menu-portal" element={<CustomerOrderingPage />} />
                    
                    {/* Table-specific Customer Ordering Portal Route (Public) */}
                    <Route path="menu-portal/:tableId" element={<CustomerOrderingPage />} />
                    
                    {/* Customer Order Status Route (Public) */}
                    <Route path="order-status" element={<CustomerOrderStatus />} />
                    
                    {/* Customer Dashboard Route (Public) */}
                    <Route path="customer-dashboard" element={<UserDashboardPage />} />
                    
                    {/* Debug Route */}
                    <Route path="debug" element={<RestaurantDebug />} />
                    
                    {/* Protected restaurant routes with shared layout */}
                    <Route path="/*" element={
                      <RestaurantProtectedRoute>
                        <RestaurantLayout />
                      </RestaurantProtectedRoute>
                    }>
                      <Route path="" element={<RestaurantDashboard />} />
                      <Route path="dashboard" element={<RestaurantDashboard />} />
                      <Route path="tables" element={<Tables />} />
                      <Route path="menu" element={<MenuManagement />} />
                      <Route path="inventory" element={<InventoryManagement />} />
                      <Route path="orders" element={<OrderDashboard />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="customers" element={<Customers />} />
                      <Route path="coupons" element={<CouponDashboard />} />
                      <Route path="gamification" element={<GamificationDashboard />} />
                      <Route path="credits" element={<Credits />} />
                      <Route path="employees" element={<EmployeePage />} />
                      <Route path="marketplace" element={<MarketplacePage />} />
                      <Route path="kitchen" element={<KitchenDisplay />} />
                      <Route path="customer-portal" element={<CustomerMenuPortal />} />
                      <Route path="order/:tableId" element={<TakeOrder />} />
                    </Route>
                    
                    {/* Restaurant 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </RestaurantWrapper>
                </VoiceProvider>
              </RestaurantAuthProvider>
            </RestaurantProvider>
          } />
          
          {/* Global 404 Page - This should be last */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
} 