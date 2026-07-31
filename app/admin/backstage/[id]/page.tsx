'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  GripVertical,
  ListOrdered,
  Pause,
  Play,
  RotateCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useBackstageSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/simple-toast';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';

interface Performance {
  id: string;
  title: string;
  contestantName: string;
  participantNames: string[];
  duration: number;
  itemNumber?: number; // Permanent item number (locked after assignment)
  performanceOrder?: number; // Current position in backstage sequence
  status: 'scheduled' | 'ready' | 'hold' | 'in_progress' | 'completed' | 'cancelled';
  entryType?: 'live' | 'virtual';
  musicFileUrl?: string;
  videoExternalUrl?: string;
  musicCue?: 'onstage' | 'offstage';
  /** From API — included in socket payload for sound desk mapping */
  eventEntryId?: string;
}

function buildPerformanceReorderSocketPayload(eventId: string, perfs: Performance[]) {
  return {
    eventId,
    performances: perfs.map((p) => ({
      id: p.id,
      itemNumber: p.itemNumber!,
      performanceOrder: p.performanceOrder!,
      displayOrder: p.performanceOrder!,
      ...(typeof p.eventEntryId === 'string' && p.eventEntryId
        ? { eventEntryId: p.eventEntryId }
        : {}),
    })),
  };
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  status: string;
}

function statusBadgeClass(status: Performance['status']) {
  if (status === 'completed') {
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40';
  }
  if (status === 'in_progress') {
    return 'bg-[rgba(0,230,255,0.12)] text-[#00E6FF] border border-[rgba(0,230,255,0.35)] animate-pulse';
  }
  if (status === 'hold') {
    return 'bg-amber-500/20 text-amber-300 border border-amber-400/40';
  }
  return 'bg-black/40 text-[#c0c0c0] border border-[rgba(192,192,192,0.22)]';
}

function cardShellClass(status: Performance['status'], isDragging: boolean, selected: boolean) {
  const base =
    'relative rounded-xl border overflow-hidden transition-all duration-150 glass-panel';
  const drag = isDragging
    ? 'z-50 shadow-2xl ring-2 ring-[rgba(0,230,255,0.55)] ring-offset-2 ring-offset-[#050505]'
    : '';
  const select = selected ? 'ring-2 ring-amber-400/80' : '';
  if (status === 'completed') {
    return `${base} ${drag} ${select} bg-emerald-950/40 border-emerald-500/40`;
  }
  if (status === 'in_progress') {
    return `${base} ${drag} ${select} bg-[rgba(0,230,255,0.08)] border-[rgba(0,230,255,0.4)]`;
  }
  return `${base} ${drag} ${select} bg-black/40 border-[rgba(192,192,192,0.22)]`;
}

function itemNumberClass(status: Performance['status'], isDragging?: boolean) {
  if (isDragging) {
    return 'bg-amber-400 border-amber-300 text-[#050505] scale-110';
  }
  if (status === 'completed') {
    return 'bg-emerald-500/90 border-emerald-400 text-white';
  }
  if (status === 'in_progress') {
    return 'bg-[rgba(0,230,255,0.2)] border-[rgba(0,230,255,0.55)] text-[#00E6FF]';
  }
  return 'bg-[rgba(192,192,192,0.12)] border-[rgba(192,192,192,0.35)] text-[#e8e8e8]';
}

