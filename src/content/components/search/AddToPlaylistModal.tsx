import React, { useEffect, useState } from 'react';
import {
  Check,
  ListMusic,
  Loader2,
  Lock,
  Plus,
  Users,
  Globe,
  X,
} from 'lucide-react';
import { PlaylistMembershipOption } from '../../../shared/types';
import type { AddToPlaylistOptionsResponse } from '../../adapters/searchAdapter';

export interface PlaylistTargetTrack {
  title: string;
  artist: string;
  artworkUrl?: string;
  videoId: string;
  batchVideoIds?: string[];
}

interface AddToPlaylistModalProps {
  target: PlaylistTargetTrack | null;
  borderRadius: number;
  onClose: () => void;
  onFetchOptions: (videoId: string) => Promise<AddToPlaylistOptionsResponse>;
  onTogglePlaylist: (
    playlistId: string,
    videoId: string,
    add: boolean
  ) => Promise<{ ok: boolean; added: boolean; error?: string }>;
  onCreatePlaylist: (
    title: string,
    privacyStatus: 'PRIVATE' | 'UNLISTED' | 'PUBLIC',
    videoIdOrIds?: string | string[]
  ) => Promise<{ ok: boolean; playlistId?: string; error?: string }>;
  onNotify?: (message: string) => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  target,
  borderRadius,
  onClose,
  onFetchOptions,
  onTogglePlaylist,
  onCreatePlaylist,
  onNotify,
}) => {
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<PlaylistMembershipOption[]>([]);
  const [busyPlaylistId, setBusyPlaylistId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrivacy, setNewPrivacy] = useState<'PRIVATE' | 'UNLISTED' | 'PUBLIC'>('PRIVATE');
  const [creating, setCreating] = useState(false);

  const loadOptions = async (videoId: string) => {
    setLoading(true);
    setError(null);
    const res = await onFetchOptions(videoId);
    setLoggedIn(res.loggedIn);
    setOptions(res.options);
    if (!res.ok && res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!target?.videoId) return;
    if (target.batchVideoIds && target.batchVideoIds.length > 0) {
      setShowCreateForm(true);
      setNewTitle('');
      setOptions([]);
      setLoading(false);
      setError(null);
      setLoggedIn(true);
      return;
    }
    setShowCreateForm(false);
    setNewTitle('');
    void loadOptions(target.videoId);
  }, [target?.videoId, target?.batchVideoIds]);

  if (!target) return null;
  const isBatchMode = Boolean(target.batchVideoIds && target.batchVideoIds.length > 0);

  const handleToggleOption = async (opt: PlaylistMembershipOption) => {
    if (busyPlaylistId) return;
    const nextAdd = !opt.containsTrack;
    setBusyPlaylistId(opt.playlistId);
    setError(null);

    setOptions((prev) =>
      prev.map((item) =>
        item.playlistId === opt.playlistId
          ? { ...item, containsTrack: nextAdd }
          : item
      )
    );

    const res = await onTogglePlaylist(opt.playlistId, target.videoId, nextAdd);
    if (!res.ok) {
      setOptions((prev) =>
        prev.map((item) =>
          item.playlistId === opt.playlistId
            ? { ...item, containsTrack: opt.containsTrack }
            : item
        )
      );
      setError(res.error || 'Could not update playlist.');
    } else {
      onNotify?.(
        nextAdd
          ? `Added to "${opt.title}"`
          : `Removed from "${opt.title}"`
      );
    }
    setBusyPlaylistId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean || creating) return;

    setCreating(true);
    setError(null);
    const targetIds = isBatchMode ? target.batchVideoIds! : target.videoId;
    const res = await onCreatePlaylist(clean, newPrivacy, targetIds);
    setCreating(false);

    if (!res.ok || !res.playlistId) {
      setError(res.error || 'Failed to create playlist on YouTube Music.');
      return;
    }

    if (isBatchMode) {
      onNotify?.(`Saved ${target.batchVideoIds!.length} queue songs to "${clean}"`);
      setNewTitle('');
      onClose();
      return;
    }

    onNotify?.(`Created "${clean}" & added track`);
    setNewTitle('');
    setShowCreateForm(false);
    await loadOptions(target.videoId);
  };

  const stopInputKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  const renderPrivacyBadge = (privacy?: string) => {
    if (privacy === 'PUBLIC') return <Globe className="w-3 h-3 text-zinc-400" />;
    if (privacy === 'UNLISTED') return <Users className="w-3 h-3 text-zinc-400" />;
    if (privacy === 'PRIVATE') return <Lock className="w-3 h-3 text-zinc-400" />;
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 pointer-events-auto"
      style={{
        backgroundColor: 'rgba(5, 6, 10, 0.72)',
        backdropFilter: 'blur(14px)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save to YouTube Music playlist"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] max-h-[78vh] flex flex-col overflow-hidden text-zinc-100 border border-white/15 shadow-2xl"
        style={{
          borderRadius: `${Math.min(28, borderRadius + 4)}px`,
          background:
            'rgba(var(--aesthetic-panel-rgb, 18, 19, 25), max(0.88, var(--aesthetic-panel-alpha, 0.92)))',
          backdropFilter: 'blur(34px) saturate(165%)',
          WebkitBackdropFilter: 'blur(34px) saturate(165%)',
        }}
      >
        {/* Header with track card */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            {target.artworkUrl ? (
              <img
                src={target.artworkUrl}
                alt={target.title}
                className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/15 shadow"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <ListMusic className="w-5 h-5 text-zinc-300" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--aesthetic-accent,#E89B63)]">
                Save to Playlist
              </div>
              <div className="text-[14px] font-semibold text-white truncate">
                {target.title}
              </div>
              <div className="text-[11.5px] text-zinc-400 truncate">
                {target.artist}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Playlist Check List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-queue-scroll">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-zinc-300">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--aesthetic-accent-strong,#C28356)]" />
              <span>Loading your playlists...</span>
            </div>
          ) : isBatchMode ? (
            <div className="py-5 px-4 text-center space-y-2 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-xs text-zinc-200 font-medium">
                Save all {target.batchVideoIds!.length} songs in this queue as a new YouTube Music playlist.
              </p>
              {error && <p className="text-xs text-red-300">{error}</p>}
            </div>
          ) : !loggedIn ? (
            <div className="py-10 px-4 text-center space-y-2">
              <p className="text-sm font-medium text-zinc-200">
                Sign in on music.youtube.com to save to playlists
              </p>
              <button
                type="button"
                onClick={() => void loadOptions(target.videoId)}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : options.length === 0 ? (
            <div className="py-8 px-4 text-center space-y-2">
              <p className="text-xs text-zinc-400">
                {error || 'No playlists found yet. Create your first playlist below!'}
              </p>
            </div>
          ) : (
            options.map((opt) => {
              const busy = busyPlaylistId === opt.playlistId;
              return (
                <button
                  key={opt.playlistId}
                  type="button"
                  disabled={Boolean(busyPlaylistId)}
                  onClick={() => void handleToggleOption(opt)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border text-left transition cursor-pointer ${
                    opt.containsTrack
                      ? 'bg-white/[0.11] border-[var(--aesthetic-accent-strong,#C28356)]/60 text-white'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {opt.thumbnailUrl ? (
                      <img
                        src={opt.thumbnailUrl}
                        alt={opt.title}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <ListMusic className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {opt.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-400 mt-0.5">
                        {renderPrivacyBadge(opt.privacyStatus)}
                        <span>
                          {opt.privacyStatus
                            ? opt.privacyStatus.toLowerCase()
                            : opt.containsTrack
                            ? 'Saved in playlist'
                            : 'Click to add'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition ${
                      opt.containsTrack
                        ? 'bg-[var(--aesthetic-accent-strong,#C28356)] border-[var(--aesthetic-accent-strong,#C28356)] text-black'
                        : 'border-white/25 bg-black/30 text-transparent'
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[2.6]" />
                    )}
                  </span>
                </button>
              );
            })
          )}

          {error && options.length > 0 && (
            <p className="text-[11px] text-red-300 text-center pt-1">{error}</p>
          )}
        </div>

        {/* Footer: Inline New Playlist Creator */}
        <div className="p-3.5 border-t border-white/10 bg-black/25">
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-[12.5px] font-semibold text-white flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[var(--aesthetic-accent,#E89B63)]" />
              <span>Create New Playlist</span>
            </button>
          ) : (
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-2.5">
              <input
                type="text"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={stopInputKeys}
                onKeyUp={stopInputKeys}
                onKeyPress={stopInputKeys}
                placeholder="New playlist name..."
                maxLength={100}
                className="w-full px-3.5 py-2 rounded-xl bg-black/45 border border-white/20 text-[13px] text-white placeholder-zinc-400 outline-none focus:border-[var(--aesthetic-accent,#E89B63)] select-text"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-white/[0.05] rounded-lg p-0.5 border border-white/10">
                  {(['PRIVATE', 'UNLISTED', 'PUBLIC'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPrivacy(p)}
                      className={`px-2.5 py-1 rounded-md text-[10.5px] font-medium capitalize transition cursor-pointer ${
                        newPrivacy === p
                          ? 'bg-white/20 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {p.toLowerCase()}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (isBatchMode) {
                        onClose();
                      } else {
                        setShowCreateForm(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg text-[11.5px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newTitle.trim() || creating}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--aesthetic-accent-strong,#C28356)] text-black text-[11.5px] font-semibold disabled:opacity-45 cursor-pointer flex items-center gap-1.5"
                  >
                    {creating && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{isBatchMode ? 'Save Playlist' : 'Create'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
