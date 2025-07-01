import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  ShoppingBag,
  ChefHat,
  Package,
  CreditCard,
  Settings,
  Store,
  Menu,
  X,
  User,
  LogOut,
  Bell,
  Search,
  Gift,
  Grid3X3,
  ChevronDown,
  TrendingUp,
  Smartphone,
  Receipt,
  ShoppingCart,
  ClipboardList,
  Gamepad2,
  UserCheck,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { useEmployeePermissions, useUserRoleDisplay } from '@/hooks/useEmployeePermissions';

export default function RestaurantNavbar() {
  const { restaurant } = useRestaurant();
  const { user, logout } = useRestaurantAuth();
  const { canAccess } = useEmployeePermissions();
  const userRoleDisplay = useUserRoleDisplay();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);

  if (!restaurant) return null;

  const primaryNavigationItems = [
    {
      name: 'Dashboard',
      href: `/${restaurant.slug}/dashboard`,
      icon: Home,
      current: location.pathname === `/${restaurant.slug}/dashboard` || location.pathname === `/${restaurant.slug}`,
    },
    {
      name: 'Tables',
      href: `/${restaurant.slug}/tables`,
      icon: Users,
      current: location.pathname === `/${restaurant.slug}/tables`,
    },
    {
      name: 'Orders',
      href: `/${restaurant.slug}/orders`,
      icon: ShoppingBag,
      current: location.pathname === `/${restaurant.slug}/orders`,
    },
  ];

  const allQuickMenuItems = [
    {
      name: 'Manage Tables',
      href: `/${restaurant.slug}/tables`,
      icon: Grid3X3,
      description: 'View and manage tables',
      moduleId: 'tables',
    },
    {
      name: 'Orders Dashboard',
      href: `/${restaurant.slug}/orders`,
      icon: ClipboardList,
      description: 'View and analyze orders',
      moduleId: 'orders',
    },
    {
      name: 'Takeaway Orders',
      href: `/${restaurant.slug}/takeaway`,
      icon: Package,
      description: 'Manage takeaway orders',
      moduleId: 'orders',
    },
    {
      name: 'Menu Management',
      href: `/${restaurant.slug}/menu`,
      icon: ChefHat,
      description: 'Manage menu items & categories',
      moduleId: 'menu',
    },
    {
      name: 'Inventory Management',
      href: `/${restaurant.slug}/inventory`,
      icon: Package,
      description: 'Track stock & inventory',
      moduleId: 'inventory',
    },
    {
      name: 'Kitchen Display',
      href: `/${restaurant.slug}/kitchen`,
      icon: Store,
      description: 'View kitchen orders',
      moduleId: 'kitchen',
    },
    {
      name: 'Customer Portal',
      href: `/${restaurant.slug}/customer-portal`,
      icon: Smartphone,
      description: 'Configure menu portal & QR codes',
      moduleId: 'customer_portal',
    },
    {
      name: 'Customer Management',
      href: `/${restaurant.slug}/customers`,
      icon: Users,
      description: 'Manage customer database',
      moduleId: 'customers',
    },
    {
      name: 'Credit Management',
      href: `/${restaurant.slug}/credits`,
      icon: CreditCard,
      description: 'Manage customer credits & payments',
      moduleId: 'credits',
    },
    {
      name: 'Coupon Dashboard',
      href: `/${restaurant.slug}/coupons`,
      icon: Gift,
      description: 'Manage coupons & promotions',
      moduleId: 'coupons',
    },
    {
      name: 'Gamification Tools',
      href: `/${restaurant.slug}/gamification`,
      icon: Gamepad2,
      description: 'Spin wheel & customer engagement',
      moduleId: 'gamification',
    },
    {
      name: 'Employee Management',
      href: `/${restaurant.slug}/employees`,
      icon: UserCheck,
      description: 'Manage staff & permissions',
      moduleId: 'employees',
    },
    {
      name: 'Marketplace',
      href: `/${restaurant.slug}/marketplace`,
      icon: ShoppingCart,
      description: 'Order bulk supplies & wholesale',
      moduleId: 'marketplace',
    },
    {
      name: 'Expense Tracker',
      href: `/${restaurant.slug}/expenses`,
      icon: Receipt,
      description: 'Track business expenses & budgets',
      moduleId: 'expenses',
    },
    {
      name: 'Business Reports',
      href: `/${restaurant.slug}/reports`,
      icon: TrendingUp,
      description: 'Generate comprehensive reports',
      moduleId: 'reports',
    },
    {
      name: 'Settings',
      href: `/${restaurant.slug}/settings`,
      icon: Settings,
      description: 'Restaurant settings',
      moduleId: 'settings',
    },
  ];

  // Filter menu items based on permissions
  const quickMenuItems = allQuickMenuItems.filter(item => canAccess(item.moduleId));

  const handleNavigation = (href: string) => {
    navigate(href);
    setIsMobileMenuOpen(false);
    setIsQuickMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate(`/${restaurant.slug}/login`);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
      <nav className="bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Restaurant Info */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white mr-3 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
                  <p className="text-xs text-gray-500">Restaurant POS</p>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-2">
              {/* Primary Navigation Items */}
              {primaryNavigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                      item.current
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md transform scale-105'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </button>
                );
              })}

              {/* Quick Menu Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsQuickMenuOpen(!isQuickMenuOpen)}
                  className="flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 transition-all duration-200 hover:scale-105"
                >
                  <Grid3X3 className="w-4 h-4 mr-2" />
                  Quick Menu
                  <ChevronDown className={`w-4 h-4 ml-2 transition-transform duration-200 ${isQuickMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isQuickMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsQuickMenuOpen(false)}
                    ></div>
                    <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 py-4 z-20 max-h-[80vh] overflow-y-auto custom-scrollbar" style={{ minWidth: '800px' }}>
                      <div className="px-6 pb-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                        <p className="text-sm text-gray-500">Access all restaurant management tools</p>
                      </div>
                      
                      <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {quickMenuItems.map((item) => {
                          const Icon = item.icon;
                          const isCurrentPage = location.pathname === item.href;
                          return (
                            <button
                              key={item.name}
                              onClick={() => handleNavigation(item.href)}
                              className={`group flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                                isCurrentPage 
                                  ? 'bg-blue-50 border-blue-200 shadow-md' 
                                  : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-blue-200'
                              }`}
                            >
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                                isCurrentPage 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-white text-gray-600 group-hover:bg-blue-500 group-hover:text-white'
                              }`}>
                                <Icon className="w-6 h-6" />
                              </div>
                              <h4 className={`text-sm font-medium text-center mb-1 ${
                                  isCurrentPage ? 'text-blue-900' : 'text-gray-900'
                                }`}>
                                  {item.name}
                              </h4>
                              <p className="text-xs text-gray-500 text-center line-clamp-2">
                                {item.description}
                                </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right side - Search, Notifications, User Menu */}
            <div className="flex items-center space-x-3">
              {/* Search - Hidden on small screens */}
              <div className="hidden xl:block relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  className="block w-48 pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                />
              </div>

              {/* Search button for smaller screens */}
              <button className="xl:hidden p-2.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
                <Search className="w-5 h-5" />
              </button>

              {/* Notifications */}
              <button className="p-2.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors relative">
                <Bell className="w-5 h-5" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
              </button>

              {/* User Menu */}
              <div className="hidden md:flex items-center space-x-3 bg-gray-50 rounded-xl px-3 py-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500">{userRoleDisplay}</p>
                </div>
                
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile menu button */}
              <div className="lg:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2.5 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          
          {/* Sidebar */}
          <div className="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-white shadow-2xl transform transition-transform ease-in-out duration-300 flex flex-col">
            {/* Sidebar Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{restaurant.name}</h2>
                  <p className="text-xs text-gray-500">Restaurant POS</p>
                </div>
              </div>
              
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 space-y-2" style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
              {/* Primary Items */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
                  Main Navigation
                </h3>
                {primaryNavigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.href)}
                      className={`flex items-center w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                        item.current
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </button>
                  );
                })}
              </div>

              {/* Quick Menu Items */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
                  Quick Access
                </h3>
                {quickMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrentPage = location.pathname === item.href;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.href)}
                      className={`flex items-start w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isCurrentPage
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3 mt-0.5" />
                      <div className="text-left">
                        <div>{item.name}</div>
                        <div className={`text-xs mt-0.5 ${
                          isCurrentPage ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Search */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Mobile User Info */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500">{userRoleDisplay}</p>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 