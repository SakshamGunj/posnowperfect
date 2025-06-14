// Removed React import since it's not needed in React 18+ with automatic JSX runtime
import { TrendingUp, Users, Clock, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface QuickStatsProps {
  stats: {
    todayRevenue: number;
    activeOrders: number;
    customersServed: number;
    avgOrderTime: number;
  };
  className?: string;
}

export default function QuickStats({ stats, className = '' }: QuickStatsProps) {
  const statItems = [
    {
      label: "Today's Revenue",
      value: formatCurrency(stats.todayRevenue),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      label: 'Active Orders',
      value: stats.activeOrders.toString(),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: '+3',
      changeType: 'positive' as const,
    },
    {
      label: 'Customers Served',
      value: stats.customersServed.toString(),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: '+8%',
      changeType: 'positive' as const,
    },
    {
      label: 'Avg Order Time',
      value: `${stats.avgOrderTime}min`,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      change: '-2min',
      changeType: 'positive' as const,
    },
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {statItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{item.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{item.value}</p>
                <div className="flex items-center mt-2">
                  <span
                    className={`text-xs font-medium ${
                      item.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {item.change}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">vs yesterday</span>
                </div>
              </div>
              <div className={`${item.bgColor} ${item.color} p-3 rounded-lg`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
} 