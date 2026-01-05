'use client';

import { useRouter } from 'next/navigation';

interface FeatureUnavailableProps {
  featureName?: string;
  showBackButton?: boolean;
}

export default function FeatureUnavailable({ 
  featureName = 'This feature', 
  showBackButton = true 
}: FeatureUnavailableProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8 text-center shadow-2xl">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-700/50 rounded-full mb-4">
            <svg 
              className="w-10 h-10 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Feature Temporarily Unavailable
          </h1>
          <p className="text-gray-400 text-sm">
            {featureName} is temporarily unavailable.
          </p>
        </div>
        
        <div className="bg-gray-700/30 rounded-lg p-4 mb-6">
          <p className="text-gray-300 text-sm">
            This feature is temporarily unavailable.
          </p>
        </div>

        {showBackButton && (
          <button
            onClick={() => router.back()}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
}
