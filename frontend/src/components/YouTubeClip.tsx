import { useEffect, useRef, useState } from "react";
import "./youtube-clip.css";

/* One YouTube player per place on the page. Switching words calls
 * loadVideoById on the same player instead of building a new iframe (which
 * re-downloads the whole player each time). A thumbnail covers the frame
 * until the video really plays, so there is no black square while loading. */

type YTPlayer = {
  loadVideoById: (o: { videoId: string; startSeconds?: number; endSeconds?: number }) => void;
  seekTo: (s: number, allow: boolean) => void;
  playVideo: () => void;
  mute: () => void;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (el: HTMLElement, o: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let api: Promise<YTNamespace> | null = null;
/** Loads the official IFrame API once (also warms the connection early). */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  api ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return api;
}

export function YouTubeClip({
  id,
  start,
  end,
  loop = true,
  replay = 0,
  className = "",
  title = "sign",
}: {
  id: string;
  start?: number;
  end?: number;
  loop?: boolean;
  /** Bump to play the same clip again from its start. */
  replay?: number;
  className?: string;
  title?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  const clip = useRef({ id, start, end, loop });
  const [playing, setPlaying] = useState(false);
  clip.current = { id, start, end, loop };

  // Build the player once.
  useEffect(() => {
    let alive = true;
    loadYouTubeApi().then((YT) => {
      if (!alive || !host.current) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      const c = clip.current;
      player.current = new YT.Player(el, {
        host: "https://www.youtube-nocookie.com",
        videoId: c.id,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          mute: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          controls: 1,
          enablejsapi: 1,
          // Without the page origin the player cannot post its events back.
          origin: window.location.origin,
          ...(c.start !== undefined ? { start: Math.floor(c.start) } : {}),
          ...(c.end !== undefined ? { end: Math.ceil(c.end) } : {}),
        },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            ready.current = true;
            e.target.mute();
            // The word may have changed while the player was loading.
            const now = clip.current;
            if (now.id !== c.id || now.start !== c.start)
              e.target.loadVideoById({ videoId: now.id, startSeconds: now.start, endSeconds: now.end });
            else e.target.playVideo();
          },
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
            if (e.data === YT.PlayerState.ENDED && clip.current.loop) {
              e.target.seekTo(clip.current.start ?? 0, true);
              e.target.playVideo();
            }
          },
        },
      });
    });
    return () => {
      alive = false;
      player.current?.destroy();
      player.current = null;
      ready.current = false;
    };
  }, []);

  // Switch clips on the same player.
  useEffect(() => {
    setPlaying(false);
    if (!ready.current || !player.current) return;
    player.current.loadVideoById({ videoId: id, startSeconds: start, endSeconds: end });
  }, [id, start, end, replay]);

  return (
    <div className={`yt-clip ${className}`} title={title}>
      <div ref={host} className="yt-clip-host" />
      <img
        className={`yt-clip-poster${playing ? " is-hidden" : ""}`}
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        aria-hidden="true"
      />
      {!playing && <span className="yt-clip-spinner" aria-hidden="true" />}
    </div>
  );
}
