import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { OrderService } from '@/services/orderService';
import { TableService } from '@/services/tableService';
import { MenuService } from '@/services/menuService';
import { Order, OrderStatus, Table, MenuItem } from '@/types';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { 
  Filter, 
  Calendar, 
  Users, 
  TrendingUp, 
  Eye, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Printer,
  DollarSign,
  Clock,
  Package,
  BarChart3,
  FileText,
  Search,
  X,
  Edit,
  RefreshCw,
  ShoppingCart,
  MapPin,
  ChevronDown,
  ChevronUp,
  CreditCard
} from 'lucide-react';

import { SalesReportService } from '@/services/salesReportService';
import { RevenueService } from '@/services/revenueService';
import { generateUPIPaymentString, generateQRCodeDataURL } from '@/utils/upiUtils';
import ReportGenerationModal from '@/components/restaurant/ReportGenerationModal';

const ALL_STATUSES = Object.values(OrderStatus);

interface FilterForm {
  dateRange: 'all' | 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'this_month' | 'last_month' | 'quarter' | 'custom';
  startDate?: string;
  endDate?: string;
  tableId?: string;
  status?: OrderStatus | 'all';
  orderType?: 'all' | 'dine_in' | 'takeaway' | 'delivery';
  menuItemId?: string;
}

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  actualRevenue: number;
  pendingCredits: number;
  avgOrderValue: number;
  todayOrders: number;
  todayRevenue: number;
  todayActualRevenue: number;
  popularItems: { menuItemId: string; name: string; quantity: number; revenue: number }[];
  tableStats: { tableId: string; tableNumber: string; orderCount: number; revenue: number }[];
}

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate: (orderId: string, status: OrderStatus) => void;
  tables: Table[];
}

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

