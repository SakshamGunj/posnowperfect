import { useState, useEffect, useMemo } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { 
  Gift, 
  Plus, 
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical,
  Edit,
  Trash2,
  TrendingUp,
  Tag,
  X,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CouponService } from '@/services/couponService';
import { Coupon, CouponType, CouponStatus } from '@/types/coupon';
import { format } from 'date-fns';

import { GamificationIntegrationService } from "@/services/gamificationIntegrationService";

// Create/Edit Coupon Modal (A placeholder for now)
interface CouponFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  coupon?: any;
  onSave: () => void;
}

const CouponFormModal = ({ isOpen, onClose, coupon, onSave }: CouponFormModalProps) => {
  if (!isOpen) return null;

  // In a real app, this would be a comprehensive form.
  // For this example, it's a simplified placeholder.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">{coupon ? 'Edit Coupon' : 'Create Coupon'}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <p>Coupon form functionality would be here.</p>
          <p className="text-sm text-gray-500 mt-2">
            This is a placeholder to show where the create/edit form would appear.
            The existing complex form logic can be integrated here.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={() => { onSave(); onClose(); }} className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CouponDashboard() {
  const { restaurant } = useRestaurant();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("date-desc");
  const [searchTerm, setSearchTerm] = useState("");

  // State for Spin Wheel coupon search
  const [spinWheelSearchTerm, setSpinWheelSearchTerm] = useState("");
  const [spinWheelSearchResults, setSpinWheelSearchResults] = useState<Coupon[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [redeemingCoupon, setRedeemingCoupon] = useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);


  // Fetch coupons
  useEffect(() => {
    const fetchCoupons = async () => {
      if (!restaurant?.id) return;
      setLoading(true);
      try {
        const response = await CouponService.getCouponsForRestaurant(restaurant.id);
        if (response.success && response.data) {
          setCoupons(response.data);
        } else {
          toast.error('Failed to load coupons.');
        }
      } catch (error) {
        toast.error('An error occurred while fetching coupons.');
      } finally {
        setLoading(false);
      }
    };
    fetchCoupons();
  }, [restaurant?.id]);
  
  // Filter and sort coupons
  const filteredCoupons = useMemo(() => {
    return coupons
      .filter(coupon => {
        const matchesStatus = filter === 'all' || coupon.status === filter;
        const matchesSearch = searchTerm === '' || 
          coupon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          coupon.code.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => new Date(b.validity.startDate).getTime() - new Date(a.validity.startDate).getTime());
  }, [coupons, filter, sort, searchTerm]);

  const handleRedeem = async (coupon: Coupon) => {
    if (!restaurant) return;
    setRedeemingCoupon(coupon.code);
    const toastId = toast.loading(`Redeeming coupon ${coupon.code}...`);

    let result;
    try {
      if (coupon.metadata?.source === 'gamification_spin_wheel') {
        result = await GamificationIntegrationService.redeemGamificationCoupon(
          restaurant.id,
          coupon.code
        );
      } else {
        result = await CouponService.markCouponAsUsed(coupon.id, restaurant.id);
      }

      if (result.success) {
        toast.success(result.message || 'Coupon redeemed successfully!', { id: toastId });
        
        // Optimistically update the UI
        setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, status: 'redeemed' as any } : c));
        setSpinWheelSearchResults(prev => prev.map(c => c.id === coupon.id ? { ...c, status: 'redeemed' as any } : c));

      } else {
        toast.error(result.error || 'Failed to redeem coupon', { id: toastId });
      }
    } catch (e: any) {
      console.error("Redeem error:", e);
      toast.error(e.message || 'Failed to redeem coupon.', { id: toastId });
    } finally {
      setRedeemingCoupon(null);
    }
  };

  const handleSpinWheelSearch = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!restaurant) return;
    if (!spinWheelSearchTerm) {
      setSpinWheelSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    const toastId = toast.loading(`Searching for "${spinWheelSearchTerm}"...`);

    try {
      const result = await GamificationIntegrationService.searchGamificationCoupons(
        restaurant.id,
        spinWheelSearchTerm
      );
      
      if (result.success && result.data) {
        setSpinWheelSearchResults(result.data);
        if (result.data.length > 0) {
            toast.success(`${result.data.length} coupon(s) found.`, { id: toastId });
        } else {
            toast.success(`No coupons found for "${spinWheelSearchTerm}".`, { id: toastId });
        }
      } else {
        toast.error(result.error || 'Failed to search coupons.', { id: toastId });
        setSpinWheelSearchResults([]);
      }
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error(err.message || 'An unexpected error occurred.', { id: toastId });
      setSpinWheelSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreate = () => {
    setSelectedCoupon(null);
    setShowCreateModal(true);
  };

  const handleEdit = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setShowCreateModal(true);
  };

  const handleDelete = async (couponId: string) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      toast.promise(
        CouponService.deleteCoupon(restaurant!.id, couponId),
        {
          loading: 'Deleting coupon...',
          success: () => {
            setCoupons(prev => prev.filter(c => c.id !== couponId));
            return 'Coupon deleted successfully!';
          },
          error: 'Failed to delete coupon.',
        }
      );
    }
  };
  
  // A placeholder save handler
  const handleSave = () => {
    toast.success(selectedCoupon ? 'Coupon updated!' : 'Coupon created!');
    // Here you would refetch the coupons or update the state
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter(c => c.status === 'active').length;
    const used = coupons.reduce((sum, c) => sum + ((c as any).usage?.totalUses || 0), 0);
    const expired = coupons.filter(c => c.status === 'expired').length;
    return { total, active, used, expired };
  }, [coupons]);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
            <h1 className="text-3xl font-bold text-gray-900">Coupon Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your restaurant's promotional campaigns.</p>
            </div>
          <div className="flex items-center gap-3">
            <button className="btn btn-secondary">
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            <button onClick={handleCreate} className="btn btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Create Coupon
              </button>
            </div>
          </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Coupons" value={stats.total} icon={Tag} />
          <StatCard title="Active" value={stats.active} icon={CheckCircle} />
          <StatCard title="Total Usage" value={stats.used} icon={TrendingUp} />
          <StatCard title="Expired" value={stats.expired} icon={Clock} />
        </div>

        {/* Gamification Coupon Redemption */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">Redeem Spin Wheel Coupons</h3>
            <p className="text-sm text-gray-500">Search by winner name or phone number to redeem their prize.</p>
          </div>
          <div className="p-4">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search winner name or phone..."
                value={spinWheelSearchTerm}
                onChange={(e) => setSpinWheelSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {spinWheelSearchTerm && (
            <div className="p-4 border-t">
              {isSearching ? <p>Searching...</p> : 
                spinWheelSearchResults.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {spinWheelSearchResults.map((coupon) => (
                    <div key={coupon.id} className="flex items-center justify-between p-2 border rounded-lg">
              <div>
                        <p className="font-semibold">{coupon.name}</p>
                        <p className="text-sm text-muted-foreground">
                           Winner: {coupon.metadata?.winnerName || 'N/A'} ({coupon.metadata?.winnerPhone || 'N/A'})
                        </p>
                         <p className="text-xs text-muted-foreground">Code: {coupon.code} | Status: <span className={
                           `font-bold ${
                             coupon.status === 'active' ? 'text-green-500' :
                             coupon.status === ('redeemed' as any) ? 'text-yellow-500' :
                             'text-red-500'
                           }`
                         }>{coupon.status}</span></p>
                      </div>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleRedeem(coupon)} 
                        disabled={redeemingCoupon === coupon.code || coupon.status !== 'active'}
                      >
                        {redeemingCoupon === coupon.code ? 'Redeeming...' : 'Redeem'}
                      </button>
                </div>
                  ))}
                </div>
            ) : (
                <p className="text-gray-500 text-sm">No matching spin wheel coupons found.</p>
              )
            }
            </div>
        )}
                </div>
        
        {/* Filters and Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Toolbar */}
          <div className="p-4 border-b flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              </div>
            <div className="flex items-center gap-2 self-start md:self-center">
              <Filter className="w-5 h-5 text-gray-500" />
              <StatusFilterButton value="all" current={filter} setFilter={setFilter} />
              <StatusFilterButton value="active" current={filter} setFilter={setFilter} />
              <StatusFilterButton value="scheduled" current={filter} setFilter={setFilter} />
              <StatusFilterButton value="expired" current={filter} setFilter={setFilter} />
                </div>
              </div>
          
          {/* Coupons List */}
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-center p-8 text-gray-500">Loading coupons...</p>
            ) : filteredCoupons.length === 0 ? (
              <p className="text-center p-8 text-gray-500">No coupons found.</p>
            ) : (
              <div>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                        <th scope="col" className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredCoupons.map((coupon) => (
                        <CouponTableRow
                          key={coupon.id}
                          coupon={coupon}
                          onEdit={() => handleEdit(coupon)}
                          onDelete={() => handleDelete(coupon.id)}
                          onRedeem={() => handleRedeem(coupon)}
                          isRedeeming={redeemingCoupon === coupon.code}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredCoupons.map((coupon) => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
                      onEdit={() => handleEdit(coupon)}
                      onDelete={() => handleDelete(coupon.id)}
                      onRedeem={() => handleRedeem(coupon)}
                      isRedeeming={redeemingCoupon === coupon.code}
                    />
                  ))}
                </div>
              </div>
                    )}
          </div>
        </div>
      </main>

      <CouponFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        coupon={selectedCoupon}
        onSave={handleSave}
      />
    </div>
  );
}

