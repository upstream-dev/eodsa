'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Globe, Calendar } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
  performanceType: string;
  region: string;
  registrationDeadline: string;
  eventEndDate: string;
}

interface EventStats {
  totalEntries: number;
  liveEntries: number;
  virtualEntries: number;
  completedPerformances: number;
}

export default function BackstageEventSelector() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventStats, setEventStats] = useState<Record<string, EventStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  useEffect(() => {
    // Check admin authentication
    const session = localStorage.getItem('adminSession');
    if (!session) {
      router.push('/portal/admin');
      return;
    }

    loadEvents();
  }, [router]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      // Load all events
      const eventsRes = await fetch('/api/events');
      const eventsData = await eventsRes.json();

      if (eventsData.success) {
        const allEvents = eventsData.events || [];
        setEvents(allEvents);

        // Load stats for each event
        const statsPromises = allEvents.map(async (event: Event) => {
          try {
            const entriesRes = await fetch(`/api/events/${event.id}/entries`);
            const entriesData = await entriesRes.json();

            if (entriesData.success) {
              const entries = entriesData.entries || [];
              const liveEntries = entries.filter((e: any) => e.entryType === 'live').length;
              const virtualEntries = entries.filter((e: any) => e.entryType === 'virtual').length;

              // Get performance stats
              const performancesRes = await fetch(`/api/events/${event.id}/performances`);
              const performancesData = await performancesRes.json();
              const completedPerformances = performancesData.success
                ? (performancesData.performances || []).filter(
                    (p: any) => p.status === 'completed'
                  ).length
                : 0;

              return {
                eventId: event.id,
                stats: {
                  totalEntries: entries.length,
                  liveEntries,
                  virtualEntries,
                  completedPerformances,
                },
              };
            }
          } catch (error) {
            console.error(`Error loading stats for event ${event.id}:`, error);
          }

          return {
            eventId: event.id,
            stats: {
              totalEntries: 0,
              liveEntries: 0,
              virtualEntries: 0,
              completedPerformances: 0,
            },
          };
        });

        const statsResults = await Promise.all(statsPromises);
        const statsMap: Record<string, EventStats> = {};

        statsResults.forEach((result) => {
          if (result) {
            statsMap[result.eventId] = result.stats;
          }
        });

        setEventStats(statsMap);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventStatusColor = (event: Event) => {
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const endDate = new Date(event.eventEndDate || event.eventDate);

    if (now < eventDate) {
      return 'bg-[rgba(192,192,192,0.2)] text-[var(--chrome-mid)] border border-[rgba(192,192,192,0.35)]'; // Upcoming
    } else if (now >= eventDate && now <= endDate) {
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'; // Live/Active
    } else {
      return 'bg-black/40 text-[#c0c0c0] border border-[rgba(192,192,192,0.22)]'; // Completed
    }
  };

  const getEventStatusText = (event: Event) => {
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const endDate = new Date(event.eventEndDate || event.eventDate);

    if (now < eventDate) {
      return 'Upcoming';
    } else if (now >= eventDate && now <= endDate) {
      return 'Live';
    } else {
      return 'Completed';
    }
  };

  const handleEventClick = (eventId: string) => {
    router.push(`/admin/backstage/${eventId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen avalon-mesh flex items-center justify-center">
        <div className="text-[#c0c0c0] text-xl">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen avalon-mesh avalon-shell text-[#e8e8e8]">
      {/* Header */}
      <div className="glass-panel border-b border-[rgba(192,192,192,0.15)]">
        <div className="avalon-container py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold chrome-text">Backstage Control Center</h1>
              <p className="text-[#c0c0c0] mt-1 text-sm sm:text-base">
                Select an event to manage live performances and program order
              </p>
            </div>
            <Link href="/admin" className="btn-outline-chrome !px-4 !py-2 avalon-tap self-start sm:self-auto justify-center">
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="avalon-container avalon-section">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[#c0c0c0] text-xl mb-4">No events found</div>
            <p className="text-[#c0c0c0]">Create events in the admin dashboard to manage them here.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-2xl font-bold text-[#e8e8e8]">Select Event to Manage</h2>
              <div className="text-[#c0c0c0] text-sm sm:text-base">
                {events.length} event{events.length !== 1 ? 's' : ''} available
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {events.map((event) => {
                const stats = eventStats[event.id] || {
                  totalEntries: 0,
                  liveEntries: 0,
                  virtualEntries: 0,
                  completedPerformances: 0,
                };

                return (
                  <div
                    key={event.id}
                    onClick={() => handleEventClick(event.id)}
                    className={`
                      glass-panel p-4 sm:p-6 rounded-lg border cursor-pointer transition-all duration-300
                      ${
                        selectedEvent === event.id
                          ? 'border-[rgba(192,192,192,0.5)] bg-black/50'
                          : 'border-[rgba(192,192,192,0.22)] bg-black/40 hover:border-[rgba(192,192,192,0.4)]'
                      }
                    `}
                    onMouseEnter={() => setSelectedEvent(event.id)}
                    onMouseLeave={() => setSelectedEvent(null)}
                  >
                    {/* Event Status Badge */}
                    <div className="flex justify-between items-start mb-4">
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${getEventStatusColor(event)}`}
                      >
                        {getEventStatusText(event)}
                      </div>
                      <div className="text-[#c0c0c0] text-sm">{event.performanceType}</div>
                    </div>

                    {/* Event Info */}
                    <h3 className="text-xl font-bold mb-2 text-[#e8e8e8]">{event.name}</h3>
                    <div className="space-y-2 text-sm text-[#c0c0c0] mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[var(--chrome-mid)] shrink-0" strokeWidth={1.75} />
                        <span>{new Date(event.eventDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[var(--chrome-mid)] shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{event.venue}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-[var(--chrome-mid)] shrink-0" strokeWidth={1.75} />
                        <span>{event.region}</span>
                      </div>
                    </div>

                    {/* Performance Stats */}
                    <div className="border-t border-[rgba(192,192,192,0.22)] pt-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-[var(--chrome-mid)]">
                            {stats.totalEntries}
                          </div>
                          <div className="text-xs text-[#c0c0c0]">Total Entries</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-[var(--chrome-mid)]">
                            {stats.completedPerformances}
                          </div>
                          <div className="text-xs text-[#c0c0c0]">Completed</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-center mt-3">
                        <div>
                          <div className="text-lg font-semibold text-[#e8e8e8]">{stats.liveEntries}</div>
                          <div className="text-xs text-[#c0c0c0]">Live</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-[#e8e8e8]">
                            {stats.virtualEntries}
                          </div>
                          <div className="text-xs text-[#c0c0c0]">Virtual</div>
                        </div>
                      </div>
                    </div>

                    {/* Action Indicator */}
                    <div className="mt-4 text-center">
                      <div
                        className={`
                          inline-flex items-center px-4 py-2 rounded-lg font-semibold transition-all
                          ${
                            selectedEvent === event.id
                              ? 'btn-chrome'
                              : 'btn-outline-chrome'
                          }
                        `}
                      >
                        Open Backstage Control
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Quick Stats Summary */}
        {events.length > 0 && (
          <div className="mt-6 sm:mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-panel bg-black/40 border border-[rgba(192,192,192,0.22)] p-3 sm:p-4 rounded-lg text-center">
              <div className="text-xl sm:text-2xl font-bold text-[var(--chrome-mid)]">{events.length}</div>
              <div className="text-[#c0c0c0] text-xs sm:text-sm">Total Events</div>
            </div>
            <div className="glass-panel bg-black/40 border border-[rgba(192,192,192,0.22)] p-3 sm:p-4 rounded-lg text-center">
              <div className="text-xl sm:text-2xl font-bold text-[var(--chrome-mid)]">
                {events.filter((e) => getEventStatusText(e) === 'Live').length}
              </div>
              <div className="text-[#c0c0c0] text-xs sm:text-sm">Live Events</div>
            </div>
            <div className="glass-panel bg-black/40 border border-[rgba(192,192,192,0.22)] p-3 sm:p-4 rounded-lg text-center">
              <div className="text-xl sm:text-2xl font-bold text-[var(--chrome-mid)]">
                {Object.values(eventStats).reduce((sum, stats) => sum + stats.totalEntries, 0)}
              </div>
              <div className="text-[#c0c0c0] text-xs sm:text-sm">Total Entries</div>
            </div>
            <div className="glass-panel bg-black/40 border border-[rgba(192,192,192,0.22)] p-3 sm:p-4 rounded-lg text-center">
              <div className="text-xl sm:text-2xl font-bold text-[var(--chrome-mid)]">
                {Object.values(eventStats).reduce(
                  (sum, stats) => sum + stats.completedPerformances,
                  0
                )}
              </div>
              <div className="text-[#c0c0c0]">Completed</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