// Sortable Item Component for @dnd-kit
function SortablePerformanceItem({
  performance,
  updatePerformanceStatus,
  onUpdateMusicCue,
  selectedForMove,
  movePerformanceUp,
  movePerformanceDown,
  setSelectedForMove,
  performances,
}: {
  performance: Performance;
  updatePerformanceStatus: (id: string, status: Performance['status']) => void;
  onUpdateMusicCue: (id: string, cue: 'onstage' | 'offstage') => void;
  selectedForMove: string | null;
  movePerformanceUp: (id: string) => void;
  movePerformanceDown: (id: string) => void;
  setSelectedForMove: (id: string | null) => void;
  performances: Performance[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: performance.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  /** One drag handle for all breakpoints (dnd-kit: never attach listeners twice in the DOM). */
  const dragHandle = (
    <button
      type="button"
      aria-label="Drag to reorder performance"
      {...listeners}
      className="touch-none select-none shrink-0 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing active:bg-[rgba(0,230,255,0.12)] [-webkit-tap-highlight-color:transparent] w-[52px] min-h-[108px] sm:min-h-[100px] rounded-l-[10px] border-r border-[rgba(192,192,192,0.22)] bg-black/50 text-[#c0c0c0] lg:w-12 lg:min-h-[5.25rem] lg:rounded-xl lg:border lg:border-[rgba(192,192,192,0.22)] lg:mr-1"
    >
      <GripVertical className="w-5 h-5 text-[var(--chrome-mid)]" strokeWidth={1.75} />
      <span className="mt-1.5 text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-[#9a9a9a] leading-tight text-center px-0.5 lg:hidden">
        Hold &amp; drag
      </span>
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cardShellClass(
        performance.status,
        isDragging,
        selectedForMove === performance.id
      )}
    >
      <div className="flex items-stretch min-h-0">
        {dragHandle}

        <div className="min-w-0 flex-1 flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:p-4">
          {/* Compact layout: phones & tablets below lg breakpoint */}
          <div className="lg:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex flex-col items-center justify-center font-bold border-2 shrink-0 ${itemNumberClass(performance.status)}`}
                >
                  <div className="text-xs sm:text-sm leading-none">
                    #{performance.itemNumber || '?'}
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-75 leading-none">
                    P{performance.performanceOrder || '?'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedForMove(
                      selectedForMove === performance.id ? null : performance.id
                    );
                  }}
                  className={`touch-manipulation px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 min-h-[44px] ${
                    selectedForMove === performance.id
                      ? 'bg-amber-400 text-[#050505]'
                      : 'btn-outline-chrome !px-3 !py-2'
                  }`}
                >
                  {selectedForMove === performance.id ? 'Selected' : 'Nudge'}
                </button>
              </div>
              {selectedForMove === performance.id && (
                <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      movePerformanceUp(performance.id);
                    }}
                    disabled={
                      performances.findIndex((p) => p.id === performance.id) === 0
                    }
                    className="touch-manipulation min-h-[44px] flex-1 sm:flex-none sm:min-w-[44px] rounded-lg btn-outline-chrome !px-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      movePerformanceDown(performance.id);
                    }}
                    disabled={
                      performances.findIndex((p) => p.id === performance.id) ===
                      performances.length - 1
                    }
                    className="touch-manipulation min-h-[44px] flex-1 sm:flex-none sm:min-w-[44px] rounded-lg btn-outline-chrome !px-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="mb-3 min-w-0">
              <h3 className="font-semibold text-base sm:text-lg text-[#e8e8e8] leading-snug break-words">
                {performance.title}
              </h3>
              <p className="text-sm text-[#c0c0c0] truncate">
                by {performance.contestantName}
              </p>
              <p className="text-xs text-[#9a9a9a] line-clamp-2">
                {performance.participantNames.join(', ')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateMusicCue(
                    performance.id,
                    performance.musicCue === 'onstage' ? 'offstage' : 'onstage'
                  );
                }}
                className={`touch-manipulation min-h-[44px] w-full sm:w-auto px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  performance.musicCue === 'onstage'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-black/40 text-[#c0c0c0] border-[rgba(192,192,192,0.22)]'
                }`}
              >
                {performance.musicCue === 'onstage' ? 'Onstage' : 'Offstage'}
              </button>
              {/* Mobile Status Controls */}
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePerformanceStatus(performance.id, 'in_progress');
                  }}
                  disabled={performance.status === 'in_progress'}
                  className={`touch-manipulation min-h-[44px] min-w-[44px] flex-1 sm:flex-none px-2 rounded-lg text-base font-bold flex items-center justify-center ${
                    performance.status === 'in_progress'
                      ? 'bg-[rgba(0,230,255,0.2)] text-[#00E6FF] border border-[rgba(0,230,255,0.4)] cursor-not-allowed'
                      : 'bg-[rgba(0,230,255,0.12)] text-[#00E6FF] border border-[rgba(0,230,255,0.3)] hover:bg-[rgba(0,230,255,0.22)]'
                  }`}
                  title="Start"
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePerformanceStatus(performance.id, 'hold');
                  }}
                  disabled={performance.status !== 'in_progress'}
                  className={`touch-manipulation min-h-[44px] min-w-[44px] flex-1 sm:flex-none px-2 rounded-lg text-base font-bold flex items-center justify-center ${
                    performance.status !== 'in_progress'
                      ? 'bg-black/40 text-[#6a6a6a] border border-[rgba(192,192,192,0.15)] cursor-not-allowed'
                      : 'bg-amber-500/90 hover:bg-amber-500 text-[#050505] border border-amber-400'
                  }`}
                  title="Pause"
                >
                  <Pause className="w-4 h-4" fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePerformanceStatus(performance.id, 'completed');
                  }}
                  disabled={performance.status === 'completed'}
                  className={`touch-manipulation min-h-[44px] min-w-[44px] flex-1 sm:flex-none px-2 rounded-lg text-base font-bold flex items-center justify-center ${
                    performance.status === 'completed'
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 cursor-not-allowed'
                      : 'bg-emerald-500/90 hover:bg-emerald-500 text-white border border-emerald-400'
                  }`}
                  title="Complete"
                >
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
              <span
                className={`px-3 py-1.5 rounded-lg text-sm font-medium self-start ${statusBadgeClass(performance.status)}`}
              >
                {performance.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Wide screens: horizontal row (drag handle is shared column on the left) */}
          <div className="hidden lg:flex flex-1 justify-between items-center min-w-0 gap-4">
            <div className="flex items-center space-x-4 min-w-0">
              <div className={`relative ${isDragging ? 'animate-pulse' : ''}`}>
                <div
                  className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center font-bold border-2 transition-all duration-150 ${itemNumberClass(performance.status, isDragging)}`}
                >
                  <div className="text-lg leading-none">
                    #{performance.itemNumber || '?'}
                  </div>
                  <div className="text-xs opacity-75 leading-none mt-1">
                    Pos: {performance.performanceOrder || '?'}
                  </div>
                </div>
                {isDragging && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-300 rounded-full flex items-center justify-center">
                    <GripVertical className="w-3.5 h-3.5 text-[#050505]" />
                  </div>
                )}
              </div>
              <div className={isDragging ? 'opacity-75' : ''}>
                <h3 className="font-semibold text-lg text-[#e8e8e8] leading-tight">
                  {performance.title}
                </h3>
                <p
                  className={`text-sm ${isDragging ? 'text-[#d0d0d0]' : 'text-[#c0c0c0]'} mt-1`}
                >
                  by {performance.contestantName} |{' '}
                  {performance.entryType?.toUpperCase()}
                </p>
                <p
                  className={`text-xs ${isDragging ? 'text-[#c0c0c0]' : 'text-[#9a9a9a]'}`}
                >
                  {performance.participantNames.join(', ')}
                </p>
              </div>
            </div>

            {/* Desktop controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  setSelectedForMove(
                    selectedForMove === performance.id ? null : performance.id
                  )
                }
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedForMove === performance.id
                    ? 'bg-amber-400 text-[#050505]'
                    : 'btn-outline-chrome !px-3 !py-2'
                }`}
              >
                {selectedForMove === performance.id ? 'Selected' : 'Select'}
              </button>
              {selectedForMove === performance.id && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => movePerformanceUp(performance.id)}
                    disabled={
                      performances.findIndex((p) => p.id === performance.id) === 0
                    }
                    className="w-10 h-10 rounded-lg btn-outline-chrome !px-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => movePerformanceDown(performance.id)}
                    disabled={
                      performances.findIndex((p) => p.id === performance.id) ===
                      performances.length - 1
                    }
                    className="w-10 h-10 rounded-lg btn-outline-chrome !px-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* On-stage/Off-stage Toggle - Desktop */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateMusicCue(
                    performance.id,
                    performance.musicCue === 'onstage' ? 'offstage' : 'onstage'
                  );
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  performance.musicCue === 'onstage'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-black/40 text-[#c0c0c0] border-[rgba(192,192,192,0.35)] hover:border-[rgba(192,192,192,0.55)]'
                }`}
                title={`Currently ${performance.musicCue || 'offstage'} - Click to toggle`}
              >
                {performance.musicCue === 'onstage' ? 'Onstage' : 'Offstage'}
              </button>

              {/* Performance Status Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    updatePerformanceStatus(performance.id, 'in_progress')
                  }
                  disabled={performance.status === 'in_progress'}
                  className={`px-2 py-1.5 min-w-[36px] min-h-[36px] rounded text-xs font-bold flex items-center justify-center ${
                    performance.status === 'in_progress'
                      ? 'bg-[rgba(0,230,255,0.2)] text-[#00E6FF] border border-[rgba(0,230,255,0.4)] cursor-not-allowed'
                      : 'bg-[rgba(0,230,255,0.12)] text-[#00E6FF] border border-[rgba(0,230,255,0.3)] hover:bg-[rgba(0,230,255,0.22)]'
                  }`}
                  title="Start Performance"
                >
                  <Play className="w-3.5 h-3.5" fill="currentColor" />
                </button>
                <button
                  onClick={() => updatePerformanceStatus(performance.id, 'hold')}
                  disabled={performance.status !== 'in_progress'}
                  className={`px-2 py-1.5 min-w-[36px] min-h-[36px] rounded text-xs font-bold flex items-center justify-center ${
                    performance.status !== 'in_progress'
                      ? 'bg-black/40 text-[#6a6a6a] border border-[rgba(192,192,192,0.15)] cursor-not-allowed'
                      : 'bg-amber-500/90 hover:bg-amber-500 text-[#050505] border border-amber-400'
                  }`}
                  title="Pause Performance"
                >
                  <Pause className="w-3.5 h-3.5" fill="currentColor" />
                </button>
                <button
                  onClick={() =>
                    updatePerformanceStatus(performance.id, 'completed')
                  }
                  disabled={performance.status === 'completed'}
                  className={`px-2 py-1.5 min-w-[36px] min-h-[36px] rounded text-xs font-bold flex items-center justify-center ${
                    performance.status === 'completed'
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 cursor-not-allowed'
                      : 'bg-emerald-500/90 hover:bg-emerald-500 text-white border border-emerald-400'
                  }`}
                  title="Complete Performance"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Status indicator */}
              <div
                className={`px-3 py-1 rounded-lg text-xs font-bold ${statusBadgeClass(performance.status)}`}
              >
                {performance.status.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drag instruction overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-[rgba(0,230,255,0.08)] rounded-lg flex items-center justify-center">
          <div className="bg-amber-400 text-[#050505] px-4 py-2 rounded-lg font-bold text-sm">
            REORDERING ITEM #{performance.itemNumber}
          </div>
        </div>
      )}
    </div>
  );
}

function BackstageDashboard() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const { success, error } = useToast();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPerformance, setCurrentPerformance] = useState<Performance | null>(null);
  const [eventStatus, setEventStatus] = useState<'waiting' | 'active' | 'paused' | 'completed'>('waiting');

  // No music player needed on Backstage - that's for Sound Tech dashboard
  // Mobile Reordering State
  const [selectedForMove, setSelectedForMove] = useState<string | null>(null);

  // Socket connection for real-time updates
  const socket = useBackstageSocket(eventId);

  // Drag handle uses touch-none; small distance + no touch delay so tablet/phone drags start quickly
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 12,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Check admin or backstage staff authentication
    const adminSession = localStorage.getItem('adminSession');
    const backstageSession = localStorage.getItem('backstageSession');

    if (!adminSession && !backstageSession) {
      router.push('/portal/backstage');
      return;
    }

    if (eventId) {
      loadEventData();
    }
  }, [eventId, router]);

  // Set up socket listeners
  useEffect(() => {
    if (!socket.connected) return;

    const onPerformanceStatus = (data: {
      performanceId: string;
      status: Performance['status'];
    }) => {
      setPerformances((prev) =>
        prev.map((p) =>
          p.id === data.performanceId ? { ...p, status: data.status } : p
        )
      );
    };

    const onPerformanceReorder = (data: { eventId: string; performances: any[] }) => {
      if (data.eventId !== eventId || !data.performances?.length) return;
      setPerformances((prev) => {
        const updateMap = new Map(data.performances.map((r: any) => [r.id, r]));
        const merged = prev.map((p) => {
          const u = updateMap.get(p.id);
          if (!u) return p;
          return {
            ...p,
            itemNumber: u.itemNumber ?? p.itemNumber,
            performanceOrder:
              u.performanceOrder ?? u.displayOrder ?? p.performanceOrder,
          };
        });
        merged.sort((a, b) => {
          if (a.performanceOrder && b.performanceOrder) {
            return a.performanceOrder - b.performanceOrder;
          }
          if (a.itemNumber && b.itemNumber) return a.itemNumber - b.itemNumber;
          if (a.itemNumber && !b.itemNumber) return -1;
          if (!a.itemNumber && b.itemNumber) return 1;
          return a.title.localeCompare(b.title);
        });
        return merged;
      });
    };

    const onEntryCreated = (data: { eventId: string }) => {
      if (data.eventId === eventId) {
        loadEventData();
      }
    };

    const onEntryUpdated = (data: { eventId: string }) => {
      if (data.eventId === eventId) {
        loadEventData();
      }
    };

    socket.on('performance:status', onPerformanceStatus);
    socket.on('performance:reorder', onPerformanceReorder);
    socket.on('entry:created', onEntryCreated);
    socket.on('entry:updated', onEntryUpdated);

    return () => {
      socket.off('performance:status', onPerformanceStatus);
      socket.off('performance:reorder', onPerformanceReorder);
      socket.off('entry:created', onEntryCreated);
      socket.off('entry:updated', onEntryUpdated);
    };
  }, [socket.connected, eventId]);

  const [searchTerm, setSearchTerm] = useState('');

  const loadEventData = async () => {
    setIsLoading(true);
    try {
      // Load event details
      const eventRes = await fetch(`/api/events/${eventId}`);
      const eventData = await eventRes.json();

      if (eventData.success) {
        setEvent(eventData.event);
      }

      // Load performances for this event
      const performancesRes = await fetch(`/api/events/${eventId}/performances`);
      const performancesData = await performancesRes.json();

      if (performancesData.success) {
        // Filter live only for backstage
        const liveOnly = performancesData.performances.filter(
          (p: Performance) => (p.entryType || 'live') === 'live'
        );
        // Sort by performanceOrder first, then by item number for initial display
        const sortedPerformances = liveOnly.sort(
          (a: Performance, b: Performance) => {
            // If both have performanceOrder, use that
            if (a.performanceOrder && b.performanceOrder) {
              return a.performanceOrder - b.performanceOrder;
            }
            // Fall back to item number ordering
            if (a.itemNumber && b.itemNumber) {
              return a.itemNumber - b.itemNumber;
            } else if (a.itemNumber && !b.itemNumber) {
              return -1;
            } else if (!a.itemNumber && b.itemNumber) {
              return 1;
            }
            return a.title.localeCompare(b.title);
          }
        );

        // Set initial performanceOrder if not already set
        const performancesWithOrder = sortedPerformances.map(
          (performance: Performance, index: number) => ({
            ...performance,
            performanceOrder: performance.performanceOrder || index + 1,
          })
        );

        setPerformances(performancesWithOrder);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMusicCue = async (
    performanceId: string,
    cue: 'onstage' | 'offstage'
  ) => {
    try {
      const res = await fetch(`/api/performances/${performanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicCue: cue }),
      });
      if (res.ok) {
        setPerformances((prev) =>
          prev.map((p) => (p.id === performanceId ? { ...p, musicCue: cue } : p))
        );
        // Broadcast to other dashboards
        socket.emit('performance:music_cue', {
          eventId,
          performanceId,
          musicCue: cue,
          timestamp: new Date().toISOString(),
        });
        success(`Music cue set to ${cue}`);
      } else {
        error('Failed to update music cue');
      }
    } catch (e) {
      console.error('Error updating music cue:', e);
      error('Failed to update music cue');
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = performances.findIndex((p) => p.id === active.id);
    const newIndex = performances.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const draggedPerformance = performances[oldIndex];

    console.log(
      ` REORDERING: Moving "${draggedPerformance.title}" from position ${oldIndex + 1} to ${newIndex + 1}`
    );

    const previousPerformances = performances;

    // Reorder performances array
    const reorderedPerformances = arrayMove(performances, oldIndex, newIndex);

    // GABRIEL'S REQUIREMENT: Lock item numbers, only update performance order
    const updatedPerformances = reorderedPerformances.map(
      (performance, index) => ({
        ...performance,
        // itemNumber stays UNCHANGED - locked for judges
        performanceOrder: index + 1, // Only update the performance sequence
      })
    );

    // Update local state immediately for instant visual feedback
    setPerformances(updatedPerformances);

    // Broadcast immediately so all dashboards update without waiting on persistence
    socket.emit(
      'performance:reorder',
      buildPerformanceReorderSocketPayload(eventId, updatedPerformances)
    );

    // Show immediate feedback - Gabriel's requirement
    const oldOrder = oldIndex + 1;
    const newOrder = newIndex + 1;

    success(
      ` Moved Item #${draggedPerformance.itemNumber} from position ${oldOrder}  position ${newOrder}`
    );

    try {
      // Send reorder to server
      const response = await fetch('/api/admin/reorder-performances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          performances: updatedPerformances.map((p) => ({
            id: p.id,
            itemNumber: p.itemNumber, // Keep original item number (locked)
            performanceOrder: p.performanceOrder, // Send new performance order
          })),
        }),
      });

      if (response.ok) {
        console.log('🔄 Reorder persisted; clients already updated via socket');
        setTimeout(() => {
          success(' Order synchronized across all dashboards!');
        }, 1000);
      } else {
        setPerformances(previousPerformances);
        socket.emit(
          'performance:reorder',
          buildPerformanceReorderSocketPayload(eventId, previousPerformances)
        );
        error(' Failed to save new order - reverted to original');
      }
    } catch (err) {
      console.error('Error reordering performances:', err);
      setPerformances(previousPerformances);
      socket.emit(
        'performance:reorder',
        buildPerformanceReorderSocketPayload(eventId, previousPerformances)
      );
      error(' Network error - reverted to original order');
    }
  };

  const visiblePerformances = performances.filter((p) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.contestantName.toLowerCase().includes(q) ||
      p.participantNames.some((name) => name.toLowerCase().includes(q)) ||
      (p.itemNumber && p.itemNumber.toString().includes(searchTerm))
    );
  });

  const updatePerformanceStatus = async (
    performanceId: string,
    status: Performance['status']
  ) => {
    // Backstage "Complete" is local only - doesn't update server or broadcast
    if (status === 'completed') {
      // Update local state only for backstage view
      setPerformances((prev) =>
        prev.map((p) => (p.id === performanceId ? { ...p, status } : p))
      );
      success('Performance marked as complete (backstage view only)');
      return;
    }

    try {
      const response = await fetch(`/api/performances/${performanceId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        // Update local state
        setPerformances((prev) =>
          prev.map((p) => (p.id === performanceId ? { ...p, status } : p))
        );

        // Broadcast status change
        socket.emit('performance:status', {
          performanceId,
          eventId,
          status,
          timestamp: new Date().toISOString(),
        });

        // Update current performance if needed
        if (status === 'in_progress') {
          const performance = performances.find((p) => p.id === performanceId);
          setCurrentPerformance(performance || null);
        }

        success(`Performance marked as ${status}`);
      } else {
        error('Failed to update performance status');
      }
    } catch (err) {
      console.error('Error updating performance status:', err);
      error('Failed to update performance status');
    }
  };

  const controlEvent = (action: 'start' | 'pause' | 'resume' | 'reset') => {
    socket.emit('event:control', {
      eventId,
      action,
      currentItem: currentPerformance?.itemNumber,
    });

    // Update local event status
    switch (action) {
      case 'start':
      case 'resume':
        setEventStatus('active');
        break;
      case 'pause':
        setEventStatus('paused');
        break;
      case 'reset':
        setEventStatus('waiting');
        setCurrentPerformance(null);
        break;
    }

    success(`Event ${action}ed`);
  };

  // Music player functions removed - Backstage doesn't need to play music/videos

  // Mobile reordering functions
  const movePerformanceUp = async (performanceId: string) => {
    const currentIndex = performances.findIndex((p) => p.id === performanceId);
    if (currentIndex <= 0) return;

    const newPerformances = [...performances];
    [newPerformances[currentIndex - 1], newPerformances[currentIndex]] = [
      newPerformances[currentIndex],
      newPerformances[currentIndex - 1],
    ];

    await updatePerformanceOrder(newPerformances);
  };

  const movePerformanceDown = async (performanceId: string) => {
    const currentIndex = performances.findIndex((p) => p.id === performanceId);
    if (currentIndex >= performances.length - 1) return;

    const newPerformances = [...performances];
    [newPerformances[currentIndex], newPerformances[currentIndex + 1]] = [
      newPerformances[currentIndex + 1],
      newPerformances[currentIndex],
    ];

    await updatePerformanceOrder(newPerformances);
  };

  const updatePerformanceOrder = async (
    reorderedPerformances: Performance[]
  ) => {
    const previousPerformances = performances;

    // Update performance order only (Gabriel's requirement)
    const updatedPerformances = reorderedPerformances.map(
      (performance, index) => ({
        ...performance,
        performanceOrder: index + 1,
      })
    );

    setPerformances(updatedPerformances);

    socket.emit(
      'performance:reorder',
      buildPerformanceReorderSocketPayload(eventId, updatedPerformances)
    );

    try {
      const response = await fetch('/api/admin/reorder-performances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          performances: updatedPerformances.map((p) => ({
            id: p.id,
            itemNumber: p.itemNumber,
            performanceOrder: p.performanceOrder,
          })),
        }),
      });

      if (response.ok) {
        success('Order updated');
      } else {
        setPerformances(previousPerformances);
        socket.emit(
          'performance:reorder',
          buildPerformanceReorderSocketPayload(eventId, previousPerformances)
        );
        error('Failed to save order');
      }
    } catch (err) {
      console.error('Error updating order:', err);
      setPerformances(previousPerformances);
      socket.emit(
        'performance:reorder',
        buildPerformanceReorderSocketPayload(eventId, previousPerformances)
      );
      error('Failed to update order');
    }
  };

  const inputClass = `w-full min-h-[44px] px-3 py-2.5 rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-[#e0e0e0] placeholder:text-[#8a8a8a] focus:outline-none ${themeClasses.inputFocus}`;

  if (isLoading) {
    return (
      <div
        className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}
      >
        <div className="text-center">
          <div
            className={`animate-spin rounded-full h-12 w-12 border-2 ${themeClasses.loadingSpinner} border-t-[var(--chrome-mid)] mx-auto`}
          />
          <p className={`mt-4 ${themeClasses.loadingText}`}>
            Loading backstage dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen avalon-shell ${themeClasses.mainBg} text-[#e8e8e8]`}
    >
      {/* Header */}
      <div
        className={`glass-panel border-b border-[rgba(192,192,192,0.15)] ${themeClasses.headerBg}`}
      >
        <div className="avalon-container py-4 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl glass-panel border border-[rgba(192,192,192,0.22)] flex items-center justify-center shrink-0">
                <Clapperboard
                  className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--electric-cyan)]"
                  strokeWidth={1.75}
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold chrome-text break-words">
                  Backstage Control
                </h1>
                <p className="text-sm sm:text-base text-[#c0c0c0] mt-1 break-words">
                  {event?.name} | {event?.eventDate} | {event?.venue}
                </p>
              </div>
            </div>

            {/* Event Controls */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
              <div
                className={`px-3 py-2 sm:px-4 rounded-lg font-semibold text-sm sm:text-base text-center ${
                  eventStatus === 'active'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    : eventStatus === 'paused'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                      : eventStatus === 'completed'
                        ? 'bg-[rgba(0,230,255,0.12)] text-[#00E6FF] border border-[rgba(0,230,255,0.35)]'
                        : 'bg-black/40 text-[#c0c0c0] border border-[rgba(192,192,192,0.22)]'
                }`}
              >
                {eventStatus.toUpperCase()}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {eventStatus === 'waiting' && (
                  <button
                    onClick={() => controlEvent('start')}
                    className="btn-chrome !px-4 !py-2 avalon-tap w-full sm:w-auto justify-center"
                  >
                    <Play className="w-4 h-4" />
                    Start Event
                  </button>
                )}

                {eventStatus === 'active' && (
                  <button
                    onClick={() => controlEvent('pause')}
                    className="btn-outline-chrome !px-4 !py-2 avalon-tap w-full sm:w-auto justify-center border-amber-400/50 text-amber-300"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                )}

                {eventStatus === 'paused' && (
                  <button
                    onClick={() => controlEvent('resume')}
                    className="btn-chrome !px-4 !py-2 avalon-tap w-full sm:w-auto justify-center"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                )}

                <button
                  onClick={() => controlEvent('reset')}
                  className="btn-outline-chrome !px-4 !py-2 avalon-tap w-full sm:w-auto justify-center border-red-400/40 text-red-300"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Current Performance */}
          {currentPerformance && (
            <div className="mt-4 p-4 rounded-lg glass-panel border border-[rgba(0,230,255,0.4)] bg-[rgba(0,230,255,0.08)]">
              <h3 className="font-semibold text-[#00E6FF] flex items-center gap-2 text-sm uppercase tracking-wide">
                <Clapperboard className="w-4 h-4" />
                Current Performance
              </h3>
              <p className="text-lg text-[#e8e8e8] mt-1">
                #{currentPerformance.itemNumber} - {currentPerformance.title} by{' '}
                {currentPerformance.contestantName}
              </p>
            </div>
          )}

          {/* Program Overview */}
          {performances.length > 0 && (
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                {
                  label: 'Total Items',
                  value: String(performances.length),
                  Icon: ListOrdered,
                },
                {
                  label: 'Completed',
                  value: String(
                    performances.filter((p) => p.status === 'completed').length
                  ),
                  Icon: Check,
                },
                {
                  label: 'In Progress',
                  value: String(
                    performances.filter((p) => p.status === 'in_progress').length
                  ),
                  Icon: Play,
                },
                {
                  label: 'Item Range',
                  value: `#${performances[0]?.itemNumber || 1} – #${performances[performances.length - 1]?.itemNumber || performances.length}`,
                  Icon: Clapperboard,
                },
              ].map(({ label, value, Icon }) => (
                <div
                  key={label}
                  className="glass-panel bg-black/40 border border-[rgba(192,192,192,0.22)] p-3 sm:p-4 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[rgba(192,192,192,0.1)] border border-[rgba(192,192,192,0.22)] flex items-center justify-center shrink-0">
                      <Icon
                        className="w-4 h-4 text-[var(--chrome-mid)]"
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-[#c0c0c0] truncate">
                        {label}
                      </p>
                      <p className="text-lg sm:text-2xl font-semibold text-[#e8e8e8] truncate">
                        {value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance List */}
      <div className="avalon-container avalon-section">
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold chrome-text">
              Performance Order
            </h2>
            <p className="text-sm text-[#9a9a9a] mt-1 max-w-2xl">
              <span className="lg:hidden">
                Use the{' '}
                <strong className="text-[#c0c0c0]">left grip</strong> — hold and
                drag to reorder.{' '}
                <strong className="text-[#c0c0c0]">Nudge</strong> + arrows still
                work.
              </span>
              <span className="hidden lg:inline">
                Use the{' '}
                <strong className="text-[#c0c0c0]">grip column</strong> on the
                left to drag. Item numbers stay locked; only performance order
                changes.
              </span>
            </p>
          </div>
          <div className="w-full lg:w-auto lg:text-right shrink-0 space-y-2">
            <div className="text-[#9a9a9a] text-sm flex flex-wrap items-center gap-2 lg:justify-end">
              <span>{performances.length} performances</span>
              <span className="text-[rgba(192,192,192,0.35)]">|</span>
              <span className="inline-flex items-center gap-1.5">
                Socket:{' '}
                {socket.connected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-red-300">Disconnected</span>
                  </>
                )}
              </span>
            </div>
            <div className="text-xs text-[#6a6a6a]">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, studio, dancer, item #"
              className={`${inputClass} lg:w-72`}
            />
          </div>
        </div>

        {/* Quick Test Instructions */}
        {performances.length === 0 && (
          <div className="glass-panel border border-amber-500/40 bg-amber-500/10 rounded-lg p-6 mb-6">
            <h3 className="text-amber-300 font-semibold mb-2 flex items-center gap-2">
              <ListOrdered className="w-4 h-4" />
              Testing Drag & Drop
            </h3>
            <p className="text-[#c0c0c0] text-sm">
              No performances found for this event. To test the drag-and-drop
              reordering:
            </p>
            <ol className="text-[#c0c0c0] text-sm mt-2 space-y-1">
              <li>1. Go to the admin dashboard and create some event entries</li>
              <li>2. Return here to see them listed with item numbers</li>
              <li>3. Drag anywhere on a card to reorder them</li>
              <li>
                4. Watch performance order update in real-time (item numbers
                stay locked)!
              </li>
            </ol>
          </div>
        )}

        {performances.length > 0 && (
          <div className="glass-panel border border-[rgba(0,230,255,0.25)] bg-[rgba(0,230,255,0.06)] rounded-lg p-4 mb-6">
            <p className="text-[#c0c0c0] text-sm">
              <span className="font-semibold text-[#00E6FF]">How to use:</span>{' '}
              Hold the <strong className="text-[#e8e8e8]">left grip</strong> and
              drag to reorder — works on phones, tablets, and desktop. Nudge +
              arrows is optional. Item numbers stay locked; order syncs live to
              all dashboards.
            </p>
            <p className="text-[#c0c0c0] text-sm mt-2">
              <span className="font-semibold text-[#00E6FF]">
                Backstage Control:
              </span>{' '}
              Use On-stage/Off-stage toggles and status buttons (Start, Pause,
              Complete) to manage performances.
            </p>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={performances.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {visiblePerformances.map((performance) => (
                <SortablePerformanceItem
                  key={performance.id}
                  performance={performance}
                  updatePerformanceStatus={updatePerformanceStatus}
                  onUpdateMusicCue={updateMusicCue}
                  selectedForMove={selectedForMove}
                  movePerformanceUp={movePerformanceUp}
                  movePerformanceDown={movePerformanceDown}
                  setSelectedForMove={setSelectedForMove}
                  performances={performances}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      {/* Music player removed - not needed on Backstage dashboard */}
    </div>
  );
}

export default function BackstageDashboardWrapper() {
  return (
    <ThemeProvider>
      <BackstageDashboard />
    </ThemeProvider>
  );
}
