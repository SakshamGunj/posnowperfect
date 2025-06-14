import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { Store, LogIn, Hash, Mail, Eye, EyeOff } from 'lucide-react';
import { getBusinessTypeDisplayName } from '@/lib/utils';
import LoadingScreen from '@/components/common/LoadingScreen';

interface LoginForm {
  email: string;
  password: string;
}

interface PinForm {
  pin: string;
}

export default function RestaurantLogin() {
  const { restaurant, loading: restaurantLoading } = useRestaurant();
  const { login, loginWithPin, loading: authLoading } = useRestaurantAuth();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  
  const [loginType, setLoginType] = useState<'email' | 'pin'>('email');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors, isValid: isEmailValid }
  } = useForm<LoginForm>({ mode: 'onChange' });

  const {
    register: registerPin,
    handleSubmit: handlePinSubmit,
    formState: { errors: pinErrors, isValid: isPinValid }
  } = useForm<PinForm>({ mode: 'onChange' });

  if (restaurantLoading) {
    return <LoadingScreen />;
  }

  if (!restaurant || !slug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Restaurant Not Found</h2>
          <p className="text-gray-600">Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  const handleEmailLogin = async (data: LoginForm) => {
    try {
      await login(data.email, data.password, slug);
      navigate(`/${slug}`);
    } catch (error) {
      // Error is handled by the auth context
    }
  };

  const handlePinLogin = async (data: PinForm) => {
    try {
      await loginWithPin(data.pin, slug);
      navigate(`/${slug}`);
    } catch (error) {
      // Error is handled by the auth context
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          {/* Restaurant Logo/Icon */}
          <div 
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-white mb-6"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Store className="w-8 h-8" />
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {restaurant.name}
          </h2>
          
          <p className="text-gray-600 mb-8">
            {getBusinessTypeDisplayName(restaurant.businessType)} Staff Login
          </p>
        </div>

        {/* Login Type Toggle */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => setLoginType('email')}
            className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              loginType === 'email'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Mail className="w-4 h-4 mr-2" />
            Email
          </button>
          <button
            type="button"
            onClick={() => setLoginType('pin')}
            className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              loginType === 'pin'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Hash className="w-4 h-4 mr-2" />
            PIN
          </button>
        </div>

        {/* Email Login Form */}
        {loginType === 'email' && (
          <form onSubmit={handleEmailSubmit(handleEmailLogin)} className="space-y-6">
            <div>
              <label className="form-label">Email Address</label>
              <input
                {...registerEmail('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Please enter a valid email address'
                  }
                })}
                type="email"
                className={`input ${emailErrors.email ? 'border-red-300' : ''}`}
                placeholder="Enter your email address"
                disabled={authLoading}
              />
              {emailErrors.email && (
                <p className="mt-1 text-sm text-red-600">{emailErrors.email.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  {...registerEmail('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className={`input pr-10 ${emailErrors.password ? 'border-red-300' : ''}`}
                  placeholder="Enter your password"
                  disabled={authLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={authLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {emailErrors.password && (
                <p className="mt-1 text-sm text-red-600">{emailErrors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              
              <a href="#" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={!isEmailValid || authLoading}
              className="w-full btn btn-theme-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              {authLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* PIN Login Form */}
        {loginType === 'pin' && (
          <form onSubmit={handlePinSubmit(handlePinLogin)} className="space-y-6">
            <div>
              <label className="form-label">4-Digit PIN</label>
              <input
                {...registerPin('pin', {
                  required: 'PIN is required',
                  pattern: {
                    value: /^\d{4}$/,
                    message: 'PIN must be exactly 4 digits'
                  }
                })}
                type="text"
                inputMode="numeric"
                maxLength={4}
                className={`input text-center text-2xl tracking-widest ${pinErrors.pin ? 'border-red-300' : ''}`}
                placeholder="••••"
                disabled={authLoading}
              />
              {pinErrors.pin && (
                <p className="mt-1 text-sm text-red-600">{pinErrors.pin.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isPinValid || authLoading}
              className="w-full btn btn-theme-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Hash className="w-4 h-4 mr-2" />
              )}
              {authLoading ? 'Signing In...' : 'Sign In with PIN'}
            </button>
          </form>
        )}
        
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Need access? Contact your manager or restaurant owner.
          </p>
        </div>
      </div>
    </div>
  );
} 