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
  MapPin
} from 'lucide-react';

import { SalesReportService } from '@/services/salesReportService';
import { RevenueService } from '@/services/revenueService';
import { generateUPIPaymentString, generateQRCodeDataURL } from '@/utils/upiUtils';
import ReportGenerationModal from '@/components/restaurant/ReportGenerationModal';

interface FilterForm {
  dateRange: 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'this_month' | 'last_month' | 'quarter' | 'custom';
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
      
      // Filter orders for this day
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate < nextDay;
      });
      
      const dailyRevenue = dayOrders.reduce((sum, order) => sum + order.total, 0);
      
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

  const statusOptions: OrderStatus[] = ['draft', 'placed', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        
        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Order Details</h3>
                <p className="text-sm text-gray-600">#{order.orderNumber}</p>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                ×
              </button>
            </div>
          </div>

          <div className="px-6 py-4 max-h-96 overflow-y-auto">
            {/* Order Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-sm text-gray-600">Table</label>
                <p className="font-medium">{table?.number || 'N/A'}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">Status</label>
                <div className="mt-1">
                  {getStatusBadge(order.status)}
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">Order Time</label>
                <p className="font-medium">{formatDate(order.createdAt)} {formatTime(order.createdAt)}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">Payment Status</label>
                <p className="font-medium capitalize">{order.paymentStatus}</p>
              </div>
            </div>

            {/* Order Items */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Order Items</h4>
              <div className="space-y-3">
                {order.items.map((item) => {
                  return (
                    <div key={item.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                        {item.customizations && item.customizations.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Customizations: {item.customizations.join(', ')}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-1">Note: {item.notes}</p>
                        )}
                      </div>
                      <p className="font-medium">{formatCurrency(item.total)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Total */}
            <div className="border-t pt-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
                
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="mt-4">
                <label className="text-sm text-gray-600">Order Notes</label>
                <p className="mt-1 p-3 bg-yellow-50 rounded-lg text-sm">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Status Update */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Update Status:</label>
              <select
                value={order.status}
                onChange={(e) => onStatusUpdate(order.id, e.target.value as OrderStatus)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
async function generateOrderBillContent(order: Order, restaurant: any, table: Table): Promise<string> {
  // Calculate bill details
  const subtotal = order.subtotal;
  const discountAmount = order.discount || 0;
  const tax = order.tax;
  const finalAmount = order.total;

  // Generate UPI QR code if UPI settings are configured
  let upiQRCodeDataURL = '';
  const upiSettings = restaurant?.settings?.upiSettings;
  if (upiSettings?.enableQRCode && upiSettings?.upiId) {
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



        ${upiSettings?.enableQRCode && upiSettings?.upiId && upiQRCodeDataURL ? `
        <!-- UPI QR Code Section - Only QR Code -->
        <div style="margin: 5px 0; text-align: center; background: #fff; padding: 5px; border: 1px solid #000;">
          <img src="${upiQRCodeDataURL}" 
               alt="UPI QR Code" 
               style="width: 80px; height: 80px; display: block; margin: 0 auto; background: white;" />
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

export default function OrderDashboard() {
  const { restaurant } = useRestaurant();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'analytics' | 'reports'>('list');
  
  // Sales Report States
  const [salesAnalytics] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // State for edit payment modal
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [orderToEditPayment, setOrderToEditPayment] = useState<Order | null>(null);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  const { register, handleSubmit, watch } = useForm<FilterForm>({
    defaultValues: {
      dateRange: 'today',
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
  const ordersPerPage = 10;

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
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const todayOrders = orderList.filter(order => 
      new Date(order.createdAt) >= todayStart
    );

    const totalRevenue = orderList.reduce((sum, order) => sum + order.total, 0);
    const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);

    // Calculate actual revenue accounting for credits
    const allRevenueData = await RevenueService.calculateOrdersRevenue(orderList, restaurant.id);
    const todayRevenueData = await RevenueService.calculateOrdersRevenue(todayOrders, restaurant.id);

    // Calculate popular items
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    
    orderList.forEach(order => {
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

    // Calculate table stats
    const tableMap = new Map<string, { tableNumber: string; orderCount: number; revenue: number }>();
    
    orderList.forEach(order => {
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

    // Date range filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'today':
        filtered = filtered.filter(order => 
          new Date(order.createdAt) >= today
        );
        break;
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= yesterday && orderDate < yesterdayEnd;
        });
        break;
      case 'week':
        const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => 
          new Date(order.createdAt) >= weekStart
        );
        break;
      case 'last_week':
        const lastWeekEnd = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastWeekStart = new Date(lastWeekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= lastWeekStart && orderDate < lastWeekEnd;
        });
        break;
      case 'month':
        const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => 
          new Date(order.createdAt) >= monthStart
        );
        break;
      case 'this_month':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        filtered = filtered.filter(order => 
          new Date(order.createdAt) >= thisMonthStart
        );
        break;
      case 'last_month':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= lastMonthStart && orderDate < lastMonthEnd;
        });
        break;
      case 'quarter':
        const quarterStart = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
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

      // Prepare update data for order
      const updateData: any = {
        paymentMethod: paymentData.paymentMethod,
        amountReceived: paymentData.amountReceived,
        finalTotal: paymentData.finalTotal,
        originalTotal: paymentData.originalTotal,
        updatedAt: new Date()
      };

      // Add split payment information if applicable
      if (paymentData.isSplitPayment) {
        updateData.splitPayments = paymentData.splitPayments;
        updateData.paymentMethod = 'split';
      }

      const result = await OrderService.updateOrderStatus(orderId, restaurant.id, 'completed', updateData);
      
      if (result.success) {
        // Update local state
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { 
            ...order, 
            paymentMethod: updateData.paymentMethod,
            amountReceived: updateData.amountReceived,
            finalTotal: updateData.finalTotal,
            originalTotal: updateData.originalTotal,
            splitPayments: updateData.splitPayments
          } : order
        ));
        
        // Update selected order if it's the one being edited
        if (orderToEditPayment && orderToEditPayment.id === orderId) {
          setOrderToEditPayment({
            ...orderToEditPayment,
            paymentMethod: updateData.paymentMethod,
            amountReceived: updateData.amountReceived,
            finalTotal: updateData.finalTotal,
            originalTotal: updateData.originalTotal
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
      const toastId = toast.loading('Generating bill with QR code...');
      
      console.log('🏷️ Starting bill generation for order:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        restaurant: restaurant.name
      });
      
      // Generate bill content with QR code
      const billContent = await generateOrderBillContent(order, restaurant, table);
      
      // Dismiss loading toast
      toast.dismiss(toastId);
      
      // Small delay to ensure QR code is fully processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(billContent);
        printWindow.document.close();
        
        // Wait a bit more for images to load
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
      console.log('🔥 Starting export process...', { 
        restaurantId: restaurant.id, 
        filteredOrdersCount: filteredOrders.length,
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
      
      // Calculate custom analytics from filtered orders
      const filteredRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
      const filteredItems = filteredOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
      
      // Create menu item sales from filtered orders
      const menuItemSalesMap = new Map<string, { menuItemId: string; name: string; quantitySold: number; revenue: number; }>();
      
      filteredOrders.forEach(order => {
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

      // Create table sales from filtered orders
      const tableSalesMap = new Map<string, { tableId: string; tableNumber: string; orderCount: number; revenue: number; }>();
      
      filteredOrders.forEach(order => {
        if (order.tableId) {
          const table = tables.find(t => t.id === order.tableId);
          const existing = tableSalesMap.get(order.tableId) || {
            tableId: order.tableId,
            tableNumber: table?.number || 'Unknown',
            orderCount: 0,
            revenue: 0
          };
          
          existing.orderCount += 1;
          existing.revenue += order.total;
          tableSalesMap.set(order.tableId, existing);
        }
      });
      
      const customTableSales = Array.from(tableSalesMap.values()).map(table => ({
        ...table,
        averageOrderValue: table.orderCount > 0 ? table.revenue / table.orderCount : 0,
        utilizationRate: 0 // Not calculated in this context
      })).sort((a, b) => b.revenue - a.revenue);

      // Create category sales from filtered orders
      const categorySalesMap = new Map<string, { categoryName: string; quantitySold: number; revenue: number; }>();
      
      filteredOrders.forEach(order => {
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

      // Create order type breakdown from filtered orders
      const orderTypeMap = new Map<string, { type: string; count: number; revenue: number; }>();
      
      filteredOrders.forEach(order => {
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

      // Create hourly breakdown from filtered orders
      const hourlyMap = new Map<number, { hour: number; orderCount: number; revenue: number; }>();
      
      filteredOrders.forEach(order => {
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

      // Create payment method breakdown from filtered orders using actual payment data
      const paymentMethodMap = new Map<string, { method: string; count: number; amount: number; splitDetails?: Array<{method: string, amount: number, count: number}> }>();
      
      filteredOrders.forEach(order => {
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
        totalOrders: filteredOrders.length,
        averageOrderValue: filteredOrders.length > 0 ? filteredRevenue / filteredOrders.length : 0,
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
          totalCreditAmount: 0,
          pendingCreditAmount: 0,
          paidCreditAmount: 0,
          ordersWithCredits: 0,
          creditTransactions: [],
          revenueCollectionRate: 100
        }
      };

      console.log('📊 Custom analytics created:', customAnalytics);

      // Add detailed order list to analytics
      const detailedOrderList = filteredOrders.slice(0, 100).map(order => {
        const table = tables.find(t => t.id === order.tableId);
        
        // Format payment method information
        let paymentInfo = 'Not specified';
        if (order.paymentMethod === 'split' && (order as any).splitPayments) {
          const splitPayments = (order as any).splitPayments;
          paymentInfo = `Split: ${splitPayments.map((p: any) => 
            `${p.method.toUpperCase()} Rs.${p.amount.toFixed(2)}`
          ).join(' + ')}`;
        } else if (order.paymentMethod) {
          paymentInfo = order.paymentMethod.toUpperCase();
        }
        
        return {
          orderNumber: order.orderNumber,
          tableNumber: table?.number || 'N/A',
          date: formatDate(order.createdAt),
          time: formatTime(order.createdAt),
          status: order.status,
          type: order.type,
          paymentMethod: paymentInfo,
          itemCount: order.items.length,
          totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          items: order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')
        };
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
        includeOrderDetails: true, // New flag for detailed order list
        reportTitle: `Orders Export - ${rangeLabel}`,
        additionalNotes: `Filtered orders export containing ${filteredOrders.length} orders. Applied filters: ${[
          dateRange !== 'today' ? `Date: ${rangeLabel}` : null,
          tableId && tableId !== 'all' ? `Table: ${tables.find(t => t.id === tableId)?.number || 'N/A'}` : null,
          status && status !== 'all' ? `Status: ${status}` : null,
          orderType && orderType !== 'all' ? `Type: ${orderType.replace('_', ' ')}` : null,
          menuItemId && menuItemId !== 'all' ? `Item: ${menuItems.find(m => m.id === menuItemId)?.name || 'N/A'}` : null,
          searchTerm ? `Search: "${searchTerm}"` : null
        ].filter(Boolean).join(', ') || 'None'}. ${filteredOrders.length > 100 ? `Note: Only first 100 orders shown in detail.` : ''}`
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
      toast.success(`Export completed! ${filteredOrders.length} orders exported.`);
    } catch (error) {
      toast.dismiss();
      console.error('❌ Export error:', error);
      toast.error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + ordersPerPage);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <BarChart3 className="w-6 h-6" />
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Order Dashboard</h1>
                <p className="text-gray-600">Manage and analyze all orders</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText className="w-4 h-4 mr-2 inline" />
                  Orders
                </button>
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'analytics' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 mr-2 inline" />
                  Analytics
                </button>
                <button
                  onClick={() => setViewMode('reports')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'reports' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Download className="w-4 h-4 mr-2 inline" />
                  Reports
                </button>
              </div>
              
              <button
                onClick={loadData}
                className="btn btn-secondary"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Actual Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.actualRevenue)}</p>
                <p className="text-xs text-gray-500">
                  Total: {formatCurrency(stats.totalRevenue)} | Credits: {formatCurrency(stats.pendingCredits)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.avgOrderValue)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Orders</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayOrders}</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Actual Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.todayActualRevenue)}</p>
                <p className="text-xs text-gray-500">
                  Total: {formatCurrency(stats.todayRevenue)}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {viewMode === 'list' && (
          <>
            {/* Filters */}
            <div className="card p-6 mb-6">
              <form onSubmit={handleSubmit(() => {})}>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                  {/* Search */}
                  <div className="md:col-span-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search orders, items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Date Range */}
                  <div>
                    <select
                      {...register('dateRange')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="today">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  {/* Table Filter */}
                  <div>
                    <select
                      {...register('tableId')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Tables</option>
                      {tables.map(table => (
                        <option key={table.id} value={table.id}>
                          Table {table.number}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <select
                      {...register('status')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Status</option>
                      <option value="placed">Placed</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Order Type Filter */}
                  <div>
                    <select
                      {...register('orderType')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Types</option>
                      <option value="dine_in">Dine In</option>
                      <option value="takeaway">Takeaway</option>
                      <option value="delivery">Delivery</option>
                    </select>
                  </div>

                  {/* Menu Item Filter */}
                  <div>
                    <select
                      {...register('menuItemId')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Items</option>
                      {menuItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Custom Date Range */}
                {dateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        {...register('startDate')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                      <input
                        type="date"
                        {...register('endDate')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Orders List */}
            <div className="card">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Orders ({filteredOrders.length})
                  </h2>
                  
                  <button 
                    onClick={handleExportFilteredData}
                    className="btn btn-secondary"
                    disabled={isLoading || filteredOrders.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export ({filteredOrders.length})
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Loading orders...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
                  <p className="text-gray-600">No orders match your current filters.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-gray-200">
                    {paginatedOrders.map((order) => {
                      const table = tables.find(t => t.id === order.tableId);
                      
                      return (
                        <div key={order.id} className="p-6 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4 mb-2">
                                <h3 className="font-semibold text-gray-900">#{order.orderNumber}</h3>
                                {getStatusBadge(order.status)}
                                <span className="text-sm text-gray-600">
                                  Table {table?.number || 'N/A'}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                                </span>
                              </div>
                              
                              <div className="text-sm text-gray-600 mb-2">
                                {order.items.length} item{order.items.length !== 1 ? 's' : ''} • 
                                {order.items.slice(0, 3).map(item => item.name).join(', ')}
                                {order.items.length > 3 && ` + ${order.items.length - 3} more`}
                              </div>
                              
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="flex items-center text-gray-600">
                                  <Users className="w-4 h-4 mr-1" />
                                  {order.type.replace('_', ' ')}
                                </span>
                                <span className="flex items-center text-gray-600">
                                  <DollarSign className="w-4 h-4 mr-1" />
                                  {order.paymentStatus}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">{formatCurrency(order.total)}</p>
                                <p className="text-sm text-gray-600">{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</p>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowOrderDetails(true);
                                }}
                                className="btn btn-secondary"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </button>
                                
                                {order.status === 'completed' && (
                                  <>
                                    <button
                                      onClick={() => handlePrintBill(order)}
                                      className="btn btn-primary"
                                      title={`Print bill for Order #${order.orderNumber}`}
                                    >
                                      <Printer className="w-4 h-4 mr-2" />
                                      Print Bill
                                    </button>
                                    
                                    <button
                                      onClick={() => {
                                        setOrderToEditPayment(order);
                                        setShowEditPaymentModal(true);
                                      }}
                                      className="btn bg-orange-600 text-white hover:bg-orange-700"
                                      title={`Edit payment method for Order #${order.orderNumber}`}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit Payment
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Showing {startIndex + 1} to {Math.min(startIndex + ordersPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          
                          <span className="px-4 py-2 text-sm font-medium">
                            Page {currentPage} of {totalPages}
                          </span>
                          
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {viewMode === 'analytics' && (
          <div className="space-y-8">
            {/* Analytics Date Filter Controls */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Analytics Filters</h3>
                  <p className="text-sm text-gray-600">Select date range to analyze your data</p>
                </div>
                <div className="text-sm text-gray-500">
                  Showing {filteredOrders.length} orders
                </div>
              </div>
              
              <form onSubmit={handleSubmit(() => {})}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Date Range Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Range
                    </label>
                    <select
                      {...register('dateRange')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">Last 7 Days</option>
                      <option value="last_week">Last Week</option>
                      <option value="month">Last 30 Days</option>
                      <option value="this_month">This Month</option>
                      <option value="last_month">Last Month</option>
                      <option value="quarter">Last 3 Months</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  {/* Custom Date Range - Start Date */}
                  {dateRange === 'custom' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          {...register('startDate')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Date
                        </label>
                        <input
                          type="date"
                          {...register('endDate')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Quick Stats for Selected Range */}
                  <div className="flex items-end">
                    <div className="bg-blue-50 rounded-lg p-4 w-full">
                      <div className="text-center">
                        <p className="text-sm font-medium text-blue-700">Selected Period</p>
                        <p className="text-lg font-bold text-blue-900">{formatCurrency(stats.totalRevenue)}</p>
                        <p className="text-xs text-blue-600">{stats.totalOrders} orders</p>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Revenue Growth Chart - Full Width */}
            <div className="card p-6">
              <RevenueGrowthChart orders={filteredOrders} />
            </div>

            {/* Performance Metrics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* AOV Trends */}
              <div className="card p-6">
                <AOVTrendsChart orders={filteredOrders} />
              </div>

              {/* Peak Hours */}
              <div className="card p-6">
                <PeakHoursChart orders={filteredOrders} />
              </div>

              {/* Day of Week Performance */}
              <div className="card p-6">
                <DayOfWeekChart orders={filteredOrders} />
              </div>
            </div>

            {/* Table and Category Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Table Turnover Rate */}
              <div className="card p-6">
                <TableTurnoverChart orders={filteredOrders} tables={tables} />
              </div>

              {/* Category Performance */}
              <div className="card p-6">
                <CategoryPerformanceChart orders={filteredOrders} menuItems={menuItems} />
              </div>
            </div>

            {/* Menu Item Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Popular Menu Items */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Popular Menu Items</h3>
                
                {stats.popularItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.popularItems.map((item, index) => (
                      <div key={item.menuItemId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-600">{item.quantity} sold</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(item.revenue)}</p>
                          <p className="text-sm text-gray-600">revenue</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Table Performance Summary */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Table Performance Summary</h3>
                
                {stats.tableStats.length === 0 ? (
                  <div className="text-center py-8">
                    <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.tableStats.slice(0, 5).map((table) => (
                      <div key={table.tableId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Table {table.tableNumber}</p>
                            <p className="text-sm text-gray-600">{table.orderCount} orders</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(table.revenue)}</p>
                          <p className="text-sm text-gray-600">revenue</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Analytics Summary Card */}
            <div className="card p-6 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Analytics Insights</h3>
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">Most Active Hour</p>
                  <p className="text-xl font-bold text-blue-600">
                    {filteredOrders.length > 0 ? (() => {
                      const hourMap = new Map<number, number>();
                      filteredOrders.forEach(order => {
                        const hour = new Date(order.createdAt).getHours();
                        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
                      });
                      const mostActiveHour = Array.from(hourMap.entries())
                        .reduce((max, [hour, count]) => count > max.count ? { hour, count } : max, { hour: 0, count: 0 });
                      return `${mostActiveHour.hour}:00`;
                    })() : 'N/A'}
                  </p>
                </div>
                
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">Best Category</p>
                  <p className="text-xl font-bold text-green-600">
                    {(() => {
                      const categoryMap = new Map<string, number>();
                      filteredOrders.forEach(order => {
                        order.items.forEach(item => {
                          const menuItem = menuItems.find(m => m.id === item.menuItemId);
                          const category = menuItem?.category || 'Unknown';
                          categoryMap.set(category, (categoryMap.get(category) || 0) + item.total);
                        });
                      });
                      const bestCategory = Array.from(categoryMap.entries())
                        .reduce((max, [cat, revenue]) => revenue > max.revenue ? { cat, revenue } : max, { cat: 'N/A', revenue: 0 });
                      return bestCategory.cat;
                    })()}
                  </p>
                </div>
                
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">Efficiency Score</p>
                  <p className="text-xl font-bold text-purple-600">
                    {(() => {
                      const totalTables = tables.length;
                      const activeTables = stats.tableStats.filter(t => t.orderCount > 0).length;
                      const efficiency = totalTables > 0 ? (activeTables / totalTables) * 100 : 0;
                      return `${efficiency.toFixed(0)}%`;
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'reports' && (
          <div className="space-y-6">
            {!salesAnalytics ? (
              <div className="card p-6">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BarChart3 className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Business Analytics Center</h2>
                  <p className="text-lg text-gray-600 mb-8">Generate comprehensive reports with detailed insights for your restaurant</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="text-center p-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Sales Analytics</h3>
                      <p className="text-sm text-gray-600">Revenue, orders, and growth metrics</p>
                    </div>
                    <div className="text-center p-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Customer Insights</h3>
                      <p className="text-sm text-gray-600">Customer behavior and preferences</p>
                    </div>
                    <div className="text-center p-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Package className="w-6 h-6 text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Operational Data</h3>
                      <p className="text-sm text-gray-600">Menu, tables, and staff performance</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowReportModal(true)}
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <FileText className="w-6 h-6 mr-3" />
                    Generate Comprehensive Report
                  </button>
                  
                  <p className="text-sm text-gray-500 mt-4">
                    Select time periods, customize sections, and download detailed PDF reports
                  </p>
                </div>

                {/* Quick Analytics Preview */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Analytics (Today)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-700 font-medium">Today's Revenue</p>
                          <p className="text-xl font-bold text-blue-900">{formatCurrency(stats.todayRevenue)}</p>
                        </div>
                        <DollarSign className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-700 font-medium">Today's Orders</p>
                          <p className="text-xl font-bold text-green-900">{stats.todayOrders}</p>
                        </div>
                        <ShoppingCart className="w-8 h-8 text-green-600" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-purple-700 font-medium">Avg Order Value</p>
                          <p className="text-xl font-bold text-purple-900">{formatCurrency(stats.avgOrderValue)}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-purple-600" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-orange-700 font-medium">Total Orders</p>
                          <p className="text-xl font-bold text-orange-900">{stats.totalOrders}</p>
                        </div>
                        <Package className="w-8 h-8 text-orange-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={showOrderDetails}
        onClose={() => setShowOrderDetails(false)}
        onStatusUpdate={handleStatusUpdate}
        tables={tables}
      />

      {/* Comprehensive Report Generation Modal */}
      <ReportGenerationModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />

      {/* Edit Payment Modal */}
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