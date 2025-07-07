import React from 'react';
import { Store } from 'lucide-react';

const MarketplacePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
      <div>
        <Store className="mx-auto h-20 w-20 text-indigo-300 sm:h-24 sm:w-24" />
        <h1 className="mt-6 text-3xl font-bold text-gray-800 tracking-tight sm:text-5xl">
          Coming Soon
        </h1>
        <p className="mt-4 text-base text-gray-500 sm:text-lg">
          Our new marketplace is under construction.
        </p>
        <p className="text-base text-gray-500 sm:text-lg">
          We're working hard to bring you an amazing experience for all your supply needs!
        </p>
      </div>
    </div>
  );
};

export default MarketplacePage; 