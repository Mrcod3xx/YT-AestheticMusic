import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Disc,
  ListPlus,
  ListStart,
  Loader2,
  Play,
  Shuffle,
  X,
} from 'lucide-react';
import {
  BrowseDetailsData,
  BrowseTarget,
  BrowseTrackItem,
  TrackMetadata,
} from '../../../shared/types';

interface BrowseDetailsModalProps {
  target: BrowseTarget | null;
  details: BrowseDetailsData | null;
  loading: boolean;
  error: string | null;
  activeTrack: TrackMetadata;
  borderRadius: number;
  onClose: () => void;
  onRetry: () => void;
  onPlayCollection: (shuffle: boolean) => void;
  onPlayTrack: (track: BrowseTrackItem) => void;
  onQueueTrack: (track: BrowseTrackItem, playNext: boolean) => Promise<boolean>;
}

function normalizeMatchText(val?: string): string {
  return (val || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/gi, ' ')
    .trim();
}

export const BrowseDetailsModal: React.FC<BrowseDetailsModalProps> = ({
  target,
  details,
  loading,
  error,
  activeTrack,
  borderRadius,
  onClose,
  onRetry,
  onPlayCollection,
  onPlayTrack,
  onQueueTrack,
}) => {
  const [queuedFeedback, setQueuedFeedback] = useState<
    Record<string, 'queue' | 'next'>
  >({});
  const feedbackTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const timers = feedbackTimersRef.current;
    return () => {
      Object.values(timers).forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (!target) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [target, onClose]);

  if (!target) return null;

  const kind = details?.kind || target.kind || 'Artist';
  const title = details?.title || target.previewTitle || 'Loading...';
  const artworkUrl = details?.artworkUrl || target.previewArtworkUrl || '';
  const summaryText =
    details?.description || details?.subtitle || target.previewSubtitle || '';
  const tracks = details?.tracks || [];
  const tracksHeading =
    details?.tracksHeading ||
    (kind === 'Artist'
      ? 'Top Songs'
      : kind === 'Playlist'
      ? 'Playlist Tracks'
      : 'Tracks');

  const activeTitleNorm = normalizeMatchText(activeTrack.title);
  const canStartPlayback = Boolean(
    details?.playEndpoint ||
      details?.shuffleEndpoint ||
      details?.playlistId ||
      tracks.length > 0
  );

  const handleQueueClick = async (
    e: React.MouseEvent,
    track: BrowseTrackItem,
    playNext: boolean
  ) => {
    e.stopPropagation();
    const ok = await onQueueTrack(track, playNext);
    if (ok) {
      if (feedbackTimersRef.current[track.id]) {
        window.clearTimeout(feedbackTimersRef.current[track.id]);
      }
      setQueuedFeedback((prev) => ({
        ...prev,
        [track.id]: playNext ? 'next' : 'queue',
      }));
      feedbackTimersRef.current[track.id] = window.setTimeout(() => {
        setQueuedFeedback((prev) => {
          const next = { ...prev };
          delete next[track.id];
          return next;
        });
      }, 1800);
    }
  };

  const modalRadius = `${Math.min(30, borderRadius + 4)}px`;

  return (
    <div
      className="relative z-30 w-[min(810px,88vw)] h-[min(435px,54vh)] min-h-[320px] pointer-events-auto flex flex-col overflow-hidden transition-all duration-300"
      style={{
        borderRadius: modalRadius,
        background:
          'linear-gradient(145deg, rgba(var(--aesthetic-panel-rgb, 28, 24, 21), max(0.82, var(--aesthetic-panel-alpha, 0.84))) 0%, rgba(16, 15, 16, 0.90) 100%)',
        backdropFilter: 'blur(36px) saturate(155%)',
        WebkitBackdropFilter: 'blur(36px) saturate(155%)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        boxShadow:
          '0 34px 90px rgba(0, 0, 0, 0.82), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
      }}
    >
      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        title="Return to search results (Esc)"
        aria-label="Close details"
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.18] text-zinc-300 hover:text-white border border-white/10 transition cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 p-6">
        {/* Left Column: Entity Artwork, Info & Play / Shuffle */}
        <div className="w-full md:w-[238px] shrink-0 flex md:flex-col items-center md:items-start gap-4 md:gap-0">
          <div
            className="w-[116px] h-[116px] md:w-[218px] md:h-[218px] rounded-2xl overflow-hidden bg-zinc-900/90 border border-white/12 shadow-2xl shrink-0"
            style={{ borderRadius: `${Math.max(14, borderRadius - 2)}px` }}
          >
            {artworkUrl ? (
              <img
                src={artworkUrl}
                alt={title}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <Disc className="w-10 h-10" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 md:w-full md:mt-3.5">
            <h2 className="text-[20px] md:text-[22px] font-bold text-white leading-tight truncate">
              {title}
            </h2>
            {summaryText ? (
              <p className="text-[12px] text-zinc-300/80 mt-1 line-clamp-2 leading-relaxed">
                {summaryText}
              </p>
            ) : (
              <p className="text-[12px] text-zinc-400 mt-1">{kind}</p>
            )}

            {/* Primary Play & Shuffle Actions */}
            <div className="flex items-center gap-2.5 mt-4">
              <button
                type="button"
                disabled={!canStartPlayback}
                onClick={() => onPlayCollection(false)}
                className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-45 text-zinc-950 text-[14px] font-semibold flex items-center gap-2 shadow-lg transition cursor-pointer disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-zinc-950" />
                <span>Play</span>
              </button>

              <button
                type="button"
                disabled={!canStartPlayback}
                onClick={() => onPlayCollection(true)}
                className="px-5 py-2.5 rounded-full bg-white/[0.12] hover:bg-white/[0.2] disabled:opacity-45 text-white border border-white/15 text-[14px] font-medium flex items-center gap-2 transition cursor-pointer disabled:cursor-not-allowed"
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Top Songs / Album Tracks / Playlist Tracks */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex items-center justify-between pr-12 pb-2.5">
            <div className="flex items-center gap-2.5">
              <h3 className="text-[15px] font-semibold text-white/95 tracking-tight">
                {tracksHeading}
              </h3>
              {loading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--aesthetic-accent,#E89B63)]" />
              )}
            </div>
            {!loading && tracks.length > 0 && (
              <span className="text-[11px] text-zinc-400">
                {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 space-y-1 custom-queue-scroll">
            {loading && tracks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2.5 text-zinc-300/80 py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--aesthetic-accent,#E89B63)]" />
                <span className="text-[13px]">Loading {kind.toLowerCase()} details...</span>
              </div>
            ) : error && tracks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-10 px-4">
                <p className="text-[13px] text-zinc-300/85">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-5 py-2.5 rounded-full bg-white/[0.12] hover:bg-white/[0.2] border border-white/15 text-[13px] font-medium text-white transition cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : tracks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px] text-zinc-400 py-10">
                No tracks found for this {kind.toLowerCase()}.
              </div>
            ) : (
              tracks.map((track) => {
                const isActive =
                  track.videoId && activeTrack.videoId
                    ? track.videoId === activeTrack.videoId
                    : Boolean(
                        activeTitleNorm &&
                          normalizeMatchText(track.title) === activeTitleNorm &&
                          (!track.artist ||
                            !activeTrack.artist ||
                            normalizeMatchText(activeTrack.artist).includes(
                              normalizeMatchText(track.artist)
                            ) ||
                            normalizeMatchText(track.artist).includes(
                              normalizeMatchText(activeTrack.artist)
                            ))
                      );
                const feedback = queuedFeedback[track.id];

                return (
                  <div
                    key={track.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPlayTrack(track)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPlayTrack(track);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl transition cursor-pointer group ${
                      isActive
                        ? 'bg-gradient-to-r from-[#dcd3c8]/95 to-[#9c8c7c]/85 text-zinc-950 shadow-md'
                        : 'hover:bg-white/[0.08] text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border ${
                          isActive
                            ? 'border-black/15 bg-zinc-800'
                            : 'border-white/10 bg-zinc-800'
                        }`}
                      >
                        {track.artworkUrl ? (
                          <img
                            src={track.artworkUrl}
                            alt={track.title}
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500">
                            <Disc className="w-4 h-4" />
                          </div>
                        )}
                        <div
                          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                            isActive
                              ? 'bg-black/35 opacity-100'
                              : 'bg-black/45 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 text-white fill-white" />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div
                          className={`text-[13px] truncate ${
                            isActive
                              ? 'font-bold text-zinc-950'
                              : 'font-semibold text-white'
                          }`}
                        >
                          {track.title}
                        </div>
                        {track.subtitle && (
                          <div
                            className={`text-[11.5px] truncate ${
                              isActive ? 'text-zinc-800/85 font-medium' : 'text-zinc-400'
                            }`}
                          >
                            {track.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {track.videoId && (
                        <div
                          className={`flex items-center gap-1.5 transition-opacity ${
                            feedback
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleQueueClick(e, track, true)}
                            title="Play next"
                            className={`w-9 h-9 rounded-full border flex items-center justify-center transition cursor-pointer ${
                              feedback === 'next'
                                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300'
                                : isActive
                                ? 'bg-black/15 hover:bg-black/25 border-black/20 text-zinc-900'
                                : 'bg-white/[0.08] hover:bg-white/[0.18] border-white/15 text-zinc-200'
                            }`}
                          >
                            {feedback === 'next' ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <ListStart className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleQueueClick(e, track, false)}
                            title="Add to queue"
                            className={`w-9 h-9 rounded-full border flex items-center justify-center transition cursor-pointer ${
                              feedback === 'queue'
                                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300'
                                : isActive
                                ? 'bg-black/15 hover:bg-black/25 border-black/20 text-zinc-900'
                                : 'bg-white/[0.08] hover:bg-white/[0.18] border-white/15 text-zinc-200'
                            }`}
                          >
                            {feedback === 'queue' ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <ListPlus className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}

                      {track.duration && (
                        <span
                          className={`text-[12px] tabular-nums ${
                            isActive ? 'text-zinc-900 font-semibold' : 'text-zinc-400'
                          }`}
                        >
                          {track.duration}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
