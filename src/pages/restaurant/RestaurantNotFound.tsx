// Removed React import since it's not needed in React 18+ with automatic JSX runtime
import { AlertTriangle, ArrowLeft, Home } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function RestaurantNotFound() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Restaurant Not Found
        </h1>
        
        <p className="text-gray-600 mb-2">
          The restaurant "{slug}" could not be found or may be temporarily unavailable.
        </p>
        
        <p className="text-sm text-gray-500 mb-8">
          Please check the URL or contact the restaurant owner for assistance.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full flex items-center justify-center space-x-2 bg-gray-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
          
          <button
            onClick={() => navigate('/admin/login')}
            className="w-full flex items-center justify-center space-x-2 border border-gray-300 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Admin Portal</span>
          </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Powered by TenVerse POS
          </p>
        </div>
      </div>
    </div>
  );
} 