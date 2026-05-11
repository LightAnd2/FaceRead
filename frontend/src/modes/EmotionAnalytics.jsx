import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useModels, faceapi } from '../hooks/useModels.js';

const EMOTION_COLORS = {
  happy: '#FFD93D', sad: '#00B4D8', angry: '#FF4757',
  surprised: '#FF6B35', neutral: '#A0A0B0', fearful: '#C77DFF', disgusted: '#52D9A4',
};
const PLAYER_COLORS = ['#006FFF', '#FF4757', '#2ECC71', '#F39C12'];
const MATCH_THRESHOLD = 0.5;
const STORAGE_KEY = 'perceive_people';
const CAPTURE_TOTAL = 5;

function loadPeople() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return raw.map(({ name, descriptors }) => ({
      name,
      descriptors: descriptors.map((d) => new Float32Array(d)),
    }));
  } catch { return []; }
}

function savePeople(people) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(
    people.map(({ name, descriptors }) => ({
      name,
      descriptors: descriptors.map((d) => Array.from(d)),
    }))
  ));
}

function buildMatcher(people) {
  if (!people.length) return null;
  return new faceapi.FaceMatcher(
    people.map(({ name, descriptors }) => new faceapi.LabeledFaceDescriptors(name, descriptors)),
    MATCH_THRESHOLD
  );
}

function drawFaces(canvas, results, matcherRef) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const multi = results.length > 1;

  results.forEach((r, idx) => {
    const { x: rawX, y, width: w, height: h } = r.detection.box;
    const x = canvas.width - rawX - w; // mirror to match webcam
    const top = Object.entries(r.expressions).sort((a, b) => b[1] - a[1])[0];
    const color = multi
      ? PLAYER_COLORS[idx % PLAYER_COLORS.length]
      : (EMOTION_COLORS[top[0]] || '#fff');
    const match = r.descriptor ? matcherRef.current?.findBestMatch(r.descriptor) : null;
    const name = match && match.label !== 'unknown' ? match.label : null;
    const label = name
      ? `${name} · ${top[0]}`
      : multi ? `P${idx + 1} · ${top[0]}` : `${top[0]} · ${r.gender}`;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;

    ctx.font = 'bold 11px Inter, sans-serif';
    const tw = ctx.measureText(label).width + 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y - 24, tw, 20, 3);
    else ctx.rect(x, y - 24, tw, 20);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 7, y - 9);
  });
}

const DETECT_OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

