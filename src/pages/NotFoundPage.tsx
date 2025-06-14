// Removed React import since it's not needed in React 18+ with automatic JSX runtime
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search, Store } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* 404 Animation */}
        <div className="mb-8">
          <div className="text-9xl font-bold text-gray-300 mb-4 animate-pulse">
            404
          </div>
          <div className="flex justify-center space-x-2 mb-6">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 animate-fade-in">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Page Not Found
          </h1>
          
          <p className="text-gray-600 mb-8">
            The page you're looking for doesn't exist or may have been moved. 
            Let's get you back on track.
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link 
              to="/" 
              className="w-full btn btn-primary"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Homepage
            </Link>
            
            <button 
              onClick={() => window.history.back()}
              className="w-full btn btn-secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Looking for a specific restaurant? Try checking the URL or contact support.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center space-x-3 text-gray-400">
          <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
                          <span className="text-sm font-medium">TenVerse POS</span>
        </div>
      </div>
    </div>
  );
} 