'use client';

import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';

/** Second argument is optional; sound desk uses `eventId` to match the selected event */
export type PerformanceReorderMeta = { eventId?: string };

interface RealtimeUpdatesProps {
 eventId: string;
 role?: 'judge' | 'sound' | 'backstage' | 'announcer' | 'registration' | 'media' | 'general';
 strictEvent?: boolean; // if true, ignore events from other eventIds even during initial load
 onPerformanceReorder?: (performances: any[], meta?: PerformanceReorderMeta) => void;
 onPerformanceStatus?: (data: any) => void;
 onPerformanceAnnounced?: (data: any) => void;
 onPerformanceMusicCue?: (data: { performanceId: string; musicCue: 'onstage' | 'offstage'; eventId?: string }) => void;
 onEventControl?: (data: any) => void;
 onPresenceUpdate?: (data: any) => void;
 onMusicUpdated?: (data: { entryId: string; musicFileUrl?: string; musicFileName?: string; eventId?: string }) => void;
 onVideoUpdated?: (data: { entryId: string; videoExternalUrl?: string; eventId?: string }) => void;
 children?: React.ReactNode;
}

export default function RealtimeUpdates({
 eventId,
 role = 'general',
 strictEvent = false,
 onPerformanceReorder,
 onPerformanceStatus,
 onPerformanceAnnounced,
 onPerformanceMusicCue,
 onEventControl,
 onPresenceUpdate,
 onMusicUpdated,
 onVideoUpdated,
 children
}: RealtimeUpdatesProps) {
 const [notifications, setNotifications] = useState<string[]>([]);

 const callbacksRef = useRef({
 onPerformanceReorder,
 onPerformanceStatus,
 onPerformanceAnnounced,
 onPerformanceMusicCue,
 onEventControl,
 onPresenceUpdate,
 onMusicUpdated,
 onVideoUpdated,
 });
 callbacksRef.current = {
 onPerformanceReorder,
 onPerformanceStatus,
 onPerformanceAnnounced,
 onPerformanceMusicCue,
 onEventControl,
 onPresenceUpdate,
 onMusicUpdated,
 onVideoUpdated,
 };

 // Join event room and wire listeners using the unified socket hook
 const socket = useSocket({ eventId, role });

 useEffect(() => {
 if (!socket.connected) return;

 // If strictEvent is true but eventId is empty (e.g., "All"), treat as wildcard
 const withinScope = (data: any) => (!strictEvent || !eventId) || (data?.eventId === eventId);

 const pushNotification = (message: string) => {
 setNotifications((prev) => [...prev.slice(-4), message]);
 setTimeout(() => {
 setNotifications((prev) => prev.slice(1));
 }, 5000);
 };

 const handleReorder = (data: any) => {
 const cb = callbacksRef.current.onPerformanceReorder;
 if (withinScope(data) && cb && data?.performances) {
 cb(data.performances, { eventId: data.eventId });
 pushNotification('🔄 Performance order updated');
 }
 };

 const handleStatus = (data: any) => {
 const cb = callbacksRef.current.onPerformanceStatus;
 if (withinScope(data) && cb) {
 cb(data);
 pushNotification(` Performance status: ${data.status}`);
 }
 };

 const handleAnnounced = (data: any) => {
 const cb = callbacksRef.current.onPerformanceAnnounced;
 if (withinScope(data) && cb) {
 cb(data);
 pushNotification(`📢 Performance announced`);
 }
 };

 const handleMusicCue = (data: any) => {
 const cb = callbacksRef.current.onPerformanceMusicCue;
 if (withinScope(data) && cb) {
 cb(data);
 pushNotification(` Music cue: ${data.musicCue}`);
 }
 };

 const handleEventControl = (data: any) => {
 const cb = callbacksRef.current.onEventControl;
 if ((!eventId || data.eventId === eventId) && cb) {
 cb(data);
 pushNotification(` Event ${data.action}ed`);
 }
 };

 const handleNotification = (data: any) => {
 if (!strictEvent && (!data.eventId || !eventId || data.eventId === eventId)) {
 pushNotification(data.message);
 }
 };

 const handlePresence = (data: any) => {
 const cb = callbacksRef.current.onPresenceUpdate;
 if (withinScope(data) && cb) {
 cb(data);
 pushNotification(` Presence: ${data.present ? 'Present' : 'Absent'}`);
 }
 };

 const handleMusicUpdated = (data: any) => {
 const cb = callbacksRef.current.onMusicUpdated;
 if ((!eventId || data.eventId === eventId) && cb) {
 cb(data);
 pushNotification(' Music file updated');
 }
 };

 const handleVideoUpdated = (data: any) => {
 const cb = callbacksRef.current.onVideoUpdated;
 if ((!eventId || data.eventId === eventId) && cb) {
 cb(data);
 pushNotification(' Video link updated');
 }
 };

 socket.on('performance:reorder' as any, handleReorder as any);
 socket.on('performance:status' as any, handleStatus as any);
 socket.on('performance:announced' as any, handleAnnounced as any);
 socket.on('performance:music_cue' as any, handleMusicCue as any);
 socket.on('event:control' as any, handleEventControl as any);
 socket.on('notification' as any, handleNotification as any);
 socket.on('presence:update' as any, handlePresence as any);
 socket.on('entry:music_updated' as any, handleMusicUpdated as any);
 socket.on('entry:video_updated' as any, handleVideoUpdated as any);

 return () => {
 socket.off('performance:reorder' as any, handleReorder as any);
 socket.off('performance:status' as any, handleStatus as any);
 socket.off('performance:announced' as any, handleAnnounced as any);
 socket.off('performance:music_cue' as any, handleMusicCue as any);
 socket.off('event:control' as any, handleEventControl as any);
 socket.off('notification' as any, handleNotification as any);
 socket.off('presence:update' as any, handlePresence as any);
 socket.off('entry:music_updated' as any, handleMusicUpdated as any);
 socket.off('entry:video_updated' as any, handleVideoUpdated as any);
 };
 }, [socket.connected, eventId, strictEvent, role]);

 // Heartbeat quick sync: every 15s and on window focus, trigger a lightweight refresh via custom event
 useEffect(() => {
 const heartbeat = setInterval(() => {
 try {
 const { socketClient } = require('@/lib/socket-client');
 socketClient.emit('notification' as any, { type: 'info', message: 'heartbeat', eventId });
 } catch {}
 }, 15000);

 const onFocus = () => {
 try {
 const { socketClient } = require('@/lib/socket-client');
 socketClient.emit('notification' as any, { type: 'info', message: 'focus-refresh', eventId });
 } catch {}
 };
 if (typeof window !== 'undefined') {
 window.addEventListener('focus', onFocus);
 }
 return () => {
 clearInterval(heartbeat);
 if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus);
 };
 }, [eventId]);

 return (
 <> {children}
 
 {/* Notification Toast */}
 {notifications.length > 0 && (
 <div className="fixed top-4 right-4 z-50 space-y-2"> {notifications.map((notification, index) => (
 <div
 key={index}
 className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in" >
 {notification}
 </div> ))}
 </div> )}
 
 <style jsx>{`
 @keyframes fadeIn {
 from { opacity: 0; transform: translateY(-10px); }
 to { opacity: 1; transform: translateY(0); }
 }
 
 .animate-fade-in {
 animation: fadeIn 0.3s ease-out;
 }
 `}</style>
 </> );
}
