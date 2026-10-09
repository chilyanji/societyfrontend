import {useEffect, useState} from 'react';
import {Play, Square, AlertCircle, Video} from 'lucide-react';
import {api} from './api';

type WorkerStatus = {
  configured: boolean;
  camera_id: string | null;
  running: boolean;
  state: 'running' | 'stopped';
  auto_start: boolean;
  last_exit_code: number | null;
};

/** Admin/manager controls. Server independently enforces role and camera access. */
export function CameraWorkerControls({onChanged}: {onChanged?: () => void}) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        const response = await fetch('/api/camera-worker/status', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'ngrok-skip-browser-warning': '1',
          },
        });
        if (!mounted) return;
        if (response.status === 401 || response.status === 403) {
          setVisible(false); // Guards and residents have no worker controls.
          return;
        }
        if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) {
          throw new Error(`Worker status unavailable (HTTP ${response.status})`);
        }
        const result = await response.json() as WorkerStatus;
        if (!mounted) return;
        setVisible(true);
        setStatus(result);
        setError('');
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Cannot contact camera worker API');
      }
    }
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 5000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, []);

  async function execute(action: 'start' | 'stop') {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/camera-worker/${action}`, 'POST') as WorkerStatus;
      setStatus(result);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Camera action failed');
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  const running = Boolean(status?.running);

  return (
    <div className="panel" style={{marginBottom: 14, padding: 15}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12}}>
        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
          <Video size={19}/>
          <div>
            <strong>Local camera worker</strong>
            <p className="hint" style={{margin: '3px 0 0'}}>
              {running ? 'Running on backend laptop' : 'Stopped'}
              {status?.auto_start ? ' · Auto-start enabled' : ''}
            </p>
          </div>
        </div>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          <button type="button" className="button primary" disabled={busy || running || !status?.configured}
                  onClick={() => { void execute('start'); }}>
            <Play size={15}/>Start camera
          </button>
          <button type="button" className="button" disabled={busy || !running}
                  onClick={() => { void execute('stop'); }}>
            <Square size={15}/>Stop camera
          </button>
        </div>
      </div>
      {status && !status.configured && <p className="hint" role="status">Configure CAMERA_WORKER_CAMERA_ID and CAMERA_WORKER_DEVICE_KEY in backend/.env first.</p>}
      {!running && status?.last_exit_code !== null && status?.last_exit_code !== undefined &&
        <p className="hint">Last worker exited with code {status.last_exit_code}. Check backend/.runtime/camera_worker.log.</p>}
      {error && <p role="alert" style={{marginTop: 9, color: '#f87171'}}><AlertCircle size={13}/> {error}</p>}
    </div>
  );
}
