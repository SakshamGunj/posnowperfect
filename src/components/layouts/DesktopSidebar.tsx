import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
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
  TrendingUp,
  Receipt,
  ShoppingCart,
  ClipboardList,
  Gamepad2,
  UserCheck,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';

export default function DesktopSidebar() {
  const { restaurant } = useRestaurant();
  const { logout } = useRestaurantAuth();
  const { canAccess } = useEmployeePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isPinned, setIsPinned] = useState(() => {
    return localStorage.getItem('sidebarPinned') === 'true';
  });
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = isPinned || isHovered;

  useEffect(() => {
    localStorage.setItem('sidebarPinned', isPinned.toString());
  }, [isPinned]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      if (isExpanded) {
        root.style.setProperty('--sidebar-width','16rem'); /* 64 */
      } else {
        root.style.setProperty('--sidebar-width','5rem'); /* 20 */
      }
    }
  }, [isExpanded]);


  if (!restaurant) return null;

  const handleNavigation = (href: string) => {
    navigate(href);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate(`/${restaurant.slug}/login`);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigationItems = [
    { name: 'Tables', href: `/${restaurant.slug}/tables`, icon: Grid3X3, moduleId: 'tables' },
    { name: 'Orders', href: `/${restaurant.slug}/orders`, icon: ClipboardList, moduleId: 'orders' },
    { name: 'Menu', href: `/${restaurant.slug}/menu`, icon: ChefHat, moduleId: 'menu' },
    { name: 'Inventory', href: `/${restaurant.slug}/inventory`, icon: Package, moduleId: 'inventory' },
    { name: 'Kitchen', href: `/${restaurant.slug}/kitchen`, icon: Store, moduleId: 'kitchen' },
    { name: 'Customers', href: `/${restaurant.slug}/customers`, icon: Users, moduleId: 'customers' },
    { name: 'Credits', href: `/${restaurant.slug}/credits`, icon: CreditCard, moduleId: 'credits' },
    { name: 'Coupons', href: `/${restaurant.slug}/coupons`, icon: Gift, moduleId: 'coupons' },
    { name: 'Reports', href: `/${restaurant.slug}/reports`, icon: TrendingUp, moduleId: 'reports' },
    { name: 'Settings', href: `/${restaurant.slug}/settings`, icon: Settings, moduleId: 'settings' },
  ];
  
  const secondaryNavigation = [
    { name: 'Employees', href: `/${restaurant.slug}/employees`, icon: UserCheck, moduleId: 'employees' },
    { name: 'Expenses', href: `/${restaurant.slug}/expenses`, icon: Receipt, moduleId: 'expenses' },
    { name: 'Marketplace', href: `/${restaurant.slug}/marketplace`, icon: ShoppingCart, moduleId: 'marketplace' },
    { name: 'Gamification', href: `/${restaurant.slug}/gamification`, icon: Gamepad2, moduleId: 'gamification' },
    { name: 'Customer Portal', href: `/${restaurant.slug}/customer-portal`, icon: Smartphone, moduleId: 'customer_portal' },
  ];
  
  const filteredNavItems = navigationItems.filter(item => canAccess(item.moduleId));
  const filteredSecondaryNavItems = secondaryNavigation.filter(item => canAccess(item.moduleId));

  const isCurrent = (href: string) => location.pathname.startsWith(href);

  const NavLink = ({ item }: { item: typeof navigationItems[0] }) => {
    const Icon = item.icon;
    const current = isCurrent(item.href);
    return (
      <li className="relative group">
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); handleNavigation(item.href); }}
          className={`
            flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors duration-150
            ${isExpanded ? 'justify-start' : 'justify-center'}
            ${current
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
            }
          `}
        >
          <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span className={`transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 w-0 hidden'}`}>{item.name}</span>
        </a>
        {current && !isExpanded && (
           <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-1 w-6 bg-indigo-600 rounded-t-full" aria-hidden="true" />
        )}
         {current && isExpanded && (
           <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-indigo-600 rounded-r-full" aria-hidden="true" />
        )}
        {!isExpanded && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {item.name}
          </div>
        )}
      </li>
    );
  };
  
  return (
    <aside 
      className={`group hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 transition-all duration-300 ease-in-out ${isExpanded ? 'lg:w-64' : 'lg:w-20'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col grow gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-3 pb-4">
        <div className={`flex h-16 shrink-0 items-center transition-all duration-300 ${isExpanded ? 'px-3' : 'justify-center'}`}>
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            <Store className="w-5 h-5" />
          </div>
          <h1 className={`text-xl font-bold text-gray-900 ml-3 whitespace-nowrap overflow-hidden transition-all duration-200 ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'}`}>{restaurant.name}</h1>
        </div>
        <nav className="flex-1 flex flex-col">
          <ul role="list" className="flex-1 flex flex-col gap-y-7">
            <li>
              <ul role="list" className="space-y-1">
                {filteredNavItems.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </ul>
            </li>
            <li>
              <div className={`text-xs font-semibold leading-6 text-gray-400 transition-all duration-300 ${isExpanded ? 'px-2' : 'text-center'}`}>
                {isExpanded ? 'Tools & Integrations' : '···'}
              </div>
              <ul role="list" className="mt-2 space-y-1">
                {filteredSecondaryNavItems.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </ul>
            </li>
            <li className="mt-auto -mx-1">
              <button
                onClick={() => setIsPinned(!isPinned)}
                className="flex items-center w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 hover:text-indigo-600 hover:bg-gray-50"
              >
                 <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                    {isPinned ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                 </div>
                <span className={`transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 w-0 hidden'}`}>{isPinned ? 'Unpin' : 'Pin'}</span>
              </button>
              <div className="relative mt-1 group">
                 <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleLogout(); }}
                  className={`
                    flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 hover:text-red-600 hover:bg-red-50
                    ${isExpanded ? 'justify-start' : 'justify-center'}
                  `}
                >
                  <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                    <LogOut size={20} />
                  </div>
                  <span className={`transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 w-0 hidden'}`}>Logout</span>
                </a>
                 {!isExpanded && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    Logout
                  </div>
                )}
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
} 