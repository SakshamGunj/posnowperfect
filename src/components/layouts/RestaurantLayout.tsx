// Removed React import since it's not needed in React 18+ with automatic JSX runtime
import { Outlet } from 'react-router-dom';
import RestaurantNavbar from './ImprovedRestaurantNavbar';
import ConnectionStatus from '@/components/common/ConnectionStatus';
import VoiceButton from '@/components/voice/VoiceButton';
import DesktopSidebar from './DesktopSidebar';

export default function RestaurantLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative">
      <DesktopSidebar />
      
      <div className="layout-with-sidebar">
        {/* The top navbar is now only for mobile/tablet */}
        <div className="lg:hidden">
          <RestaurantNavbar />
        </div>
        
        {/* Main content area with improved spacing and safe area handling */}
        <main className="pt-20 lg:pt-10 pb-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Voice Button and Connection Status - now positioned relative to the new layout */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex flex-col items-center gap-4">
          <ConnectionStatus />
          <VoiceButton />
        </div>
      </div>
    </div>
  );
} 