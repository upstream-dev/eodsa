'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Check,
  Download,
  ExternalLink,
  Music,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import MusicPlayer from '@/components/MusicPlayer';
import MusicUpload from '@/components/MusicUpload';
import { useToast } from '@/components/ui/simple-toast';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import RealtimeUpdates from '@/components/RealtimeUpdates';
import { usePhase2Feature } from '@/hooks/usePhase2Feature';
import FeatureUnavailable from '@/components/FeatureUnavailable';
import { AdminAccessSplash, useRequireAdminSession } from '@/hooks/useRequireAdminSession';

interface EventEntry {
  id: string;
  eventId: string;
  contestantId: string;
  eodsaId: string;
  participantIds: string[];
  calculatedFee: number;
  paymentStatus: string;
  paymentMethod?: string;
  submittedAt: string;
  approved: boolean;
  qualifiedForNationals: boolean;
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: number;
  itemNumber?: number;
  contestantName?: string;
  contestantEmail?: string;
  participantNames?: string[];
  // Phase 2: Live/Virtual Entry Support
  entryType: 'live' | 'virtual';
  musicFileUrl?: string;
  musicFileName?: string;
  videoExternalUrl?: string;
  videoExternalType?: string;
  eventName?: string;
  // From performances mapping when single event selected
  musicCue?: 'onstage' | 'offstage';
  performanceOrder?: number;
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
}

