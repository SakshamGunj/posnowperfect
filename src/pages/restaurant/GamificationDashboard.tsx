import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Plus,
  Grid3X3,
  Copy,
  ExternalLink,
  Edit,
  Trash2,
  BarChart3,
  Users,
  Award,
  Save,
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { GamificationService } from '@/services/gamificationService';
import { LoyaltyPointsService } from '@/services/loyaltyPointsService';
import { SpinWheelConfig, SpinWheelSegment, SpinWheelStats, PointsConfig, PointsThreshold } from '@/types';
// Removed unused utility imports

interface SpinWheelForm {
  name: string;
  maxSpinsPerCustomer: number;
  requiresContactInfo: boolean;
  termsAndConditions: string;
  // Points configuration
  enablePoints: boolean;
  pointsPerSpin: number;
  resetPeriod: 'never' | 'monthly' | 'yearly';
}

export default function GamificationDashboard() {
  const { restaurant } = useRestaurant();

  const [spinWheels, setSpinWheels] = useState<SpinWheelConfig[]>([]);
  const [selectedWheel, setSelectedWheel] = useState<SpinWheelConfig | null>(null);
  const [wheelStats, setWheelStats] = useState<SpinWheelStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [editingSegments, setEditingSegments] = useState<SpinWheelSegment[]>([]);
  const [createSegments, setCreateSegments] = useState<SpinWheelSegment[]>([]);
  
  // Points configuration state
  const [editingThresholds, setEditingThresholds] = useState<PointsThreshold[]>([]);
  const [createThresholds, setCreateThresholds] = useState<PointsThreshold[]>(LoyaltyPointsService.getDefaultThresholds());

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SpinWheelForm>({
    defaultValues: {
      maxSpinsPerCustomer: 3,
      requiresContactInfo: true,
      termsAndConditions: 'Terms and conditions apply. Up to 3 spins per customer per day. Offers cannot be combined with other promotions.',
      enablePoints: true,
      pointsPerSpin: 10,
      resetPeriod: 'never',
    }
  });

  useEffect(() => {
    if (restaurant) {
      loadSpinWheels();
    }
  }, [restaurant]);

  const loadSpinWheels = async () => {
    if (!restaurant) return;

    try {
      setIsLoading(true);
      const result = await GamificationService.getSpinWheelsForRestaurant(restaurant.id);
      
      if (result.success && result.data) {
        setSpinWheels(result.data);
      } else {
        toast.error(result.error || 'Failed to load spin wheels');
      }
    } catch (error) {
      toast.error('Failed to load spin wheels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSpinWheel = async (data: SpinWheelForm) => {
    if (!restaurant) return;

    try {
      const pointsConfig: PointsConfig = {
        enabled: data.enablePoints,
        pointsPerSpin: data.pointsPerSpin,
        thresholds: createThresholds,
        resetPeriod: data.resetPeriod,
      };

      const spinWheelConfig = {
        name: data.name,
        maxSpinsPerCustomer: data.maxSpinsPerCustomer,
        requiresContactInfo: data.requiresContactInfo,
        termsAndConditions: data.termsAndConditions,
        restaurantId: restaurant.id,
        isActive: true,
        segments: createSegments,
        pointsConfig,
      };

      const result = await GamificationService.createSpinWheel(restaurant.id, spinWheelConfig);
      
      if (result.success) {
        toast.success('Spin wheel created successfully!');
        setShowCreateModal(false);
        setCreateSegments([]);
        setCreateThresholds(LoyaltyPointsService.getDefaultThresholds());
        reset();
        loadSpinWheels();
      } else {
        toast.error(result.error || 'Failed to create spin wheel');
      }
    } catch (error) {
      toast.error('Failed to create spin wheel');
    }
  };

  const handleUpdateSpinWheel = async (data: SpinWheelForm) => {
    if (!restaurant || !selectedWheel) return;

    try {
      const pointsConfig: PointsConfig = {
        enabled: data.enablePoints,
        pointsPerSpin: data.pointsPerSpin,
        thresholds: editingThresholds,
        resetPeriod: data.resetPeriod,
      };

      const updates = {
        name: data.name,
        maxSpinsPerCustomer: data.maxSpinsPerCustomer,
        requiresContactInfo: data.requiresContactInfo,
        termsAndConditions: data.termsAndConditions,
        segments: editingSegments,
        pointsConfig,
      };

      const result = await GamificationService.updateSpinWheel(restaurant.id, selectedWheel.id, updates);
      
      if (result.success) {
        toast.success('Spin wheel updated successfully!');
        setShowEditModal(false);
        setSelectedWheel(null);
        setEditingSegments([]);
        setEditingThresholds([]);
        loadSpinWheels();
      } else {
        toast.error(result.error || 'Failed to update spin wheel');
      }
    } catch (error) {
      toast.error('Failed to update spin wheel');
    }
  };

  const handleDeleteSpinWheel = async (wheelId: string) => {
    if (!restaurant) return;

    if (!confirm('Are you sure you want to delete this spin wheel? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await GamificationService.deleteSpinWheel(restaurant.id, wheelId);
      
      if (result.success) {
        toast.success('Spin wheel deleted successfully');
        loadSpinWheels();
      } else {
        toast.error(result.error || 'Failed to delete spin wheel');
      }
    } catch (error) {
      toast.error('Failed to delete spin wheel');
    }
  };

  const handleToggleActive = async (wheel: SpinWheelConfig) => {
    if (!restaurant) return;

    try {
      const result = await GamificationService.updateSpinWheel(restaurant.id, wheel.id, {
        isActive: !wheel.isActive
      });
      
      if (result.success) {
        toast.success(`Spin wheel ${wheel.isActive ? 'deactivated' : 'activated'}`);
        loadSpinWheels();
      } else {
        toast.error(result.error || 'Failed to update spin wheel');
      }
    } catch (error) {
      toast.error('Failed to update spin wheel');
    }
  };

  const loadWheelStats = async (wheel: SpinWheelConfig) => {
    if (!restaurant) return;

    try {
      const result = await GamificationService.getSpinWheelStats(restaurant.id, wheel.id);
      
      if (result.success && result.data) {
        setWheelStats(result.data);
        setSelectedWheel(wheel);
        setShowStatsModal(true);
      } else {
        toast.error(result.error || 'Failed to load stats');
      }
    } catch (error) {
      toast.error('Failed to load stats');
    }
  };

  const copyShareableLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  };

  const openEditModal = (wheel: SpinWheelConfig) => {
    setSelectedWheel(wheel);
    setEditingSegments([...wheel.segments]);
    setEditingThresholds(wheel.pointsConfig?.thresholds || LoyaltyPointsService.getDefaultThresholds());
    reset({
      name: wheel.name,
      maxSpinsPerCustomer: wheel.maxSpinsPerCustomer,
      requiresContactInfo: wheel.requiresContactInfo,
      termsAndConditions: wheel.termsAndConditions,
      enablePoints: wheel.pointsConfig?.enabled || false,
      pointsPerSpin: wheel.pointsConfig?.pointsPerSpin || 10,
      resetPeriod: wheel.pointsConfig?.resetPeriod || 'never',
    });
    setShowEditModal(true);
  };

  const updateSegment = (index: number, field: keyof SpinWheelSegment, value: any) => {
    const newSegments = [...editingSegments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    setEditingSegments(newSegments);
  };

  const updateCreateSegment = (index: number, field: keyof SpinWheelSegment, value: any) => {
    const newSegments = [...createSegments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    setCreateSegments(newSegments);
  };

  // Threshold management functions
  const updateCreateThreshold = (index: number, field: keyof PointsThreshold, value: any) => {
    const newThresholds = [...createThresholds];
    newThresholds[index] = { ...newThresholds[index], [field]: value };
    setCreateThresholds(newThresholds);
  };

  const updateEditThreshold = (index: number, field: keyof PointsThreshold, value: any) => {
    const newThresholds = [...editingThresholds];
    newThresholds[index] = { ...newThresholds[index], [field]: value };
    setEditingThresholds(newThresholds);
  };

  const addCreateThreshold = () => {
    const newId = `custom_${Date.now()}`;
    const newThreshold: PointsThreshold = {
      id: newId,
      name: 'New Level',
      pointsRequired: 100,
      benefits: ['Custom benefit'],
      color: '#808080',
      badgeIcon: '🎖️',
      description: 'Custom loyalty level'
    };
    setCreateThresholds([...createThresholds, newThreshold]);
  };

  const removeCreateThreshold = (index: number) => {
    if (createThresholds.length > 1) {
      const newThresholds = createThresholds.filter((_, i) => i !== index);
      setCreateThresholds(newThresholds);
    }
  };

  const addEditThreshold = () => {
    const newId = `custom_${Date.now()}`;
    const newThreshold: PointsThreshold = {
      id: newId,
      name: 'New Level',
      pointsRequired: 100,
      benefits: ['Custom benefit'],
      color: '#808080',
      badgeIcon: '🎖️',
      description: 'Custom loyalty level'
    };
    setEditingThresholds([...editingThresholds, newThreshold]);
  };

  const removeEditThreshold = (index: number) => {
    if (editingThresholds.length > 1) {
      const newThresholds = editingThresholds.filter((_, i) => i !== index);
      setEditingThresholds(newThresholds);
    }
  };

  // Removed unused defaultColors array

  if (!restaurant) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => window.history.back()}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                <Grid3X3 className="w-6 h-6" />
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gamification Tools</h1>
                <p className="text-gray-600">Create engaging spin wheel games for your customers</p>
              </div>
            </div>

            <button
              onClick={() => {
                console.log('Create button clicked');
                setCreateSegments(GamificationService.getDefaultSegments());
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Spin Wheel</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Grid3X3 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Wheels</p>
                <p className="text-2xl font-bold text-gray-900">{spinWheels.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active Wheels</p>
                <p className="text-2xl font-bold text-gray-900">
                  {spinWheels.filter(w => w.isActive).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Spins</p>
                <p className="text-2xl font-bold text-gray-900">
                  {spinWheels.reduce((sum, wheel) => sum + wheel.totalSpins, 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Award className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Redemptions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {spinWheels.reduce((sum, wheel) => sum + wheel.totalRedemptions, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Spin Wheels List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Spin Wheels</h2>
            <p className="text-gray-600">Manage your customer engagement games</p>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Loading spin wheels...</p>
            </div>
          ) : spinWheels.length === 0 ? (
            <div className="p-12 text-center">
              <Grid3X3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Spin Wheels Yet</h3>
              <p className="text-gray-600 mb-6">Create your first spin wheel to start engaging customers with fun rewards!</p>
              <button
                onClick={() => {
                  console.log('Create first button clicked');
                  setCreateSegments(GamificationService.getDefaultSegments());
                  setShowCreateModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Your First Spin Wheel
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {spinWheels.map((wheel) => (
                <div key={wheel.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">{wheel.name}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          wheel.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {wheel.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex items-center space-x-6 text-sm text-gray-600">
                        <span>
                          <Users className="w-4 h-4 inline mr-1" />
                          {wheel.totalSpins} spins
                        </span>
                        <span>
                          <Award className="w-4 h-4 inline mr-1" />
                          {wheel.totalRedemptions} redeemed
                        </span>
                        <span>
                          Max {wheel.maxSpinsPerCustomer} per customer
                        </span>
                        <span>
                          {wheel.segments.length} segments
                        </span>
                      </div>

                      <div className="mt-3 flex items-center space-x-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {wheel.shareableLink}
                        </code>
                        <button
                          onClick={() => copyShareableLink(wheel.shareableLink)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={wheel.shareableLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => loadWheelStats(wheel)}
                        className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        title="View analytics"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => openEditModal(wheel)}
                        className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Edit wheel"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleToggleActive(wheel)}
                        className={`p-2 rounded-lg transition-colors ${
                          wheel.isActive 
                            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                            : 'bg-green-100 text-green-600 hover:bg-green-200'
                        }`}
                        title={wheel.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {wheel.isActive ? <XCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => handleDeleteSpinWheel(wheel.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="Delete wheel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Spin Wheel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create New Spin Wheel</h2>
              <p className="text-gray-600 mt-1">Configure your wheel settings and customize each segment's offers</p>
            </div>

            <form onSubmit={handleSubmit(handleCreateSpinWheel)} className="overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="p-6 space-y-6">
                {/* Basic Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wheel Name *
                    </label>
                    <input
                      type="text"
                      {...register('name', { required: 'Wheel name is required' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Weekend Special Rewards"
                    />
                    {errors.name && (
                      <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Spins Per Customer (Daily)
                    </label>
                    <select 
                      {...register('maxSpinsPerCustomer')} 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>1 spin per day</option>
                      <option value={2}>2 spins per day</option>
                      <option value={3}>3 spins per day</option>
                      <option value={0}>Unlimited</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...register('requiresContactInfo')}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Require customer contact info before spinning
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Collect phone number or email to build your customer database
                  </p>
                </div>

                {/* Segments Configuration */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Configure Your 8 Wheel Segments</h3>
                    <div className="text-sm text-gray-500">
                      Customize offers, colors, and win probability for each segment
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {createSegments.map((segment, index) => (
                      <div key={segment.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">Segment {index + 1}</h4>
                          <div 
                            className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: segment.color }}
                          />
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Offer Title (appears on wheel)
                            </label>
                            <input
                              type="text"
                              value={segment.label}
                              onChange={(e) => updateCreateSegment(index, 'label', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="e.g., 10% Off, Free Drink"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Full Offer Description
                            </label>
                            <textarea
                              rows={2}
                              value={segment.value}
                              onChange={(e) => updateCreateSegment(index, 'value', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="e.g., 10% discount on your next order"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Color
                              </label>
                              <input
                                type="color"
                                value={segment.color}
                                onChange={(e) => updateCreateSegment(index, 'color', e.target.value)}
                                className="w-full h-8 rounded border border-gray-300"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Win Chance
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={segment.probability}
                                onChange={(e) => updateCreateSegment(index, 'probability', parseInt(e.target.value))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Type
                              </label>
                              <select
                                value={segment.rewardType}
                                onChange={(e) => updateCreateSegment(index, 'rewardType', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="discount_percentage">% Off</option>
                                <option value="discount_fixed">$ Off</option>
                                <option value="free_item">Free Item</option>
                                <option value="points">Points</option>
                                <option value="custom">Custom</option>
                              </select>
                            </div>
                          </div>

                          {(segment.rewardType === 'discount_percentage' || segment.rewardType === 'discount_fixed') && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                {segment.rewardType === 'discount_percentage' ? 'Percentage (%)' : 'Amount ($)'}
                              </label>
                              <input
                                type="number"
                                step={segment.rewardType === 'discount_percentage' ? '1' : '0.01'}
                                value={segment.rewardValue || 0}
                                onChange={(e) => updateCreateSegment(index, 'rewardValue', parseFloat(e.target.value))}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={segment.rewardType === 'discount_percentage' ? '10' : '5.00'}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg mt-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Pro Tips:</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• Higher win chances = more customers win = higher engagement</li>
                      <li>• Mix high-value prizes (low chance) with small prizes (high chance)</li>
                      <li>• Use bright, contrasting colors for better visibility</li>
                      <li>• "Better Luck" segments create anticipation for return visits</li>
                    </ul>
                  </div>
                </div>

                {/* Points & Loyalty Configuration */}
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Award className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Loyalty Points System</h3>
                      <p className="text-sm text-gray-600">Reward customers with points to build loyalty</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        {...register('enablePoints')}
                        className="rounded border-gray-300 h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label className="text-sm font-medium text-gray-700">
                        Enable Points & Loyalty Levels
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points Per Spin
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          {...register('pointsPerSpin')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="10"
                        />
                        <p className="text-xs text-gray-500 mt-1">Points awarded for each spin</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points Reset Period
                        </label>
                        <select 
                          {...register('resetPeriod')} 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="never">Never Reset</option>
                          <option value="yearly">Reset Yearly</option>
                          <option value="monthly">Reset Monthly</option>
                        </select>
                      </div>
                    </div>

                    {/* Loyalty Thresholds */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900">Loyalty Levels & Rewards</h4>
                        <button
                          type="button"
                          onClick={addCreateThreshold}
                          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                        >
                          Add Level
                        </button>
                      </div>

                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {createThresholds.map((threshold, index) => (
                          <div key={threshold.id} className="bg-white p-4 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{threshold.badgeIcon}</span>
                                <input
                                  type="text"
                                  value={threshold.name}
                                  onChange={(e) => updateCreateThreshold(index, 'name', e.target.value)}
                                  className="text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                                  placeholder="Level Name"
                                />
                              </div>
                              {createThresholds.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCreateThreshold(index)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Points Required</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={threshold.pointsRequired}
                                  onChange={(e) => updateCreateThreshold(index, 'pointsRequired', parseInt(e.target.value))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Badge Color</label>
                                <input
                                  type="color"
                                  value={threshold.color}
                                  onChange={(e) => updateCreateThreshold(index, 'color', e.target.value)}
                                  className="w-full h-8 rounded border border-gray-300"
                                />
                              </div>
                            </div>

                            <div className="mt-3">
                              <label className="block text-xs text-gray-600 mb-1">Benefits (one per line)</label>
                              <textarea
                                rows={2}
                                value={threshold.benefits.join('\n')}
                                onChange={(e) => updateCreateThreshold(index, 'benefits', e.target.value.split('\n').filter(b => b.trim()))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="5% discount&#10;Priority support"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-lg">
                      <h5 className="text-xs font-medium text-purple-900 mb-1">🎯 Points Strategy Tips:</h5>
                      <ul className="text-xs text-purple-800 space-y-1">
                        <li>• Start with 10-20 points per spin for good engagement</li>
                        <li>• Set achievable first level (50-100 points) for quick wins</li>
                        <li>• Space out levels to maintain progression motivation</li>
                        <li>• Offer meaningful benefits at each level</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Terms & Conditions
                  </label>
                  <textarea
                    {...register('termsAndConditions')}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter terms and conditions for this promotion..."
                  />
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-green-900 mb-2">✨ Ready to Launch?</h3>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Your spin wheel will be created with your custom segments</li>
                    <li>• A unique shareable link will be generated automatically</li>
                    <li>• Share via QR codes, social media, or directly with customers</li>
                    <li>• Start tracking engagement and redemptions immediately!</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateSegments([]);
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Spin Wheel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Spin Wheel Modal */}
      {showEditModal && selectedWheel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Spin Wheel</h2>
              <p className="text-gray-600 mt-1">Customize your spin wheel settings and segments</p>
            </div>

            <form onSubmit={handleSubmit(handleUpdateSpinWheel)} className="overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="p-6 space-y-6">
                {/* Basic Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wheel Name *
                    </label>
                    <input
                      type="text"
                      {...register('name', { required: 'Wheel name is required' })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Spins Per Customer (Daily)
                    </label>
                    <select {...register('maxSpinsPerCustomer')} className="input">
                      <option value={1}>1 spin per day</option>
                      <option value={2}>2 spins per day</option>
                      <option value={3}>3 spins per day</option>
                      <option value={0}>Unlimited</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...register('requiresContactInfo')}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Require customer contact info
                    </span>
                  </label>
                </div>

                {/* Segments Configuration */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Configure Segments</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {editingSegments.map((segment, index) => (
                      <div key={segment.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">Segment {index + 1}</h4>
                          <div 
                            className="w-6 h-6 rounded-full border-2 border-gray-300"
                            style={{ backgroundColor: segment.color }}
                          />
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Label
                            </label>
                            <input
                              type="text"
                              value={segment.label}
                              onChange={(e) => updateSegment(index, 'label', e.target.value)}
                              className="input text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={segment.value}
                              onChange={(e) => updateSegment(index, 'value', e.target.value)}
                              className="input text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Color
                              </label>
                              <input
                                type="color"
                                value={segment.color}
                                onChange={(e) => updateSegment(index, 'color', e.target.value)}
                                className="w-full h-8 rounded border border-gray-300"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Weight (1-100)
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={segment.probability}
                                onChange={(e) => updateSegment(index, 'probability', parseInt(e.target.value))}
                                className="input text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Reward Type
                            </label>
                            <select
                              value={segment.rewardType}
                              onChange={(e) => updateSegment(index, 'rewardType', e.target.value)}
                              className="input text-sm"
                            >
                              <option value="discount_percentage">Percentage Discount</option>
                              <option value="discount_fixed">Fixed Amount Discount</option>
                              <option value="free_item">Free Item</option>
                              <option value="points">Loyalty Points</option>
                              <option value="custom">Custom Reward</option>
                            </select>
                          </div>

                          {(segment.rewardType === 'discount_percentage' || segment.rewardType === 'discount_fixed') && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                {segment.rewardType === 'discount_percentage' ? 'Percentage' : 'Amount'}
                              </label>
                              <input
                                type="number"
                                value={segment.rewardValue || 0}
                                onChange={(e) => updateSegment(index, 'rewardValue', parseFloat(e.target.value))}
                                className="input text-sm"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Points & Loyalty Configuration */}
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Award className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Loyalty Points System</h3>
                      <p className="text-sm text-gray-600">Manage customer loyalty and engagement</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        {...register('enablePoints')}
                        className="rounded border-gray-300 h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label className="text-sm font-medium text-gray-700">
                        Enable Points & Loyalty Levels
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points Per Spin
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          {...register('pointsPerSpin')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points Reset Period
                        </label>
                        <select 
                          {...register('resetPeriod')} 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="never">Never Reset</option>
                          <option value="yearly">Reset Yearly</option>
                          <option value="monthly">Reset Monthly</option>
                        </select>
                      </div>
                    </div>

                    {/* Loyalty Thresholds */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900">Loyalty Levels & Rewards</h4>
                        <button
                          type="button"
                          onClick={addEditThreshold}
                          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                        >
                          Add Level
                        </button>
                      </div>

                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {editingThresholds.map((threshold, index) => (
                          <div key={threshold.id} className="bg-white p-4 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{threshold.badgeIcon}</span>
                                <input
                                  type="text"
                                  value={threshold.name}
                                  onChange={(e) => updateEditThreshold(index, 'name', e.target.value)}
                                  className="text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                                />
                              </div>
                              {editingThresholds.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeEditThreshold(index)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Points Required</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={threshold.pointsRequired}
                                  onChange={(e) => updateEditThreshold(index, 'pointsRequired', parseInt(e.target.value))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Badge Color</label>
                                <input
                                  type="color"
                                  value={threshold.color}
                                  onChange={(e) => updateEditThreshold(index, 'color', e.target.value)}
                                  className="w-full h-8 rounded border border-gray-300"
                                />
                              </div>
                            </div>

                            <div className="mt-3">
                              <label className="block text-xs text-gray-600 mb-1">Benefits (one per line)</label>
                              <textarea
                                rows={2}
                                value={threshold.benefits.join('\n')}
                                onChange={(e) => updateEditThreshold(index, 'benefits', e.target.value.split('\n').filter(b => b.trim()))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Terms & Conditions
                  </label>
                  <textarea
                    {...register('termsAndConditions')}
                    rows={3}
                    className="input"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && selectedWheel && wheelStats && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{selectedWheel.name} - Analytics</h2>
              <p className="text-gray-600 mt-1">Performance insights and customer engagement metrics</p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{wheelStats.totalSpins}</div>
                  <div className="text-sm text-gray-600">Total Spins</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{wheelStats.totalRedemptions}</div>
                  <div className="text-sm text-gray-600">Redeemed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{wheelStats.redemptionRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Redemption Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{wheelStats.customerEngagement.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Engagement</div>
                </div>
              </div>

              {/* Popular Segments */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Most Popular Segments</h3>
                <div className="space-y-3">
                  {wheelStats.popularSegments.slice(0, 5).map((segment, index) => (
                    <div key={segment.segmentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                        <span className="text-sm text-gray-900">{segment.label}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-600">{segment.count} spins</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 