// Revenue Growth Chart Component
function RevenueGrowthChart({ orders }: { orders: Order[] }) {
  const [weeklyData, setWeeklyData] = useState<DailyRevenue[]>([]);

  useEffect(() => {
    // Get the past 7 days
    const today = new Date();
    const pastWeekData: DailyRevenue[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      
      // Filter orders for this day (only completed orders count towards revenue)
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate < nextDay;
      });
      
      const completedDayOrders = dayOrders.filter(order => order.status === OrderStatus.COMPLETED);
      const dailyRevenue = completedDayOrders.reduce((sum, order) => sum + order.total, 0);
      
      pastWeekData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dailyRevenue,
        orders: dayOrders.length
      });
    }
    
    setWeeklyData(pastWeekData);
  }, [orders]);

  if (weeklyData.length === 0) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No revenue data available</p>
      </div>
    );
  }

  const maxRevenue = weeklyData.length > 0 ? Math.max(...weeklyData.map(d => d.revenue)) : 1;
  const chartHeight = 200;
  const chartWidth = 400;
  const padding = 40;

  // Calculate growth percentage
  const firstDayRevenue = weeklyData[0]?.revenue || 0;
  const lastDayRevenue = weeklyData[weeklyData.length - 1]?.revenue || 0;
  const growthPercentage = firstDayRevenue > 0 
    ? ((lastDayRevenue - firstDayRevenue) / firstDayRevenue) * 100 
    : 0;

  return (
    <div className="space-y-4">
      {/* Header with Growth Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Revenue Growth (Past 7 Days)</h3>
          <p className="text-sm text-gray-600">Daily revenue trend analysis</p>
        </div>
        <div className="text-right">
          <div className={`flex items-center space-x-2 ${growthPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`w-4 h-4 ${growthPercentage < 0 ? 'rotate-180' : ''}`} />
            <span className="font-semibold">
              {growthPercentage >= 0 ? '+' : ''}{growthPercentage.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-gray-500">vs first day</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-50 rounded-lg p-6">
        <svg width="100%" height={chartHeight + padding * 2} viewBox={`0 0 ${chartWidth + padding * 2} ${chartHeight + padding * 2}`} className="w-full">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <g key={i}>
              <line
                x1={padding}
                y1={padding + chartHeight * ratio}
                x2={chartWidth + padding}
                y2={padding + chartHeight * ratio}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={padding - 10}
                y={padding + chartHeight * ratio + 4}
                textAnchor="end"
                fontSize="12"
                fill="#6b7280"
              >
                {formatCurrency(maxRevenue * (1 - ratio))}
              </text>
            </g>
          ))}

          {/* Chart line */}
          {weeklyData.length > 1 && (
            <polyline
              points={weeklyData.map((data, index) => {
                const x = padding + (index * (chartWidth / (weeklyData.length - 1)));
                const y = padding + chartHeight - (data.revenue / maxRevenue) * chartHeight;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="url(#revenueGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points */}
          {weeklyData.map((data, index) => {
            const x = padding + (index * (chartWidth / (weeklyData.length - 1)));
            const y = padding + chartHeight - (data.revenue / maxRevenue) * chartHeight;
            
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="white"
                  stroke="url(#revenueGradient)"
                  strokeWidth="3"
                />
                {/* Date labels */}
                <text
                  x={x}
                  y={chartHeight + padding + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#6b7280"
                >
                  {data.date}
                </text>
              </g>
            );
          })}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <p className="text-sm font-medium text-blue-600">Total Revenue</p>
          <p className="text-xl font-bold text-blue-800">
            {formatCurrency(weeklyData.reduce((sum, d) => sum + d.revenue, 0))}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-sm font-medium text-green-600">Total Orders</p>
          <p className="text-xl font-bold text-green-800">
            {weeklyData.reduce((sum, d) => sum + d.orders, 0)}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <p className="text-sm font-medium text-purple-600">Best Day</p>
          <p className="text-xl font-bold text-purple-800">
            {weeklyData.reduce((best, current) => 
              current.revenue > best.revenue ? current : best, weeklyData[0]
            )?.date || 'N/A'}
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <p className="text-sm font-medium text-orange-600">Avg Daily</p>
          <p className="text-xl font-bold text-orange-800">
            {formatCurrency(weeklyData.reduce((sum, d) => sum + d.revenue, 0) / weeklyData.length)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Average Order Value Trends Chart
function AOVTrendsChart({ orders }: { orders: Order[] }) {
  const [aovData, setAovData] = useState<DailyRevenue[]>([]);

  useEffect(() => {
    const today = new Date();
    const pastWeekData: DailyRevenue[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate < nextDay;
      });
      
      const avgOrderValue = dayOrders.length > 0 
        ? dayOrders.reduce((sum, order) => sum + order.total, 0) / dayOrders.length 
        : 0;
      
      pastWeekData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: avgOrderValue,
        orders: dayOrders.length
      });
    }
    
    setAovData(pastWeekData);
  }, [orders]);

  if (aovData.length === 0) {
    return (
      <div className="text-center py-8">
        <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No AOV data available</p>
      </div>
    );
  }

  const maxAOV = aovData.length > 0 ? Math.max(...aovData.map(d => d.revenue)) : 1;
  const chartHeight = 150;
  const chartWidth = 300;
  const padding = 30;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Average Order Value Trends</h3>
        <p className="text-sm text-gray-600">7-day AOV progression</p>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4">
        <svg width="100%" height={chartHeight + padding * 2} viewBox={`0 0 ${chartWidth + padding * 2} ${chartHeight + padding * 2}`} className="w-full">
          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio, i) => (
            <g key={i}>
              <line
                x1={padding}
                y1={padding + chartHeight * ratio}
                x2={chartWidth + padding}
                y2={padding + chartHeight * ratio}
                stroke="#d1fae5"
                strokeWidth="1"
              />
              <text
                x={padding - 5}
                y={padding + chartHeight * ratio + 4}
                textAnchor="end"
                fontSize="10"
                fill="#6b7280"
              >
                {formatCurrency(maxAOV * (1 - ratio))}
              </text>
            </g>
          ))}

          {/* Chart line */}
          {aovData.length > 1 && (
            <polyline
              points={aovData.map((data, index) => {
                const x = padding + (index * (chartWidth / (aovData.length - 1)));
                const y = padding + chartHeight - (data.revenue / maxAOV) * chartHeight;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Data points */}
          {aovData.map((data, index) => {
            const x = padding + (index * (chartWidth / (aovData.length - 1)));
            const y = padding + chartHeight - (data.revenue / maxAOV) * chartHeight;
            
            return (
              <g key={index}>
                <circle cx={x} cy={y} r="3" fill="#10b981" />
                <text
                  x={x}
                  y={chartHeight + padding + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {data.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="bg-green-50 rounded p-3 text-center">
        <p className="text-sm font-medium text-green-600">Current Avg AOV</p>
        <p className="text-lg font-bold text-green-800">
          {formatCurrency(aovData[aovData.length - 1]?.revenue || 0)}
        </p>
      </div>
    </div>
  );
}

// Peak Hours Revenue Distribution Chart
function PeakHoursChart({ orders }: { orders: Order[] }) {
  const [hourlyData, setHourlyData] = useState<{ hour: number; revenue: number; orders: number }[]>([]);

  useEffect(() => {
    const hoursMap = new Map<number, { revenue: number; orders: number }>();
    
    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hoursMap.set(i, { revenue: 0, orders: 0 });
    }
    
    // Aggregate data by hour
    orders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      const existing = hoursMap.get(hour) || { revenue: 0, orders: 0 };
      hoursMap.set(hour, {
        revenue: existing.revenue + order.total,
        orders: existing.orders + 1
      });
    });
    
    const data = Array.from(hoursMap.entries()).map(([hour, stats]) => ({
      hour,
      revenue: stats.revenue,
      orders: stats.orders
    }));
    
    setHourlyData(data);
  }, [orders]);

  const maxRevenue = hourlyData.length > 0 ? Math.max(...hourlyData.map(d => d.revenue)) : 1;
  const chartHeight = 120;
  const barWidth = 12;
  const padding = 20;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Peak Hours Revenue</h3>
        <p className="text-sm text-gray-600">24-hour revenue distribution</p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
        <svg width="100%" height={chartHeight + padding * 2} viewBox={`0 0 ${24 * barWidth + padding * 2} ${chartHeight + padding * 2}`} className="w-full">
          {hourlyData.map((data, index) => {
            const barHeight = maxRevenue > 0 ? (data.revenue / maxRevenue) * chartHeight : 0;
            const x = padding + index * barWidth;
            const y = padding + chartHeight - barHeight;
            
            return (
              <g key={index}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth - 1}
                  height={barHeight}
                  fill={data.revenue > 0 ? "#3b82f6" : "#e5e7eb"}
                  rx="1"
                />
                {index % 3 === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + padding + 15}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#6b7280"
                  >
                    {data.hour}h
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-blue-50 rounded p-2">
          <p className="text-xs font-medium text-blue-600">Peak Hour</p>
          <p className="text-sm font-bold text-blue-800">
            {hourlyData.reduce((peak, current) => 
              current.revenue > peak.revenue ? current : peak, hourlyData[0]
            )?.hour || 0}:00
          </p>
        </div>
        <div className="bg-indigo-50 rounded p-2">
          <p className="text-xs font-medium text-indigo-600">Peak Revenue</p>
          <p className="text-sm font-bold text-indigo-800">
            {formatCurrency(Math.max(...hourlyData.map(d => d.revenue)))}
          </p>
        </div>
        <div className="bg-purple-50 rounded p-2">
          <p className="text-xs font-medium text-purple-600">Active Hours</p>
          <p className="text-sm font-bold text-purple-800">
            {hourlyData.filter(d => d.revenue > 0).length}
          </p>
        </div>
      </div>
    </div>
  );
}

// Day of Week Performance Chart
function DayOfWeekChart({ orders }: { orders: Order[] }) {
  const [weeklyData, setWeeklyData] = useState<{ day: string; revenue: number; orders: number }[]>([]);

  useEffect(() => {
    const daysMap = new Map<number, { revenue: number; orders: number }>();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Initialize all days
    for (let i = 0; i < 7; i++) {
      daysMap.set(i, { revenue: 0, orders: 0 });
    }
    
    // Aggregate data by day of week
    orders.forEach(order => {
      const dayOfWeek = new Date(order.createdAt).getDay();
      const existing = daysMap.get(dayOfWeek) || { revenue: 0, orders: 0 };
      daysMap.set(dayOfWeek, {
        revenue: existing.revenue + order.total,
        orders: existing.orders + 1
      });
    });
    
    const data = Array.from(daysMap.entries()).map(([dayIndex, stats]) => ({
      day: dayNames[dayIndex],
      revenue: stats.revenue,
      orders: stats.orders
    }));
    
    setWeeklyData(data);
  }, [orders]);

  const maxRevenue = weeklyData.length > 0 ? Math.max(...weeklyData.map(d => d.revenue)) : 1;
  const chartHeight = 120;
  const barWidth = 30;
  const padding = 20;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Day of Week Performance</h3>
        <p className="text-sm text-gray-600">Weekly revenue pattern</p>
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4">
        <svg width="100%" height={chartHeight + padding * 2} viewBox={`0 0 ${7 * barWidth + padding * 2} ${chartHeight + padding * 2}`} className="w-full">
          {weeklyData.map((data, index) => {
            const barHeight = maxRevenue > 0 ? (data.revenue / maxRevenue) * chartHeight : 0;
            const x = padding + index * barWidth;
            const y = padding + chartHeight - barHeight;
            
            return (
              <g key={index}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth - 2}
                  height={barHeight}
                  fill="#8b5cf6"
                  rx="2"
                />
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + padding + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {data.day}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-purple-50 rounded p-3 text-center">
          <p className="text-sm font-medium text-purple-600">Best Day</p>
          <p className="text-lg font-bold text-purple-800">
            {weeklyData.length > 0 ? (
              weeklyData.reduce((best, current) => 
                current.revenue > best.revenue ? current : best, weeklyData[0]
              )?.day || 'N/A'
            ) : 'N/A'}
          </p>
        </div>
        <div className="bg-pink-50 rounded p-3 text-center">
          <p className="text-sm font-medium text-pink-600">Weekend vs Weekday</p>
          <p className="text-lg font-bold text-pink-800">
            {weeklyData.length >= 7 ? (() => {
              const weekendRevenue = weeklyData[0].revenue + weeklyData[6].revenue; // Sun + Sat
              const weekdayRevenue = weeklyData.slice(1, 6).reduce((sum, d) => sum + d.revenue, 0);
              return weekendRevenue > weekdayRevenue ? 'Weekend' : 'Weekday';
            })() : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Table Turnover Rate Chart
function TableTurnoverChart({ orders, tables }: { orders: Order[]; tables: Table[] }) {
  const [turnoverData, setTurnoverData] = useState<{ tableNumber: string; turnoverRate: number; totalOrders: number }[]>([]);

  useEffect(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const todayOrders = orders.filter(order => 
      new Date(order.createdAt) >= startOfDay
    );
    
    const tableOrderMap = new Map<string, number>();
    
    todayOrders.forEach(order => {
      if (order.tableId) {
        const current = tableOrderMap.get(order.tableId) || 0;
        tableOrderMap.set(order.tableId, current + 1);
      }
    });
    
    const data = tables.map(table => {
      const orderCount = tableOrderMap.get(table.id) || 0;
      // Assuming 8-hour operational day, calculate theoretical turnover
      const turnoverRate = orderCount / 8; // orders per hour
      
      return {
        tableNumber: table.number,
        turnoverRate,
        totalOrders: orderCount
      };
    }).sort((a, b) => b.turnoverRate - a.turnoverRate);
    
    setTurnoverData(data.slice(0, 8)); // Show top 8 tables
  }, [orders, tables]);

  const maxTurnover = Math.max(...turnoverData.map(d => d.turnoverRate), 1);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Table Turnover Rate</h3>
        <p className="text-sm text-gray-600">Orders per hour (today)</p>
      </div>

      <div className="space-y-2">
        {turnoverData.map((table) => (
          <div key={table.tableNumber} className="flex items-center space-x-3">
            <div className="w-12 text-center">
              <span className="text-sm font-medium text-gray-700">T{table.tableNumber}</span>
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
              <div 
                className="bg-gradient-to-r from-orange-400 to-red-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${(table.turnoverRate / maxTurnover) * 100}%` }}
              />
            </div>
            <div className="w-16 text-right">
              <span className="text-sm font-semibold text-gray-900">
                {table.turnoverRate.toFixed(1)}/h
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 rounded p-3 text-center">
          <p className="text-sm font-medium text-orange-600">Avg Turnover</p>
          <p className="text-lg font-bold text-orange-800">
            {(turnoverData.reduce((sum, d) => sum + d.turnoverRate, 0) / turnoverData.length || 0).toFixed(1)}/h
          </p>
        </div>
        <div className="bg-red-50 rounded p-3 text-center">
          <p className="text-sm font-medium text-red-600">Best Table</p>
          <p className="text-lg font-bold text-red-800">
            {turnoverData[0]?.tableNumber || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Category Performance Chart
function CategoryPerformanceChart({ orders, menuItems }: { orders: Order[]; menuItems: MenuItem[] }) {
  const [categoryData, setCategoryData] = useState<{ category: string; revenue: number; quantity: number; percentage: number }[]>([]);

  useEffect(() => {
    const categoryMap = new Map<string, { revenue: number; quantity: number }>();
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        const category = menuItem?.category || 'Unknown';
        
        const existing = categoryMap.get(category) || { revenue: 0, quantity: 0 };
        categoryMap.set(category, {
          revenue: existing.revenue + item.total,
          quantity: existing.quantity + item.quantity
        });
      });
    });
    
    const totalRevenue = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.revenue, 0);
    
    const data = Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        revenue: stats.revenue,
        quantity: stats.quantity,
        percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
    
    setCategoryData(data);
  }, [orders, menuItems]);

  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#6b7280'];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Category Performance</h3>
        <p className="text-sm text-gray-600">Revenue by menu category</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <div className="flex justify-center">
          <svg width="150" height="150" viewBox="0 0 150 150">
            {categoryData.length > 0 && (() => {
              let cumulativePercentage = 0;
              return categoryData.map((category, index) => {
                const startAngle = (cumulativePercentage * 360) / 100;
                const endAngle = ((cumulativePercentage + category.percentage) * 360) / 100;
                cumulativePercentage += category.percentage;
                
                const startAngleRad = (startAngle * Math.PI) / 180;
                const endAngleRad = (endAngle * Math.PI) / 180;
                
                const largeArcFlag = category.percentage > 50 ? 1 : 0;
                
                const x1 = 75 + 60 * Math.cos(startAngleRad);
                const y1 = 75 + 60 * Math.sin(startAngleRad);
                const x2 = 75 + 60 * Math.cos(endAngleRad);
                const y2 = 75 + 60 * Math.sin(endAngleRad);
                
                const pathData = [
                  'M', 75, 75,
                  'L', x1, y1,
                  'A', 60, 60, 0, largeArcFlag, 1, x2, y2,
                  'Z'
                ].join(' ');
                
                return (
                  <path
                    key={category.category}
                    d={pathData}
                    fill={colors[index]}
                    stroke="white"
                    strokeWidth="2"
                  />
                );
              });
            })()}
          </svg>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {categoryData.map((category, index) => (
            <div key={category.category} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[index] }}
                />
                <span className="text-sm font-medium text-gray-700">{category.category}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(category.revenue)}</p>
                <p className="text-xs text-gray-600">{category.percentage.toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderDetailsModal({ order, isOpen, onClose, onStatusUpdate, tables }: OrderDetailsModalProps) {
  if (!isOpen || !order) return null;

  const table = tables.find(t => t.id === order.tableId);
  
  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-600', label: 'Draft' },
      placed: { color: 'bg-blue-100 text-blue-800', label: 'Placed' },
      confirmed: { color: 'bg-yellow-100 text-yellow-800', label: 'Confirmed' },
      preparing: { color: 'bg-orange-100 text-orange-800', label: 'Preparing' },
      ready: { color: 'bg-green-100 text-green-800', label: 'Ready' },
      completed: { color: 'bg-gray-100 text-gray-800', label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
    };
    
    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const statusOptions = Object.values(OrderStatus) as OrderStatus[];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        
        <div className="inline-block w-full max-w-2xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-xl sm:rounded-2xl">
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Order Details</h3>
                <p className="text-sm text-gray-600">#{order.orderNumber}</p>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 touch-manipulation"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <div className="px-3 sm:px-6 py-3 sm:py-4 max-h-96 overflow-y-auto">
            {/* Order Info - Mobile Optimized */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div>
                <label className="text-xs sm:text-sm text-gray-600">Table</label>
                <p className="font-medium text-sm sm:text-base">{table?.number || 'N/A'}</p>
              </div>
              
              <div>
                <label className="text-xs sm:text-sm text-gray-600">Status</label>
                <div className="mt-1">
                  {getStatusBadge(order.status)}
                </div>
              </div>
              
              <div>
                <label className="text-xs sm:text-sm text-gray-600">Order Time</label>
                <p className="font-medium text-sm sm:text-base">{formatDate(order.createdAt)} {formatTime(order.createdAt)}</p>
              </div>
              
              <div>
                <label className="text-xs sm:text-sm text-gray-600">Payment Status</label>
                <p className="font-medium capitalize text-sm sm:text-base">{order.paymentStatus}</p>
              </div>
            </div>

            {/* Order Items - Mobile Optimized */}
            <div className="mb-4 sm:mb-6">
              <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Order Items</h4>
              <div className="space-y-2 sm:space-y-3">
                {order.items.map((item) => {
                  return (
                    <div key={item.id} className="flex justify-between items-start p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 pr-2">
                        <p className="font-medium text-sm sm:text-base">{item.name}</p>
                        <p className="text-xs sm:text-sm text-gray-600">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                        {item.customizations && item.customizations.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Customizations: {item.customizations.join(', ')}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-1">Note: {item.notes}</p>
                        )}
                      </div>
                      <p className="font-medium text-sm sm:text-base flex-shrink-0">{formatCurrency(item.total)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Total - Mobile Optimized */}
            <div className="border-t pt-3 sm:pt-4">
              <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Order Summary</h4>
              <div className="space-y-1 sm:space-y-2 text-sm sm:text-base">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount Applied</span>
                    <span>-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                
                {(order as any).tip > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Tip/Gratuity</span>
                    <span>+{formatCurrency((order as any).tip)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
                
                <div className="flex justify-between font-semibold text-base sm:text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>

                {/* Credit Information - Mobile Optimized */}
                {(order as any).isCredit && (
                  <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <h5 className="font-medium text-orange-800 mb-2 flex items-center text-sm sm:text-base">
                      <CreditCard className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2" />
                      Credit Payment Details
                    </h5>
                    <div className="space-y-1 text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span className="text-orange-700">Amount Received:</span>
                        <span className="font-medium text-green-600">{formatCurrency((order as any).amountReceived || 0)}</span>
              </div>
                      <div className="flex justify-between">
                        <span className="text-orange-700">Credit Amount:</span>
                        <span className="font-medium text-orange-600">{formatCurrency((order as any).creditAmount || 0)}</span>
                      </div>
                      {(order as any).creditCustomerName && (
                        <div className="pt-2 border-t border-orange-200">
                          <div className="text-orange-700">Customer: <span className="font-medium">{(order as any).creditCustomerName}</span></div>
                          {(order as any).creditCustomerPhone && (
                            <div className="text-orange-600 text-xs">{(order as any).creditCustomerPhone}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Savings Information - Mobile Optimized */}
                {(order as any).totalSavings > 0 && (
                  <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between text-sm sm:text-base">
                      <span className="font-medium text-green-800">💰 Total Customer Savings</span>
                      <span className="font-bold text-green-600">{formatCurrency((order as any).totalSavings)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {order.notes && (
              <div className="mt-3 sm:mt-4">
                <label className="text-xs sm:text-sm text-gray-600">Order Notes</label>
                <p className="mt-1 p-2 sm:p-3 bg-yellow-50 rounded-lg text-xs sm:text-sm">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Status Update - Mobile Optimized */}
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <label className="text-xs sm:text-sm font-medium text-gray-700">Update Status:</label>
              <select
                value={order.status}
                onChange={(e) => onStatusUpdate(order.id, e.target.value as OrderStatus)}
                className="w-full sm:w-auto px-2 sm:px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bill generation function for reprinting orders
async function generateOrderBillContent(order: Order, restaurant: any, table: Table, isMobile: boolean = false): Promise<string> {
  // Calculate bill details
  const subtotal = order.subtotal;
  const discountAmount = order.discount || 0;
  const tax = order.tax;
  const finalAmount = order.total;

  // Generate UPI QR code if UPI settings are configured
  let upiQRCodeDataURL = '';
  const upiSettings = restaurant?.settings?.upiSettings;
  
  // Skip QR code generation on mobile or if not configured
  if (!isMobile && upiSettings?.enableQRCode && upiSettings?.upiId) {
    try {
      console.log('🏷️ Generating UPI QR code for order bill:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        upiId: upiSettings.upiId,
        amount: finalAmount,
        restaurant: restaurant.name
      });
      
      const upiPaymentString = generateUPIPaymentString(
        upiSettings.upiId,
        finalAmount,
        restaurant.name,
        `Payment for Order #${order.orderNumber} - ${restaurant.name}`
      );
      
      console.log('🔗 UPI Payment String:', upiPaymentString);
      
      upiQRCodeDataURL = await generateQRCodeDataURL(upiPaymentString);
      
      if (upiQRCodeDataURL) {
        console.log('✅ UPI QR Code generated successfully for order');
      } else {
        console.error('❌ Failed to generate UPI QR Code for order');
      }
    } catch (error) {
      console.error('❌ Error generating UPI QR Code for order:', error);
    }
  } else if (isMobile) {
    console.log('📱 Skipping QR code generation for mobile device');
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bill - Order #${order.orderNumber}</title>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: bold;
          line-height: 1.1;
          width: 100%;
          margin: 0;
          padding: 0 5px;
          background: #fff;
          color: #000;
        }
        
        .receipt {
          width: 100%;
          padding: 5px 0;
          background: #fff;
          ${isMobile ? 'max-width: 300px; margin: 0 auto;' : ''}
        }
        
        .header {
          text-align: center;
          margin-bottom: 5px;
          border-bottom: 2px solid #000;
          padding-bottom: 3px;
        }
        
        .restaurant-name {
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
          text-transform: uppercase;
        }
        
        .contact-info {
          font-size: 9px;
          line-height: 1.1;
          font-weight: bold;
          margin-bottom: 2px;
        }
        
        .bill-header {
          text-align: center;
          margin: 5px 0;
          padding: 3px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
        }
        
        .bill-title {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 2px;
          letter-spacing: 0.5px;
        }
        
        .bill-info {
          font-size: 10px;
          line-height: 1.1;
          font-weight: bold;
        }
        
        .items-section {
          margin: 5px 0;
        }
        
        .items-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #000;
          padding-bottom: 2px;
          margin-bottom: 3px;
          font-weight: bold;
          font-size: 10px;
        }
        
        .item-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          padding: 1px 0;
        }
        
        .item-details {
          flex: 1;
          padding-right: 5px;
        }
        
        .item-name {
          font-weight: bold;
          margin-bottom: 1px;
          font-size: 10px;
        }
        
        .item-qty-price {
          font-size: 9px;
          font-weight: bold;
        }
        
        .item-total {
          font-weight: bold;
          min-width: 50px;
          text-align: right;
          font-size: 10px;
        }
        
        .totals-section {
          margin-top: 5px;
          border-top: 1px solid #000;
          padding-top: 3px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 1px 0;
          padding: 1px 0;
          font-weight: bold;
          font-size: 10px;
        }
        
        .total-row.subtotal {
          border-bottom: 1px dotted #000;
          padding-bottom: 2px;
          margin-bottom: 2px;
        }
        
        .total-row.final {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 3px 0;
          margin-top: 3px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .payment-section {
          margin: 5px 0;
          padding: 3px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
        }
        
        .payment-title {
          font-weight: bold;
          margin-bottom: 2px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-size: 10px;
        }
        
        .payment-details {
          font-size: 9px;
          line-height: 1.1;
          font-weight: bold;
        }
        
        .payment-method {
          background: #f0f0f0;
          padding: 1px 2px;
          display: inline-block;
          font-weight: bold;
        }
        
        .upi-section {
          margin: 5px 0;
          padding: 8px;
          border: 2px solid #000;
          text-align: center;
          background: #f9f9f9;
        }
        
        .upi-title {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 3px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        
        .upi-id {
          font-size: 10px;
          font-weight: bold;
          margin-bottom: 5px;
          color: #333;
        }
        
        .footer {
          text-align: center;
          margin-top: 5px;
          padding-top: 3px;
          border-top: 2px solid #000;
        }
        
        .thank-you {
          font-size: 11px;
          font-weight: bold;
          margin-bottom: 2px;
          letter-spacing: 0.5px;
        }
        
        .footer-info {
          font-size: 8px;
          font-weight: bold;
          line-height: 1.1;
        }
        
        .timestamp {
          text-align: center;
          margin-top: 3px;
          font-size: 8px;
          font-weight: bold;
        }
        
        /* Mobile-specific styles */
        ${isMobile ? `
        @media screen {
          body { 
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .receipt { 
            max-width: 280px; 
            margin: 0 auto;
            font-size: 10px;
          }
          .item-name { font-size: 9px; }
          .item-qty-price { font-size: 8px; }
          .item-total { font-size: 9px; }
          .total-row { font-size: 9px; }
          .total-row.final { font-size: 11px; }
        }
        
        @media print {
          body { 
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            margin: 0;
            padding: 0;
          }
          .receipt { 
            max-width: 280px; 
            margin: 0;
            padding: 0;
          }
        }
        ` : ''}
      </style>
    </head>
    <body>
      <div class="receipt">
        <!-- Header Section -->
        <div class="header">
          <div class="restaurant-name">${restaurant.name}</div>
          <div class="contact-info">
            ${restaurant.settings?.businessInfo?.businessAddress || restaurant.settings?.address || 'Restaurant Address'}
            ${restaurant.settings?.businessInfo?.city ? `, ${restaurant.settings.businessInfo.city}` : ''}
            ${restaurant.settings?.businessInfo?.state ? `, ${restaurant.settings.businessInfo.state}` : ''}
            ${restaurant.settings?.businessInfo?.pincode ? ` - ${restaurant.settings.businessInfo.pincode}` : ''}
            <br>
            ${restaurant.settings?.phone ? `📞 ${restaurant.settings.phone}` : ''}
            ${restaurant.settings?.businessInfo?.gstin ? `<br>GSTIN: ${restaurant.settings.businessInfo.gstin}` : ''}
            ${restaurant.settings?.businessInfo?.fssaiNumber ? `<br>FSSAI: ${restaurant.settings.businessInfo.fssaiNumber}` : ''}
          </div>
        </div>

        <!-- Bill Header -->
        <div class="bill-header">
          <div class="bill-title">BILL RECEIPT</div>
          <div class="bill-info">
            <strong>Order:</strong> #${order.orderNumber}<br>
            <strong>Table:</strong> ${table?.number || 'N/A'} (${table?.area || 'N/A'})<br>
            <strong>Date:</strong> ${formatDate(order.createdAt)}<br>
            <strong>Time:</strong> ${formatTime(order.createdAt)}<br>
            <strong>Status:</strong> ${order.status.toUpperCase()}
          </div>
        </div>

        <!-- Items Section -->
        <div class="items-section">
          <div class="items-header">
            <span>ITEM</span>
            <span>TOTAL</span>
          </div>
          
          ${order.items.map(item => `
            <div class="item-row">
              <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-qty-price">${item.quantity} × ${formatCurrency(item.price)}</div>
                ${item.customizations && item.customizations.length > 0 ? `
                  <div style="font-size: 8px; color: #666;">+ ${item.customizations.join(', ')}</div>
                ` : ''}
                ${item.notes ? `
                  <div style="font-size: 8px; color: #666;">Note: ${item.notes}</div>
                ` : ''}
              </div>
              <div class="item-total">${formatCurrency(item.total)}</div>
            </div>
          `).join('')}
        </div>

        <!-- Totals Section -->
        <div class="totals-section">
          <div class="total-row subtotal">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          
          ${discountAmount > 0 ? `
            <div class="total-row">
              <span>Discount</span>
              <span>-${formatCurrency(discountAmount)}</span>
            </div>
          ` : ''}
          
          <div class="total-row">
            <span>Tax (${restaurant?.settings?.taxRate || 8.5}%)</span>
            <span>${formatCurrency(tax)}</span>
          </div>
          
          <div class="total-row final">
            <span>TOTAL AMOUNT</span>
            <span>${formatCurrency(finalAmount)}</span>
          </div>
        </div>

        <!-- Payment Section -->
        <div class="payment-section">
          <div class="payment-title">Payment Details</div>
          <div class="payment-details">
            <strong>Status:</strong> <span class="payment-method">${order.paymentStatus.toUpperCase()}</span><br>
            <strong>Method:</strong> ${order.paymentMethod || 'N/A'}
          </div>
        </div>



        ${upiSettings?.enableQRCode && upiSettings?.upiId ? `
        <!-- UPI Payment Section -->
        <div style="margin: 5px 0; text-align: center; background: #fff; padding: 5px; border: 1px solid #000;">
          <div style="font-size: 10px; font-weight: bold; margin-bottom: 3px;">UPI PAYMENT</div>
          ${!isMobile && upiQRCodeDataURL ? `
            <img src="${upiQRCodeDataURL}" 
                 alt="UPI QR Code" 
                 style="width: 80px; height: 80px; display: block; margin: 0 auto; background: white;" />
          ` : ''}
          <div style="font-size: 9px; font-weight: bold; margin-top: 3px;">UPI ID: ${upiSettings.upiId}</div>
          <div style="font-size: 8px; font-weight: bold; margin-top: 2px;">Amount: ₹${finalAmount.toFixed(2)}</div>
          ${isMobile ? `
            <div style="font-size: 8px; margin-top: 2px; color: #666;">
              Use any UPI app to pay using the UPI ID above
            </div>
          ` : ''}
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <div class="footer-info">
            ${restaurant.settings?.businessInfo?.website ? `🌐 ${restaurant.settings.businessInfo.website}<br>` : ''}
            ${restaurant.settings?.businessInfo?.email ? `📧 ${restaurant.settings.businessInfo.email}` : ''}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Main Order Dashboard Component
export default function OrderDashboard() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [orderToEditPayment, setOrderToEditPayment] = useState<Order | null>(null);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);
  
  // New state for managing expanded order groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    totalRevenue: 0,
    actualRevenue: 0,
    pendingCredits: 0,
    avgOrderValue: 0,
    todayOrders: 0,
    todayRevenue: 0,
    todayActualRevenue: 0,
    popularItems: [],
    tableStats: [],
  });
  
  const [searchTerm, setSearchTerm] = useState('');

  // Sales Report States
  const [salesAnalytics] = useState<any>(null);

  const { register, handleSubmit, watch } = useForm<FilterForm>({
    defaultValues: {
      dateRange: 'all', // Show all orders by default to avoid date issues
      status: 'all',
      orderType: 'all',
      menuItemId: 'all',
    }
  });

  const dateRange = watch('dateRange');
  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const tableId = watch('tableId');
  const status = watch('status');
  const orderType = watch('orderType');
  const menuItemId = watch('menuItemId');

  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (restaurant) {
      loadData();
    }
  }, [restaurant]);

  const loadData = async () => {
    if (!restaurant) return;

    try {
      setIsLoading(true);

      const [ordersResult, menuResult, tablesResult] = await Promise.all([
        OrderService.getOrdersForRestaurant(restaurant.id, 200), // Load more orders for analytics
        MenuService.getMenuItemsForRestaurant(restaurant.id),
        TableService.getTablesForRestaurant(restaurant.id),
      ]);

      if (ordersResult.success && ordersResult.data) {
        setOrders(ordersResult.data);
      }

      if (menuResult.success && menuResult.data) {
        setMenuItems(menuResult.data);
      }

      if (tablesResult.success && tablesResult.data) {
        setTables(tablesResult.data);
      }
    } catch (error) {
      toast.error('Failed to load order data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = useCallback(async (orderList: Order[]) => {
    if (!restaurant) return;
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    
    const todayOrders = orderList.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= todayStart && orderDate <= todayEnd;
    });

    // Only calculate revenue from completed orders
    const completedOrders = orderList.filter(order => order.status === OrderStatus.COMPLETED);
    const completedTodayOrders = todayOrders.filter(order => order.status === OrderStatus.COMPLETED);

    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
    const todayRevenue = completedTodayOrders.reduce((sum, order) => sum + order.total, 0);

    // Calculate actual revenue accounting for credits (only from completed orders)
    const allRevenueData = await RevenueService.calculateOrdersRevenue(completedOrders, restaurant.id);
    const todayRevenueData = await RevenueService.calculateOrdersRevenue(completedTodayOrders, restaurant.id);

    // Calculate popular items (only from completed orders)
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    
    completedOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = itemMap.get(item.menuItemId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.total;
        } else {
          itemMap.set(item.menuItemId, {
            name: item.name,
            quantity: item.quantity,
            revenue: item.total,
          });
        }
      });
    });

    const popularItems = Array.from(itemMap.entries())
      .map(([menuItemId, data]) => ({
        menuItemId,
        ...data,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Calculate table stats (only from completed orders)
    const tableMap = new Map<string, { tableNumber: string; orderCount: number; revenue: number }>();
    
    completedOrders.forEach(order => {
      if (order.tableId) {
        const table = tables.find(t => t.id === order.tableId);
        const existing = tableMap.get(order.tableId);
        
        if (existing) {
          existing.orderCount += 1;
          existing.revenue += order.total;
        } else {
          tableMap.set(order.tableId, {
            tableNumber: table?.number || 'Unknown',
            orderCount: 1,
            revenue: order.total,
          });
        }
      }
    });

    const tableStats = Array.from(tableMap.entries())
      .map(([tableId, data]) => ({
        tableId,
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    setStats({
      totalOrders: orderList.length,
      totalRevenue,
      actualRevenue: allRevenueData.actualRevenue,
      pendingCredits: allRevenueData.pendingCreditAmount,
      avgOrderValue: orderList.length > 0 ? totalRevenue / orderList.length : 0,
      todayOrders: todayOrders.length,
      todayRevenue,
      todayActualRevenue: todayRevenueData.actualRevenue,
      popularItems,
      tableStats,
    });
  }, [tables]);

  const applyFilters = useCallback(async () => {
    let filtered = [...orders];

    // Date range filter - Fixed date comparison logic
    const now = new Date();
    
    switch (dateRange) {
      case 'all':
        // No date filtering - show all orders
        break;
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setHours(23, 59, 59, 999);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= todayStart && orderDate <= todayEnd;
        });
        break;
      case 'yesterday':
        const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yesterdayEnd = new Date(yesterdayStart);
        yesterdayEnd.setHours(23, 59, 59, 999);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= yesterdayStart && orderDate <= yesterdayEnd;
        });
        break;
      case 'week':
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => 
          new Date(order.createdAt) >= weekStart
        );
        break;
      case 'last_week':
        const lastWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastWeekStart = new Date(lastWeekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= lastWeekStart && orderDate < lastWeekEnd;
        });
        break;
      case 'month':
        const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => 
          new Date(order.createdAt) >= monthStart
        );
        break;
      case 'this_month':
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter(order => 
          new Date(order.createdAt) >= thisMonthStart
        );
        break;
      case 'last_month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= lastMonthStart && orderDate < lastMonthEnd;
        });
        break;
      case 'quarter':
        const quarterStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => 
          new Date(order.createdAt) >= quarterStart
        );
        break;
      case 'custom':
        if (startDate) {
          const startDateObj = new Date(startDate);
          filtered = filtered.filter(order => 
            new Date(order.createdAt) >= startDateObj
          );
        }
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          filtered = filtered.filter(order => 
            new Date(order.createdAt) <= endDateObj
          );
        }
        break;
    }

    // Table filter
    if (tableId && tableId !== 'all') {
      filtered = filtered.filter(order => order.tableId === tableId);
    }

    // Status filter
    if (status && status !== 'all') {
      filtered = filtered.filter(order => order.status === status);
    }

    // Order type filter
    if (orderType && orderType !== 'all') {
      filtered = filtered.filter(order => order.type === orderType);
    }

    // Menu item filter
    if (menuItemId && menuItemId !== 'all') {
      filtered = filtered.filter(order => 
        order.items.some(item => item.menuItemId === menuItemId)
      );
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item => 
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    setFilteredOrders(filtered);
    await calculateStats(filtered);
    setCurrentPage(1);
  }, [orders, dateRange, startDate, endDate, tableId, status, orderType, menuItemId, searchTerm, calculateStats]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Group orders function - groups related orders from same table/session based on payment status
  const groupRelatedOrders = useCallback((ordersList: Order[]) => {
    // Remove any potential duplicates based on order ID first
    const uniqueOrders = ordersList.filter((order, index, self) => 
      index === self.findIndex(o => o.id === order.id)
    );
    
    const groups = new Map<string, Order[]>();
    
    // Sort orders by creation time globally (all tables together)
    const sortedOrders = [...uniqueOrders].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Group orders based on payment sessions - group only unpaid orders from same table
    sortedOrders.forEach((order, index) => {
      if (!order.tableId) {
        // Orders without table go in individual groups
        groups.set(order.id, [order]);
        return;
      }

      let foundGroup = false;
      
      // Look backwards to find the most recent order from the same table
      for (let i = index - 1; i >= 0; i--) {
        const previousOrder = sortedOrders[i];
        
        if (previousOrder.tableId === order.tableId) {
          // Found a previous order from the same table
          const currentOrderPaid = order.status === OrderStatus.COMPLETED && 
            (order.paymentStatus === 'paid' || order.paymentMethod);
          const previousOrderPaid = previousOrder.status === OrderStatus.COMPLETED && 
            (previousOrder.paymentStatus === 'paid' || previousOrder.paymentMethod);
          
          // If both orders are paid, check if they were paid together (completed at similar time)
          if (currentOrderPaid && previousOrderPaid) {
            const currentCompletedTime = new Date(order.updatedAt).getTime();
            const previousCompletedTime = new Date(previousOrder.updatedAt).getTime();
            const completionTimeDiff = Math.abs(currentCompletedTime - previousCompletedTime);
            
            // If completed within 30 seconds of each other, they were likely paid together
            const thirtySeconds = 30 * 1000;
            
            if (completionTimeDiff <= thirtySeconds) {
              // Find the group that contains this previous order
              for (const [groupKey, groupOrders] of groups.entries()) {
                if (groupOrders.some(o => o.id === previousOrder.id)) {
                  // Add current order to the same group (paid together)
                  groupOrders.push(order);
                  foundGroup = true;
                  break;
                }
              }
              if (foundGroup) break;
            }
          }
          // If both orders are unpaid, check if they're part of ongoing Add More session
          else if (!currentOrderPaid && !previousOrderPaid) {
            const currentOrderTime = new Date(order.createdAt).getTime();
            const previousOrderTime = new Date(previousOrder.createdAt).getTime();
            const creationTimeDiff = currentOrderTime - previousOrderTime;
            
            // Allow longer time for Add More sessions (15 minutes)
            const fifteenMinutes = 15 * 60 * 1000;
            
            if (creationTimeDiff <= fifteenMinutes) {
              // Find the group that contains this previous order
              for (const [groupKey, groupOrders] of groups.entries()) {
                if (groupOrders.some(o => o.id === previousOrder.id)) {
                  // Add current order to the same unpaid group
                  groupOrders.push(order);
                  foundGroup = true;
                  break;
                }
              }
              if (foundGroup) break;
            }
          }
          
          // Stop at first order from same table
          break;
        }
      }

      if (!foundGroup) {
        // Create new group with unique key using order ID to prevent duplicates
        groups.set(order.id, [order]);
      }
    });

    return Array.from(groups.entries()).map(([groupKey, orders]) => ({
      groupKey,
      orders: orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      primaryOrder: orders[0], // Use first order as primary
      totalAmount: orders.reduce((sum, order) => sum + order.total, 0),
      totalItems: orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
      isGroup: orders.length > 1
    }));
  }, []);

  // Toggle group expansion
  const toggleGroupExpansion = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  // Get grouped orders for display
  const groupedOrders = useMemo(() => {
    return groupRelatedOrders(filteredOrders);
  }, [filteredOrders, groupRelatedOrders]);

  // Pagination for grouped orders
  const totalGroups = groupedOrders.length;
  const totalPages = Math.ceil(totalGroups / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;
  const paginatedGroups = groupedOrders.slice(startIndex, startIndex + ordersPerPage);

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    if (!restaurant) return;

    try {
      const result = await OrderService.updateOrderStatus(orderId, restaurant.id, status);
      
      if (result.success) {
        // Update local state
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, status } : order
        ));
        
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status });
        }
        
        toast.success('Order status updated successfully');
      } else {
        toast.error(result.error || 'Failed to update order status');
      }
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  // Handle payment update
  const handleUpdatePayment = async (orderId: string, paymentData: any) => {
    if (!restaurant) return;

    try {
      setIsUpdatingPayment(true);

      // Prepare update data for order with comprehensive payment and discount information
      const updateData: any = {
        paymentMethod: paymentData.paymentMethod,
        amountReceived: paymentData.amountReceived,
        finalTotal: paymentData.finalTotal,
        originalTotal: paymentData.originalTotal,
        // Update the main total field to reflect discounted amount
        total: paymentData.finalTotal,
        updatedAt: new Date()
      };

      // Add discount information to preserve it in order record
      if (paymentData.manualDiscountAmount > 0 || paymentData.couponDiscountAmount > 0) {
        updateData.discountApplied = true;
        updateData.totalDiscountAmount = (paymentData.manualDiscountAmount || 0) + (paymentData.couponDiscountAmount || 0);
        updateData.originalTotalBeforeDiscount = paymentData.originalTotal;
        
        // Store manual discount details
        if (paymentData.manualDiscount) {
          updateData.manualDiscount = {
            type: paymentData.manualDiscount.type,
            value: paymentData.manualDiscount.value,
            amount: paymentData.manualDiscountAmount,
            reason: paymentData.manualDiscount.reason || ''
          };
        }
        
        // Store coupon discount details
        if (paymentData.couponDiscountAmount > 0) {
          updateData.couponDiscountAmount = paymentData.couponDiscountAmount;
        }
        
        // Update the discount field for backward compatibility
        updateData.discount = (paymentData.manualDiscountAmount || 0) + (paymentData.couponDiscountAmount || 0);
      }

      // Add tip information if provided
      if (paymentData.tip > 0) {
        updateData.tip = paymentData.tip;
      }

      // Add total savings information
      if (paymentData.totalSavings > 0) {
        updateData.totalSavings = paymentData.totalSavings;
      }

      // Add coupon information if applied
      if (paymentData.appliedCoupon) {
        updateData.appliedCoupon = {
          code: paymentData.appliedCoupon.coupon.code,
          name: paymentData.appliedCoupon.coupon.name,
          discountAmount: paymentData.appliedCoupon.discountAmount || 0,
          freeItems: paymentData.appliedCoupon.freeItems || [],
          totalSavings: paymentData.totalSavings || 0
        };
      }

      // Add split payment information if applicable
      if (paymentData.isSplitPayment) {
        updateData.splitPayments = paymentData.splitPayments;
        updateData.paymentMethod = 'split';
      }

      // Add credit information if applicable
      if (paymentData.isCredit) {
        updateData.isCredit = true;
        updateData.creditAmount = paymentData.creditAmount;
        updateData.creditCustomerId = paymentData.creditCustomerId;
        updateData.creditCustomerName = paymentData.creditCustomerName;
        updateData.creditCustomerPhone = paymentData.creditCustomerPhone;
      }

      const result = await OrderService.updateOrderStatus(orderId, restaurant.id, OrderStatus.COMPLETED, updateData);
      
      if (result.success) {
        // Update local state
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, ...updateData } : order
        ));
        
        // Update selected order if it's the one being edited
        if (orderToEditPayment && orderToEditPayment.id === orderId) {
          setOrderToEditPayment({
            ...orderToEditPayment,
            ...updateData,
          } as any);
        }
        
        setShowEditPaymentModal(false);
        setOrderToEditPayment(null);
        
        const methodText = paymentData.isSplitPayment 
          ? `Split payment (${paymentData.splitPayments.map((p: any) => p.method.toUpperCase()).join(' + ')})`
          : paymentData.paymentMethod.toUpperCase();
        
        toast.success(`Payment method updated to ${methodText}`);
      } else {
        toast.error(result.error || 'Failed to update payment details');
      }
    } catch (error) {
      console.error('Payment update error:', error);
      toast.error('Failed to update payment details');
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handlePrintBill = async (order: Order) => {
    if (!restaurant) {
      toast.error('Restaurant data not available');
      return;
    }

    const table = tables.find(t => t.id === order.tableId);
    if (!table) {
      toast.error('Table information not found');
      return;
    }

    try {
      // Show loading toast
      const toastId = toast.loading('Generating bill...');
      
      console.log('🏷️ Starting bill generation for order:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        restaurant: restaurant.name,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      });
      
      // Detect if user is on mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Generate bill content with mobile-optimized settings
      const billContent = await generateOrderBillContent(order, restaurant, table, isMobile);
      
      // Dismiss loading toast
      toast.dismiss(toastId);
      
      if (isMobile) {
        // Mobile-specific print handling
        console.log('🔥 Mobile device detected - using mobile print strategy');
        
        // Create a temporary container in the current document
        const printContainer = document.createElement('div');
        printContainer.style.position = 'fixed';
        printContainer.style.top = '-9999px';
        printContainer.style.left = '-9999px';
        printContainer.style.width = '100%';
        printContainer.style.height = '100%';
        printContainer.innerHTML = billContent;
        
        document.body.appendChild(printContainer);
        
        // Wait for any images to load
        const images = printContainer.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
          return new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve(); // Resolve even on error to not block
              // Timeout fallback
              setTimeout(() => resolve(), 2000);
            }
          });
        });
        
        await Promise.all(imagePromises);
        
        // Try to use Web Share API on mobile if available
        if (isMobile && navigator.share) {
          try {
            // Create a plain text version for sharing
            const textContent = `
${restaurant.name}
BILL RECEIPT

Order: #${order.orderNumber}
Table: ${table?.number || 'N/A'}
Date: ${formatDate(order.createdAt)}
Time: ${formatTime(order.createdAt)}

ITEMS:
${order.items.map(item => 
  `${item.quantity}x ${item.name} - ₹${item.total.toFixed(2)}`
).join('\n')}

Subtotal: ₹${order.subtotal.toFixed(2)}
${order.discount > 0 ? `Discount: -₹${order.discount.toFixed(2)}\n` : ''}Tax: ₹${order.tax.toFixed(2)}
TOTAL: ₹${order.total.toFixed(2)}

Payment: ${order.paymentStatus.toUpperCase()}
${restaurant?.settings?.upiSettings?.upiId ? `\nUPI ID: ${restaurant.settings.upiSettings.upiId}` : ''}

Thank you for dining with us!
            `.trim();
            
            const shareButton = document.createElement('button');
            shareButton.textContent = 'Share Bill';
            shareButton.style.cssText = `
              position: fixed; 
              bottom: 20px; 
              right: 20px; 
              z-index: 9999; 
              background: #007bff; 
              color: white; 
              border: none; 
              padding: 12px 16px; 
              border-radius: 8px; 
              font-weight: bold;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            
            shareButton.onclick = async () => {
              try {
                await navigator.share({
                  title: `Bill - Order #${order.orderNumber}`,
                  text: textContent
                });
                document.body.removeChild(shareButton);
                toast.success('Bill shared successfully!');
              } catch (err) {
                console.log('Share cancelled or failed:', err);
              }
            };
            
            document.body.appendChild(shareButton);
            
            // Remove share button after 10 seconds
            setTimeout(() => {
              if (document.body.contains(shareButton)) {
                document.body.removeChild(shareButton);
              }
            }, 10000);
            
          } catch (error) {
            console.log('Web Share API not available:', error);
          }
        }
        
        // Create print-specific styles
        const printStyles = document.createElement('style');
        printStyles.innerHTML = `
          @media print {
            body * { visibility: hidden; }
            .print-content, .print-content * { visibility: visible; }
            .print-content { position: absolute; left: 0; top: 0; width: 100%; }
            @page { margin: 0.5in; size: auto; }
          }
        `;
        document.head.appendChild(printStyles);
        printContainer.classList.add('print-content');
        
        // Trigger print with mobile fallback
        setTimeout(() => {
          // First try the standard print
          try {
            window.print();
          } catch (printError) {
            console.log('Standard print failed, showing mobile alternative:', printError);
            
            // Show a modal with print instructions for mobile
            const modal = document.createElement('div');
            modal.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0,0,0,0.8);
              z-index: 10000;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            `;
            
            modal.innerHTML = `
              <div style="
                background: white;
                border-radius: 8px;
                padding: 20px;
                max-width: 350px;
                text-align: center;
                font-family: system-ui, -apple-system, sans-serif;
              ">
                <h3 style="margin: 0 0 15px 0; color: #333;">Print Instructions</h3>
                <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">
                  To print this bill on mobile:
                </p>
                <ol style="text-align: left; padding-left: 20px; margin: 0 0 15px 0; color: #666; font-size: 14px;">
                  <li>Tap the three dots (⋮) in your browser</li>
                  <li>Select "Print" or "Share"</li>
                  <li>Choose your printer or save as PDF</li>
                </ol>
                <div style="display: flex; gap: 10px; justify-content: center;">
                  <button onclick="window.print(); this.parentElement.parentElement.parentElement.remove();" 
                          style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; font-weight: bold;">
                    Try Print Again
                  </button>
                  <button onclick="this.parentElement.parentElement.parentElement.remove();" 
                          style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px;">
                    Close
                  </button>
                </div>
              </div>
            `;
            
            document.body.appendChild(modal);
            
            // Remove modal after 30 seconds
            setTimeout(() => {
              if (document.body.contains(modal)) {
                document.body.removeChild(modal);
              }
            }, 30000);
          }
          
          // Cleanup
          setTimeout(() => {
            document.body.removeChild(printContainer);
            document.head.removeChild(printStyles);
          }, 1000);
        }, 500);
        
      } else {
        // Desktop print handling (existing method)
        console.log('🖥️ Desktop device detected - using popup window strategy');
        
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(billContent);
          printWindow.document.close();
          
          // Wait for content to load
          printWindow.addEventListener('load', () => {
            setTimeout(() => {
              printWindow.focus();
              printWindow.print();
            }, 1000);
          });
          
          // Fallback for immediate print
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          }, 2000);
        }
      }
      
      toast.success(`Bill for Order #${order.orderNumber} sent to printer`);
    } catch (error) {
      console.error('❌ Error generating bill:', error);
      toast.error('Failed to generate bill');
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-600', label: 'Draft' },
      placed: { color: 'bg-blue-100 text-blue-800', label: 'Placed' },
      confirmed: { color: 'bg-yellow-100 text-yellow-800', label: 'Confirmed' },
      preparing: { color: 'bg-orange-100 text-orange-800', label: 'Preparing' },
      ready: { color: 'bg-green-100 text-green-800', label: 'Ready' },
      completed: { color: 'bg-gray-100 text-gray-800', label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
    };
    
    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Sales Report Functions
  const handleExportFilteredData = async () => {
    if (!restaurant || filteredOrders.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Use grouped orders for export instead of individual orders
      const exportGroupedOrders = groupRelatedOrders(filteredOrders);
      
      console.log('🔥 Starting export process...', { 
        restaurantId: restaurant.id, 
        filteredOrdersCount: filteredOrders.length,
        groupedOrdersCount: exportGroupedOrders.length,
        filters: { dateRange, tableId, status, orderType, menuItemId, searchTerm }
      });
      
      toast.loading('Generating export...');
      
      // Create date range based on current filters
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let exportStartDate: Date;
      let exportEndDate: Date;
      let rangeLabel: string;

      switch (dateRange) {
        case 'today':
          exportStartDate = today;
          exportEndDate = new Date();
          rangeLabel = 'Today';
          break;
        case 'week':
          exportStartDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          exportEndDate = new Date();
          rangeLabel = 'Last 7 Days';
          break;
        case 'month':
          exportStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
          exportEndDate = new Date();
          rangeLabel = 'This Month';
          break;
        case 'custom':
          exportStartDate = startDate ? new Date(startDate) : new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          exportEndDate = endDate ? new Date(endDate) : new Date();
          rangeLabel = `${formatDate(exportStartDate)} - ${formatDate(exportEndDate)}`;
          break;
        default:
          exportStartDate = today;
          exportEndDate = new Date();
          rangeLabel = 'Today';
      }

      console.log('📅 Date range for export:', { exportStartDate, exportEndDate, rangeLabel });

      // Skip Firebase analytics generation and create analytics directly from filtered orders
      console.log('📊 Creating analytics directly from filtered orders...');
      
      // Create base analytics structure with default values
      const baseAnalytics = {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        totalItems: 0,
        totalCustomers: 0,
        revenueGrowth: 0,
        orderGrowth: 0,
        customerGrowth: 0,
        menuItemSales: [],
        categorySales: [],
        tableSales: [],
        hourlyBreakdown: [],
        dailyBreakdown: [],
        paymentMethodBreakdown: [],
        orderTypeBreakdown: [],
        topCustomers: [],
        staffPerformance: [],
        peakHours: [],
        itemCombinations: []
      };
      
      // Calculate custom analytics from filtered orders (only completed orders)
      const completedFilteredOrders = filteredOrders.filter(order => order.status === OrderStatus.COMPLETED);
      
      // Calculate actual revenue accounting for credits
      const filteredRevenue = completedFilteredOrders.reduce((sum, order) => {
        const creditAmount = (order as any).creditAmount || 0;
        const actualRevenue = order.total - creditAmount;
        return sum + actualRevenue;
      }, 0);
      
      // Calculate total bill amount (before credits)
      const totalBillAmount = completedFilteredOrders.reduce((sum, order) => sum + order.total, 0);
      
      // Calculate total credits
      const totalCredits = completedFilteredOrders.reduce((sum, order) => sum + ((order as any).creditAmount || 0), 0);
      
      // Calculate total savings from discounts and coupons
      const totalSavings = completedFilteredOrders.reduce((sum, order) => sum + ((order as any).totalSavings || 0), 0);
      
      const filteredItems = filteredOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
      
      // Create menu item sales from filtered completed orders
      const menuItemSalesMap = new Map<string, { menuItemId: string; name: string; quantitySold: number; revenue: number; }>();
      
      completedFilteredOrders.forEach(order => {
        order.items.forEach(item => {
          const existing = menuItemSalesMap.get(item.menuItemId) || {
            menuItemId: item.menuItemId,
            name: item.name,
            quantitySold: 0,
            revenue: 0
          };
          
          existing.quantitySold += item.quantity;
          existing.revenue += item.total;
          menuItemSalesMap.set(item.menuItemId, existing);
        });
      });
      
      const customMenuItemSales = Array.from(menuItemSalesMap.values()).map(item => ({
        ...item,
        percentage: filteredRevenue > 0 ? (item.revenue / filteredRevenue) * 100 : 0
      })).sort((a, b) => b.revenue - a.revenue);

      // Create table sales from grouped orders for better analytics
      const tableSalesMap = new Map<string, { tableId: string; tableNumber: string; orderCount: number; revenue: number; }>();
      
      exportGroupedOrders.forEach(group => {
        if (group.primaryOrder.tableId) {
          const table = tables.find(t => t.id === group.primaryOrder.tableId);
          const existing = tableSalesMap.get(group.primaryOrder.tableId) || {
            tableId: group.primaryOrder.tableId,
            tableNumber: table?.number || 'Unknown',
            orderCount: 0,
            revenue: 0
          };
          
          // Only count revenue from completed orders in the group
          const completedGroupOrders = group.orders.filter(order => order.status === OrderStatus.COMPLETED);
          if (completedGroupOrders.length > 0) {
            existing.orderCount += 1;
            existing.revenue += completedGroupOrders.reduce((sum, order) => sum + order.total, 0);
          }
          tableSalesMap.set(group.primaryOrder.tableId, existing);
        }
      });
      
      const customTableSales = Array.from(tableSalesMap.values()).map(table => ({
        ...table,
        averageOrderValue: table.orderCount > 0 ? table.revenue / table.orderCount : 0,
        utilizationRate: 0 // Not calculated in this context
      })).sort((a, b) => b.revenue - a.revenue);

      // Create category sales from filtered completed orders
      const categorySalesMap = new Map<string, { categoryName: string; quantitySold: number; revenue: number; }>();
      
      completedFilteredOrders.forEach(order => {
        order.items.forEach(item => {
          const menuItem = menuItems.find(m => m.id === item.menuItemId);
          const categoryName = menuItem?.categoryName || 'Uncategorized';
          
          const existing = categorySalesMap.get(categoryName) || {
            categoryName,
            quantitySold: 0,
            revenue: 0
          };
          
          existing.quantitySold += item.quantity;
          existing.revenue += item.total;
          categorySalesMap.set(categoryName, existing);
        });
      });
      
      const customCategorySales = Array.from(categorySalesMap.values()).map(category => ({
        ...category,
        percentage: filteredRevenue > 0 ? (category.revenue / filteredRevenue) * 100 : 0,
        itemCount: 0 // Not calculated in this context
      })).sort((a, b) => b.revenue - a.revenue);

      // Create order type breakdown from filtered completed orders
      const orderTypeMap = new Map<string, { type: string; count: number; revenue: number; }>();
      
      completedFilteredOrders.forEach(order => {
        const type = order.type || 'dine_in';
        const existing = orderTypeMap.get(type) || {
          type,
          count: 0,
          revenue: 0
        };
        
        existing.count += 1;
        existing.revenue += order.total;
        orderTypeMap.set(type, existing);
      });
      
      const customOrderTypeBreakdown = Array.from(orderTypeMap.values()).map(type => ({
        ...type,
        percentage: filteredRevenue > 0 ? (type.revenue / filteredRevenue) * 100 : 0
      }));

      // Create hourly breakdown from filtered completed orders
      const hourlyMap = new Map<number, { hour: number; orderCount: number; revenue: number; }>();
      
      completedFilteredOrders.forEach(order => {
        const hour = new Date(order.createdAt).getHours();
        const existing = hourlyMap.get(hour) || {
          hour,
          orderCount: 0,
          revenue: 0
        };
        
        existing.orderCount += 1;
        existing.revenue += order.total;
        hourlyMap.set(hour, existing);
      });
      
      const customHourlyBreakdown = Array.from(hourlyMap.values()).sort((a, b) => a.hour - b.hour);

      // Create payment method breakdown from filtered completed orders using actual payment data
      const paymentMethodMap = new Map<string, { method: string; count: number; amount: number; splitDetails?: Array<{method: string, amount: number, count: number}> }>();
      
      completedFilteredOrders.forEach(order => {
        // Use actual payment method from order data
        if (order.paymentMethod === 'split' && (order as any).splitPayments) {
          // Handle split payments - count each split method separately
          const splitPayments = (order as any).splitPayments;
          const splitMethodMap = new Map<string, number>();
          
          splitPayments.forEach((payment: any) => {
            const method = payment.method.toUpperCase();
            splitMethodMap.set(method, (splitMethodMap.get(method) || 0) + payment.amount);
          });
          
          // Add each split method to the main payment breakdown
          splitMethodMap.forEach((amount, method) => {
            const existing = paymentMethodMap.get(method) || {
              method: method,
              count: 0,
              amount: 0,
              splitDetails: []
            };
            
            existing.count += 1;
            existing.amount += amount;
            
            // Track split payment details
            if (!existing.splitDetails) existing.splitDetails = [];
            const splitDetail = existing.splitDetails.find(s => s.method === method);
            if (splitDetail) {
              splitDetail.amount += amount;
              splitDetail.count += 1;
            } else {
              existing.splitDetails.push({
                method: method,
                amount: amount,
                count: 1
              });
            }
            
            paymentMethodMap.set(method, existing);
          });
          
          // Also track the split payment as a separate category
          const splitTotal = order.total;
          const existingSplit = paymentMethodMap.get('SPLIT') || {
            method: 'SPLIT',
            count: 0,
            amount: 0,
            splitDetails: splitPayments.map((p: any) => ({
              method: p.method.toUpperCase(),
              amount: p.amount,
              count: 1
            }))
          };
          
          existingSplit.count += 1;
          existingSplit.amount += splitTotal;
          paymentMethodMap.set('SPLIT', existingSplit);
          
        } else if (order.paymentMethod) {
          // Handle single payment methods
          const method = order.paymentMethod.toUpperCase();
          const existing = paymentMethodMap.get(method) || {
            method: method,
            count: 0,
            amount: 0
          };
          
          existing.count += 1;
          existing.amount += order.total;
          paymentMethodMap.set(method, existing);
          
        } else {
          // Fallback for orders without payment method data
          let estimatedMethod = 'CASH'; // Default
          
          // Use order notes as a hint for payment method
          const orderNotes = order.notes?.toLowerCase() || '';
          if (orderNotes.includes('upi') || orderNotes.includes('gpay') || orderNotes.includes('paytm') || orderNotes.includes('phonepe')) {
            estimatedMethod = 'UPI';
          } else if (orderNotes.includes('card') || orderNotes.includes('bank')) {
            estimatedMethod = 'BANK';
          }
          
          const existing = paymentMethodMap.get(estimatedMethod) || {
            method: estimatedMethod,
            count: 0,
            amount: 0
          };
          
          existing.count += 1;
          existing.amount += order.total;
          paymentMethodMap.set(estimatedMethod, existing);
        }
      });
      
      const customPaymentMethodBreakdown = Array.from(paymentMethodMap.values()).map(payment => ({
        ...payment,
        percentage: filteredRevenue > 0 ? (payment.amount / filteredRevenue) * 100 : 0
      })).sort((a, b) => b.amount - a.amount);

      // Update analytics with filtered data
      const customAnalytics = {
        ...baseAnalytics,
        totalRevenue: filteredRevenue,
        totalOrders: filteredOrders.length, // Individual orders count
        totalOrderGroups: exportGroupedOrders.length, // Grouped order count
        averageOrderValue: filteredOrders.length > 0 ? filteredRevenue / filteredOrders.length : 0,
        averageGroupValue: exportGroupedOrders.length > 0 ? filteredRevenue / exportGroupedOrders.length : 0,
        totalItems: filteredItems,
        menuItemSales: customMenuItemSales,
        tableSales: customTableSales,
        categorySales: customCategorySales,
        orderTypeBreakdown: customOrderTypeBreakdown,
        paymentMethodBreakdown: customPaymentMethodBreakdown,
        hourlyBreakdown: customHourlyBreakdown,
        peakHours: customHourlyBreakdown.slice().sort((a, b) => b.orderCount - a.orderCount).map(h => ({
          ...h,
          isWeekend: false
        })),
        creditAnalytics: {
          totalCreditAmount: totalCredits,
          pendingCreditAmount: totalCredits, // All credit is pending since this is order-level data
          paidCreditAmount: 0, // Would need credit service data for payments made
          ordersWithCredits: completedFilteredOrders.filter(order => {
            const explicit = (order as any).creditAmount || 0;
            const received = (order as any).amountReceived ?? order.total;
            return explicit > 0 || order.total - received > 0;
          }).length,
          creditTransactions: completedFilteredOrders.filter(order => {
            const explicit = (order as any).creditAmount || 0;
            const received = (order as any).amountReceived ?? order.total;
            return explicit > 0 || order.total - received > 0;
          }).map(order => {
            const table = tables.find(t => t.id === order.tableId);
            const explicitCredit = (order as any).creditAmount || 0;
            const creditAmount = explicitCredit > 0 ? explicitCredit : Math.max(0, order.total - ((order as any).amountReceived ?? order.total));
            return {
              customerName: (order as any).creditCustomerName || 'Unknown',
              customerPhone: (order as any).creditCustomerPhone || '',
              orderId: order.id,
              tableNumber: table?.number || 'Unknown',
              totalAmount: order.total,
              amountReceived: (order as any).amountReceived || 0,
              creditAmount: creditAmount,
              remainingAmount: creditAmount,
              status: 'pending' as const,
              createdAt: order.createdAt,
              paymentHistory: []
            };
          }),
          revenueCollectionRate: totalBillAmount > 0 ? (filteredRevenue / totalBillAmount) * 100 : 100,
          actualRevenue: filteredRevenue,
          totalBillAmount: totalBillAmount
        },
        // Savings analytics
        savingsAnalytics: {
          ordersWithSavings: completedFilteredOrders.filter(order => (order as any).totalSavings > 0).length,
          totalSavingsAmount: totalSavings,
          averageSavingsAmount: totalSavings > 0 ? totalSavings / completedFilteredOrders.filter(order => (order as any).totalSavings > 0).length : 0,
          savingsPercentage: (totalBillAmount + totalSavings) > 0 ? (totalSavings / (totalBillAmount + totalSavings)) * 100 : 0
        },
        // Additional grouping insights
        groupingInsights: {
          totalGroups: exportGroupedOrders.length,
          totalIndividualOrders: filteredOrders.length,
          groupedOrders: exportGroupedOrders.filter(g => g.isGroup).length,
          standaloneOrders: exportGroupedOrders.filter(g => !g.isGroup).length,
          averageOrdersPerGroup: exportGroupedOrders.length > 0 ? 
            exportGroupedOrders.reduce((sum, g) => sum + g.orders.length, 0) / exportGroupedOrders.length : 0
        }
      };

      console.log('📊 Custom analytics created:', customAnalytics);

      // Add detailed grouped order list to analytics
      const detailedOrderList = exportGroupedOrders.slice(0, 50).map(group => {
        const table = tables.find(t => t.id === group.primaryOrder.tableId);
        
        // Format comprehensive payment information including credits and discounts
        let paymentInfo = 'Not specified';
        const groupCreditAmount = group.orders.reduce((sum, o) => {
          const explicit = (o as any).creditAmount || 0;
          if (explicit > 0) return sum + explicit;
          const received = (o as any).amountReceived ?? o.total;
          return sum + Math.max(0, o.total - received);
        }, 0);
        const groupDiscountAmount = group.orders.reduce((sum, o) => sum + ((o as any).discount || 0), 0);
        const groupSavingsAmount = group.orders.reduce((sum, o) => sum + ((o as any).totalSavings || 0), 0);
        const hasCredit = group.orders.some(order => (order as any).isCredit);
        const hasDiscount = groupDiscountAmount > 0;
        const hasSavings = groupSavingsAmount > 0;
        
        // Base payment method
        if (group.primaryOrder.paymentMethod === 'split' && (group.primaryOrder as any).splitPayments) {
          const splitPayments = (group.primaryOrder as any).splitPayments;
          paymentInfo = `Split: ${splitPayments.map((p: any) => 
            `${p.method.toUpperCase()} Rs.${p.amount.toFixed(2)}`
          ).join(' + ')}`;
        } else if (group.primaryOrder.paymentMethod) {
          paymentInfo = group.primaryOrder.paymentMethod.toUpperCase();
        }
        
        // Create structured payment information with better formatting
        if (hasCredit || hasDiscount || hasSavings) {
          const creditCustomers = group.orders.filter(order => (order as any).isCredit && (order as any).creditCustomerName).map(order => (order as any).creditCustomerName);
                                                                                                                                                                                
          let structuredPayment = `${paymentInfo}`;
          
          if (hasCredit) {
            structuredPayment += `\n• Credit: -${formatCurrency(groupCreditAmount)}`;
            if (creditCustomers.length > 0) {
              structuredPayment += `\n• Customer: ${creditCustomers.slice(0, 2).join(', ')}${creditCustomers.length > 2 ? ` +${creditCustomers.length - 2} more` : ''}`;
            }
          }
          
          if (hasDiscount) {
            structuredPayment += `\n• Discount: -${formatCurrency(groupDiscountAmount)}`;
          }
          
          if (hasSavings) {
            structuredPayment += `\n• Savings: ${formatCurrency(groupSavingsAmount)}`;
          }
          
          paymentInfo = structuredPayment;
        }

        // If it's a group, create a combined description
        if (group.isGroup) {
          const allItems = group.orders.flatMap(o => o.items.map(item => `${item.quantity}x ${item.name}`)).join(', ');
          
          // Explicitly aggregate credit and discount amounts for the entire group
          const totalCreditForGroup = group.orders.reduce((sum, order) => {
            const explicitCredit = (order as any).creditAmount || 0;
            if (explicitCredit > 0) return sum + explicitCredit;
            const received = (order as any).amountReceived ?? order.total;
            return sum + Math.max(0, order.total - received);
          }, 0);
          const totalSavingsForGroup = group.orders.reduce((sum, order) => sum + ((order as any).totalSavings || 0), 0);
          const totalDiscountForGroup = group.orders.reduce((sum, order) => sum + ((order as any).discount || 0), 0);
          
          return {
            orderNumber: `${group.primaryOrder.orderNumber} (+${group.orders.length - 1} more)`,
            tableNumber: table?.number || 'N/A',
            date: formatDate(group.primaryOrder.createdAt),
            time: formatTime(group.primaryOrder.createdAt),
            status: group.primaryOrder.status,
            type: group.primaryOrder.type,
            paymentMethod: paymentInfo,
            itemCount: group.orders.reduce((sum, o) => sum + o.items.length, 0),
            totalItems: group.totalItems,
            subtotal: group.orders.reduce((sum, o) => sum + (o.subtotal || 0), 0),
            tax: group.orders.reduce((sum, o) => sum + (o.tax || 0), 0),
            total: group.totalAmount,
            items: allItems,
            
            // Pass the aggregated amounts to the PDF service
            creditAmount: totalCreditForGroup,
            discount: totalDiscountForGroup,
            totalSavings: totalSavingsForGroup,
            
            isCredit: totalCreditForGroup > 0,
            creditCustomerName: group.orders.map(o => (o as any).creditCustomerName).filter(Boolean).join(', '),
            
            groupDetails: group.orders.map(order => ({
              orderNumber: order.orderNumber,
              time: formatTime(order.createdAt),
              items: order.items.map(item => `${item.quantity}x ${item.name}`).join(', '),
              total: order.total,
              creditAmount: (order as any).creditAmount ?? Math.max(0, order.total - ((order as any).amountReceived ?? order.total)),
              totalSavings: (order as any).totalSavings || 0,
              customerName: (order as any).creditCustomerName || '',
              discount: (order as any).discount || 0
            }))
          };
        } else {
          // Single order in group
          const order = group.primaryOrder;
          const creditAmount = (order as any).creditAmount ?? Math.max(0, order.total - ((order as any).amountReceived ?? order.total));
          const amountReceived = (order as any).amountReceived || order.total;
          const totalSavings = (order as any).totalSavings || 0;
          const discountAmount = (order as any).discount || 0;
          
          // Create structured payment information with better formatting for single order
          let finalSinglePaymentInfo = paymentInfo;
          
          if (creditAmount > 0 || discountAmount > 0 || totalSavings > 0) {
            let structuredSinglePayment = `${paymentInfo}`;
            
            if (creditAmount > 0) {
              structuredSinglePayment += `\n• Credit: -${formatCurrency(creditAmount)}`;
              if ((order as any).creditCustomerName) {
                structuredSinglePayment += `\n• Customer: ${(order as any).creditCustomerName}`;
              }
            }
            
            if (discountAmount > 0) {
              structuredSinglePayment += `\n• Discount: -${formatCurrency(discountAmount)}`;
            }
            
            if (totalSavings > 0) {
              structuredSinglePayment += `\n• Savings: ${formatCurrency(totalSavings)}`;
            }
            
            finalSinglePaymentInfo = structuredSinglePayment;
          }
          
          return {
            orderNumber: order.orderNumber,
            tableNumber: table?.number || 'N/A',
            date: formatDate(order.createdAt),
            time: formatTime(order.createdAt),
            status: order.status,
            type: order.type,
            paymentMethod: finalSinglePaymentInfo,
            itemCount: order.items.length,
            totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0),
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total,
            items: order.items.map(item => `${item.quantity}x ${item.name}`).join(', '),
            
            // Ensure single orders also pass their credit/savings data correctly
            creditAmount: creditAmount,
            totalSavings: (order as any).totalSavings || 0,
            isCredit: creditAmount > 0,
            
            creditCustomerName: (order as any).creditCustomerName || '',
            creditCustomerPhone: (order as any).creditCustomerPhone || '',
            discount: (order as any).discount || 0
          };
        }
      });

      // Add to analytics
      (customAnalytics as any).detailedOrderList = detailedOrderList;

      // Generate PDF with comprehensive configuration
      const reportConfig = {
        includeGraphs: true,
        includeMenuAnalysis: true,
        includeTableAnalysis: true,
        includeCustomerAnalysis: false, // Not available in current filter context
        includeStaffAnalysis: false, // Not available in current filter context
        includeTimeAnalysis: true,
        includeTaxBreakdown: false,
        includeDiscountAnalysis: false,
        includeCreditAnalysis: true,
        includeOrderDetails: true, // New flag for detailed order list
        reportTitle: `Orders Export - ${rangeLabel}`,
        additionalNotes: `Grouped orders export containing ${filteredOrders.length} individual orders (${exportGroupedOrders.length} groups). Applied filters: ${[
          dateRange !== 'today' ? `Date: ${rangeLabel}` : null,
          tableId && tableId !== 'all' ? `Table: ${tables.find(t => t.id === tableId)?.number || 'N/A'}` : null,
          status && status !== 'all' ? `Status: ${status}` : null,
          orderType && orderType !== 'all' ? `Type: ${orderType.replace('_', ' ')}` : null,
          menuItemId && menuItemId !== 'all' ? `Item: ${menuItems.find(m => m.id === menuItemId)?.name || 'N/A'}` : null,
          searchTerm ? `Search: "${searchTerm}"` : null
        ].filter(Boolean).join(', ') || 'None'}. ${exportGroupedOrders.length > 50 ? `Note: Only first 50 order groups shown in detail.` : 'Related orders from same table are grouped together.'}`
      };

      const dateRangeObj = {
        startDate: exportStartDate,
        endDate: exportEndDate,
        label: rangeLabel
      };

      console.log('📄 Generating PDF...');
      const pdfBlob = await SalesReportService.generatePDFReport(
        customAnalytics,
        dateRangeObj,
        restaurant.name,
        reportConfig
      );

      console.log('📄 PDF generated successfully, size:', pdfBlob.size);

      // Download the PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orders-export-${restaurant.name.replace(/\s+/g, '-').toLowerCase()}-${formatDate(new Date()).replace(/\//g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ Export completed successfully');
      toast.dismiss();
      toast.success(`Export completed! ${filteredOrders.length} orders in ${exportGroupedOrders.length} groups exported.`);
    } catch (error) {
      toast.dismiss();
      console.error('❌ Export error:', error);
      toast.error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const openModal = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const openEditPaymentModal = (order: Order) => {
    setOrderToEditPayment(order);
    setShowEditPaymentModal(true);
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header - Mobile Optimized */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-indigo-600"
              >
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Order Dashboard</h1>
                <p className="text-xs text-gray-600 hidden sm:block">Manage all orders efficiently</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadData()}
                className="btn btn-sm btn-secondary"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline ml-2">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Compact Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-4 mb-4">
          <div className="bg-white p-3 rounded-lg border">
            <div className="text-center">
              <p className="text-xs sm:text-sm font-medium text-gray-500">Revenue</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{formatCurrency(stats.actualRevenue)}</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border">
            <div className="text-center">
              <p className="text-xs sm:text-sm font-medium text-gray-500">Avg Order</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{formatCurrency(stats.avgOrderValue)}</p>
              </div>
            </div>
          </div>

        {/* Filters - Mobile Optimized */}
            <div className="bg-white p-3 sm:p-4 rounded-lg border mb-4">
              <form onSubmit={handleSubmit(() => {})} className="space-y-3">
                {/* Search Input */}
                    <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search orders, items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                      />
                  </div>

                {/* Filter selects in a responsive grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  <select {...register('dateRange')} className="filter-select w-full min-w-0">
                    <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                    <option value="custom">Custom</option>
                    </select>
                  <select {...register('tableId')} className="filter-select w-full min-w-0">
                    <option value="all">All Tables</option>
                      {tables.map(table => (
                      <option key={table.id} value={table.id}>Table {table.number}</option>
                      ))}
                    </select>
                  <select {...register('status')} className="filter-select w-full min-w-0">
                      <option value="all">All Status</option>
                    {ALL_STATUSES.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()}</option>
                    ))}
                    </select>
                  <select {...register('orderType')} className="filter-select w-full min-w-0">
                      <option value="all">All Types</option>
                    <option value="dine_in">Dine-In</option>
                      <option value="takeaway">Takeaway</option>
                      <option value="delivery">Delivery</option>
                    </select>
                  <div className="col-span-2 sm:col-span-1 md:col-span-1">
                    <select {...register('menuItemId')} className="filter-select w-full min-w-0">
                      <option value="all">All Items</option>
                      {menuItems.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </form>
            </div>

        {/* Orders List Header */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Orders ({filteredOrders.length})</h2>
                  <button 
            className="btn btn-sm btn-primary"
                    onClick={handleExportFilteredData}
            disabled={isExporting}
                  >
            <Download className="w-4 h-4 mr-2"/>
                    Export ({filteredOrders.length})
                  </button>
              </div>

        {/* Orders List / Grid */}
        <div className="space-y-3">
        {isLoading && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Loading orders...</p>
                </div>
         )}
         {!isLoading && filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
                  <p className="text-gray-600">No orders match your current filters.</p>
                </div>
              ) : (
          !isLoading && paginatedGroups.map((group) => {
            const order = group.primaryOrder;
            const groupKey = group.groupKey;
            const table = tables.find(t => t.id === order.tableId);
            const totalItems = group.orders.reduce((sum, o) => sum + o.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);
            return(
              <div key={groupKey} className="bg-white p-3 rounded-lg border shadow-sm" onClick={() => toggleGroupExpansion(groupKey)}>
                {/* Top Section: Order ID and Total */}
                <div className="flex justify-between items-start">
                                   <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-800 truncate">#{order.orderNumber}</span>
                    {group.orders.length > 1 && <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{group.orders.length} orders</span>}
                                   </div>
                  <div className="text-right">
                    {/* Show final total if different from original or if there's any discount */}
                    {((order as any).finalTotal && (order as any).finalTotal !== order.total) || 
                     ((order as any).discountApplied) || 
                     ((order as any).totalDiscountAmount && (order as any).totalDiscountAmount > 0) || 
                     (order.discount && order.discount > 0) ? (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 line-through">{formatCurrency(order.total)}</span>
                        <span className="font-bold text-indigo-600 text-sm sm:text-base">
                          {formatCurrency((order as any).finalTotal || (order.total - ((order as any).totalDiscountAmount || order.discount || 0)))}
                        </span>
                      </div>
                    ) : (
                      <span className="font-bold text-indigo-600 text-sm sm:text-base">{formatCurrency(group.totalAmount)}</span>
                    )}
                  </div>
                                  </div>
                                  
                {/* Middle Section: Status and Date */}
                <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                                         <div className="flex items-center space-x-2">
                                         {getStatusBadge(order.status)}
                    <div className="hidden sm:flex items-center space-x-2">
                      <span>Table {table?.number || 'N/A'}</span>
                      <span className="mx-1.5">&bull;</span>
                      <span>{totalItems} items</span>
                                         </div>
                                       </div>
                  <span className="font-medium text-right">{formatDate(order.createdAt)} {formatTime(order.createdAt)}</span>
                                       </div>
                
                {/* Credit and Discount Information */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {/* Credit Information */}
                  {((order as any).isCredit || 
                    (order as any).creditAmount > 0 || 
                    (order as any).creditCustomerName || 
                    (order.paymentMethod && (order.paymentMethod.includes('credit') || order.paymentMethod.includes('partial_credit')))) && (
                    <div className="flex items-center space-x-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      <CreditCard className="w-3 h-3" />
                      <span className="font-medium">
                        Credit: {formatCurrency((order as any).creditAmount || 
                          (order.paymentMethod === 'credit' ? 
                            ((order as any).finalTotal || 
                             (order.total - ((order as any).totalDiscountAmount || order.discount || 0))) : 0))}
                      </span>
                      {(order as any).creditCustomerName && (
                        <span className="hidden sm:inline">
                          - {(order as any).creditCustomerName}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Discount Information */}
                  {((order as any).discountApplied || 
                    ((order as any).totalDiscountAmount && (order as any).totalDiscountAmount > 0) || 
                    (order.discount && order.discount > 0)) && (
                    <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      <span className="font-medium">💰</span>
                      <span className="font-medium">
                        Discount: {formatCurrency((order as any).totalDiscountAmount || order.discount || 0)}
                      </span>
                    </div>
                  )}
                  
                  {/* Payment Method */}
                  {order.paymentMethod && order.status === 'completed' && (
                    <div className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      <span className="font-medium">
                        {order.paymentMethod.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                                       
                {/* Collapsible Details Section */}
                {expandedGroups.has(groupKey) && (
                  <div className="mt-3 pt-3 border-t text-xs text-gray-600 space-y-3">
                     {group.orders.map(o => (
                       <div key={o.id} className="pb-2 border-b last:border-none">
                         <div className="flex justify-between items-start mb-1">
                           <p className="font-semibold text-gray-800">#{o.orderNumber}</p>
                           <div className="text-right">
                             {/* Show final total if different from original or if there's any discount */}
                             {((o as any).finalTotal && (o as any).finalTotal !== o.total) || 
                              ((o as any).discountApplied) || 
                              ((o as any).totalDiscountAmount && (o as any).totalDiscountAmount > 0) || 
                              (o.discount && o.discount > 0) ? (
                               <div className="flex flex-col">
                                 <span className="text-xs text-gray-500 line-through">{formatCurrency(o.total)}</span>
                                 <span className="font-bold text-gray-800">
                                   {formatCurrency((o as any).finalTotal || (o.total - ((o as any).totalDiscountAmount || o.discount || 0)))}
                                 </span>
                               </div>
                             ) : (
                               <span className="font-bold text-gray-800">{formatCurrency(o.total)}</span>
                             )}
                           </div>
                         </div>
                         <p>
                           <span className="font-semibold">Items:</span> {o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                         </p>
                         <div className="flex items-center space-x-2 mt-1">
                           <span className={`px-2 py-0.5 rounded-full bg-blue-100 text-blue-700`}>{o.type}</span>
                           <span className={`px-2 py-0.5 rounded-full ${o.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{o.paymentStatus}</span>
                         </div>
                         
                         {/* Credit and Discount for Individual Order */}
                         <div className="mt-2 flex flex-wrap items-center gap-1">
                           {/* Credit Information */}
                           {((o as any).isCredit || 
                             (o as any).creditAmount > 0 || 
                             (o as any).creditCustomerName || 
                             (o.paymentMethod && (o.paymentMethod.includes('credit') || o.paymentMethod.includes('partial_credit')))) && (
                             <div className="flex items-center space-x-1 bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded text-xs">
                               <CreditCard className="w-2.5 h-2.5" />
                               <span className="font-medium">
                                 Credit: {formatCurrency((o as any).creditAmount || 
                                   (o.paymentMethod === 'credit' ? 
                                     ((o as any).finalTotal || 
                                      (o.total - ((o as any).totalDiscountAmount || o.discount || 0))) : 0))}
                               </span>
                             </div>
                           )}
                           
                           {/* Discount Information */}
                           {((o as any).discountApplied || 
                             ((o as any).totalDiscountAmount && (o as any).totalDiscountAmount > 0) || 
                             (o.discount && o.discount > 0)) && (
                             <div className="flex items-center space-x-1 bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-xs">
                               <span className="font-medium">💰</span>
                               <span className="font-medium">
                                 -{formatCurrency((o as any).totalDiscountAmount || o.discount || 0)}
                               </span>
                             </div>
                           )}
                           
                           {/* Payment Method */}
                           {o.paymentMethod && o.status === 'completed' && (
                             <div className="flex items-center space-x-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs">
                               <span className="font-medium">
                                 {o.paymentMethod.replace('_', ' ').toUpperCase()}
                               </span>
                             </div>
                           )}
                         </div>
                                     </div>
                     ))}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-2 pt-2">
                      <button className="btn btn-xs btn-ghost" onClick={(e) => {e.stopPropagation(); openModal(order)}}><Eye className="w-3 h-3 mr-1"/>View</button>
                      <button className="btn btn-xs btn-ghost" onClick={(e) => {e.stopPropagation(); handlePrintBill(order)}}><Printer className="w-3 h-3 mr-1"/>Print</button>
                      <button className="btn btn-xs btn-ghost" onClick={(e) => {e.stopPropagation(); openEditPaymentModal(order)}}><Edit className="w-3 h-3 mr-1"/>Edit</button>
                                     </div>
                                         </div>
                                       )}
                                     </div>
            )
          })
         )}
                  </div>

        {/* Pagination */}
                  {totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center text-sm">
                          <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
              className="btn btn-sm btn-ghost"
                          >
              <ChevronLeft className="w-4 h-4 mr-1"/>
              Previous
                          </button>
            <span>Page {currentPage} of {totalPages}</span>
                          <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
              className="btn btn-sm btn-ghost"
                          >
              Next
              <ChevronRight className="w-4 h-4 ml-1"/>
                          </button>
                    </div>
                  )}
      </main>

      {/* Modals */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={showOrderDetails}
        onClose={() => setShowOrderDetails(false)}
        onStatusUpdate={handleStatusUpdate}
        tables={tables}
      />

      <ReportGenerationModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />

      <EditPaymentModal
        order={orderToEditPayment}
        isOpen={showEditPaymentModal}
        onClose={() => {
          setShowEditPaymentModal(false);
          setOrderToEditPayment(null);
        }}
        onUpdatePayment={handleUpdatePayment}
        isUpdating={isUpdatingPayment}
      />
    </div>
  );
}

// Edit Payment Modal Component
interface EditPaymentModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePayment: (orderId: string, paymentData: any) => void;
  isUpdating: boolean;
}

function EditPaymentModal({ order, isOpen, onClose, onUpdatePayment, isUpdating }: EditPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: number }>>([]);
  const [isSplitPayment, setIsSplitPayment] = useState(false);

  useEffect(() => {
    if (order && isOpen) {
      setPaymentMethod(order.paymentMethod || 'cash');
      setAmountReceived(order.total);
      setSplitPayments([]);
      setIsSplitPayment(false);
    }
  }, [order, isOpen]);

  const addSplitPayment = () => {
    setSplitPayments([...splitPayments, { method: 'cash', amount: 0 }]);
  };

  const updateSplitPayment = (index: number, field: 'method' | 'amount', value: string | number) => {
    const updated = [...splitPayments];
    updated[index] = { ...updated[index], [field]: value };
    setSplitPayments(updated);
  };

  const removeSplitPayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };

  const totalSplitAmount = splitPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const remainingAmount = order ? order.total - totalSplitAmount : 0;

  const handleSubmit = () => {
    if (!order) return;

    let paymentData;
    
    if (isSplitPayment) {
      if (Math.abs(totalSplitAmount - order.total) > 0.01) {
        toast.error('Split payment amounts must equal the order total');
        return;
      }
      
      paymentData = {
        isSplitPayment: true,
        splitPayments: splitPayments.map(payment => ({
          method: payment.method,
          amount: payment.amount,
          reference: `Split payment - ${payment.method.toUpperCase()}`
        })),
        paymentMethod: 'split', // Special indicator for split payments
        amountReceived: order.total,
        finalTotal: order.total,
        originalTotal: order.total
      };
    } else {
      paymentData = {
        isSplitPayment: false,
        paymentMethod: paymentMethod,
        amountReceived: amountReceived,
        finalTotal: order.total,
        originalTotal: order.total,
        reference: `Payment method updated - ${paymentMethod.toUpperCase()}`
      };
    }

    onUpdatePayment(order.id, paymentData);
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Edit Payment Details</h3>
              <p className="text-blue-100">Order #{order.orderNumber} • {formatCurrency(order.total)}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="space-y-6">
            {/* Payment Type Toggle */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="paymentType"
                  checked={!isSplitPayment}
                  onChange={() => setIsSplitPayment(false)}
                  className="mr-2"
                />
                <span className="font-medium">Single Payment Method</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="paymentType"
                  checked={isSplitPayment}
                  onChange={() => setIsSplitPayment(true)}
                  className="mr-2"
                />
                <span className="font-medium">Split Payment</span>
              </label>
            </div>

            {!isSplitPayment ? (
              <div className="space-y-4">
                {/* Single Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer/Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Received
                  </label>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Split Payments */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Split Payment Details</h4>
                    <button
                      onClick={addSplitPayment}
                      className="btn btn-secondary btn-sm"
                    >
                      Add Payment
                    </button>
                  </div>

                  {splitPayments.map((payment, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-3">
                      <select
                        value={payment.method}
                        onChange={(e) => updateSplitPayment(index, 'method', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank">Bank Transfer/Card</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={payment.amount || ''}
                        onChange={(e) => updateSplitPayment(index, 'amount', parseFloat(e.target.value) || 0)}
                        step="0.01"
                        min="0"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={() => removeSplitPayment(index)}
                        className="w-8 h-8 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span>Total Split Amount:</span>
                      <span className={totalSplitAmount === order.total ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {formatCurrency(totalSplitAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Order Total:</span>
                      <span className="font-medium">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Remaining:</span>
                      <span className={remainingAmount === 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {formatCurrency(remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Current Payment Info */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Current Payment Info</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>Method:</strong> {order.paymentMethod?.toUpperCase() || 'Not specified'}</p>
                <p><strong>Total:</strong> {formatCurrency(order.total)}</p>
                <p><strong>Status:</strong> {order.paymentStatus}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isUpdating}
              className="btn btn-primary"
            >
              {isUpdating ? 'Updating...' : 'Update Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