export default function EmotionAnalytics({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const modelsLoaded = useModels();
  const rafRef            = useRef(null);
  const peopleRef         = useRef(loadPeople());
  const matcherRef        = useRef(buildMatcher(peopleRef.current));
  const frameCountRef     = useRef(0);
  const lastDescriptorsRef = useRef([]);
  const selectedFaceRef   = useRef(0);
  const historyRef        = useRef([]);
  const timerRef          = useRef(null);

  const [faces,         setFaces]         = useState([]);
  const [selectedFace,  setSelectedFace]  = useState(0);
  const [history,       setHistory]       = useState([]);
  const [sessionTime,   setSessionTime]   = useState(0);
  const [summary,       setSummary]       = useState(null);
  const [people,        setPeople]        = useState(loadPeople);
  const [nameInput,     setNameInput]     = useState('');
  const [regFeedback,   setRegFeedback]   = useState('');
  const [capturing,     setCapturing]     = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [showReg,       setShowReg]       = useState(false);

  // Keep selectedFaceRef in sync for use inside the detect closure
  useEffect(() => { selectedFaceRef.current = selectedFace; }, [selectedFace]);

  // Session timer
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setSessionTime((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setSessionTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  // Detection loop — descriptors only run every 5th frame for performance
  useEffect(() => {
    if (!isRunning || !modelsLoaded || !isReady) return;

    let cancelled = false;
    frameCountRef.current = 0;

    const detect = async () => {
      if (cancelled) return;
      const video = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      frameCountRef.current++;
      const runDescriptors = frameCountRef.current % 5 === 1;

      let results;
      if (runDescriptors) {
        results = await faceapi
          .detectAllFaces(video, DETECT_OPTS)
          .withFaceLandmarks(true)
          .withFaceDescriptors()
          .withFaceExpressions()
          .withAgeAndGender();
        if (!cancelled) lastDescriptorsRef.current = results.map((r) => r.descriptor);
      } else {
        results = await faceapi
          .detectAllFaces(video, DETECT_OPTS)
          .withFaceLandmarks(true)
          .withFaceExpressions()
          .withAgeAndGender();
        // Reuse last known descriptors for name matching
        results = results.map((r, i) => ({
          ...r,
          descriptor: lastDescriptorsRef.current[i] ?? null,
        }));
      }

      if (cancelled) return;

      const canvas = overlayCanvasRef.current;
      if (canvas) {
        const scaleX = canvas.clientWidth / (video.videoWidth || 1);
        const scaleY = canvas.clientHeight / (video.videoHeight || 1);
        canvas.width  = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const scaled = results.map((r) => ({
          ...r,
          detection: {
            ...r.detection,
            box: {
              x:      r.detection.box.x      * scaleX,
              y:      r.detection.box.y      * scaleY,
              width:  r.detection.box.width  * scaleX,
              height: r.detection.box.height * scaleY,
            },
          },
        }));
        drawFaces(canvas, scaled, matcherRef);
      }

      const faceData = results.map((r, idx) => {
        const sorted = Object.entries(r.expressions).sort((a, b) => b[1] - a[1]);
        const match  = r.descriptor ? matcherRef.current?.findBestMatch(r.descriptor) : null;
        return {
          dominant:   sorted[0][0],
          emotions:   Object.fromEntries(sorted.map(([k, v]) => [k, Math.round(v * 100)])),
          age:        Math.round(r.age),
          gender:     r.gender,
          genderProb: Math.round(r.genderProbability * 100),
          name:       match && match.label !== 'unknown' ? match.label : null,
          color:      PLAYER_COLORS[idx % PLAYER_COLORS.length],
        };
      });

      setFaces(faceData);
      setSelectedFace((prev) => Math.min(prev, Math.max(0, faceData.length - 1)));

      if (faceData.length > 0) {
        const ts = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const tracked = faceData[Math.min(selectedFaceRef.current, faceData.length - 1)];
        setHistory((h) => {
          const entry = { time: ts, ...Object.fromEntries(Object.entries(tracked.emotions).map(([k, v]) => [k, v])) };
          const next = [...h.slice(-29), entry];
          historyRef.current = next;
          return next;
        });
      }

      onFpsTick?.();
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      const canvas = overlayCanvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [isRunning, modelsLoaded, isReady, videoRef, overlayCanvasRef, onFpsTick]);

  // On stop: compute session summary, then clear state
  useEffect(() => {
    if (!isRunning) {
      const h = historyRef.current;
      if (h.length > 5) {
        const totals = {};
        h.forEach((entry) => {
          Object.keys(EMOTION_COLORS).forEach((e) => {
            totals[e] = (totals[e] || 0) + (entry[e] || 0);
          });
        });
        const dominant = Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
        setSummary({ dominant, samples: h.length });
      } else {
        setSummary(null);
      }
      setFaces([]);
      setHistory([]);
      historyRef.current = [];
    } else {
      setSummary(null);
    }
  }, [isRunning]);

  // Register face — captures CAPTURE_TOTAL samples for reliable matching
  const registerFace = useCallback(async () => {
    if (!nameInput.trim()) { setRegFeedback('Enter a name'); return; }
    if (!isRunning)        { setRegFeedback('Start camera first'); return; }
    const video = videoRef.current?.video;
    if (!video || video.readyState < 2) { setRegFeedback('Camera not ready'); return; }

    setCapturing(true);
    setRegFeedback('');
    const descriptors = [];

    for (let i = 0; i < CAPTURE_TOTAL; i++) {
      setCaptureProgress(i + 1);
      await new Promise((r) => setTimeout(r, 350));
      try {
        const result = await faceapi
          .detectSingleFace(video, DETECT_OPTS)
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (result) descriptors.push(result.descriptor);
      } catch {}
    }

    setCapturing(false);
    setCaptureProgress(0);

    if (descriptors.length === 0) { setRegFeedback('No face detected'); return; }

    const name = nameInput.trim();
    const existing = peopleRef.current.find((p) => p.name === name);
    if (existing) existing.descriptors.push(...descriptors);
    else peopleRef.current.push({ name, descriptors });
    savePeople(peopleRef.current);
    matcherRef.current = buildMatcher(peopleRef.current);
    setPeople(loadPeople());
    setRegFeedback(`✓ ${name} — ${descriptors.length} samples`);
    setNameInput('');
  }, [nameInput, isRunning, videoRef]);

  const deletePerson = (name) => {
    const updated = peopleRef.current.filter((p) => p.name !== name);
    peopleRef.current = updated;
    savePeople(updated);
    matcherRef.current = buildMatcher(updated);
    setPeople(updated);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const face   = faces[selectedFace];
  const isMulti = faces.length > 1;

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setShowReg((s) => !s); setRegFeedback(''); }}
          className="text-[11px] transition-opacity hover:opacity-60"
          style={{ color: showReg ? '#006FFF' : 'rgba(255,255,255,0.3)' }}
        >
          + name
        </button>
        {isRunning && (
          <span className="text-[11px] font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {fmt(sessionTime)}
          </span>
        )}
      </div>

      {!modelsLoaded && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading models…
        </div>
      )}

      {/* Name registration panel */}
      <AnimatePresence>
        {showReg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 py-1">
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !capturing && registerFace()}
                  placeholder={isRunning ? 'Name' : 'Start camera first'}
                  disabled={capturing}
                  className="flex-1 bg-transparent outline-none text-xs"
                  style={{
                    color: '#fff',
                    borderBottom: '1px solid rgba(255,255,255,0.15)',
                    paddingBottom: 4,
                    opacity: capturing ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={registerFace}
                  disabled={capturing || !isRunning}
                  className="text-xs font-medium shrink-0 transition-opacity"
                  style={{ color: '#006FFF', opacity: (capturing || !isRunning) ? 0.35 : 1 }}
                >
                  {capturing ? `${captureProgress}/${CAPTURE_TOTAL}` : 'save'}
                </button>
                <button
                  onClick={() => { setShowReg(false); setRegFeedback(''); setNameInput(''); }}
                  className="text-xs shrink-0 transition-opacity hover:opacity-60"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  ✕
                </button>
              </div>

              {regFeedback && (
                <p className="text-[11px]" style={{ color: regFeedback.startsWith('✓') ? '#4ade80' : '#FF4757' }}>
                  {regFeedback}
                </p>
              )}

              {people.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                  {people.map(({ name, descriptors }) => (
                    <div key={name} className="flex items-center gap-1 text-[11px]"
                      style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {name}
                      <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9 }}>
                        ×{descriptors.length}
                      </span>
                      <button onClick={() => deletePerson(name)}
                        className="transition-opacity hover:opacity-60"
                        style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis */}
      {!isRunning ? (
        <div className="space-y-2">
          {summary && (
            <div className="flex items-center gap-2 py-1">
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Last session ·
              </div>
              <div className="text-sm font-black capitalize" style={{ color: EMOTION_COLORS[summary.dominant] }}>
                {summary.dominant}
              </div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                dominant
              </div>
            </div>
          )}
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start to begin analysis</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {faces.length === 0 ? (
            <motion.p key="noface" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
              No face detected
            </motion.p>

          ) : isMulti ? (
            /* ── Multi-person layout ── */
            <motion.div key="multi" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-2 gap-3">
              {faces.map((f, i) => (
                <div key={i} className="border-l-2 pl-3" style={{ borderColor: f.color }}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: f.color }}>
                      {f.name || `Person ${i + 1}`}
                    </span>
                    <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                      {f.gender} · ~{f.age}
                    </span>
                  </div>
                  <div className="text-xl font-black capitalize leading-none mb-2"
                    style={{ color: EMOTION_COLORS[f.dominant] || '#fff' }}>
                    {f.dominant}
                  </div>
                  <div className="space-y-1">
                    {Object.entries(f.emotions).slice(0, 3).map(([e, v]) => (
                      <div key={e} className="flex items-center gap-1.5">
                        <span className="text-[9px] w-12 text-right capitalize"
                          style={{ color: 'rgba(255,255,255,0.28)' }}>{e}</span>
                        <div className="flex-1 h-0.5 rounded-full overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${v}%`, background: EMOTION_COLORS[e] || '#fff' }} />
                        </div>
                        <span className="text-[9px] font-mono w-5"
                          style={{ color: 'rgba(255,255,255,0.22)' }}>{v}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>

          ) : (
            /* ── Single-person detailed layout ── */
            <motion.div key="single" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {face && (
                <div className="flex items-start gap-5">

                  {/* Identity */}
                  <div className="shrink-0" style={{ minWidth: 110 }}>
                    <div className="text-2xl font-black capitalize leading-none mb-1"
                      style={{ color: EMOTION_COLORS[face.dominant] || '#fff' }}>
                      {face.name || face.dominant}
                    </div>
                    {face.name && (
                      <div className="text-xs capitalize mb-1.5" style={{ color: EMOTION_COLORS[face.dominant] }}>
                        {face.dominant}
                      </div>
                    )}
                    <div className="text-[11px] mb-1.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
                      {face.emotions[face.dominant]}% conf
                    </div>
                    {face.gender && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {face.gender} · {face.genderProb}%
                        </span>
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          ~{face.age} yrs
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Emotion bars */}
                  <div className="flex-1 space-y-1.5 self-center">
                    {Object.entries(face.emotions)
                      .sort((a, b) => b[1] - a[1])
                      .map(([emotion, score]) => (
                        <div key={emotion} className="flex items-center gap-2">
                          <span className="text-[10px] w-14 text-right capitalize shrink-0"
                            style={{ color: 'rgba(255,255,255,0.28)' }}>
                            {emotion}
                          </span>
                          <div className="flex-1 h-1 rounded-full overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <motion.div className="h-full rounded-full"
                              initial={{ width: 0 }} animate={{ width: `${score}%` }}
                              transition={{ duration: 0.35, ease: 'easeOut' }}
                              style={{ background: EMOTION_COLORS[emotion] || '#fff' }} />
                          </div>
                          <span className="text-[10px] font-mono w-7 tabular-nums shrink-0"
                            style={{ color: 'rgba(255,255,255,0.2)' }}>
                            {score}%
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* History chart */}
                  <div className="shrink-0 self-center"
                    style={{ width: 160, height: 80, opacity: history.length > 1 ? 1 : 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip
                          contentStyle={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 10 }}
                          labelStyle={{ color: 'rgba(255,255,255,0.3)' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        {Object.keys(EMOTION_COLORS).map((e) => (
                          <Line key={e} type="monotone" dataKey={e} stroke={EMOTION_COLORS[e]}
                            strokeWidth={1.5} dot={false} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
