import { useEffect, useRef, useState } from 'react';

const COOLDOWN_MS = 30000;

export default function MusicRecognition({ isRunning }) {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  useEffect(() => {
    if (!isRunning) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(cooldownRef.current);
      setStatus('idle');
    }
  }, [isRunning]);

  const startRecognition = async () => {
    if (cooldown > 0) return;
    setError(null);
    setStatus('recording');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setStatus('recognizing');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'clip.webm');

        try {
          const res = await fetch('/api/recognize', { method: 'POST', body: formData });
          if (!res.ok) throw new Error('API error');
          const data = await res.json();
          setResult(data.title ? data : null);
          setStatus(data.title ? 'found' : 'notfound');
        } catch {
          setStatus('error');
          setError('Recognition failed. Configure /api/recognize with ACRCloud credentials.');
        }

        setCooldown(COOLDOWN_MS / 1000);
        cooldownRef.current = setInterval(() => {
          setCooldown((c) => {
            if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
            return c - 1;
          });
        }, 1000);
      };

      mr.start();
      setTimeout(() => { if (mr.state === 'recording') mr.stop(); }, 10000);
    } catch {
      setError('Microphone access denied.');
      setStatus('idle');
    }
  };

  const btnActive = status !== 'recording' && status !== 'recognizing' && cooldown === 0;

  return (
    <div className="space-y-6">
      {result && status === 'found' && (
        <div className="border-l-2 pl-3" style={{ borderColor: '#006FFF' }}>
          {result.artwork && (
            <img src={result.artwork} alt="Album art"
              className="w-14 h-14 rounded object-cover mb-2" />
          )}
          <div className="font-bold text-base leading-tight" style={{ color: '#fff' }}>
            {result.title}
          </div>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{result.artist}</div>
          {result.album && (
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{result.album}</div>
          )}
          {result.year && (
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{result.year}</div>
          )}
        </div>
      )}

      {status === 'notfound' && (
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Song not recognized — try again</p>
      )}

      <button
        onClick={startRecognition}
        disabled={!btnActive}
        className="w-full py-3 rounded text-sm font-semibold transition-all"
        style={
          status === 'recording'
            ? { background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.35)', color: '#FF4757' }
            : cooldown > 0
            ? { background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }
            : { background: 'rgba(0,111,255,0.12)', border: '1px solid rgba(0,111,255,0.35)', color: '#006FFF' }
        }
      >
        {status === 'recording' && (
          <span className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Recording 10s…
          </span>
        )}
        {status === 'recognizing' && (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin" />
            Recognizing…
          </span>
        )}
        {btnActive && 'Recognize song'}
        {cooldown > 0 && !['recording','recognizing'].includes(status) && `Wait ${cooldown}s`}
      </button>

      {error && (
        <p className="text-xs" style={{ color: '#FF4757' }}>{error}</p>
      )}

      {!isRunning && status === 'idle' && !result && (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start and tap Recognize</p>
      )}

      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.18)' }}>
        Proxies to ACRCloud via <code className="text-white/40">/api/recognize</code>
      </p>
    </div>
  );
}
