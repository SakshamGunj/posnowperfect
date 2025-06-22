import React, { useState, useEffect } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { MenuService } from '@/services/menuService';
import { TableService } from '@/services/tableService';
import { MenuItem, Table } from '@/types';
import toast from 'react-hot-toast';
import {
  MapPin,
  QrCode,
  Smartphone,
  Eye,
  Copy,
  Download,
  Settings,
  Globe,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Palette,
  RefreshCw,
  Users,
  ShoppingCart,
  Utensils,
  ChefHat,
  ToggleLeft,
  ToggleRight,
  Save,
  Clock
} from 'lucide-react';

interface CustomerPortalSettings {
  isEnabled: boolean;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    radius: number; // meters for verification
  };
  customization: {
    primaryColor: string;
    logo: string;
    welcomeMessage: string;
    orderingInstructions: string;
  };
  security: {
    locationVerification: boolean;
    phoneVerification: boolean;
    maxOrderValue: number;
    operatingHours: {
      enabled: boolean;
      open: string;
      close: string;
    };
  };
}

export default function CustomerMenuPortal() {
  const { restaurant } = useRestaurant();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [portalType, setPortalType] = useState<'single' | 'table-specific'>('single');
  const [portalSettings, setPortalSettings] = useState<CustomerPortalSettings>({
    isEnabled: false,
    location: {
      latitude: 0,
      longitude: 0,
      address: '',
      radius: 100
    },
    customization: {
      primaryColor: '#3B82F6',
      logo: '',
      welcomeMessage: 'Welcome! Browse our menu and place your order.',
      orderingInstructions: 'Scan the QR code at your table to get started.'
    },
    security: {
      locationVerification: true,
      phoneVerification: true,
      maxOrderValue: 5000,
      operatingHours: {
        enabled: true,
        open: '09:00',
        close: '22:00'
      }
    }
  });
  const [portalUrl, setPortalUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [portalStats, setPortalStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    conversionRate: 0
  });

  useEffect(() => {
    if (restaurant) {
      loadMenuItems();
      loadTables();
      loadPortalSettings();
      generatePortalUrl();
    }
  }, [restaurant]);

  const loadMenuItems = async () => {
    if (!restaurant) return;

    try {
      const result = await MenuService.getMenuItemsForRestaurant(restaurant.id);
      if (result.success && result.data) {
        setMenuItems(result.data.filter(item => item.isAvailable));
      }
    } catch (error) {
      console.error('Failed to load menu items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTables = async () => {
    if (!restaurant) return;

    try {
      const result = await TableService.getTablesForRestaurant(restaurant.id);
      if (result.success && result.data) {
        setTables(result.data.filter(table => table.isActive));
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  };

  const loadPortalSettings = () => {
    if (!restaurant) return;

    // Load from localStorage for now (in production, this would be from database)
    const savedSettings = localStorage.getItem(`portal_settings_${restaurant.id}`);
    if (savedSettings) {
      setPortalSettings(JSON.parse(savedSettings));
    } else {
      // Initialize with default settings
      console.log('📝 Initializing default portal settings for admin dashboard');
      const defaultSettings = {
        isEnabled: false, // Disabled by default in admin (they need to configure)
        location: {
          latitude: 0,
          longitude: 0,
          address: '',
          radius: 100
        },
        customization: {
          primaryColor: '#3B82F6',
          logo: '',
          welcomeMessage: `Welcome to ${restaurant.name}! Browse our menu and place your order.`,
          orderingInstructions: 'Scan the QR code at your table to get started.'
        },
        security: {
          locationVerification: true,
          phoneVerification: true,
          maxOrderValue: 5000,
          operatingHours: {
            enabled: false, // Start disabled for easier setup
            open: '09:00',
            close: '22:00'
          }
        }
      };
      setPortalSettings(defaultSettings);
    }
  };

  const savePortalSettings = async () => {
    if (!restaurant) return;

    try {
      // Save to localStorage for now (in production, this would be database)
      localStorage.setItem(`portal_settings_${restaurant.id}`, JSON.stringify(portalSettings));
      toast.success('Portal settings saved successfully!');
    } catch (error) {
      console.error('Failed to save portal settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const generatePortalUrl = () => {
    if (!restaurant) return;
    
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/${restaurant.slug}/menu-portal`;
    setPortalUrl(url);
    
    // Generate QR code URL
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    setQrCodeUrl(qrUrl);
  };

  const generateTableSpecificUrl = (tableId: string) => {
    if (!restaurant) return '';
    
    const baseUrl = window.location.origin;
    return `${baseUrl}/${restaurant.slug}/menu-portal/${tableId}`;
  };

  const generateTableSpecificQR = (tableId: string) => {
    const url = generateTableSpecificUrl(tableId);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
  };

  const copyTableUrl = (tableId: string) => {
    const url = generateTableSpecificUrl(tableId);
    navigator.clipboard.writeText(url);
    toast.success('Table-specific URL copied to clipboard!');
  };

  const downloadTableQR = (tableId: string, tableNumber: string) => {
    const qrUrl = generateTableSpecificQR(tableId);
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `${restaurant?.name || 'restaurant'}-table-${tableNumber}-qr.png`;
    link.click();
  };

  const requestLocationPermission = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
        setPortalSettings(prev => ({
          ...prev,
          location: {
            latitude,
            longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            radius: prev.location.radius
          }
        }));

      toast.success('Restaurant location set successfully!');
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('Failed to get location. Please try again.');
    }
  };

  const copyPortalUrl = () => {
    navigator.clipboard.writeText(portalUrl);
    toast.success('Portal URL copied to clipboard!');
  };

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `${restaurant?.name || 'restaurant'}-menu-qr.png`;
    link.click();
  };

  const togglePortal = async () => {
    if (!portalSettings.isEnabled && (!portalSettings.location.latitude || !portalSettings.location.longitude)) {
      toast.error('Please set restaurant location first!');
      return;
    }

    setPortalSettings(prev => ({ ...prev, isEnabled: !prev.isEnabled }));
    
    setTimeout(() => {
      savePortalSettings();
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Customer Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Customer Menu Portal</h1>
                <p className="text-gray-600">Enable customers to order directly from their phones</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm ${
                portalSettings.isEnabled 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  portalSettings.isEnabled ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <span>{portalSettings.isEnabled ? 'Portal Active' : 'Portal Inactive'}</span>
              </div>
              
              <button
                onClick={togglePortal}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  portalSettings.isEnabled
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {portalSettings.isEnabled ? 'Disable Portal' : 'Enable Portal'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Location Setup */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center space-x-3 mb-6">
                <MapPin className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Restaurant Location</h2>
              </div>
              
              {!portalSettings.location.latitude ? (
                <div className="text-center py-8">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Set Your Restaurant Location</h3>
                  <p className="text-gray-600 mb-6">
                    This helps verify customers are actually at your restaurant when placing orders.
                  </p>
                  <button
                    onClick={requestLocationPermission}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <MapPin className="w-5 h-5 mr-2 inline" />
                    Set Restaurant Location
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-green-900">Location Set Successfully</h4>
                      <p className="text-green-700 mt-1">{portalSettings.location.address}</p>
                      <p className="text-green-600 text-sm mt-1">
                        Coordinates: {portalSettings.location.latitude.toFixed(6)}, {portalSettings.location.longitude.toFixed(6)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Verification Radius (meters)
                      </label>
                      <input
                        type="number"
                        value={portalSettings.location.radius}
                        onChange={(e) => setPortalSettings(prev => ({
                          ...prev,
                          location: { ...prev.location, radius: parseInt(e.target.value) || 100 }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="50"
                        max="500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Recommended: 100-200 meters</p>
                    </div>
                    
                    <div className="flex items-end">
                      <button
                        onClick={requestLocationPermission}
                        className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4 mr-2 inline" />
                        Update Location
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Portal Customization */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Palette className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">Portal Customization</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Welcome Message
                  </label>
                  <input
                    type="text"
                    value={portalSettings.customization.welcomeMessage}
                    onChange={(e) => setPortalSettings(prev => ({
                      ...prev,
                      customization: { ...prev.customization, welcomeMessage: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Welcome! Browse our menu and place your order."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordering Instructions
                  </label>
                  <input
                    type="text"
                    value={portalSettings.customization.orderingInstructions}
                    onChange={(e) => setPortalSettings(prev => ({
                      ...prev,
                      customization: { ...prev.customization, orderingInstructions: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Scan the QR code at your table to get started."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Brand Colors & Appearance
                  </label>
                  
                  {/* Primary Color Picker */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Primary Brand Color
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={portalSettings.customization.primaryColor}
                        onChange={(e) => setPortalSettings(prev => ({
                          ...prev,
                          customization: { ...prev.customization, primaryColor: e.target.value }
                        }))}
                        className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={portalSettings.customization.primaryColor}
                        onChange={(e) => setPortalSettings(prev => ({
                          ...prev,
                          customization: { ...prev.customization, primaryColor: e.target.value }
                        }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="#6366F1"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Used for selected categories and action buttons</p>
                  </div>

                  {/* Preset Color Options */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Quick Color Presets
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        { name: 'Blue', color: '#3B82F6' },
                        { name: 'Purple', color: '#8B5CF6' },
                        { name: 'Pink', color: '#EC4899' },
                        { name: 'Red', color: '#EF4444' },
                        { name: 'Orange', color: '#F97316' },
                        { name: 'Green', color: '#10B981' },
                        { name: 'Teal', color: '#14B8A6' },
                        { name: 'Indigo', color: '#6366F1' },
                        { name: 'Rose', color: '#F43F5E' },
                        { name: 'Emerald', color: '#059669' },
                        { name: 'Violet', color: '#7C3AED' },
                        { name: 'Amber', color: '#F59E0B' }
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => setPortalSettings(prev => ({
                            ...prev,
                            customization: { ...prev.customization, primaryColor: preset.color }
                          }))}
                          className={`w-10 h-10 rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                            portalSettings.customization.primaryColor === preset.color
                              ? 'border-gray-900 ring-2 ring-gray-400'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Preview
                    </label>
                    <div className="flex space-x-2">
                      <div 
                        className="px-4 py-2 rounded-lg text-white font-medium text-sm"
                        style={{ backgroundColor: portalSettings.customization.primaryColor }}
                      >
                        Selected Category
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium text-sm">
                        Unselected Category
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Settings className="w-6 h-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Security Settings</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Location Verification</h4>
                    <p className="text-sm text-gray-600">Verify customers are at restaurant location</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={portalSettings.security.locationVerification}
                      onChange={(e) => setPortalSettings(prev => ({
                        ...prev,
                        security: { ...prev.security, locationVerification: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Phone Verification</h4>
                    <p className="text-sm text-gray-600">Require phone number verification for orders</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={portalSettings.security.phoneVerification}
                      onChange={(e) => setPortalSettings(prev => ({
                        ...prev,
                        security: { ...prev.security, phoneVerification: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Order Value (₹)
                    </label>
                    <input
                      type="number"
                      value={portalSettings.security.maxOrderValue}
                      onChange={(e) => setPortalSettings(prev => ({
                        ...prev,
                        security: { ...prev.security, maxOrderValue: parseInt(e.target.value) || 5000 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="500"
                      max="50000"
                      step="500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operating Hours
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="time"
                        value={portalSettings.security.operatingHours.open}
                        onChange={(e) => setPortalSettings(prev => ({
                          ...prev,
                          security: { 
                            ...prev.security, 
                            operatingHours: { ...prev.security.operatingHours, open: e.target.value }
                          }
                        }))}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-gray-500">-</span>
                      <input
                        type="time"
                        value={portalSettings.security.operatingHours.close}
                        onChange={(e) => setPortalSettings(prev => ({
                          ...prev,
                          security: { 
                            ...prev.security, 
                            operatingHours: { ...prev.security.operatingHours, close: e.target.value }
                          }
                        }))}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={savePortalSettings}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Save Settings
              </button>
            </div>
          </div>

          {/* Sidebar - Portal Info & QR Code */}
          <div className="space-y-6">
            
            {/* Portal Type Selection */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Settings className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Portal Type</h3>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                    <input
                      type="radio"
                      name="portalType"
                      value="single"
                      checked={portalType === 'single'}
                      onChange={(e) => setPortalType(e.target.value as 'single' | 'table-specific')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">Single Portal Link</div>
                      <div className="text-sm text-gray-500">One link for entire restaurant (current functionality)</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                    <input
                      type="radio"
                      name="portalType"
                      value="table-specific"
                      checked={portalType === 'table-specific'}
                      onChange={(e) => setPortalType(e.target.value as 'single' | 'table-specific')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">Table-Specific Links</div>
                      <div className="text-sm text-gray-500">Separate link for each table with table tracking</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Portal URL & QR Code */}
            {portalType === 'single' ? (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center space-x-3 mb-6">
                <QrCode className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">General Portal Access</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Portal URL
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={portalUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={copyPortalUrl}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Copy URL"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                
                {qrCodeUrl && (
                  <div className="text-center">
                    <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-xl">
                      <img 
                        src={qrCodeUrl} 
                        alt="Portal QR Code" 
                        className="w-48 h-48"
                      />
                    </div>
                    <div className="flex items-center justify-center space-x-2 mt-4">
                      <button
                        onClick={downloadQRCode}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        <Download className="w-4 h-4 mr-2 inline" />
                        Download QR
                      </button>
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <Eye className="w-4 h-4 mr-2 inline" />
                        Preview
                      </a>
                    </div>
                  </div>
                )}
              </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Users className="w-6 h-6 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Table-Specific Links</h3>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    {tables.length} Tables
                  </span>
            </div>
                
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {tables.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No tables found. Please add tables first.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Group tables by area */}
                      {Object.entries(
                        tables.reduce((acc, table) => {
                          if (!acc[table.area]) acc[table.area] = [];
                          acc[table.area].push(table);
                          return acc;
                        }, {} as Record<string, Table[]>)
                      ).map(([area, areaTables]) => (
                        <div key={area} className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                            <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                            {area}
                            <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                              {areaTables.length} tables
                            </span>
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            {areaTables.map((table) => (
                              <div key={table.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                                    {table.number}
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">Table {table.number}</div>
                                    <div className="text-xs text-gray-500">{table.capacity} seats</div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => copyTableUrl(table.id)}
                                    className="p-2 bg-white hover:bg-gray-100 rounded-lg transition-colors border"
                                    title="Copy Table URL"
                                  >
                                    <Copy className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <button
                                    onClick={() => downloadTableQR(table.id, table.number)}
                                    className="p-2 bg-white hover:bg-gray-100 rounded-lg transition-colors border"
                                    title="Download Table QR"
                                  >
                                    <Download className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <a
                                    href={generateTableSpecificUrl(table.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-white hover:bg-gray-100 rounded-lg transition-colors border"
                                    title="Preview Table Portal"
                                  >
                                    <Eye className="w-4 h-4 text-gray-600" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Portal Stats */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Users className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Portal Overview</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Menu Items</span>
                  <span className="font-semibold text-gray-900">{menuItems.length}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Portal Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    portalSettings.isEnabled 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {portalSettings.isEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Location Set</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    portalSettings.location.latitude 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {portalSettings.location.latitude ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Security Level</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {portalSettings.security.locationVerification && portalSettings.security.phoneVerification ? 'High' : 
                     portalSettings.security.locationVerification || portalSettings.security.phoneVerification ? 'Medium' : 'Basic'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <a
                  href={`/${restaurant?.slug}/menu`}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Utensils className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Manage Menu</span>
                  <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
                </a>
                
                <a
                  href={`/${restaurant?.slug}/orders`}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ShoppingCart className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">View Orders</span>
                  <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
                </a>
                
                <a
                  href={`/${restaurant?.slug}/kitchen`}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChefHat className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Kitchen Display</span>
                  <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 