// -- Sub-components --

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
}

const StatCard = ({ title, value, icon: Icon }: StatCardProps) => (
  <div className="bg-white p-3 rounded-lg shadow-sm border flex items-center gap-3">
    <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
      <Icon className="w-5 h-5" />
                    </div>
                    <div>
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
                    </div>
                  </div>
);

interface StatusFilterButtonProps {
  value: string;
  current: string;
  setFilter: (value: string) => void;
}

const StatusFilterButton = ({ value, current, setFilter }: StatusFilterButtonProps) => (
                    <button 
    onClick={() => setFilter(value)}
    className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${
      current === value 
        ? 'bg-blue-600 text-white' 
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    {value}
                    </button>
);

interface CouponTableRowProps {
  coupon: any;
  onEdit: () => void;
  onDelete: () => void;
  onRedeem: () => void;
  isRedeeming: boolean;
}

const CouponTableRow = ({ coupon, onEdit, onDelete, onRedeem, isRedeeming }: CouponTableRowProps) => (
  <tr>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="text-sm font-medium text-gray-900">{coupon.name}</div>
      {coupon.metadata?.userName && (
          <div className="text-xs text-purple-600">
            For: {coupon.metadata.userName} ({coupon.metadata.userPhone})
                      </div>
      )}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{coupon.code}</td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCouponTypeText(coupon.type)}</td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCouponValueText(coupon)}</td>
    <td className="px-6 py-4 whitespace-nowrap">
      <StatusBadge status={coupon.status} />
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
      {format(coupon.validity.endDate, "MMM dd, yyyy")}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button 
        className="btn btn-sm btn-outline"
        onClick={onRedeem} 
        disabled={isRedeeming || coupon.status !== 'active'}
      >
        {isRedeeming ? '...' : 'Redeem'}
                    </button>
      <button onClick={onEdit} className="text-indigo-600 hover:text-indigo-900"><Edit className="w-4 h-4" /></button>
      <button onClick={onDelete} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4" /></button>
    </td>
  </tr>
);

