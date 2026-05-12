import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DYNAMIC = ['J', 'Z']; // require motion — detected as base pose

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];
const TIPS = [4, 8, 12, 16, 20];

// ─── Singleton loader ─────────────────────────────────────────────────────────
let _lm = null, _loading = false, _cbs = [];
async function getHandLandmarker() {
  if (_lm) return _lm;
  if (_loading) return new Promise(r => _cbs.push(r));
  _loading = true;
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
  );
  _lm = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
  });
  _cbs.forEach(r => r(_lm));
  _cbs = [];
  return _lm;
}

// ─── Geometric classifier ─────────────────────────────────────────────────────
function dist2D(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function classifyASL(lm) {
  const hs = dist2D(lm[0], lm[9]) || 0.001;
  const d  = (a, b) => dist2D(lm[a], lm[b]) / hs;

  // Finger extended: tip clearly above PIP
  const ext = {
    thumb:  lm[4].y < lm[2].y,
    index:  lm[8].y < lm[6].y - 0.01,
    middle: lm[12].y < lm[10].y - 0.01,
    ring:   lm[16].y < lm[14].y - 0.01,
    pinky:  lm[20].y < lm[18].y - 0.01,
  };

  // Tight curl: tip below MCP
  const curl = {
    index:  lm[8].y  > lm[5].y,
    middle: lm[12].y > lm[9].y,
    ring:   lm[16].y > lm[13].y,
    pinky:  lm[20].y > lm[17].y,
  };

  // Thumb side-extended (tip left of index MCP — works for mirrored cam)
  const thumbOut = lm[4].x < lm[5].x;
  const thumbUp  = lm[4].y < lm[3].y;

  // Key distances (normalised by hand size)
  const tI = d(4, 8);   // thumb ↔ index tip
  const tM = d(4, 12);  // thumb ↔ middle tip
  const iM = d(8, 12);  // index ↔ middle tip spread

  const { index: iE, middle: mE, ring: rE, pinky: pE } = ext;
  const { index: iC, middle: mC, ring: rC, pinky: pC } = curl;

  // ── Distinct single combos ────────────────────────────────────────────────
  if (thumbOut && pE && !iE && !mE && !rE)                  return { letter: 'Y', conf: 92 };
  if (iE && !mE && !rE && !pE && thumbOut)                  return { letter: 'L', conf: 90 };
  if (pE && !iE && !mE && !rE && !thumbOut)                 return { letter: 'I', conf: 90 };

  // ── 4-finger group ────────────────────────────────────────────────────────
  if (iE && mE && rE && pE && !thumbOut)                    return { letter: 'B', conf: 88 };

  // ── 3-finger group ────────────────────────────────────────────────────────
  if (iE && mE && rE && !pE)                                return { letter: 'W', conf: 85 };
  if (tI < 0.18 && mE && rE && pE)                         return { letter: 'F', conf: 85 };

  // ── Index only ────────────────────────────────────────────────────────────
  if (iE && !mE && !rE && !pE) {
    if (tM < 0.28)                                          return { letter: 'D', conf: 83 };
    if (lm[8].y > lm[7].y && lm[8].y < lm[5].y)           return { letter: 'X', conf: 76 };
                                                            return { letter: 'G', conf: 72 };
  }

  // ── Index + middle ────────────────────────────────────────────────────────
  if (iE && mE && !rE && !pE) {
    if (iM > 0.30)                                          return { letter: 'V', conf: 85 };
    if (thumbUp && tI < 0.28)                               return { letter: 'K', conf: 80 };
    if (iM < 0.20)                                          return { letter: 'U', conf: 82 };
                                                            return { letter: 'R', conf: 72 };
  }

  // ── Curved / partial ─────────────────────────────────────────────────────
  if (!iE && !mE && !rE && !pE && tI < 0.25 && !iC)       return { letter: 'O', conf: 80 };
  if (!iE && !mE && !rE && !pE && !iC && !mC && tI > 0.28) return { letter: 'C', conf: 76 };

  // ── Fist group ────────────────────────────────────────────────────────────
  if (!iE && !mE && !rE && !pE) {
    // M: 3 fingers over thumb
    if (lm[8].y > lm[4].y && lm[12].y > lm[4].y && lm[16].y > lm[4].y)
                                                            return { letter: 'M', conf: 72 };
    // N: 2 fingers over thumb
    if (lm[8].y > lm[4].y && lm[12].y > lm[4].y && lm[16].y < lm[4].y)
                                                            return { letter: 'N', conf: 72 };
    // E: tight curl, all tips near palm
    if (iC && mC && rC && pC)                              return { letter: 'E', conf: 74 };
    // S: thumb over fist
    if (!thumbOut)                                          return { letter: 'S', conf: 76 };
    // A: thumb beside fist
    if (thumbOut)                                           return { letter: 'A', conf: 78 };
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ASLRecognition({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const lmRef    = useRef(null);
  const rafRef   = useRef(null);
  const holdRef  = useRef({ letter: null, frames: 0 });
  const bufRef   = useRef([]);              // smoothing buffer

  const [loading,  setLoading]  = useState(false);
  const [ready,    setReady]    = useState(false);
  const [detected, setDetected] = useState(null);
  const [confidence, setConf]   = useState(0);
  const [word,     setWord]     = useState('');
  const [progress, setProgress] = useState(0); // hold progress 0-100

  // Load model
  useEffect(() => {
    if (!isRunning || ready) return;
    let cancelled = false;
    setLoading(true);
    getHandLandmarker().then(lm => {
      if (!cancelled) { lmRef.current = lm; setLoading(false); setReady(true); }
    });
    return () => { cancelled = true; };
  }, [isRunning]);

  const classifyingRef = useRef(false);

  // Detection loop
  useEffect(() => {
    if (!isRunning || !ready || !isReady) return;
    const HOLD_FRAMES = 22;
    classifyingRef.current = false;

    const detect = () => {
      const video  = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      if (!lmRef.current) { rafRef.current = requestAnimationFrame(detect); return; }
      const results = lmRef.current.detectForVideo(video, performance.now());
      const canvas  = overlayCanvasRef.current;

      if (canvas) {
        canvas.width  = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cw = canvas.width, ch = canvas.height;

        const allLms = results.landmarks ?? [];
        const allHandedness = results.handednesses ?? [];

        // Draw skeleton for every detected hand
        allLms.forEach((lms, hi) => {
          const handedness = allHandedness[hi]?.[0]?.categoryName;
          const isRight = handedness !== 'Left';
          const color = hi === 0 ? 'rgba(0,111,255,0.6)' : 'rgba(0,220,180,0.6)';
          const tipColor = hi === 0 ? '#00E5FF' : '#00FFD0';
          const dotColor = hi === 0 ? 'rgba(0,111,255,0.85)' : 'rgba(0,220,180,0.85)';

          ctx.strokeStyle = color;
          ctx.lineWidth   = 1.8;
          HAND_CONNECTIONS.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(lms[a].x * cw, lms[a].y * ch);
            ctx.lineTo(lms[b].x * cw, lms[b].y * ch);
            ctx.stroke();
          });
          lms.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x * cw, p.y * ch, TIPS.includes(i) ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = TIPS.includes(i) ? tipColor : dotColor;
            ctx.fill();
          });
        });

        // Classify using the first (primary) hand only
        const lms = allLms[0];
        const handedness = allHandedness[0]?.[0]?.categoryName;
        const isRight = handedness !== 'Left';

        if (lms) {
          const result = classifyASL(lms);
          const raw = result?.letter ?? null;

          // Smooth: require same letter 4× in last 6 results
          bufRef.current.push(raw);
          if (bufRef.current.length > 6) bufRef.current.shift();
          const counts = {};
          bufRef.current.forEach(l => { if (l) counts[l] = (counts[l] || 0) + 1; });
          const stable = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          const smoothed = (stable && stable[1] >= 4) ? stable[0] : null;

          setDetected(smoothed);
          setConf(result?.conf ?? 0);

          // Hold-to-register
          if (smoothed) {
            if (holdRef.current.letter === smoothed) {
              holdRef.current.frames++;
              const pct = Math.min(100, Math.round(holdRef.current.frames / HOLD_FRAMES * 100));
              setProgress(pct);
              if (holdRef.current.frames === HOLD_FRAMES) {
                setWord(w => w + smoothed);
                holdRef.current.frames = HOLD_FRAMES + 1;
              }
            } else {
              holdRef.current = { letter: smoothed, frames: 1 };
              setProgress(0);
            }
          } else {
            holdRef.current = { letter: null, frames: 0 };
            setProgress(0);
          }
        } else {
          // No hands detected
          setDetected(null);
          setConf(0);
          setProgress(0);
          bufRef.current = [];
          holdRef.current = { letter: null, frames: 0 };
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
  }, [isRunning, ready, isReady, videoRef, overlayCanvasRef, onFpsTick]);

  useEffect(() => {
    if (!isRunning) {
      setDetected(null); setWord(''); setReady(false);
      setProgress(0); setConf(0);
      cancelAnimationFrame(rafRef.current);
    }
  }, [isRunning]);

  return (
    <div className="w-full space-y-4">

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading hand model…
        </div>
      )}

      {!isRunning && !loading && (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Start and show ASL hand signs — hold each sign to register
        </p>
      )}

      {isRunning && (
        <div className="flex gap-6 items-start">

          {/* Left – big letter + hold ring */}
          <div className="flex flex-col items-center gap-2 shrink-0" style={{ width: 100 }}>
            <div className="relative flex items-center justify-center" style={{ width: 90, height: 90 }}>
              {/* Hold progress ring */}
              <svg className="absolute inset-0" width="90" height="90" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r="40" fill="none"
                  stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle cx="45" cy="45" r="40" fill="none"
                  stroke="#006FFF" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                  transform="rotate(-90 45 45)"
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
              <AnimatePresence mode="wait">
                <motion.span
                  key={detected || '?'}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="text-5xl font-black leading-none"
                  style={{ color: detected ? '#fff' : 'rgba(255,255,255,0.08)' }}
                >
                  {detected || '?'}
                </motion.span>
              </AnimatePresence>
            </div>

            {detected && (
              <span className="text-[10px] tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {confidence}% conf
                {DYNAMIC.includes(detected) && ' (motion)'}
              </span>
            )}
            {!detected && (
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>no sign</span>
            )}
          </div>

          {/* Right – word builder + alphabet grid */}
          <div className="flex-1 space-y-3 min-w-0">
            {/* Word output */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>Word</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWord(w => w.slice(0, -1))}
                    className="text-[10px] transition-colors"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                  >⌫</button>
                  <button
                    onClick={() => setWord(w => w + ' ')}
                    className="text-[10px] transition-colors"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                  >space</button>
                  <button
                    onClick={() => setWord('')}
                    className="text-[10px] transition-colors"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                  >clear</button>
                </div>
              </div>
              <div className="text-2xl font-bold tracking-wide truncate" style={{ color: '#fff', minHeight: 34 }}>
                {word || <span style={{ color: 'rgba(255,255,255,0.08)' }}>…</span>}
              </div>
            </div>

            {/* Alphabet grid */}
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}>
              {ALL_LETTERS.map(l => (
                <div key={l}
                  className="flex items-center justify-center rounded text-[10px] font-bold transition-all"
                  style={{
                    aspectRatio: '1',
                    background: l === detected
                      ? 'rgba(0,111,255,0.25)'
                      : 'rgba(255,255,255,0.04)',
                    color: l === detected
                      ? '#006FFF'
                      : DYNAMIC.includes(l)
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(255,255,255,0.28)',
                    border: l === detected
                      ? '1px solid rgba(0,111,255,0.5)'
                      : '1px solid transparent',
                    transform: l === detected ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  {l}
                </div>
              ))}
            </div>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
              J and Z require motion — shown at base position
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
