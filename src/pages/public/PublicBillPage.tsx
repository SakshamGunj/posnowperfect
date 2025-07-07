import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Download, Share2, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { OrderService } from '@/services/orderService';
import { RestaurantService } from '@/services/restaurantService';
import { Order } from '@/types';
import { Restaurant } from '@/types';
import { generateUPIPaymentString, generateQRCodeDataURL } from '@/utils/upiUtils';

const PublicBillPage = () => {
  const { orderId, restaurantId } = useParams<{ orderId: string; restaurantId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchBillData = async () => {
      if (!orderId || !restaurantId) {
        setError("Invalid bill link.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const orderResult = await OrderService.getOrderById(orderId, restaurantId);

        if (!orderResult.success || !orderResult.data) {
          throw new Error("Order not found.");
        }
        const orderData = orderResult.data;
        setOrder(orderData);

        const restaurantResult = await RestaurantService.getRestaurantById(orderData.restaurantId);
        if (!restaurantResult || !restaurantResult.success || !restaurantResult.data) {
          throw new Error("Restaurant not found.");
        }
        const restaurantData = restaurantResult.data;
        setRestaurant(restaurantData);

        // Generate QR if enabled
        if ((restaurantData as any).settings?.upiSettings?.enableQRCode && (restaurantData as any).settings.upiSettings.upiId) {
          const upiString = generateUPIPaymentString(
            (restaurantData as any).settings.upiSettings.upiId,
            orderData.total,
            (restaurantData as any).name,
            `Bill Payment - ${orderData.orderNumber}`
          );
          const qr = await generateQRCodeDataURL(upiString);
          setQrCode(qr);
        }

      } catch (err: any) {
        setError(err.message || "Failed to fetch bill details.");
      } finally {
        setLoading(false);
      }
    };

    fetchBillData();
  }, [orderId, restaurantId]);

  if (loading) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin h-8 w-8 text-gray-500" />
          <span className="text-gray-500">Loading Bill...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="text-center text-red-500">
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!order || !restaurant) {
    return null; // Should be handled by loading/error states
  }

  // Helper to calculate total for an item
  const getItemTotal = (item: any) => (item.price + (item.variant?.price || 0)) * item.quantity;

  const fc = (amount: number) => formatCurrency(amount, 'INR');

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-8">
            {(restaurant as any).logoUrl && <img src={(restaurant as any).logoUrl} alt="Restaurant Logo" className="w-24 h-24 mx-auto mb-4 rounded-full"/>}
            <h1 className="text-3xl font-bold">{restaurant.name}</h1>
            <p className="text-gray-500">{(restaurant as any).address}</p>
            <p className="text-gray-500">{(restaurant as any).contact?.phone}</p>
          </div>

          {/* Bill Details */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold border-b-2 border-dashed pb-2 mb-4">Invoice</h2>
            <div className="flex justify-between text-gray-600 mb-2">
              <span>Order ID:</span>
              <span className="font-mono">{order.orderNumber || order.id.slice(-8)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Date:</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Table:</span>
              <span>{order.tableId || 'N/A'}</span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">Item</th>
                <th className="text-center py-2 font-semibold">Qty</th>
                <th className="text-right py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-2">
                    {item.name}
                    {item.variants && item.variants.length > 0 && (
                      <span className="text-xs text-gray-500 block">
                        ({item.variants.map(v => v.optionName).join(', ')})
                      </span>
                    )}
                  </td>
                  <td className="text-center py-2">{item.quantity}</td>
                  <td className="text-right py-2 font-mono">{fc(getItemTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Section */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-mono">{fc(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tax ({(order as any).taxInfo?.rate || restaurant?.settings?.taxRate || 8.5}%)</span>
              <span className="font-mono">{fc((order as any).taxInfo?.amount || (order.subtotal * ((order as any).taxInfo?.rate || restaurant?.settings?.taxRate || 8.5) / 100))}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="font-semibold">Discount</span>
                <span className="font-mono">- {fc(order.discount)}</span>
              </div>
            )}
            <div className="border-t-2 border-dashed my-2"></div>
            <div className="flex justify-between text-2xl font-bold">
              <span>Total</span>
              <span className="font-mono">{fc(order.total)}</span>
            </div>
            <div className="text-right text-gray-500 text-sm mt-1">
              Paid via {order.paymentMethod}
            </div>
          </div>
          
          {/* Footer */}
          <div className="text-center mt-8 pt-4 border-t">
            {restaurant.settings?.businessInfo?.gstin && (
              <p className="text-gray-500 text-sm">GSTIN: {restaurant.settings.businessInfo.gstin}</p>
            )}
            {qrCode && (
              <div className="flex flex-col items-center mt-6">
                <img src={qrCode} alt="UPI QR" className="w-32 h-32" />
                <p className="text-xs text-gray-500 mt-1">Scan to pay via UPI</p>
              </div>
            )}
            <p className="text-gray-600 font-semibold">Thank you for your business!</p>
            {(restaurant as any).website && <p className="text-gray-500 text-sm">Visit us at {(restaurant as any).website}</p>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 p-4 flex justify-around rounded-b-lg">
            <button onClick={() => window.print()} className="flex items-center space-x-2 text-gray-600 hover:text-black">
                <Printer size={20} />
                <span>Print</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-600 hover:text-black">
                <Download size={20} />
                <span>Download</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-600 hover:text-black">
                <Share2 size={20} />
                <span>Share</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default PublicBillPage; 