interface CouponCardProps {
  coupon: any;
  onEdit: () => void;
  onDelete: () => void;
  onRedeem: () => void;
  isRedeeming: boolean;
}

const CouponCard = ({ coupon, onEdit, onDelete, onRedeem, isRedeeming }: CouponCardProps) => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden">
    <div className="p-4">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-bold text-gray-800">{coupon.name}</h3>
        <StatusBadge status={coupon.status} />
                      </div>
      {coupon.metadata?.userName && (
          <div className="text-xs text-purple-600 mt-1">
            For: {coupon.metadata.userName} ({coupon.metadata.userPhone})
          </div>
        )}
      <p className="text-sm text-gray-600 mt-1">{coupon.description}</p>
      <div className="mt-4 space-y-2">
        <div className="flex items-center text-sm text-gray-500">
          <Tag className="w-4 h-4 mr-2" /> Code: <span className="font-mono bg-gray-100 px-2 py-1 rounded ml-1">{coupon.code}</span>
                          </div>
        <div className="flex items-center text-sm text-gray-500">
          <Gift className="w-4 h-4 mr-2" /> {getCouponTypeText(coupon.type)}: {getCouponValueText(coupon)}
                            </div>
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="w-4 h-4 mr-2" /> Expires: {format(coupon.validity.endDate, "MMM dd, yyyy")}
                            </div>
                    </div>
                  </div>
    <div className="px-4 py-3 bg-gray-50 flex justify-end items-center gap-2">
                    <button 
            className="btn btn-sm" 
            onClick={onRedeem} 
            disabled={isRedeeming || coupon.status !== 'active'}
        >
            {isRedeeming ? 'Redeeming...' : 'Redeem'}
                    </button>
        <button onClick={onEdit} className="p-2 text-gray-500 hover:text-gray-700"><Edit className="w-4 h-4"/></button>
        <button onClick={onDelete} className="p-2 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                </div>
               </div>
);

