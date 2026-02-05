'use client';

import { useState, useEffect } from 'react';
import { getMedalFromPercentage } from '@/lib/types';
import { calculateRoundedPercentage } from '@/lib/certificate-generator';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { usePhase2Feature } from '@/hooks/usePhase2Feature';
import FeatureUnavailable from '@/components/FeatureUnavailable';

interface RankingData {
  performanceId: string;
  eventId: string;
  eventName: string;
  region: string;
  ageCategory: string;
  performanceType: string;
  title: string;
  itemStyle: string;
  contestantName: string;
  participantNames?: string[];
  studioName?: string;
  totalScore: number;
  averageScore: number;
  rawAverageScore?: number;
  roundedPercentage?: number;
  rank: number;
  judgeCount: number;
  percentage?: number;
  rankingLevel: string;
  itemNumber?: number;
  mastery?: string;
  entryType?: string;
}

function RankingsPage() {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const { isEnabled: isPhase2Enabled, isLoading: isLoadingFlag } = usePhase2Feature();
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [filteredRankings, setFilteredRankings] = useState<RankingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [events, setEvents] = useState<Array<{id: string; name: string}>>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'top3_age' | 'top3_style' | 'top3_duets' | 'top3_groups' | 'top3_trios' | 'top10_soloists'>('all');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    console.log('Applying filters, rankings count:', rankings.length, 'viewMode:', viewMode, 'selectedEventId:', selectedEventId);
    applyFilters();
  }, [rankings, viewMode, selectedEventId]);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Load events list for filter
      const eventsRes = await fetch('/api/events');
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        if (eventsData.success) {
          setEvents(eventsData.events.map((e: any) => ({ id: e.id, name: e.name })));
        }
      }
      
      // Load all rankings
      await loadRankings();
    } catch (error) {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRankings = async () => {
    if (!isPhase2Enabled) {
      console.log('Phase 2 not enabled');
      return;
    }
    
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('type', 'nationals');
      
      const url = `/api/rankings?${params.toString()}`;
      console.log('Loading rankings from:', url);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Rankings data received:', data);
        console.log('Rankings data type:', Array.isArray(data) ? 'array' : typeof data);
        console.log('Rankings data length:', Array.isArray(data) ? data.length : 'not an array');
        
        if (Array.isArray(data)) {
          // If we got an empty array with type=nationals, try without type parameter
          if (data.length === 0) {
            console.log('No data with type=nationals, trying without type parameter...');
            try {
              const fallbackResponse = await fetch('/api/rankings');
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('Fallback rankings data:', fallbackData);
                if (Array.isArray(fallbackData) && fallbackData.length > 0) {
                  setRankings(fallbackData);
                  console.log('Set rankings from fallback:', fallbackData.length, 'items');
                  return;
                }
              }
            } catch (fallbackError) {
              console.error('Fallback fetch failed:', fallbackError);
            }
          }
          
          setRankings(data);
          console.log('Set rankings:', data.length, 'items');
        } else {
          console.error('Rankings data is not an array:', data);
          setError('Invalid data format received');
          setRankings([]);
        }
      } else if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        console.error('403 Error:', errorData);
        setError(errorData.error || 'This feature is temporarily unavailable.');
        setRankings([]);
      } else {
        const errorText = await response.text();
        console.error('Failed to load rankings, status:', response.status, 'error:', errorText);
        setError('Failed to load rankings');
        setRankings([]);
      }
    } catch (error) {
      console.error('Error loading rankings:', error);
      setError('Failed to load rankings: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setRankings([]);
    }
  };

  const applyFilters = () => {
    console.log('applyFilters called with rankings:', rankings.length);
    let filtered = [...rankings]; // Create a copy to avoid mutating original
    
    // Apply event filter
    if (selectedEventId && selectedEventId !== 'all') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(ranking => ranking.eventId === selectedEventId);
      console.log('After event filter:', beforeCount, '->', filtered.length);
    }
    
    // Apply view mode filters with deduplication
    if (viewMode === 'top3_age') {
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered.forEach(ranking => {
        const existing = bestPerformanceByContestant.get(ranking.contestantName);
        const existingRounded = existing?.roundedPercentage ?? (existing ? calculateRoundedPercentage(existing.totalScore, existing.judgeCount) : 0);
        const rankingRounded = ranking.roundedPercentage ?? calculateRoundedPercentage(ranking.totalScore, ranking.judgeCount);
        const existingRaw = existing?.rawAverageScore ?? existing?.averageScore ?? 0;
        const rankingRaw = ranking.rawAverageScore ?? ranking.averageScore ?? 0;
        
        if (!existing || rankingRounded > existingRounded || 
            (rankingRounded === existingRounded && rankingRaw > existingRaw)) {
          bestPerformanceByContestant.set(ranking.contestantName, ranking);
        }
      });
      filtered = Array.from(bestPerformanceByContestant.values());
      
      const groupedByAge = filtered.reduce((groups, ranking) => {
        if (!groups[ranking.ageCategory]) {
          groups[ranking.ageCategory] = [];
        }
        groups[ranking.ageCategory].push(ranking);
        return groups;
      }, {} as Record<string, RankingData[]>);

      filtered = Object.values(groupedByAge).flatMap(group => 
        group.sort((a, b) => {
          const aRounded = a.roundedPercentage ?? calculateRoundedPercentage(a.totalScore, a.judgeCount);
          const bRounded = b.roundedPercentage ?? calculateRoundedPercentage(b.totalScore, b.judgeCount);
          if (bRounded !== aRounded) return bRounded - aRounded;
          const aRaw = a.rawAverageScore ?? a.averageScore;
          const bRaw = b.rawAverageScore ?? b.averageScore;
          return bRaw - aRaw;
        }).slice(0, 3)
      );
    } else if (viewMode === 'top3_style') {
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered.forEach(ranking => {
        const existing = bestPerformanceByContestant.get(ranking.contestantName);
        const existingRounded = existing?.roundedPercentage ?? (existing ? calculateRoundedPercentage(existing.totalScore, existing.judgeCount) : 0);
        const rankingRounded = ranking.roundedPercentage ?? calculateRoundedPercentage(ranking.totalScore, ranking.judgeCount);
        const existingRaw = existing?.rawAverageScore ?? existing?.averageScore ?? 0;
        const rankingRaw = ranking.rawAverageScore ?? ranking.averageScore ?? 0;
        
        if (!existing || rankingRounded > existingRounded || 
            (rankingRounded === existingRounded && rankingRaw > existingRaw)) {
          bestPerformanceByContestant.set(ranking.contestantName, ranking);
        }
      });
      filtered = Array.from(bestPerformanceByContestant.values());
      
      const groupedByStyle = filtered.reduce((groups, ranking) => {
        if (!groups[ranking.itemStyle]) {
          groups[ranking.itemStyle] = [];
        }
        groups[ranking.itemStyle].push(ranking);
        return groups;
      }, {} as Record<string, RankingData[]>);

      filtered = Object.values(groupedByStyle).flatMap(group => 
        group.sort((a, b) => {
          const aRounded = a.roundedPercentage ?? calculateRoundedPercentage(a.totalScore, a.judgeCount);
          const bRounded = b.roundedPercentage ?? calculateRoundedPercentage(b.totalScore, b.judgeCount);
          if (bRounded !== aRounded) return bRounded - aRounded;
          const aRaw = a.rawAverageScore ?? a.averageScore;
          const bRaw = b.rawAverageScore ?? b.averageScore;
          return bRaw - aRaw;
        }).slice(0, 3)
      );
    } else if (viewMode === 'top3_duets') {
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered
        .filter(ranking => ranking.performanceType === 'Duet')
        .forEach(ranking => {
          const existing = bestPerformanceByContestant.get(ranking.contestantName);
          const existingRounded = existing?.roundedPercentage ?? (existing ? calculateRoundedPercentage(existing.totalScore, existing.judgeCount) : 0);
          const rankingRounded = ranking.roundedPercentage ?? calculateRoundedPercentage(ranking.totalScore, ranking.judgeCount);
          const existingRaw = existing?.rawAverageScore ?? existing?.averageScore ?? 0;
          const rankingRaw = ranking.rawAverageScore ?? ranking.averageScore ?? 0;
          
          if (!existing || rankingRounded > existingRounded || 
              (rankingRounded === existingRounded && rankingRaw > existingRaw)) {
            bestPerformanceByContestant.set(ranking.contestantName, ranking);
          }
        });
      
      filtered = Array.from(bestPerformanceByContestant.values())
        .sort((a, b) => {
          const aRounded = a.roundedPercentage ?? calculateRoundedPercentage(a.totalScore, a.judgeCount);
          const bRounded = b.roundedPercentage ?? calculateRoundedPercentage(b.totalScore, b.judgeCount);
          if (bRounded !== aRounded) return bRounded - aRounded;
          const aRaw = a.rawAverageScore ?? a.averageScore;
          const bRaw = b.rawAverageScore ?? b.averageScore;
          return bRaw - aRaw;
        })
        .slice(0, 3);
    } else if (viewMode === 'top3_groups') {
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered
        .filter(ranking => ranking.performanceType === 'Group')
        .forEach(ranking => {
          const existing = bestPerformanceByContestant.get(ranking.contestantName);
          const existingRounded = existing?.roundedPercentage ?? (existing ? calculateRoundedPercentage(existing.totalScore, existing.judgeCount) : 0);
          const rankingRounded = ranking.roundedPercentage ?? calculateRoundedPercentage(ranking.totalScore, ranking.judgeCount);
          const existingRaw = existing?.rawAverageScore ?? existing?.averageScore ?? 0;
          const rankingRaw = ranking.rawAverageScore ?? ranking.averageScore ?? 0;
          
          if (!existing || rankingRounded > existingRounded || 
              (rankingRounded === existingRounded && rankingRaw > existingRaw)) {
            bestPerformanceByContestant.set(ranking.contestantName, ranking);
          }
        });
      
      filtered = Array.from(bestPerformanceByContestant.values())
        .sort((a, b) => {
          const aRounded = a.roundedPercentage ?? calculateRoundedPercentage(a.totalScore, a.judgeCount);
          const bRounded = b.roundedPercentage ?? calculateRoundedPercentage(b.totalScore, b.judgeCount);
          if (bRounded !== aRounded) return bRounded - aRounded;
          const aRaw = a.rawAverageScore ?? a.averageScore;
          const bRaw = b.rawAverageScore ?? b.averageScore;
          return bRaw - aRaw;
        })
        .slice(0, 3);
    } else if (viewMode === 'top3_trios') {
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered
        .filter(ranking => ranking.performanceType === 'Trio')
        .forEach(ranking => {
          const existing = bestPerformanceByContestant.get(ranking.contestantName);
          const existingRounded = existing?.roundedPercentage ?? (existing ? calculateRoundedPercentage(existing.totalScore, existing.judgeCount) : 0);
          const rankingRounded = ranking.roundedPercentage ?? calculateRoundedPercentage(ranking.totalScore, ranking.judgeCount);
          const existingRaw = existing?.rawAverageScore ?? existing?.averageScore ?? 0;
          const rankingRaw = ranking.rawAverageScore ?? ranking.averageScore ?? 0;
          
          if (!existing || rankingRounded > existingRounded || 
              (rankingRounded === existingRounded && rankingRaw > existingRaw)) {
            bestPerformanceByContestant.set(ranking.contestantName, ranking);
          }
        });
      
      filtered = Array.from(bestPerformanceByContestant.values())
        .sort((a, b) => {
          const aRounded = a.roundedPercentage ?? calculateRoundedPercentage(a.totalScore, a.judgeCount);
          const bRounded = b.roundedPercentage ?? calculateRoundedPercentage(b.totalScore, b.judgeCount);
          if (bRounded !== aRounded) return bRounded - aRounded;
          const aRaw = a.rawAverageScore ?? a.averageScore;
          const bRaw = b.rawAverageScore ?? b.averageScore;
          return bRaw - aRaw;
        })
        .slice(0, 3);
    } else if (viewMode === 'top10_soloists') {
      const bestPerformanceByContestant = new Map<string, RankingData>();
      filtered
        .filter(ranking => ranking.performanceType === 'Solo')
        .forEach(ranking => {
          const existing = bestPerformanceByContestant.get(ranking.contestantName);
          const existingRounded = existing?.roundedPercentage ?? (existing ? calculateRoundedPercentage(existing.totalScore, existing.judgeCount) : 0);
          const rankingRounded = ranking.roundedPercentage ?? calculateRoundedPercentage(ranking.totalScore, ranking.judgeCount);
          const existingRaw = existing?.rawAverageScore ?? existing?.averageScore ?? 0;
          const rankingRaw = ranking.rawAverageScore ?? ranking.averageScore ?? 0;
          
          if (!existing || rankingRounded > existingRounded || 
              (rankingRounded === existingRounded && rankingRaw > existingRaw)) {
            bestPerformanceByContestant.set(ranking.contestantName, ranking);
          }
        });
      
      filtered = Array.from(bestPerformanceByContestant.values())
        .sort((a, b) => {
          const aRounded = a.roundedPercentage ?? calculateRoundedPercentage(a.totalScore, a.judgeCount);
          const bRounded = b.roundedPercentage ?? calculateRoundedPercentage(b.totalScore, b.judgeCount);
          if (bRounded !== aRounded) return bRounded - aRounded;
          const aRaw = a.rawAverageScore ?? a.averageScore;
          const bRaw = b.rawAverageScore ?? b.averageScore;
          return bRaw - aRaw;
        })
        .slice(0, 10);
    }
    
    // Sort filtered results
    filtered.sort((a, b) => {
      const aRounded = a.roundedPercentage ?? calculateRoundedPercentage(a.totalScore, a.judgeCount);
      const bRounded = b.roundedPercentage ?? calculateRoundedPercentage(b.totalScore, b.judgeCount);
      
      if (bRounded !== aRounded) {
        return bRounded - aRounded;
      }
      const aRaw = a.rawAverageScore ?? a.averageScore;
      const bRaw = b.rawAverageScore ?? b.averageScore;
      return bRaw - aRaw;
    });
    
    // Recalculate ranks
    let currentRank = 1;
    const rankedFiltered = filtered.map((ranking, index) => {
      if (index > 0) {
        const prev = filtered[index - 1];
        const prevRounded = prev.roundedPercentage ?? calculateRoundedPercentage(prev.totalScore, prev.judgeCount);
        const currRounded = ranking.roundedPercentage ?? calculateRoundedPercentage(ranking.totalScore, ranking.judgeCount);
        
        if (currRounded !== prevRounded) {
          currentRank = index + 1;
        }
      }
      
      return {
        ...ranking,
        rank: currentRank
      };
    });
    
    setFilteredRankings(rankedFiltered);
  };

  const calculatePercentageAndRanking = (ranking: RankingData) => {
    const percentage = ranking.roundedPercentage ?? calculateRoundedPercentage(ranking.totalScore, ranking.judgeCount);
    const medalInfo = getMedalFromPercentage(percentage);
    let rankingColor = '';
    
    switch (medalInfo.type) {
      case 'elite':
        rankingColor = 'bg-gradient-to-r from-yellow-600 to-yellow-800 text-white';
        break;
      case 'opus':
        rankingColor = 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-white';
        break;
      case 'legend':
        rankingColor = 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
        break;
      case 'gold':
        rankingColor = 'bg-gradient-to-r from-yellow-300 to-yellow-500 text-white';
        break;
      case 'silver_plus':
        rankingColor = 'bg-gradient-to-r from-slate-300 to-slate-500 text-white';
        break;
      case 'silver':
        rankingColor = 'bg-gradient-to-r from-gray-400 to-gray-600 text-white';
        break;
      case 'bronze':
      default:
        rankingColor = 'bg-gradient-to-r from-amber-500 to-amber-700 text-white';
        break;
    }
    
    return { 
      percentage,
      rankingLevel: medalInfo.label, 
      rankingColor, 
      medalEmoji: medalInfo.emoji 
    };
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white border-yellow-300 shadow-lg';
      case 2: return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white border-gray-400 shadow-lg';
      case 3: return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white border-orange-300 shadow-lg';
      default: return 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-indigo-300 shadow-md';
    }
  };

  // Check Phase 2 feature flag
  if (!isLoadingFlag && !isPhase2Enabled) {
    return <FeatureUnavailable featureName="Rankings" />;
  }

  if (isLoading || isLoadingFlag) {
    return (
      <div className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`w-16 h-16 border-4 ${theme === 'dark' ? 'border-indigo-500/30 border-t-indigo-500' : 'border-indigo-600/30 border-t-indigo-600'} rounded-full animate-spin mx-auto mb-4`}></div>
          <p className={themeClasses.loadingText}>Loading rankings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${themeClasses.mainBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className={`${theme === 'dark' ? 'text-red-400' : 'text-red-600'} text-lg mb-4`}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className={`${themeClasses.buttonBase} ${themeClasses.buttonPrimary}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate stats from event-filtered rankings
  const eventFilteredRankings = selectedEventId === 'all' 
    ? rankings 
    : rankings.filter(r => r.eventId === selectedEventId);
  
  const totalPerformances = eventFilteredRankings.length;
  const studios = new Set(eventFilteredRankings.map(r => r.studioName).filter(s => s)).size;
  const ageCategories = new Set(eventFilteredRankings.map(r => r.ageCategory)).size;

  return (
    <div className={`min-h-screen ${themeClasses.mainBg}`}>
      {/* Header */}
      <header className={`${themeClasses.headerBg} shadow-sm border-b ${themeClasses.headerBorder}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className={`w-10 h-10 ${themeClasses.iconContainer} rounded-full flex items-center justify-center`}>
                <span className="text-white text-xl">🏆</span>
              </div>
              <div>
                <h1 className={`${themeClasses.heading2}`}>Rankings</h1>
                <p className={`text-sm ${themeClasses.textSecondary}`}>Performance results and awards</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-6 ${themeClasses.cardShadow} border ${themeClasses.metricCardBorder} hover:shadow-2xl transition-all duration-300 transform hover:scale-105`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                {totalPerformances}
              </div>
              <div className={`text-sm ${themeClasses.textSecondary} font-medium`}>Total Performances</div>
            </div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-6 ${themeClasses.cardShadow} border ${themeClasses.metricCardBorder} hover:shadow-2xl transition-all duration-300 transform hover:scale-105`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                {studios}
              </div>
              <div className={`text-sm ${themeClasses.textSecondary} font-medium`}>Studios</div>
            </div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-6 ${themeClasses.cardShadow} border ${themeClasses.metricCardBorder} hover:shadow-2xl transition-all duration-300 transform hover:scale-105`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                {ageCategories}
              </div>
              <div className={`text-sm ${themeClasses.textSecondary} font-medium`}>Age Categories</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} shadow-xl p-8 mb-8 border ${themeClasses.cardBorder}`}>
          {/* Event Filter */}
          <div className="mb-6">
            <label className={`block text-sm font-semibold ${themeClasses.textPrimary} mb-3`}>Filter by Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className={`w-full px-4 py-3 border-2 ${themeClasses.inputBorder} ${themeClasses.cardRadius} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
            >
              <option value="all">All Events</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>

          {/* View Mode Tabs */}
          <div>
            <label className={`block text-sm font-semibold ${themeClasses.textPrimary} mb-3`}>View Mode</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setViewMode('all')}
                className={`px-4 py-2 ${themeClasses.cardRadius} font-medium transition-all duration-200 ${
                  viewMode === 'all'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                    : `${themeClasses.buttonSecondary} ${themeClasses.textPrimary} hover:opacity-80`
                }`}
              >
                All Rankings
              </button>
              <button
                onClick={() => setViewMode('top3_age')}
                className={`px-4 py-2 ${themeClasses.cardRadius} font-medium transition-all duration-200 ${
                  viewMode === 'top3_age'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                    : `${themeClasses.buttonSecondary} ${themeClasses.textPrimary} hover:opacity-80`
                }`}
              >
                Top 3 by Age
              </button>
              <button
                onClick={() => setViewMode('top3_style')}
                className={`px-4 py-2 ${themeClasses.cardRadius} font-medium transition-all duration-200 ${
                  viewMode === 'top3_style'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                    : `${themeClasses.buttonSecondary} ${themeClasses.textPrimary} hover:opacity-80`
                }`}
              >
                Top 3 by Style
              </button>
              <button
                onClick={() => setViewMode('top3_duets')}
                className={`px-4 py-2 ${themeClasses.cardRadius} font-medium transition-all duration-200 ${
                  viewMode === 'top3_duets'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                    : `${themeClasses.buttonSecondary} ${themeClasses.textPrimary} hover:opacity-80`
                }`}
              >
                Top 3 Duets
              </button>
              <button
                onClick={() => setViewMode('top3_groups')}
                className={`px-4 py-2 ${themeClasses.cardRadius} font-medium transition-all duration-200 ${
                  viewMode === 'top3_groups'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                    : `${themeClasses.buttonSecondary} ${themeClasses.textPrimary} hover:opacity-80`
                }`}
              >
                Top 3 Groups
              </button>
              <button
                onClick={() => setViewMode('top3_trios')}
                className={`px-4 py-2 ${themeClasses.cardRadius} font-medium transition-all duration-200 ${
                  viewMode === 'top3_trios'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                    : `${themeClasses.buttonSecondary} ${themeClasses.textPrimary} hover:opacity-80`
                }`}
              >
                Top 3 Trios
              </button>
              <button
                onClick={() => setViewMode('top10_soloists')}
                className={`px-4 py-2 ${themeClasses.cardRadius} font-medium transition-all duration-200 ${
                  viewMode === 'top10_soloists'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                    : `${themeClasses.buttonSecondary} ${themeClasses.textPrimary} hover:opacity-80`
                }`}
              >
                Top 10 Soloists
              </button>
            </div>
          </div>
        </div>

        {/* Rankings Table */}
        <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Rankings</h2>
                <p className="text-indigo-100 mt-1">Performance results and awards - Filter by event to view specific competition results</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-indigo-100">Total Results</div>
                <div className="text-2xl font-bold">{filteredRankings.length}</div>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            {filteredRankings.length === 0 ? (
              <div className={`text-center py-12 ${themeClasses.cardBg} ${themeClasses.cardRadius} shadow-lg`}>
                <div className="text-6xl mb-4">📊</div>
                <p className={`${themeClasses.textSecondary} text-lg`}>No rankings available</p>
                <p className={`${themeClasses.textSecondary} text-sm mt-2`}>Rankings will appear here once competitions are completed and scored</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                  <tr className={`border-b ${themeClasses.cardBorder}`}>
                      <th className={`text-left py-4 px-6 font-bold ${themeClasses.textPrimary}`}>Rank</th>
                      <th className={`text-left py-4 px-6 font-bold ${themeClasses.textPrimary}`}>Item #</th>
                      <th className={`text-left py-4 px-6 font-bold ${themeClasses.textPrimary}`}>Performance</th>
                      <th className={`text-left py-4 px-6 font-bold ${themeClasses.textPrimary}`}>Contestant</th>
                      <th className={`text-left py-4 px-6 font-bold ${themeClasses.textPrimary}`}>Type</th>
                      <th className={`text-left py-4 px-6 font-bold ${themeClasses.textPrimary}`}>Age</th>
                      <th className={`text-left py-4 px-6 font-bold ${themeClasses.textPrimary}`}>Score</th>
                      <th className={`text-left py-4 px-6 font-bold ${themeClasses.textPrimary}`}>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRankings.map((ranking) => {
                      const { percentage, rankingLevel, rankingColor, medalEmoji } = calculatePercentageAndRanking(ranking);
                      const displayRank = ranking.rank;
                      
                      return (
                        <tr key={ranking.performanceId} className={`border-b ${themeClasses.cardBorder} ${themeClasses.tableRowHover} transition-colors`}>
                          <td className="py-4 px-6">
                            <div className={`inline-flex items-center px-3 py-1 ${themeClasses.cardRadius} text-sm font-bold border ${getRankBadgeColor(displayRank)}`}>
                              #{displayRank}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {ranking.itemNumber ? (
                              <div className={`inline-flex items-center px-3 py-1 ${themeClasses.cardRadius} text-sm font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-300 shadow-md`}>
                                Item {ranking.itemNumber}
                              </div>
                            ) : (
                              <span className={`${themeClasses.textSecondary}`}>-</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className={`font-semibold ${themeClasses.textPrimary}`}>{ranking.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-sm ${themeClasses.textSecondary}`}>{ranking.itemStyle}</span>
                              {ranking.mastery && (
                                <span className={`inline-flex items-center px-2 py-1 ${themeClasses.cardRadius} text-xs font-medium bg-emerald-700 text-emerald-200`}>
                                  {ranking.mastery}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className={`font-medium ${themeClasses.textPrimary}`}>{ranking.contestantName}</div>
                            {ranking.studioName && (
                              <div className={`text-xs ${themeClasses.textSecondary} mt-1`}>{ranking.studioName}</div>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className={`inline-flex items-center px-3 py-1 ${themeClasses.cardRadius} text-xs font-bold bg-blue-700 text-blue-200 border border-blue-500`}>
                              {ranking.performanceType}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className={`inline-flex items-center px-3 py-1 ${themeClasses.cardRadius} text-xs font-bold bg-indigo-700 text-indigo-200 border border-indigo-500`}>
                              {ranking.ageCategory}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className={`font-bold ${themeClasses.textPrimary}`}>{percentage}%</div>
                            <div className={`text-sm ${themeClasses.textSecondary}`}>{ranking.judgeCount} judges</div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center px-3 py-1 ${themeClasses.cardRadius} text-xs font-bold ${rankingColor}`}>
                              <span className="mr-1">{medalEmoji}</span>
                              {rankingLevel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap with ThemeProvider
export default function RankingsPageWrapper() {
  return (
    <ThemeProvider>
      <RankingsPage />
    </ThemeProvider>
  );
}
