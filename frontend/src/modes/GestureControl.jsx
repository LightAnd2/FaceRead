import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 7, 11, 15, 19];

function detectGesture(lm) {
  const extended = FINGER_TIPS.map((tip, i) => lm[tip].y < lm[FINGER_PIPS[i]].y);
  const [thumb, index, middle, ring, pinky] = extended;
  const thumbExtended = lm[4].x < lm[3].x;

  const allOpen   = index && middle && ring && pinky;
  const onlyIndex = index && !middle && !ring && !pinky;
  const peace     = index && middle && !ring && !pinky;
  const fist      = !index && !middle && !ring && !pinky;
  const thumbUp   = thumbExtended && !index && !middle && !ring && !pinky;
  const thumbDown = !thumbExtended && !index && !middle && !ring && !pinky && lm[4].y > lm[2].y;
  const pinch     = lm[4].y > lm[8].y - 0.04 && lm[4].y < lm[8].y + 0.04;

  if (thumbUp)   return { name: 'Thumbs Up',  action: 'Export data' };
  if (thumbDown) return { name: 'Thumbs Down', action: 'Reset session' };
  if (allOpen)   return { name: 'Open Hand',   action: 'Next mode' };
  if (peace)     return { name: 'Peace',        action: 'Toggle sidebar' };
  if (fist)      return { name: 'Fist',         action: 'Stop camera' };
  if (onlyIndex) return { name: 'Point',        action: 'Start camera' };
  if (pinch)     return { name: 'Pinch',        action: 'Capture' };
  return { name: 'Unknown', action: '—' };
}

const GESTURE_GUIDE = [
  { name: 'Open Hand',  action: 'Next mode' },
  { name: 'Point',      action: 'Start camera' },
  { name: 'Fist',       action: 'Stop camera' },
  { name: 'Peace',      action: 'Toggle sidebar' },
  { name: 'Thumbs Up',  action: 'Export data' },
  { name: 'Pinch',      action: 'Capture' },
];

export default function GestureControl({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [gesture, setGesture] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );
        const lm = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        if (!cancelled) { landmarkerRef.current = lm; setLoading(false); setReady(true); }
      } catch { if (!cancelled) setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || !ready || !landmarkerRef.current) return;

    const detect = () => {
      const video = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      const results = landmarkerRef.current.detectForVideo(video, performance.now());
      const canvas = overlayCanvasRef.current;

      if (canvas) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks?.length > 0) {
          results.landmarks.forEach((lm, handIdx) => {
            const color = handIdx === 0 ? '#006FFF' : '#FF4757';
            const CONNS = [
              [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
              [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
              [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17],
            ];
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            CONNS.forEach(([a, b]) => {
              ctx.beginPath();
              ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
              ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
              ctx.stroke();
            });
            ctx.globalAlpha = 1;
            lm.forEach((p, i) => {
              ctx.beginPath();
              ctx.arc(p.x * canvas.width, p.y * canvas.height, FINGER_TIPS.includes(i) ? 5 : 3, 0, Math.PI * 2);
              ctx.fillStyle = FINGER_TIPS.includes(i) ? '#fff' : color;
              ctx.fill();
            });
          });

          const g = detectGesture(results.landmarks[0]);
          setGesture(g);
          if (g.name !== 'Unknown') {
            setHistory((h) => {
              if (h[0]?.name === g.name) return h;
              return [g, ...h.slice(0, 4)];
            });
          }
        } else {
          setGesture(null);
        }
      }

      onFpsTick?.();
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => {
      cancelAnimationFrame(rafRef.current);
      const c = overlayCanvasRef.current;
      if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    };
  }, [isRunning, ready, videoRef, overlayCanvasRef, onFpsTick]);

  useEffect(() => {
    if (!isRunning) { setGesture(null); setHistory([]); setReady(false); }
  }, [isRunning]);

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading MediaPipe…
        </div>
      )}

      {!isRunning ? (
        <>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start and show a hand gesture</p>
          <div className="space-y-2">
            {GESTURE_GUIDE.map((g) => (
              <div key={g.name} className="flex items-center justify-between text-xs">
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>{g.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.18)' }}>{g.action}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={gesture?.name || 'none'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="text-4xl font-black leading-none mb-2" style={{ color: gesture ? '#fff' : 'rgba(255,255,255,0.15)' }}>
                {gesture?.name || 'Show a hand'}
              </div>
              {gesture?.action && gesture.action !== '—' && (
                <div className="text-xs" style={{ color: '#006FFF' }}>→ {gesture.action}</div>
              )}
            </motion.div>
          </AnimatePresence>

          {history.length > 0 && (
            <div className="space-y-2">
              {history.map((g, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs"
                  style={{ opacity: 1 - i * 0.18, color: 'rgba(255,255,255,0.5)' }}
                >
                  <span>{g.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>{g.action}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {GESTURE_GUIDE.map((g) => (
              <div key={g.name} className="flex items-center justify-between text-xs">
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>{g.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.18)' }}>{g.action}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
