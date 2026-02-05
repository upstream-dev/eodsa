'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashPhase, setSplashPhase] = useState('entering'); // 'entering', 'visible', 'exiting'

  useEffect(() => {
    // Animation sequence - shows every time the page loads
    const timer1 = setTimeout(() => setSplashPhase('visible'), 500); // Fade in
    const timer2 = setTimeout(() => setSplashPhase('exiting'), 2500); // Start fade out
    const timer3 = setTimeout(() => {
      setShowSplash(false);
    }, 3500); // Complete fade out

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  if (showSplash) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-black transition-all duration-1000 ${
        splashPhase === 'entering' ? 'opacity-0' : 
        splashPhase === 'visible' ? 'opacity-100' : 
        'opacity-0'
      }`}>
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Main Content */}
        <div className={`relative text-center transition-all duration-1000 ${
          splashPhase === 'entering' ? 'scale-90 opacity-0 translate-y-8' : 
          splashPhase === 'visible' ? 'scale-100 opacity-100 translate-y-0' : 
          'scale-110 opacity-0 -translate-y-8'
        }`}>
          {/* Main Title */}
          <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 bg-clip-text text-transparent mb-4 tracking-wider">
            AVALON
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-gray-300 font-light tracking-wide mb-8">
            Welcome to Dance Excellence
          </p>

          {/* Animated Sparkles */}
          <div className="relative">
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
              <div className="flex space-x-2 animate-bounce">
                <span className="text-yellow-400 text-2xl animate-pulse">✨</span>
                <span className="text-purple-400 text-2xl animate-pulse delay-300">💫</span>
                <span className="text-pink-400 text-2xl animate-pulse delay-600">⭐</span>
              </div>
            </div>
          </div>

          {/* Loading Bar */}
          <div className="mt-12 w-64 mx-auto">
            <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-2000 ${
                splashPhase === 'visible' ? 'w-full' : 'w-0'
              }`}></div>
            </div>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-20 text-purple-400/30 text-4xl animate-float">🎭</div>
          <div className="absolute top-32 right-32 text-pink-400/30 text-3xl animate-float delay-1000">🩰</div>
          <div className="absolute bottom-32 left-32 text-blue-400/30 text-3xl animate-float delay-500">🎪</div>
          <div className="absolute bottom-20 right-20 text-purple-400/30 text-4xl animate-float delay-1500">🌟</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Compact Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          {/* EODSA Logo Placeholder */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-2xl">
            <span className="text-white text-3xl font-bold">EODSA</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                          Avalon
          </h1>
          <p className="text-gray-300 text-lg">Competition Management Portal</p>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Get Started</h2>
            <p className="text-gray-400">Choose your path to get started</p>
          </div>

          <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-16 max-w-5xl mx-auto">
            {/* New User Card */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-indigo-500/30 p-6 text-center hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-indigo-500/20">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <span className="text-white text-2xl">👋</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">New User</h3>
              <p className="text-gray-300 mb-4 text-sm">
                Register as a new dancer to participate in EODSA competitions.
              </p>
              <Link 
                href="/register"
                className="block w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl text-sm"
              >
                Start Registration
              </Link>
            </div>

            {/* Dancer Portal Card (Secure Login Only) */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-purple-500/30 p-6 text-center hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-purple-500/20">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <span className="text-white text-2xl">🩰</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Dancer Portal</h3>
              <p className="text-gray-300 mb-4 text-sm">
                Already registered? Use secure login to access your dancer dashboard and enter events.
              </p>
              
              <div className="space-y-3">
                <Link 
                  href="/dancer-login"
                  className="block w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl text-sm"
                >
                  Secure Dancer Login
                </Link>
                <p className="text-xs text-gray-400">
                  After logging in, you can clearly select your event and complete your entry from your dashboard.
                </p>
              </div>
            </div>

            {/* Studio Portal Card */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-green-500/30 p-6 text-center hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-green-500/20">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <span className="text-white text-2xl">🏢</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Studio Portal</h3>
              <p className="text-gray-300 mb-4 text-sm">
                Register your studio or access your studio dashboard to manage dancers.
              </p>
              <div className="space-y-2">
                <Link 
                  href="/studio-register"
                  className="block w-full px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl text-sm"
                >
                  Register Studio
                </Link>
                <Link 
                  href="/studio-login"
                  className="block w-full px-4 py-2 border-2 border-green-500 text-green-400 rounded-lg font-semibold hover:bg-green-500 hover:text-white transition-all duration-300 text-sm"
                >
                  Studio Login
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
