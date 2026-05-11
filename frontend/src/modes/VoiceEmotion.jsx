import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOTIONS = ['calm', 'happy', 'stressed', 'sad', 'angry'];
const EMOTION_COLORS = {
  calm: '#2ECC71', happy: '#FFD93D', stressed: '#FF6B35', sad: '#00B4D8', angry: '#FF4757',
};

export default function VoiceEmotion({ isRunning, onFpsTick }) {
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);
  const [emotion, setEmotion] = useState(null);
  const [scores, setScores] = useState({});
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!isRunning) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafRef.current);
      setActive(false);
      setEmotion(null);
      setScores({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        src.connect(analyser);
        analyserRef.current = analyser;
        if (!cancelled) setActive(true);

        const buf = new Float32Array(analyser.frequencyBinCount);
        const timeBuf = new Float32Array(analyser.fftSize);

        const analyze = () => {
          if (cancelled) return;
          analyser.getFloatFrequencyData(buf);
          analyser.getFloatTimeDomainData(timeBuf);

          const canvas = canvasRef.current;
          if (canvas) {
            const c = canvas.getContext('2d');
            canvas.width = canvas.clientWidth || 240;
            canvas.height = canvas.clientHeight || 80;
            c.clearRect(0, 0, canvas.width, canvas.height);
            c.strokeStyle = '#006FFF';
            c.lineWidth = 1.5;
            c.beginPath();
            const sliceW = canvas.width / timeBuf.length;
            let x = 0;
            for (let i = 0; i < timeBuf.length; i++) {
              const y = ((timeBuf[i] + 1) / 2) * canvas.height;
              if (i === 0) c.moveTo(x, y);
              else c.lineTo(x, y);
              x += sliceW;
            }
            c.stroke();
          }

          const freqRange = buf.length / (ctx.sampleRate / 2);
          const slice = (low, high) => {
            const s = Math.floor(low * freqRange), e = Math.floor(high * freqRange);
            const vals = buf.slice(s, e).filter((v) => isFinite(v));
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length + 100 : 0;
          };

          const energy = timeBuf.reduce((a, b) => a + b * b, 0) / timeBuf.length;
          const lowEnergy = slice(20, 300);
          const midEnergy = slice(300, 2000);
          const highEnergy = slice(2000, 8000);
          const pitch = midEnergy - lowEnergy;

          const rawScores = {
            calm:    Math.max(0, 60 - pitch * 0.5 - energy * 200),
            happy:   Math.max(0, highEnergy * 0.8 + pitch * 0.4),
            stressed: Math.max(0, pitch * 0.6 + energy * 300 - lowEnergy),
            sad:     Math.max(0, lowEnergy * 0.7 - highEnergy * 0.3 - energy * 100),
            angry:   Math.max(0, energy * 400 + lowEnergy * 0.5 - 20),
          };

          const total = Object.values(rawScores).reduce((a, b) => a + b, 0) || 1;
          const normalized = Object.fromEntries(
            Object.entries(rawScores).map(([k, v]) => [k, Math.round((v / total) * 100)])
          );

          const dominant = Object.entries(normalized).sort((a, b) => b[1] - a[1])[0][0];
          setEmotion(dominant);
          setScores(normalized);
          onFpsTick?.();
          rafRef.current = requestAnimationFrame(analyze);
        };

        analyze();
      } catch {
        if (!cancelled) setError('Microphone access denied.');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, onFpsTick]);

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-xs" style={{ color: '#FF4757' }}>{error}</p>
      )}

      {!isRunning ? (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start to analyze your voice</p>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${active ? 'bg-green-400' : 'bg-white/20'}`} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {active ? 'listening' : 'connecting…'}
            </span>
          </div>

          <canvas ref={canvasRef} className="w-full rounded" style={{ height: 60, display: 'block' }} />

          <AnimatePresence mode="wait">
            {emotion ? (
              <motion.div
                key={emotion}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-5xl font-black capitalize leading-none mb-1"
                  style={{ color: EMOTION_COLORS[emotion] }}>
                  {emotion}
                </div>
              </motion.div>
            ) : (
              <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Analyzing…
              </motion.p>
            )}
          </AnimatePresence>

          {Object.keys(scores).length > 0 && (
            <div className="space-y-2">
              {EMOTIONS.map((e) => (
                <div key={e} className="flex items-center gap-2">
                  <span className="text-[11px] w-14 text-right capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>{e}</span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: `${scores[e] || 0}%` }}
                      transition={{ duration: 0.3 }}
                      style={{ background: EMOTION_COLORS[e] }}
                    />
                  </div>
                  <span className="text-[11px] font-mono w-7" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {scores[e] || 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
