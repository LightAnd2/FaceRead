import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 7, 11, 15, 19];
const SUPPORTED = ['A','B','D','G','H','I','L','V','W'];

function classifyGesture(landmarks) {
  if (!landmarks || landmarks.length === 0) return null;
  const lm = landmarks[0];
  const extended = FINGER_TIPS.map((tip, i) => lm[tip].y < lm[FINGER_PIPS[i]].y);
  const [thumb, index, middle, ring, pinky] = extended;

  if (!thumb && !index && !middle && !ring && !pinky) return 'A';
  if (!thumb && index && middle && ring && pinky) return 'B';
  if (!thumb && index && !middle && !ring && !pinky) return 'D';
  if (!index && !middle && !ring && !pinky) return 'G';
  if (index && middle && !ring && !pinky) return 'H';
  if (!thumb && !index && !middle && !ring && pinky) return 'I';
  if (index && !middle && !ring && pinky) return 'L';
  if (!thumb && index && middle && !ring && !pinky) return 'V';
  if (index && middle && ring && !pinky) return 'W';
  return null;
}

export default function ASLRecognition({ videoRef, overlayCanvasRef, isRunning, onFpsTick }) {
  const handLandmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [detected, setDetected] = useState(null);
  const [word, setWord] = useState('');
  const holdRef = useRef({ letter: null, count: 0 });

  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (!cancelled) { handLandmarkerRef.current = landmarker; setLoading(false); setReady(true); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || !ready || !handLandmarkerRef.current) return;

    const detect = () => {
      const video = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      const results = handLandmarkerRef.current.detectForVideo(video, performance.now());
      const canvas = overlayCanvasRef.current;

      if (canvas) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks?.length > 0) {
          const lm = results.landmarks[0];
          const CONNS = [
            [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
            [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
            [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17],
          ];
          ctx.strokeStyle = 'rgba(0,111,255,0.6)';
          ctx.lineWidth = 2;
          CONNS.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(lm[a].x * canvas.clientWidth, lm[a].y * canvas.clientHeight);
            ctx.lineTo(lm[b].x * canvas.clientWidth, lm[b].y * canvas.clientHeight);
            ctx.stroke();
          });
          lm.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x * canvas.clientWidth, p.y * canvas.clientHeight, FINGER_TIPS.includes(i) ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = FINGER_TIPS.includes(i) ? '#00E5FF' : 'rgba(0,111,255,0.8)';
            ctx.fill();
          });

          const letter = classifyGesture(results.landmarks);
          if (letter) {
            setDetected(letter);
            if (holdRef.current.letter === letter) {
              holdRef.current.count++;
              if (holdRef.current.count === 20) {
                setWord((w) => w + letter);
              }
            } else {
              holdRef.current = { letter, count: 0 };
            }
          } else {
            setDetected(null);
          }
        } else {
          setDetected(null);
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
    if (!isRunning) { setDetected(null); setWord(''); setReady(false); cancelAnimationFrame(rafRef.current); }
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
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start and show a hand sign</p>
          <div className="grid grid-cols-5 gap-1.5">
            {SUPPORTED.map((l) => (
              <div key={l}
                className="aspect-square rounded flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.28)', border: '1px solid transparent' }}
              >
                {l}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={detected || 'none'}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-center py-2"
            >
              <div className="text-8xl font-black leading-none mb-2"
                style={{ color: detected ? '#006FFF' : 'rgba(255,255,255,0.08)' }}>
                {detected || '?'}
              </div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {detected ? 'Hold to add to word' : 'Show a hand sign'}
              </div>
            </motion.div>
          </AnimatePresence>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Word</span>
              {word && (
                <button onClick={() => setWord('')}
                  className="text-[10px] transition-colors"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                >
                  clear
                </button>
              )}
            </div>
            <div className="text-3xl font-bold tracking-wide min-h-10" style={{ color: '#fff' }}>
              {word || <span style={{ color: 'rgba(255,255,255,0.1)' }}>…</span>}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {SUPPORTED.map((l) => (
              <div key={l}
                className="aspect-square rounded flex items-center justify-center text-xs font-bold transition-all"
                style={l === detected
                  ? { background: 'rgba(0,111,255,0.2)', color: '#006FFF', border: '1px solid rgba(0,111,255,0.4)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.28)', border: '1px solid transparent' }
                }
              >
                {l}
              </div>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Hold each sign ~0.5s to register
          </p>
        </>
      )}
    </div>
  );
}
