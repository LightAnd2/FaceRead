import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar.jsx';
import { CameraProvider } from '../contexts/CameraContext.jsx';

import EmotionAnalytics from '../modes/EmotionAnalytics.jsx';
import AgeProgression from '../modes/AgeProgression.jsx';
import FaceSwap from '../modes/FaceSwap.jsx';
import FaceFilters from '../modes/FaceFilters.jsx';
import AvatarMode from '../modes/AvatarMode.jsx';
import ASLRecognition from '../modes/ASLRecognition.jsx';
import EyeTracking from '../modes/EyeTracking.jsx';
import GestureControl from '../modes/GestureControl.jsx';
import VoiceEmotion from '../modes/VoiceEmotion.jsx';
import MusicRecognition from '../modes/MusicRecognition.jsx';
import InterviewCoach from '../modes/InterviewCoach.jsx';
import FatigueDetection from '../modes/FatigueDetection.jsx';
import BackgroundReplacement from '../modes/BackgroundReplacement.jsx';

const MODE_COMPONENTS = {
  emotion: EmotionAnalytics, age: AgeProgression,
  swap: FaceSwap, filters: FaceFilters, avatar: AvatarMode,
  asl: ASLRecognition, eye: EyeTracking, gesture: GestureControl,
  voice: VoiceEmotion, music: MusicRecognition, interview: InterviewCoach,
  fatigue: FatigueDetection, bg: BackgroundReplacement,
};

const AUDIO_ONLY     = ['voice', 'music'];
const CANVAS_REPLACE = ['bg', 'avatar'];

