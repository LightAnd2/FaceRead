import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

const BACKGROUNDS = [
  { id: 'blur',   name: 'Blur',         type: 'blur' },
  { id: 'dark',   name: 'Dark',         type: 'color', value: '#0A0A0A' },
  { id: 'blue',   name: 'Navy',         type: 'color', value: '#0A1628' },
  { id: 'space',  name: 'Space',        type: 'gradient', c1: '#0A0A1F', c2: '#1A0A2E' },
  { id: 'green',  name: 'Green screen', type: 'color', value: '#00B140' },
  { id: 'custom', name: 'Custom color', type: 'picker' },
];

export default function BackgroundReplacement({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const segmenterRef = useRef(null);
  const rafRef = useRef(null);
  const offscreenRef = useRef(null);
  const blurCanvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [bg, setBg] = useState('blur');
  const [customColor, setCustomColor] = useState('#1A0A2E');
  const bgRef = useRef('blur');
  const customColorRef = useRef('#1A0A2E');

  useEffect(() => { bgRef.current = bg; }, [bg]);
  useEffect(() => { customColorRef.current = customColor; }, [customColor]);

  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );
        const seg = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
        if (!cancelled) { segmenterRef.current = seg; setLoading(false); setReady(true); }
      } catch { if (!cancelled) setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || !ready || !segmenterRef.current) return;

    const detect = () => {
      const video = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      const canvas = overlayCanvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(detect); return; }

      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const ctx = canvas.getContext('2d');

      try {
        const result = segmenterRef.current.segmentForVideo(video, performance.now());
        const mask = result.categoryMask;
        if (!mask) { rafRef.current = requestAnimationFrame(detect); return; }

        const vw = video.videoWidth || canvas.width;
        const vh = video.videoHeight || canvas.height;
        const cw = canvas.width, ch = canvas.height;

        // Offscreen: draw video frame
        if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
        const oc = offscreenRef.current;
        oc.width = vw; oc.height = vh;
        const octx = oc.getContext('2d');
        octx.drawImage(video, 0, 0, vw, vh);
        const personImageData = octx.getImageData(0, 0, vw, vh);

        // Create output imageData
        const outCanvas = document.createElement('canvas');
        outCanvas.width = vw; outCanvas.height = vh;
        const outCtx = outCanvas.getContext('2d');

        const bgId = bgRef.current;
        const bgConfig = BACKGROUNDS.find((b) => b.id === bgId) || BACKGROUNDS[0];

        // Draw background
        if (bgConfig.type === 'color') {
          outCtx.fillStyle = bgConfig.value;
          outCtx.fillRect(0, 0, vw, vh);
        } else if (bgConfig.type === 'gradient') {
          const grad = outCtx.createLinearGradient(0, 0, 0, vh);
          grad.addColorStop(0, bgConfig.c1);
          grad.addColorStop(1, bgConfig.c2);
          outCtx.fillStyle = grad;
          outCtx.fillRect(0, 0, vw, vh);
        } else if (bgConfig.type === 'picker') {
          outCtx.fillStyle = customColorRef.current;
          outCtx.fillRect(0, 0, vw, vh);
        } else {
          // Blur: draw video blurred
          outCtx.filter = 'blur(16px)';
          outCtx.drawImage(video, 0, 0, vw, vh);
          outCtx.filter = 'none';
        }

        const bgImageData = outCtx.getImageData(0, 0, vw, vh);
        const maskData = mask.getAsUint8Array();

        // Composite: keep person, use bg elsewhere
        const out = outCtx.createImageData(vw, vh);
        for (let i = 0; i < maskData.length; i++) {
          const isPerson = maskData[i] === 0; // 0 = background class in selfie segmenter, but depends on model
          const alpha = isPerson ? 1 : 0; // person = show video, bg = show replacement
          const j = i * 4;
          if (isPerson) {
            out.data[j] = personImageData.data[j];
            out.data[j+1] = personImageData.data[j+1];
            out.data[j+2] = personImageData.data[j+2];
            out.data[j+3] = 255;
          } else {
            out.data[j] = bgImageData.data[j];
            out.data[j+1] = bgImageData.data[j+1];
            out.data[j+2] = bgImageData.data[j+2];
            out.data[j+3] = 255;
          }
        }

        outCtx.putImageData(out, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        // Mirror to match selfie expectation
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-cw, 0);
        ctx.drawImage(outCanvas, 0, 0, cw, ch);
        ctx.restore();
        mask.close();
      } catch {
        // Segmentation failed this frame
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
    if (!isRunning) { setReady(false); setLoading(false); }
  }, [isRunning]);

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading MediaPipe…
        </div>
      )}

      <div>
        <span className="text-xs mb-3 block" style={{ color: 'rgba(255,255,255,0.25)' }}>Background</span>
        <div className="grid grid-cols-2 gap-2">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBg(b.id)}
              className="py-2.5 px-3 rounded text-xs font-medium transition-all text-left"
              style={bg === b.id
                ? { background: 'rgba(0,111,255,0.12)', border: '1px solid rgba(0,111,255,0.35)', color: '#fff' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {bg === 'custom' && (
        <div className="flex items-center gap-3 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Custom color</span>
          <input
            type="color" value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent"
          />
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>{customColor}</span>
        </div>
      )}

      {!isRunning && (
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.18)' }}>Start to replace background</p>
      )}
    </div>
  );
}