interface GamificationCouponCardProps {
  coupon: any;
  onRedeem: () => void;
}

const GamificationCouponCard = ({ coupon, onRedeem }: GamificationCouponCardProps) => (
  <div className="p-3 rounded-lg border bg-blue-50 flex items-center justify-between">
    <div>
      <p className="font-semibold text-purple-800">{coupon.name}</p>
      <p className="text-xs text-purple-600">Winner: {coupon.metadata.userName} ({coupon.metadata.userPhone})</p>
    </div>
    <StatusBadge status={coupon.status} />
  </div>
);

const StatusBadge = ({ status }: { status: CouponStatus }) => {
  const styles = {
    active: { icon: CheckCircle, color: 'text-green-600 bg-green-100' },
    scheduled: { icon: Clock, color: 'text-blue-600 bg-blue-100' },
    expired: { icon: XCircle, color: 'text-gray-600 bg-gray-100' },
    draft: { icon: Edit, color: 'text-yellow-600 bg-yellow-100' },
    disabled: { icon: XCircle, color: 'text-red-600 bg-red-100' },
    paused: { icon: Clock, color: 'text-orange-600 bg-orange-100' },
  }[status] || { icon: Clock, color: 'text-gray-600 bg-gray-100' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles.color}`}>
      <styles.icon className="w-3.5 h-3.5" />
      <span className="capitalize">{status}</span>
    </span>
  );
};

// Helper functions to get display text
const getCouponTypeText = (type: CouponType): string => {
  const map: Record<CouponType, string> = {
    percentage_discount: 'Percentage',
    fixed_amount: 'Fixed Amount',
    buy_x_get_y: 'BOGO',
    free_item: 'Free Item',
    combo_deal: 'Combo Deal',
    minimum_order: 'Minimum Order',
    category_specific: 'Category Specific'
  };
  return map[type] || 'Custom';
};

const getCouponValueText = (coupon: Coupon): string => {
  switch (coupon.type) {
    case 'percentage_discount':
      return `${coupon.config.percentage}% Off`;
    case 'fixed_amount':
      return `$${coupon.config.discountAmount} Off`;
    case 'buy_x_get_y':
      return `Buy ${coupon.config.buyXGetY?.buyQuantity}, Get ${coupon.config.buyXGetY?.getQuantity} Free`;
    case 'free_item':
        return `Free ${coupon.config.freeItemId ? 'Item' : 'Item'}`
    default:
      return 'Special Offer';
  }
};