export default function Platform() {
  const { modeId } = useParams();
  const navigate   = useNavigate();
  const [activeMode, setActiveMode] = useState(modeId || 'emotion');
  const [isRunning, setIsRunning]   = useState(false);
  const [isReady, setIsReady]       = useState(false);
  const [fps, setFps]               = useState(0);

  const webcamRef        = useRef(null);
  const overlayCanvasRef = useRef(null);
  const fpsRef           = useRef({ count: 0, last: performance.now() });

  // Smooth mouse spotlight
  const [mouse, setMouse]   = useState({ x: -2000, y: -2000 });
  const targetRef  = useRef({ x: -2000, y: -2000 });
  const currentRef = useRef({ x: -2000, y: -2000 });
  const mouseRaf   = useRef(null);

  useEffect(() => {
    const onMove = (e) => { targetRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove);
    const lerp = (a, b, t) => a + (b - a) * t;
    const tick = () => {
      const c = currentRef.current, t = targetRef.current;
      const nx = lerp(c.x, t.x, 0.08), ny = lerp(c.y, t.y, 0.08);
      if (Math.abs(nx - c.x) > 0.1 || Math.abs(ny - c.y) > 0.1) {
        currentRef.current = { x: nx, y: ny };
        setMouse({ x: nx, y: ny });
      }
      mouseRaf.current = requestAnimationFrame(tick);
    };
    mouseRaf.current = requestAnimationFrame(tick);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(mouseRaf.current); };
  }, []);

  useEffect(() => {
    if (modeId && MODE_COMPONENTS[modeId]) setActiveMode(modeId);
  }, [modeId]);

  const handleModeSwitch = useCallback((id) => {
    setActiveMode(id);
    setIsReady(false);
    setIsRunning(false);
    navigate(`/app/${id}`, { replace: true });
  }, [navigate]);

  const tickFps = useCallback(() => {
    fpsRef.current.count++;
    const now = performance.now();
    if (now - fpsRef.current.last >= 1000) {
      setFps(fpsRef.current.count);
      fpsRef.current.count = 0;
      fpsRef.current.last  = now;
    }
  }, []);

  const syncCanvas = useCallback(() => {
    const video  = webcamRef.current?.video;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;
  }, []);

  const toggle = () => {
    setIsRunning(r => !r);
    if (isRunning) { setIsReady(false); setFps(0); }
  };

  const isAudioOnly    = AUDIO_ONLY.includes(activeMode);
  const isCanvasReplace = CANVAS_REPLACE.includes(activeMode);
  const ModeComponent  = MODE_COMPONENTS[activeMode] || EmotionAnalytics;

  return (
    <CameraProvider>
      <div
        className="flex h-screen overflow-hidden"
        style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#000', color: 'rgba(255,255,255,0.85)' }}
      >
        {/* Mouse spotlight */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: `radial-gradient(550px circle at ${mouse.x}px ${mouse.y}px, rgba(0,111,255,0.055), transparent 50%)`,
        }} />

        <Sidebar activeMode={activeMode} onModeSelect={handleModeSwitch} />

        {/* Main content */}
        <div className="relative flex-1 flex flex-col overflow-hidden" style={{ zIndex: 1 }}>

          {/* Camera / audio box */}
          <div className="flex-1 flex items-center justify-center p-5 pb-3 overflow-hidden">

            {isAudioOnly ? (
              /* Audio — big circle button */
              <div className="flex flex-col items-center gap-8">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={toggle}
                  className="relative flex items-center justify-center rounded-full"
                  style={{ width: 200, height: 200 }}
                  animate={isRunning ? { boxShadow: ['0 0 0 0px rgba(0,111,255,0.3)', '0 0 0 24px rgba(0,111,255,0)'] } : {}}
                  transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: isRunning ? 'rgba(255,71,87,0.12)' : 'rgba(0,111,255,0.1)',
                      border: `1px solid ${isRunning ? 'rgba(255,71,87,0.3)' : 'rgba(0,111,255,0.25)'}`,
                    }}
                  />
                  <div className="relative flex flex-col items-center gap-2">
                    <div className="text-3xl font-black" style={{ color: isRunning ? '#FF4757' : '#006FFF' }}>
                      {isRunning ? '■' : '▶'}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: isRunning ? '#FF4757' : '#006FFF' }}>
                      {isRunning ? 'Stop' : 'Start'}
                    </span>
                  </div>
                </motion.button>

                <div className="text-center">
                  <div className="text-2xl font-black mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {activeMode === 'voice' ? 'Voice Emotion' : 'Music Recognition'}
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {activeMode === 'voice' ? 'Microphone — no camera needed' : 'Tap to record 10 seconds of audio'}
                  </p>
                </div>
              </div>

            ) : (
              /* Camera box */
              <div className="relative w-full" style={{ maxWidth: 900, aspectRatio: '16/9' }}>
                <div className="relative w-full h-full rounded-2xl overflow-hidden" style={{ background: '#111' }}>
                  <AnimatePresence>
                    {isRunning && (
                      <motion.div key="cam"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0"
                      >
                        {isCanvasReplace ? (
                          <>
                            <Webcam ref={webcamRef} mirrored
                              videoConstraints={{ facingMode: 'user', width: 1280, height: 720 }}
                              className="absolute inset-0 w-full h-full object-cover opacity-0"
                              onUserMedia={() => { setIsReady(true); syncCanvas(); }} />
                            <canvas ref={overlayCanvasRef} className="w-full h-full object-cover" />
                          </>
                        ) : (
                          <Webcam ref={webcamRef} mirrored
                            videoConstraints={{ facingMode: 'user', width: 1280, height: 720 }}
                            className="w-full h-full object-cover"
                            onUserMedia={() => { setIsReady(true); syncCanvas(); }} />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!isRunning && <CameraIdle />}

                  {!isCanvasReplace && (
                    <canvas ref={overlayCanvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none" />
                  )}

                  {/* Live + FPS badge */}
                  <AnimatePresence>
                    {isRunning && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute top-3 right-3 flex items-center gap-3"
                      >
                        {!isAudioOnly && (
                          <span className="text-xs font-mono tabular-nums"
                            style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {fps} fps
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          <span className="text-xs font-medium" style={{ color: '#4ade80' }}>live</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </div>
            )}
          </div>

          {/* Mode content + button */}
          {!isAudioOnly && (
            <div className="flex flex-col items-center gap-4 pb-6 shrink-0">
              <motion.div
                key={activeMode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-full overflow-y-auto no-scrollbar"
                style={{ maxWidth: 900, maxHeight: 180, padding: '0 4px' }}
              >
                <ModeComponent
                  videoRef={webcamRef}
                  overlayCanvasRef={overlayCanvasRef}
                  isRunning={isRunning}
                  isReady={isReady}
                  onFpsTick={tickFps}
                  dark={true}
                />
              </motion.div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggle}
                className="px-10 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={isRunning
                  ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }
                  : { background: '#006FFF', color: '#fff', border: 'none' }
                }
              >
                {isRunning ? 'Stop' : 'Start'}
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </CameraProvider>
  );
}

function CameraIdle() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none">
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.1 }}>
        <rect x="2" y="10" width="36" height="28" rx="4" stroke="white" strokeWidth="1.5"/>
        <circle cx="20" cy="24" r="8" stroke="white" strokeWidth="1.5"/>
        <circle cx="20" cy="24" r="3" fill="white" fillOpacity="0.4"/>
        <path d="M38 18l8-5v18l-8-5V18z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.1)', letterSpacing: '0.14em' }}>
        PRESS START
      </span>
    </div>
  );
}
