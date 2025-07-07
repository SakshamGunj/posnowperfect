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
  User,
  LogOut,
  Gift,
  Grid3X3,
  ChevronDown,
  TrendingUp,
  Receipt,
  ShoppingCart,
  ClipboardList,
  Gamepad2,
  UserCheck,
  Smartphone,
  Mic,
  MicOff,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { useEmployeePermissions, useUserRoleDisplay } from '@/hooks/useEmployeePermissions';

export default function ImprovedRestaurantNavbar() {
  const { restaurant } = useRestaurant();
  const { user, logout } = useRestaurantAuth();
  const { canAccess } = useEmployeePermissions();
  const userRoleDisplay = useUserRoleDisplay();
  const navigate = useNavigate();
  const location = useLocation();
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false); // Keep for desktop dropdown
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    // Initialize from localStorage, default to true
    const stored = localStorage.getItem('voiceEnabled');
    return stored !== null ? JSON.parse(stored) : true;
  });

  // Update localStorage when voice state changes
  const toggleVoice = () => {
    const newState = !isVoiceEnabled;
    setIsVoiceEnabled(newState);
    localStorage.setItem('voiceEnabled', JSON.stringify(newState));
  };

  if (!restaurant) return null;

  const primaryNavigationItems = [
    {
      name: 'Tables',
      href: `/${restaurant.slug}/tables`,
      icon: Users,
      current: location.pathname === `/${restaurant.slug}/tables` || location.pathname === `/${restaurant.slug}`,
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

  // Exclude primary navigation items from the quick menu list for mobile to avoid duplication
  const mobileQuickMenuItems = quickMenuItems.filter(
    item => !primaryNavigationItems.some(primary => primary.name === item.name || (primary.name === 'Orders' && item.name === 'Orders Dashboard') || (primary.name === 'Tables' && item.name === 'Manage Tables'))
  );

  // Function to simplify menu names to single words
  const getSimplifiedName = (name: string) => {
    const nameMap: { [key: string]: string } = {
      'Tables': 'Tables',
      'Orders': 'Orders', 
      'Manage Tables': 'Tables',
      'Orders Dashboard': 'Orders',
      'Menu Management': 'Menu',
      'Inventory Management': 'Inventory',
      'Kitchen Display': 'Kitchen',
      'Customer Portal': 'Portal',
      'Customer Management': 'Customers',
      'Credit Management': 'Credits',
      'Coupon Dashboard': 'Coupons',
      'Gamification Tools': 'Games',
      'Employee Management': 'Employees',
      'Marketplace': 'Market',
      'Expense Tracker': 'Expenses',
      'Business Reports': 'Reports',
      'Settings': 'Settings'
    };
    
    return nameMap[name] || name.split(' ')[0]; // Fallback to first word if not in map
  };

  const handleNavigation = (href: string) => {
    navigate(href);
    setIsQuickMenuOpen(false); // Close desktop dropdown on navigation
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
    <div className="lg:hidden">
      <nav className="bg-white/98 backdrop-blur-lg shadow-lg border-b border-gray-200/80 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Restaurant Info */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white mr-3 shadow-lg transition-transform duration-200 hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-gray-900 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text">
                    {restaurant.name}
                  </h1>
                  <p className="text-xs text-gray-500 font-medium">Restaurant POS</p>
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
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                      item.current
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105 border border-blue-400/30'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 border border-transparent hover:border-gray-200'
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
                  className="flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 transition-all duration-300 hover:scale-105 active:scale-95 border border-transparent hover:border-gray-200"
                >
                  <Grid3X3 className="w-4 h-4 mr-2" />
                  Quick Menu
                  <ChevronDown className={`w-4 h-4 ml-2 transition-transform duration-300 ${isQuickMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu with enhanced styling */}
                {isQuickMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsQuickMenuOpen(false);
                      }}
                      style={{ 
                        background: 'transparent',
                        width: '100vw',
                        height: '100vh',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                      }}
                    ></div>
                    <div 
                      className="absolute top-full mt-2 w-80 max-h-96 bg-white/98 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-200/80 py-2 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-4 py-2 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900">Quick Access</h3>
                        <p className="text-xs text-gray-500">Manage your restaurant operations</p>
                      </div>
                      
                      <div className="py-2 max-h-80 overflow-y-auto custom-scrollbar">
                        {quickMenuItems.map((item) => {
                          const Icon = item.icon;
                          const isCurrentPage = location.pathname === item.href;
                          return (
                            <button
                              key={item.name}
                              onClick={() => handleNavigation(item.href)}
                              className={`flex items-start w-full px-4 py-3 text-left hover:bg-gray-50 transition-all duration-200 active:scale-[0.98] ${
                                isCurrentPage ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                              }`}
                            >
                              <Icon className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 transition-colors duration-200 ${
                                isCurrentPage ? 'text-blue-600' : 'text-gray-400'
                              }`} />
                              <div>
                                <p className={`text-sm font-medium transition-colors duration-200 ${
                                  isCurrentPage ? 'text-blue-900' : 'text-gray-900'
                                }`}>
                                  {item.name}
                                </p>
                                <p className="text-xs text-gray-500">{item.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right side - User Menu and Voice Toggle */}
            <div className="flex items-center space-x-3">
              {/* Voice Toggle */}
              <button
                onClick={toggleVoice}
                className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                  isVoiceEnabled 
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 shadow-lg border border-blue-200' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200'
                }`}
                title={isVoiceEnabled ? 'Disable Voice Commands' : 'Enable Voice Commands'}
              >
                {isVoiceEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              {/* User Menu */}
              <div className="hidden md:flex items-center space-x-3 bg-gray-50/80 backdrop-blur-sm rounded-xl px-3 py-2 border border-gray-200/50 hover:bg-gray-100/80 transition-all duration-200">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500">{userRoleDisplay}</p>
                </div>
                
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                  <User className="w-4 h-4 text-white" />
                </div>
                
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all duration-200 hover:scale-105 active:scale-95"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Sticky Bottom Navigation for Mobile - Always Visible */}
      <div className="lg:hidden fixed bottom-1 left-2 right-2 z-50">
        <div className="bg-white/95 backdrop-blur-lg shadow-2xl border border-gray-200/80 rounded-t-2xl overflow-hidden">
          <div className="w-full pt-1 pb-1">
            {/* Horizontal scroll indicator */}
            <div className="flex justify-center mb-1">
              <div className="w-8 h-1 bg-gray-300 rounded-full opacity-60"></div>
            </div>
            
            {/* Scrollable container with gradient mask for scroll indication */}
            <div 
              className="relative overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth"
              style={{
                WebkitOverflowScrolling: 'touch',
                maskImage: 'linear-gradient(to right, transparent, black 10px, black 90%, transparent)',
                maskSize: '100% 100%',
                maskRepeat: 'no-repeat',
              }}
            >
              <div 
                className="flex items-center space-x-0.5 px-3 py-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {/* Primary Navigation Items */}
                {primaryNavigationItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrentPage = item.current;
                  return (
                    <button
                      key={`primary-${item.name}`}
                      onClick={() => handleNavigation(item.href)}
                      className="mobile-nav-button flex-shrink-0"
                    >
                      <div className={`
                        flex flex-col items-center justify-center h-full w-[64px] p-1 rounded-xl
                        transition-all duration-200 transform
                        ${isCurrentPage 
                          ? 'bg-blue-600 text-white shadow-lg scale-100' 
                          : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                        }`
                      }>
                        <Icon className="w-4 h-4 mb-0.5" />
                        <span className="text-xs text-center leading-tight font-medium">
                          {getSimplifiedName(item.name)}
                        </span>
                      </div>
                    </button>
                  );
                })}
                
                {/* Separator */}
                <div className="h-10 w-px bg-gray-200/80 mx-1"></div>

                {/* Quick Menu Items */}
                {mobileQuickMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrentPage = location.pathname === item.href;
                  return (
                    <button
                      key={`quick-${item.name}`}
                      onClick={() => handleNavigation(item.href)}
                      className="mobile-nav-button flex-shrink-0"
                    >
                       <div className={`
                        flex flex-col items-center justify-center h-full w-[64px] p-1 rounded-xl
                        transition-all duration-200 transform
                        ${isCurrentPage 
                          ? 'bg-blue-600 text-white shadow-lg scale-100' 
                          : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                        }`
                      }>
                        <Icon className="w-4 h-4 mb-0.5" />
                        <span className="text-xs text-center leading-tight font-medium">
                          {getSimplifiedName(item.name)}
                        </span>
                      </div>
                    </button>
                  );
                })}
                
                {/* User Actions Section Separator */}
                <div className="h-10 w-px bg-gray-200/80 mx-1"></div>

                {/* User Actions Section */}
                <div className="flex items-center space-x-0.5">
                  {/* Voice Toggle Button */}
                  <button
                    onClick={toggleVoice}
                    className="mobile-nav-button flex-shrink-0"
                  >
                    <div className={`
                      flex flex-col items-center justify-center h-full w-[64px] p-1 rounded-xl
                      transition-all duration-200 transform
                      ${isVoiceEnabled 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                      }`
                    }>
                      {isVoiceEnabled 
                        ? <Mic className="w-4 h-4 mb-0.5" /> 
                        : <MicOff className="w-4 h-4 mb-0.5" />}
                      <span className="text-xs text-center leading-tight font-medium">Voice</span>
                    </div>
                  </button>
                  
                  {/* User Profile Button */}
                  <button
                    onClick={() => {/* TODO: navigate to profile page */}}
                    className="mobile-nav-button flex-shrink-0"
                  >
                    <div className="flex flex-col items-center justify-center h-full w-[64px] p-1 rounded-xl text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-all duration-200">
                      <User className="w-4 h-4 mb-0.5" />
                      <span className="text-xs text-center leading-tight font-medium">Profile</span>
                    </div>
                  </button>
                  
                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="mobile-nav-button flex-shrink-0"
                  >
                    <div className="flex flex-col items-center justify-center h-full w-[64px] p-1 rounded-xl text-red-600 hover:bg-red-50 active:bg-red-100 transition-all duration-200">
                      <LogOut className="w-4 h-4 mb-0.5" />
                      <span className="text-xs text-center leading-tight font-medium">Logout</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 