function SoundTechPage() {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const { isEnabled: isPhase2Enabled, isLoading: isLoadingFlag } = usePhase2Feature();
  const { authorized, checking } = useRequireAdminSession();
  const router = useRouter();
  const { success, error } = useToast();
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('live');
  const [searchTerm, setSearchTerm] = useState('');
  const [removingMusic, setRemovingMusic] = useState<Set<string>>(new Set());
  // Local completion state - not broadcasted to other dashboards
  const [localCompletedItems, setLocalCompletedItems] = useState<Set<string>>(new Set());
  // Track currently playing item for mini player
  const [currentlyPlaying, setCurrentlyPlaying] = useState<{
    entryId: string;
    itemName: string;
    isPlaying: boolean;
  } | null>(null);

  useEffect(() => {
    if (!authorized) return;

    // Load local completion state from localStorage
    const savedCompletions = localStorage.getItem('soundDeskCompletions');
    if (savedCompletions) {
      try {
        const parsed = JSON.parse(savedCompletions);
        setLocalCompletedItems(new Set(parsed));
      } catch (e) {
        console.error('Failed to load completion state:', e);
      }
    }
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when event filter changes
  }, [authorized, selectedEvent]);

  // Save completion state to localStorage whenever it changes
  useEffect(() => {
    if (localCompletedItems.size > 0) {
      localStorage.setItem('soundDeskCompletions', JSON.stringify(Array.from(localCompletedItems)));
    }
  }, [localCompletedItems]);

  // Join sound room for real-time updates
  useEffect(() => {
    if (selectedEvent && selectedEvent !== 'all') {
      import('@/lib/socket-client').then(({ socketClient }) => {
        socketClient.joinAsSound(selectedEvent);
        console.log(` Joined sound room for event: ${selectedEvent}`);
      });
    }
  }, [selectedEvent]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const entriesUrl =
        selectedEvent && selectedEvent !== 'all'
          ? `/api/event-entries?eventId=${encodeURIComponent(selectedEvent)}`
          : '/api/event-entries';

      const [entriesRes, eventsRes] = await Promise.all([
        fetch(entriesUrl),
        fetch('/api/events'),
      ]);

      if (!entriesRes.ok || !eventsRes.ok) {
        throw new Error('Failed to load sound tech data');
      }

      const entriesData = await entriesRes.json();
      const eventsData = await eventsRes.json();

      if (entriesData.success) {
        console.log(' Sound Tech: Fetched entries:', entriesData.entries);
        console.log(
          ' Live entries with music:',
          entriesData.entries?.filter((e: any) => e.entryType === 'live' && e.musicFileUrl)
        );
        let baseEntries = entriesData.entries || [];
        // If a specific event is selected, map in the latest item numbers from performances
        if (selectedEvent && selectedEvent !== 'all') {
          try {
            const perfRes = await fetch(`/api/events/${selectedEvent}/performances`);
            const perfData = await perfRes.json();
            if (perfData.success) {
              const numMap = new Map<string, number>();
              const cueMap = new Map<string, 'onstage' | 'offstage'>();
              const orderMap = new Map<string, number>();
              for (const p of perfData.performances) {
                if (p.eventEntryId && p.itemNumber) {
                  numMap.set(p.eventEntryId, p.itemNumber);
                }
                if (p.eventEntryId && p.musicCue) cueMap.set(p.eventEntryId, p.musicCue);
                if (p.eventEntryId && p.performanceOrder)
                  orderMap.set(p.eventEntryId, p.performanceOrder);
              }
              baseEntries = baseEntries.map((e: any) =>
                e.eventId === selectedEvent
                  ? {
                      ...e,
                      itemNumber: numMap.get(e.id) ?? e.itemNumber,
                      musicCue: cueMap.get(e.id) ?? e.musicCue,
                      performanceOrder: orderMap.get(e.id) ?? e.performanceOrder,
                    }
                  : e
              );
            }
          } catch {}
        }
        setEntries(baseEntries);
      } else {
        error(entriesData.error || 'Failed to load entries');
      }
      if (eventsData.success) {
        const ev = eventsData.events || [];
        setEvents(ev);
        // Default to first event for realtime join if currently "all"
        if ((selectedEvent === 'all' || !selectedEvent) && ev.length > 0) {
          setSelectedEvent(ev[0].id);
        }
      } else {
        error(eventsData.error || 'Failed to load events');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      error('Failed to load sound tech dashboard. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getEventName = (eventId: string) => {
    const event = events.find((e) => e.id === eventId);
    return event?.name || 'Unknown Event';
  };

  const getPerformanceType = (participantIds: string[]) => {
    const count = participantIds.length;
    if (count === 1) return 'Solo';
    if (count === 2) return 'Duet';
    if (count === 3) return 'Trio';
    if (count >= 4) return 'Group';
    return 'Unknown';
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesEvent = selectedEvent === 'all' || entry.eventId === selectedEvent;
    const matchesEntryType = entryTypeFilter === 'all' || entry.entryType === entryTypeFilter;
    const matchesSearch =
      searchTerm === '' ||
      entry.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.choreographer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.contestantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.participantNames?.some((name) =>
        name.toLowerCase().includes(searchTerm.toLowerCase())
      );

    return matchesEvent && matchesEntryType && matchesSearch;
  });
  // Sort consistently by performance order (from backstage), fallback to item number then name
  const sortedFilteredEntries = [...filteredEntries].sort((a, b) => {
    // Primary: Use performance order from backstage if available
    if (a.performanceOrder && b.performanceOrder) return a.performanceOrder - b.performanceOrder;
    // Fallback: Use item number if performance order not available
    if (a.itemNumber && b.itemNumber) return a.itemNumber - b.itemNumber;
    if (a.itemNumber && !b.itemNumber) return -1;
    if (!a.itemNumber && b.itemNumber) return 1;
    return a.itemName.localeCompare(b.itemName);
  });
  // Sound desk must see ALL live entries, even without music
  const liveEntries = sortedFilteredEntries.filter((entry) => entry.entryType === 'live');
  const virtualEntries = sortedFilteredEntries.filter(
    (entry) => entry.entryType === 'virtual' && entry.videoExternalUrl
  );

  const downloadAllMusic = () => {
    liveEntries.forEach((entry) => {
      if (entry.musicFileUrl) {
        const link = document.createElement('a');
        link.href = entry.musicFileUrl;
        link.download = entry.musicFileName || `${entry.itemName}.mp3`;
        link.click();
      }
    });
    success(`Started download of ${liveEntries.length} music files`);
  };

  const toggleCompletion = (entryId: string) => {
    setLocalCompletedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const removeMusic = async (entryId: string, itemName: string) => {
    if (removingMusic.has(entryId)) return;

    if (
      !confirm(
        `Remove music from "${itemName}"?\n\nThis will make the entry available for re-upload in the contestant's dashboard.`
      )
    ) {
      return;
    }

    setRemovingMusic((prev) => new Set(prev).add(entryId));

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        error('Session expired. Please log in again.');
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch(`/api/admin/entries/${entryId}/remove-music`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: adminData.id,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        success(result.message);

        // Refresh the data to show updated state
        await fetchData();
      } else {
        const errorResponse = await response.json();
        error(`Failed to remove music: ${errorResponse.error}`);
      }
    } catch (err) {
      console.error('Error removing music:', err);
      error('Failed to remove music. Please try again.');
    } finally {
      setRemovingMusic((prev) => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto" />
          <p className={`mt-4 ${themeClasses.loadingText}`}>Loading sound tech dashboard...</p>
        </div>
      </div>
    );
  }

  const handleRealtimeReorder = async (
    reorderedFromSocket?: any[],
    meta?: { eventId?: string }
  ) => {
    const ev = meta?.eventId;
    if (
      reorderedFromSocket?.length &&
      ev &&
      selectedEvent !== 'all' &&
      selectedEvent === ev
    ) {
      const orderByEntryId = new Map<
        string,
        { itemNumber?: number; performanceOrder?: number }
      >();
      for (const r of reorderedFromSocket) {
        const entryId = r.eventEntryId as string | undefined;
        if (!entryId) continue;
        orderByEntryId.set(entryId, {
          itemNumber: r.itemNumber,
          performanceOrder: r.performanceOrder ?? r.displayOrder,
        });
      }
      if (orderByEntryId.size > 0) {
        setEntries((prev) => {
          const updated = prev.map((e: any) => {
            if (e.eventId !== ev) return e;
            const u = orderByEntryId.get(e.id);
            if (!u) return e;
            return {
              ...e,
              ...(typeof u.itemNumber === 'number' ? { itemNumber: u.itemNumber } : {}),
              ...(typeof u.performanceOrder === 'number'
                ? { performanceOrder: u.performanceOrder }
                : {}),
            };
          });
          return updated.sort((a: any, b: any) => {
            if (a.performanceOrder && b.performanceOrder) {
              return a.performanceOrder - b.performanceOrder;
            }
            if (a.itemNumber && b.itemNumber) {
              return a.itemNumber - b.itemNumber;
            }
            return a.itemName.localeCompare(b.itemName);
          });
        });
        return;
      }
    }

    // Fallback: refetch from API (e.g. "all" events, or payload without entry ids)
    if (!selectedEvent || selectedEvent === 'all') {
      await fetchData();
      return;
    }
    try {
      const perfRes = await fetch(`/api/events/${selectedEvent}/performances`);
      const perfData = await perfRes.json();
      if (perfData.success) {
        const numMap = new Map<string, number>();
        const cueMap = new Map<string, 'onstage' | 'offstage'>();
        const orderMap = new Map<string, number>();
        for (const p of perfData.performances) {
          if (p.eventEntryId && p.itemNumber) numMap.set(p.eventEntryId, p.itemNumber);
          if (p.eventEntryId && p.musicCue) cueMap.set(p.eventEntryId, p.musicCue);
          if (p.eventEntryId && p.performanceOrder)
            orderMap.set(p.eventEntryId, p.performanceOrder);
        }
        setEntries((prev) => {
          const updated = prev.map((e: any) =>
            e.eventId === selectedEvent
              ? {
                  ...e,
                  itemNumber: numMap.get(e.id) ?? e.itemNumber,
                  musicCue: cueMap.get(e.id) ?? e.musicCue,
                  performanceOrder: orderMap.get(e.id) ?? e.performanceOrder,
                }
              : e
          );
          // Re-sort by performance order if available, fallback to item number
          return updated.sort((a, b) => {
            if (a.performanceOrder && b.performanceOrder) {
              return a.performanceOrder - b.performanceOrder;
            }
            if (a.itemNumber && b.itemNumber) {
              return a.itemNumber - b.itemNumber;
            }
            return a.itemName.localeCompare(b.itemName);
          });
        });
      }
    } catch {
      await fetchData();
    }
  };

  if (!isLoadingFlag && !isPhase2Enabled) {
    return <FeatureUnavailable featureName="Sound Tech" />;
  }
  if (checking || !authorized) {
    return <AdminAccessSplash />;
  }

  const inputClass = `w-full min-h-[44px] px-3 py-2 rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-[#e0e0e0] placeholder:text-[#8a8a8a] focus:outline-none ${themeClasses.inputFocus}`;

  return (
    <RealtimeUpdates
      eventId={selectedEvent !== 'all' ? selectedEvent : ''}
      strictEvent
      onPerformanceReorder={handleRealtimeReorder}
      onPerformanceMusicCue={async (data) => {
        // Update in place for specific event; if in All, fetch the single performance to map
        if (selectedEvent && selectedEvent !== 'all') {
          setEntries((prev) =>
            prev.map((e: any) =>
              e.eventId === selectedEvent && e.id === data.performanceId ? e : e
            )
          );
          // We map by eventEntry; refresh mapping quickly
          await handleRealtimeReorder();
        } else {
          try {
            const perfRes = await fetch(`/api/performances/${data.performanceId}`);
            const perfData = await perfRes.json();
            if (perfData.success) {
              setEntries((prev) =>
                prev.map((e: any) =>
                  e.id === perfData.performance.eventEntryId
                    ? { ...e, musicCue: perfData.performance.musicCue }
                    : e
                )
              );
            }
          } catch {}
        }
      }}
    >
      <div className={`min-h-screen avalon-shell ${themeClasses.mainBg} text-[#e8e8e8]`}>
        {/* Header */}
        <div
          className={`glass-panel border-b border-[rgba(192,192,192,0.15)] ${themeClasses.headerBg}`}
        >
          <div className="avalon-container py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl glass-panel border border-[rgba(192,192,192,0.22)] flex items-center justify-center shrink-0">
                  <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--electric-cyan)]" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-3xl font-bold chrome-text">Sound Tech Dashboard</h1>
                  <p className="text-[#c0c0c0] mt-1 text-sm sm:text-base">
                    Manage music files for live performances
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={() => router.push('/admin')}
                  className="btn-outline-chrome !px-4 !py-2 avalon-tap w-full sm:w-auto justify-center"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Admin
                </button>
                {liveEntries.length > 0 && (
                  <button
                    onClick={downloadAllMusic}
                    className="btn-chrome !px-4 !py-2 avalon-tap w-full sm:w-auto justify-center"
                  >
                    <Download className="w-4 h-4" />
                    Download All ({liveEntries.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mini Player - Fixed at top */}
        {currentlyPlaying && (
          <div className="sticky top-0 z-40 glass-panel border-b border-[rgba(34,211,238,0.35)] bg-black/80 backdrop-blur-xl">
            <div className="avalon-container py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5 text-[var(--electric-cyan)]" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-cyan-300/80">Now Playing</p>
                    <p className="text-base sm:text-lg font-semibold text-white truncate">
                      {currentlyPlaying.itemName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      currentlyPlaying.isPlaying
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 animate-pulse'
                        : 'bg-black/40 text-[#c0c0c0] border border-[rgba(192,192,192,0.22)]'
                    }`}
                  >
                    {currentlyPlaying.isPlaying ? 'Playing' : 'Paused'}
                  </span>
                  <button
                    onClick={() => setCurrentlyPlaying(null)}
                    className="btn-outline-chrome !px-3 !py-1 text-sm avalon-tap"
                  >
                    <X className="w-3.5 h-3.5" />
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="avalon-container avalon-section">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[
              { label: 'Live Entries', value: liveEntries.length, Icon: Music },
              { label: 'Virtual Entries', value: virtualEntries.length, Icon: Video },
              { label: 'Total Entries', value: filteredEntries.length, Icon: Volume2 },
              { label: 'Events', value: events.length, Icon: Calendar },
            ].map(({ label, value, Icon }) => (
              <div
                key={label}
                className="glass-panel bg-black/40 border border-[rgba(192,192,192,0.22)] p-3 sm:p-4 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(192,192,192,0.1)] border border-[rgba(192,192,192,0.22)] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[var(--chrome-mid)]" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-[#c0c0c0] truncate">{label}</p>
                    <p className="text-xl sm:text-2xl font-semibold text-[#e8e8e8]">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col gap-4">
              <div className="w-full">
                <label className="block text-sm font-medium text-[#c0c0c0] mb-2">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by item name, choreographer, or participant..."
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="w-full">
                  <label className="block text-sm font-medium text-[#c0c0c0] mb-2">Event</label>
                  <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className={inputClass}
                  >
                    <option value="all">All Events</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full">
                  <label className="block text-sm font-medium text-[#c0c0c0] mb-2">Entry Type</label>
                  <select
                    value={entryTypeFilter}
                    onChange={(e) => setEntryTypeFilter(e.target.value)}
                    className={inputClass}
                  >
                    <option value="all">All Types</option>
                    <option value="live">Live Performances</option>
                    <option value="virtual">Virtual Performances</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Music Files List */}
          {entryTypeFilter === 'live' || entryTypeFilter === 'all' ? (
            <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-xl mb-6 sm:mb-8 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-[rgba(192,192,192,0.15)]">
                <h2 className="text-lg sm:text-xl font-semibold text-[#e8e8e8] flex items-center gap-2">
                  <Music className="w-5 h-5 text-[var(--chrome-mid)]" strokeWidth={1.75} />
                  Live Performances — Music Files ({liveEntries.length})
                </h2>
              </div>
              {liveEntries.length > 0 ? (
                <div className="divide-y divide-[rgba(192,192,192,0.12)]">
                  {liveEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-4 sm:p-6 ${
                        localCompletedItems.has(entry.id)
                          ? 'bg-emerald-500/10 border-l-4 border-l-emerald-400'
                          : ''
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        {/* Entry header */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[rgba(192,192,192,0.1)] border border-[rgba(192,192,192,0.22)] flex items-center justify-center shrink-0">
                            <span className="text-[var(--chrome-mid)] font-semibold text-sm">
                              {entry.itemNumber || '#'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                              {entry.itemName}
                            </h3>
                            <p className="text-sm text-[#c0c0c0]">
                              {getPerformanceType(entry.participantIds)} • Style: {entry.itemStyle}
                              <span
                                className={`ml-2 inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  entry.musicCue === 'onstage'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                    : 'bg-black/40 text-[#c0c0c0] border border-[rgba(192,192,192,0.22)]'
                                }`}
                              >
                                {entry.musicCue === 'onstage' ? 'On Stage' : 'Off Stage'}
                              </span>
                            </p>

                            <div className="mt-2 mb-1">
                              {entry.contestantName &&
                              entry.contestantName !== 'Unknown Contestant' ? (
                                <div>
                                  <p className="text-sm font-semibold text-[#e0e0e0] mb-1">
                                    {entry.contestantName.includes(', ') ? (
                                      <span className="text-[var(--electric-cyan)]">
                                        Group Performance
                                      </span>
                                    ) : (
                                      <span className="text-emerald-300">Solo Performance</span>
                                    )}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {entry.contestantName.split(', ').map((name, index) => (
                                      <span
                                        key={index}
                                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[rgba(192,192,192,0.1)] text-[#e0e0e0] border border-[rgba(192,192,192,0.22)]"
                                      >
                                        {name.trim()}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm font-semibold text-red-400">
                                  Unknown Contestant
                                </p>
                              )}
                            </div>

                            {selectedEvent === 'all' && (
                              <p className="text-xs text-[#c0c0c0] mt-1">
                                Event: {getEventName(entry.eventId)}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 px-2 py-1 text-xs font-medium rounded-md ${
                              entry.approved
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                            }`}
                          >
                            {entry.approved ? 'Approved' : 'Pending'}
                          </span>
                        </div>

                        {/* Music player — full width */}
                        {entry.musicFileUrl && (
                          <div className="w-full">
                            <MusicPlayer
                              musicUrl={entry.musicFileUrl}
                              filename={entry.musicFileName || entry.itemName}
                              className="w-full"
                              showDownload={true}
                              onPlayingChange={(isPlaying) => {
                                if (isPlaying) {
                                  setCurrentlyPlaying({
                                    entryId: entry.id,
                                    itemName: entry.itemName,
                                    isPlaying: true,
                                  });
                                } else if (currentlyPlaying?.entryId === entry.id) {
                                  setCurrentlyPlaying({
                                    ...currentlyPlaying,
                                    isPlaying: false,
                                  });
                                }
                              }}
                            />
                          </div>
                        )}

                        {!entry.musicFileUrl && (
                          <div className="w-full">
                            <div className="mb-2 p-3 border border-amber-400/40 bg-amber-500/10 text-amber-200 rounded-md text-sm">
                              Upload outstanding — no track uploaded yet.
                            </div>
                            <MusicUpload
                              currentFile={null}
                              variant="dark"
                              compact
                              onUploadSuccess={async (file) => {
                                try {
                                  await fetch(`/api/admin/entries/${entry.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      musicFileUrl: file.url,
                                      musicFileName: file.originalFilename,
                                    }),
                                  });
                                  success('Music uploaded and saved');
                                  await fetchData();
                                } catch (e) {
                                  error('Failed to save uploaded music');
                                }
                              }}
                              onUploadError={(err) => error(err)}
                            />
                          </div>
                        )}

                        {/* Actions — full-width stacked on mobile */}
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                          <button
                            onClick={() => toggleCompletion(entry.id)}
                            className={`w-full sm:w-auto justify-center avalon-tap px-3 py-2 text-xs font-medium rounded-md border transition-colors inline-flex items-center gap-1.5 ${
                              localCompletedItems.has(entry.id)
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30'
                                : 'btn-outline-chrome !text-xs'
                            }`}
                            title="Mark as complete (local view only - doesn't affect other dashboards)"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {localCompletedItems.has(entry.id) ? 'Completed' : 'Mark Complete'}
                          </button>
                          <button
                            onClick={() => removeMusic(entry.id, entry.itemName)}
                            disabled={removingMusic.has(entry.id)}
                            className="w-full sm:w-auto justify-center avalon-tap px-3 py-2 text-xs font-medium text-red-300 bg-red-500/10 border border-red-400/40 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                            title="Remove music file - contestant will be able to re-upload"
                          >
                            {removingMusic.has(entry.id) ? (
                              <>
                                <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                Removing...
                              </>
                            ) : (
                              <>
                                <X className="w-3.5 h-3.5" />
                                Remove Music
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Music className="w-10 h-10 text-[#c0c0c0] mx-auto mb-3 opacity-50" />
                  <p className="text-[#c0c0c0]">No live performances with music files found</p>
                </div>
              )}
            </div>
          ) : null}

          {/* Virtual Entries List */}
          {entryTypeFilter === 'virtual' || entryTypeFilter === 'all' ? (
            <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-xl overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-[rgba(192,192,192,0.15)]">
                <h2 className="text-lg sm:text-xl font-semibold text-[#e8e8e8] flex items-center gap-2">
                  <Video className="w-5 h-5 text-[var(--chrome-mid)]" strokeWidth={1.75} />
                  Virtual Performances — Video Links ({virtualEntries.length})
                </h2>
              </div>
              {virtualEntries.length > 0 ? (
                <div className="divide-y divide-[rgba(192,192,192,0.12)]">
                  {virtualEntries.map((entry) => (
                    <div key={entry.id} className="p-4 sm:p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[rgba(192,192,192,0.1)] border border-[rgba(192,192,192,0.22)] flex items-center justify-center shrink-0">
                            <span className="text-[var(--electric-cyan)] font-semibold text-sm">
                              {entry.itemNumber || '#'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                              {entry.itemName}
                            </h3>
                            <p className="text-sm text-[#c0c0c0]">
                              by {entry.choreographer} • {getPerformanceType(entry.participantIds)}
                            </p>
                            <p className="text-xs text-[#c0c0c0] mt-1">
                              {getEventName(entry.eventId)} • {entry.participantNames?.join(', ')}
                            </p>
                            <div className="mt-2 text-xs text-[#c0c0c0]">
                              Mastery: {entry.mastery} · Style: {entry.itemStyle}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 px-2 py-1 text-xs font-medium rounded-md ${
                              entry.approved
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                            }`}
                          >
                            {entry.approved ? 'Approved' : 'Pending'}
                          </span>
                        </div>

                        {entry.videoExternalUrl && (
                          <div className="w-full p-4 rounded-lg bg-cyan-500/10 border border-cyan-400/30">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-cyan-200">
                                  {entry.videoExternalType?.toUpperCase()} Video
                                </p>
                                <p className="text-xs text-cyan-300/70 truncate">
                                  {entry.videoExternalUrl}
                                </p>
                              </div>
                              <a
                                href={entry.videoExternalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-chrome !px-3 !py-1.5 text-sm avalon-tap w-full sm:w-auto justify-center"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Watch Video
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Video className="w-10 h-10 text-[#c0c0c0] mx-auto mb-3 opacity-50" />
                  <p className="text-[#c0c0c0]">No virtual performances found</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </RealtimeUpdates>
  );
}

// Wrap with ThemeProvider
export default function SoundTechPageWrapper() {
  return (
    <ThemeProvider>
      <SoundTechPage />
    </ThemeProvider>
  );
}
