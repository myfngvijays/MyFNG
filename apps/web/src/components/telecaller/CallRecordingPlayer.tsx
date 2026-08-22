'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Play, Pause, X, Loader2, Volume2, VolumeX, Download } from 'lucide-react';

/** Manager / admin panels may download; telecaller CRM path may only play. */
function pathAllowsRecordingDownload(pathname: string | null | undefined): boolean {
  const p = String(pathname || '');
  return (
    p.includes('/lead_manager') ||
    p.includes('/super_admin') ||
    p.includes('/sub_admin')
  );
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

function formatDurationSeconds(raw: unknown): string | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  const total = Math.round(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatClock(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const t = Math.floor(secs);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatCallLogDuration(seconds: unknown): string {
  return formatDurationSeconds(seconds) || '—';
}

/**
 * Compact recording control for CRM timelines.
 * Closed = purple Play chip. Open = full-width seek bar (parent should stack it below meta).
 */
export default function CallRecordingPlayer({
  callLogId,
  hasRecording,
  durationSeconds,
  open: openProp,
  onOpenChange,
  allowDownload: allowDownloadProp,
}: {
  callLogId: string;
  hasRecording?: boolean;
  /** @deprecated kept for callers; open player is always full-width */
  compact?: boolean;
  durationSeconds?: number | null;
  /** Controlled open state (optional) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Explicit override; default = manager/admin paths only (not telecaller). */
  allowDownload?: boolean;
}) {
  const pathname = usePathname();
  const allowDownload =
    allowDownloadProp !== undefined
      ? allowDownloadProp
      : pathAllowsRecordingDownload(pathname);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const speedMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!speedOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!speedMenuRef.current?.contains(e.target as Node)) setSpeedOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [speedOpen]);

  useEffect(() => {
    if (!open || !callLogId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setCurrent(0);
    setDuration(Number(durationSeconds) > 0 ? Number(durationSeconds) : 0);

    (async () => {
      try {
        const res = await fetch(`/api/telecaller/calls/recording/${callLogId}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'audio/*,*/*' },
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error || `Play failed (${res.status})`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Recording load failed');
          setBlobUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, callLogId, durationSeconds]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !blobUrl) return;
    el.volume = muted ? 0 : volume;
  }, [volume, muted, blobUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !blobUrl) return;
    el.playbackRate = speed;
  }, [speed, blobUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !blobUrl) return;
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [blobUrl]);

  if (!hasRecording || !callLogId) return null;

  const knownLabel = formatDurationSeconds(durationSeconds);
  const maxDur = Math.max(duration || Number(durationSeconds) || 0, 0.1);

  const closePlayer = () => {
    try {
      audioRef.current?.pause();
    } catch {
      /* ignore */
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
    setError(null);
    setPlaying(false);
    setCurrent(0);
    setSpeed(1);
    setSpeedOpen(false);
    setOpen(false);
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const onSeek = (value: number) => {
    const el = audioRef.current;
    const next = Math.max(0, Math.min(value, maxDur));
    setCurrent(next);
    if (el && Number.isFinite(next)) {
      try {
        el.currentTime = next;
      } catch {
        /* ignore */
      }
    }
  };

  const downloadRecording = async () => {
    try {
      let url = blobUrl;
      let revokeAfter = false;
      if (!url) {
        const res = await fetch(`/api/telecaller/calls/recording/${callLogId}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'audio/*,*/*' },
        });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        revokeAfter = true;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-recording-${callLogId.slice(0, 8)}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (revokeAfter) URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Download failed');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-violet-600 px-3 text-[11px] font-bold text-white shadow-sm hover:bg-violet-700"
        title={knownLabel ? `Play · ${knownLabel}` : 'Play recording'}
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        Play
        {knownLabel ? <span className="font-semibold text-violet-100">{knownLabel}</span> : null}
      </button>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <div className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2">
        {loading && !blobUrl ? (
          <span className="inline-flex items-center gap-1 px-1 text-[10px] font-bold text-violet-800">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </span>
        ) : error ? (
          <span className="truncate px-1 text-[10px] font-medium text-rose-600" title={error}>
            {error}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={togglePlay}
              disabled={!blobUrl}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <Pause className="h-3 w-3 fill-current" />
              ) : (
                <Play className="h-3 w-3 fill-current" />
              )}
            </button>

            <span className="shrink-0 whitespace-nowrap tabular-nums text-[10px] font-semibold text-violet-900">
              {formatClock(current)}/{formatClock(duration || Number(durationSeconds) || 0)}
            </span>

            <input
              type="range"
              min={0}
              max={maxDur}
              step={0.1}
              value={Math.min(current, maxDur)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-violet-600"
              aria-label="Seek"
              title="Seek"
            />

            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-violet-800 hover:bg-violet-100"
              aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (v > 0) setMuted(false);
              }}
              className="hidden h-1.5 w-12 shrink-0 cursor-pointer accent-violet-600 sm:block"
              aria-label="Volume"
              title="Volume"
            />

            <div className="relative shrink-0" ref={speedMenuRef}>
              <button
                type="button"
                onClick={() => setSpeedOpen((o) => !o)}
                className="inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded bg-violet-100 px-1.5 text-[10px] font-bold text-violet-900 hover:bg-violet-200"
                title="Playback speed"
                aria-label={`Speed ${speed}x`}
                aria-expanded={speedOpen}
                aria-haspopup="listbox"
              >
                {speed}x
              </button>
              {speedOpen ? (
                <div
                  role="listbox"
                  className="absolute right-0 bottom-full z-50 mb-1 min-w-[4.5rem] overflow-hidden rounded-lg border border-violet-200 bg-white py-1 shadow-lg"
                >
                  {SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="option"
                      aria-selected={speed === opt}
                      onClick={() => {
                        setSpeed(opt);
                        setSpeedOpen(false);
                      }}
                      className={`block w-full px-3 py-1.5 text-left text-[11px] font-semibold ${
                        speed === opt
                          ? 'bg-violet-50 text-violet-900'
                          : 'text-slate-700 hover:bg-violet-50'
                      }`}
                    >
                      {opt}x
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {allowDownload ? (
              <button
                type="button"
                onClick={() => void downloadRecording()}
                disabled={loading && !blobUrl}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-violet-800 hover:bg-violet-100 disabled:opacity-40"
                title="Download recording"
                aria-label="Download recording"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </>
        )}

        {blobUrl ? (
          <audio
            ref={audioRef}
            src={blobUrl}
            preload="auto"
            className="hidden"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setDuration(d);
              e.currentTarget.playbackRate = speed;
            }}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setCurrent(0);
            }}
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={closePlayer}
        className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-violet-700 hover:bg-violet-100"
        aria-label="Close player"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Timeline call card shell: meta row + Play on the right; expanded player full-width below.
 */
export function CallRecordingCardRow({
  callLogId,
  hasRecording,
  durationSeconds,
  allowDownload,
  children,
}: {
  callLogId: string;
  hasRecording?: boolean;
  durationSeconds?: number | null;
  /** Passed through to player; omit for path-based default (LM/admin only). */
  allowDownload?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-violet-100 bg-white px-2.5 py-2 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-[12rem]">{children}</div>
        {hasRecording && !open ? (
          <CallRecordingPlayer
            callLogId={callLogId}
            hasRecording
            durationSeconds={durationSeconds}
            allowDownload={allowDownload}
            open={false}
            onOpenChange={setOpen}
          />
        ) : null}
      </div>
      {hasRecording && open ? (
        <CallRecordingPlayer
          callLogId={callLogId}
          hasRecording
          durationSeconds={durationSeconds}
          allowDownload={allowDownload}
          open
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}
