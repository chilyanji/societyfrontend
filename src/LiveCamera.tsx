import {useEffect, useRef, useState} from 'react';
import {Camera, VideoOff} from 'lucide-react';

type StreamStatus = 'Connecting' | 'LIVE' | 'Reconnecting' | 'Offline';

// JPEG frames arrive within a multipart MJPEG response. Fetch rather than a
// plain <img> allows the ngrok warning bypass header to be included.
function jpegMarker(bytes: Uint8Array, a: number, b: number, from = 0): number {
  for (let i = from; i + 1 < bytes.length; i++) {
    if (bytes[i] === a && bytes[i + 1] === b) return i;
  }
  return -1;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(a.length + b.length);
  bytes.set(a);
  bytes.set(b, a.length);
  return bytes;
}

function httpMessage(code: number): string {
  if (code === 401 || code === 403) return 'Sign in or request camera permission';
  if (code === 404) return 'Live API/camera not found (check backend and proxy)';
  if (code === 409) return 'Camera is disabled';
  if (code === 502 || code === 503 || code === 504) return 'Camera backend or proxy unavailable';
  return `Unable to connect (HTTP ${code})`;
}

/** Continuous MJPEG live playback, not periodic snapshot polling. */
export function LiveCamera({cameraId, name}: {cameraId: string; name: string}) {
  const [status, setStatus] = useState<StreamStatus>('Connecting');
  const [message, setMessage] = useState('Connecting to live camera…');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let activeController: AbortController | null = null;
    setImageUrl(null);
    setStatus('Connecting');
    setMessage('Connecting to live camera…');

    function clearFrame() {
      const previous = imageRef.current;
      imageRef.current = null;
      setImageUrl(null);
      if (previous) URL.revokeObjectURL(previous);
    }

    async function connect() {
      while (!disposed) {
        const controller = new AbortController();
        activeController = controller;
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        let receivedFrame = false;
        const resetWatchdog = () => {
          if (watchdog !== undefined) clearTimeout(watchdog);
          // The backend ends streams after 8 seconds without new frames.
          // This catches stalled intermediate proxies, too.
          watchdog = setTimeout(() => controller.abort(), 14000);
        };
        try {
          setStatus('Connecting');
          resetWatchdog();
          const response = await fetch(`/api/cameras/${encodeURIComponent(cameraId)}/live`, {
            credentials: 'same-origin',
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
            headers: {
              Accept: 'multipart/x-mixed-replace',
              'ngrok-skip-browser-warning': '1',
            },
          });

          if (!response.ok) throw new Error(httpMessage(response.status));
          if (!(response.headers.get('content-type') || '').includes('multipart/x-mixed-replace') || !response.body) {
            throw new Error('Expected MJPEG, received a different response');
          }

          const reader = response.body.getReader();
          let buffer = new Uint8Array(0);
          try {
            while (!disposed && !controller.signal.aborted) {
              const {value, done} = await reader.read();
              if (done) break;
              if (!value) continue;
              buffer = concat(buffer, value);

              for (;;) {
                const start = jpegMarker(buffer, 0xff, 0xd8);
                if (start < 0) {
                  // Bound memory if the proxy sends something unexpected.
                  if (buffer.length > 512 * 1024) buffer = buffer.slice(-64);
                  break;
                }
                const end = jpegMarker(buffer, 0xff, 0xd9, start + 2);
                if (end < 0) {
                  buffer = buffer.slice(start);
                  if (buffer.length > 1024 * 1024) buffer = new Uint8Array(0);
                  break;
                }
                const jpeg = buffer.slice(start, end + 2);
                buffer = buffer.slice(end + 2);
                // TypedArray.from ensures a regular ArrayBuffer-backed BlobPart.
                const nextUrl = URL.createObjectURL(new Blob([Uint8Array.from(jpeg)], {type: 'image/jpeg'}));
                if (disposed) { URL.revokeObjectURL(nextUrl); break; }
                const previous = imageRef.current;
                imageRef.current = nextUrl;
                setImageUrl(nextUrl);
                if (previous) URL.revokeObjectURL(previous);
                receivedFrame = true;
                resetWatchdog();
                setStatus('LIVE');
                setMessage('');
              }
            }
          } finally {
            try { await reader.cancel(); } catch { /* stream already closed */ }
          }
          if (!disposed) setMessage(receivedFrame ? 'Video connection ended; reconnecting…' : 'Waiting for live frames from the worker');
        } catch (error) {
          if (!disposed) {
            setMessage(error instanceof Error && error.name !== 'AbortError' ? error.message : 'No recent video frames; reconnecting…');
          }
        } finally {
          if (watchdog !== undefined) clearTimeout(watchdog);
          activeController = null;
        }

        if (disposed) break;
        clearFrame(); // Never show a stale image as though it is live.
        setStatus(receivedFrame ? 'Reconnecting' : 'Offline');
        await new Promise<void>(resolve => setTimeout(resolve, 1800));
      }
    }

    void connect();
    return () => {
      disposed = true;
      activeController?.abort();
      const previous = imageRef.current;
      imageRef.current = null;
      if (previous) URL.revokeObjectURL(previous);
    };
  }, [cameraId]);

  return (
    <div style={{position: 'relative', background: '#091920', minHeight: 220, overflow: 'hidden'}}>
      {imageUrl ? (
        <img src={imageUrl} alt={`${name} live video`} style={{display: 'block', width: '100%', height: 220, objectFit: 'contain'}}/>
      ) : (
        <div className="camera-offline" style={{minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8}}>
          {status === 'Offline' ? <VideoOff size={29}/> : <Camera size={29}/>}
          <span style={{textAlign: 'center', padding: '0 10px'}}>{message}</span>
        </div>
      )}
      <span role="status" aria-live="polite" style={{position: 'absolute', left: 9, top: 9, borderRadius: 5,
        padding: '4px 8px', fontSize: 11, fontWeight: 800, color: '#fff',
        background: status === 'LIVE' ? '#087f64' : 'rgba(21,37,45,0.9)'}}>
        {status === 'LIVE' ? '● LIVE' : status}
      </span>
    </div>
  );
}
