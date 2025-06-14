// Removed React import since it's not needed in React 18+ with automatic JSX runtime
import { Outlet } from 'react-router-dom';
import RestaurantNavbar from './ImprovedRestaurantNavbar';
import VoiceButton from '@/components/voice/VoiceButton';
import ConnectionStatus from '@/components/common/ConnectionStatus';

export default function RestaurantLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <RestaurantNavbar />
      {/* Add top padding to account for fixed navbar */}
      <main className="pt-16">
        <Outlet />
      </main>
      {/* Voice Command Button - Available on all restaurant pages */}
      <VoiceButton />
      
      {/* Connection Status - Shows only when there are issues */}
      <div className="fixed bottom-4 left-4 z-40">
        <ConnectionStatus />
      </div>
    </div>
  );
} 