import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const ELECTRIC = '#006FFF';

const SECTIONS = [
  {
    label: 'Face',
    modes: [
      { id: 'emotion',   name: 'Emotion Analytics',  desc: '7-class real-time emotion detection with multi-face support' },
      { id: 'age',       name: 'Age Progression',     desc: 'AI-powered face aging via HuggingFace' },
      { id: 'swap',      name: 'Face Swap',           desc: 'Landmark-aligned face region swap' },
      { id: 'filters',   name: 'Face Filters',        desc: 'AR overlays on 68 landmark points' },
      { id: 'avatar',    name: 'Avatar Mode',         desc: 'Canvas avatar driven by expressions' },
    ],
  },
  {
    label: 'Gesture',
    modes: [
      { id: 'asl',       name: 'ASL Recognition',    desc: 'Hand classification for sign language' },
      { id: 'eye',       name: 'Eye Tracking',        desc: 'Gaze estimation and attention heatmap' },
      { id: 'gesture',   name: 'Gesture Control',     desc: 'Control the app with hand poses' },
    ],
  },
  {
    label: 'Audio',
    modes: [
      { id: 'voice',     name: 'Voice Emotion',       desc: 'Pitch and energy mapped to emotion' },
      { id: 'music',     name: 'Music Recognition',   desc: '10-second clip matched via ACRCloud' },
    ],
  },
  {
    label: 'Productivity',
    modes: [
      { id: 'interview', name: 'Interview Coach',     desc: 'Eye contact and confidence scoring' },
      { id: 'fatigue',   name: 'Fatigue Detection',   desc: 'Eye aspect ratio composite score' },
      { id: 'bg',        name: 'Background Replace',  desc: 'MediaPipe segmentation per frame' },
    ],
  },
];

// ── Demo canvases ───────────────────────────────────────────────────────────

function WaveDemo() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); let t = 0, raf;
    const draw = () => {
      c.width = c.offsetWidth; c.height = c.offsetHeight;
      const w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#006FFF'; ctx.lineWidth = 2;
      ctx.shadowColor = '#006FFF'; ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = h/2 + Math.sin((x/w)*Math.PI*4+t)*(h*0.22) + Math.sin((x/w)*Math.PI*7+t*1.3)*(h*0.1);
        x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.stroke(); ctx.shadowBlur = 0; t+=0.04;
      raf = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="w-full h-full" />;
}

function EmotionBarsDemo() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    const EM = [
      {label:'happy',color:'#FFD93D'},{label:'neutral',color:'#A0A0B0'},
      {label:'surprised',color:'#FF6B35'},{label:'sad',color:'#00B4D8'},{label:'angry',color:'#FF4757'},
    ];
    const ph = EM.map(() => Math.random()*Math.PI*2);
    let t=0, raf;
    const draw = () => {
      c.width=c.offsetWidth; c.height=c.offsetHeight;
      const w=c.width, h=c.height; ctx.clearRect(0,0,w,h);
      const rowH = h/EM.length;
      EM.forEach((e,i) => {
        const val=(Math.sin(t+ph[i])+1)/2, bW=val*(w-80), y=i*rowH+rowH*0.2, bh=rowH*0.45;
        ctx.fillStyle='rgba(255,255,255,0.05)';
        ctx.beginPath(); ctx.roundRect(60,y,w-80,bh,3); ctx.fill();
        if(bW>0){ctx.fillStyle=e.color;ctx.beginPath();ctx.roundRect(60,y,bW,bh,3);ctx.fill();}
        ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='10px Inter,sans-serif';
        ctx.textAlign='right'; ctx.fillText(e.label,52,y+bh*0.75);
      });
      t+=0.025; raf=requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="w-full h-full" />;
}

function HandSkeletonDemo() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); let t=0, raf;
    const CONNS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]];
    const draw = () => {
      c.width=c.offsetWidth; c.height=c.offsetHeight;
      const w=c.width, h=c.height; ctx.clearRect(0,0,w,h);
      const cx=w*0.5, cy=h*0.58, sc=Math.min(w,h)*0.38, sw=Math.sin(t*0.4)*0.04;
      const pts=[[0,.12],[-0.15+sw,-.02],[-0.17+sw,-.22],[-0.17+sw,-.38],[-0.17+sw,-.5],[-0.06,-.08],[-0.08,-.38],[-0.08,-.56],[-0.08,-.7],[.05,-.06],[.04,-.38],[.04,-.57],[.04,-.7],[.15,-.04],[.16,-.32],[.16,-.48],[.16,-.6],[.24,.02],[.26,-.22],[.26,-.36],[.26,-.46]].map(([dx,dy])=>[cx+dx*sc,cy+dy*sc+Math.sin(t*0.6+dx*3)*3]);
      ctx.strokeStyle='rgba(0,111,255,0.55)'; ctx.lineWidth=1.5;
      CONNS.forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(pts[a][0],pts[a][1]);ctx.lineTo(pts[b][0],pts[b][1]);ctx.stroke();});
      [4,8,12,16,20].forEach(ti=>{ctx.beginPath();ctx.arc(pts[ti][0],pts[ti][1],4.5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();});
      pts.forEach((p,i)=>{if(![4,8,12,16,20].includes(i)){ctx.beginPath();ctx.arc(p[0],p[1],2.5,0,Math.PI*2);ctx.fillStyle='#006FFF';ctx.fill();}});
      t+=0.04; raf=requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="w-full h-full" />;
}

function GazeDemo() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); let t=0; const trail=[]; let raf;
    const draw = () => {
      c.width=c.offsetWidth; c.height=c.offsetHeight;
      const w=c.width, h=c.height;
      const gx=w*0.5+Math.sin(t*0.7)*w*0.28+Math.sin(t*1.3)*w*0.1;
      const gy=h*0.5+Math.cos(t*0.5)*h*0.25+Math.cos(t*1.1)*h*0.1;
      trail.push({x:gx,y:gy}); if(trail.length>40) trail.shift();
      ctx.clearRect(0,0,w,h);
      ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
      trail.forEach((p,i)=>{
        const alpha=(i/trail.length)*0.18, r=(trail.length-i)*0.6;
        const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r+4);
        g.addColorStop(0,`rgba(0,111,255,${alpha})`); g.addColorStop(1,'rgba(0,111,255,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      });
      ctx.beginPath(); ctx.arc(gx,gy,6,0,Math.PI*2);
      ctx.fillStyle='#006FFF'; ctx.shadowColor='#006FFF'; ctx.shadowBlur=12; ctx.fill(); ctx.shadowBlur=0;
      t+=0.03; raf=requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="w-full h-full" />;
}

// ── Robot + Emotion Bars Canvas ─────────────────────────────────────────────

function RobotHeroCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    let t = 0, raf;

    // browInner/browOuter: positive=UP, negative=DOWN (inner=nose side, outer=temple side)
    // noseFlare: >1 = wider nostrils (surprised), <1 = scrunched (angry)
    const EMOTIONS = [
      { name: 'HAPPY',     conf: 0.94, eyeOpen: 0.92, browInner: 0.3,  browOuter: 0.2,  mouthK: -1.3, mouthOpen: 0.1, noseFlare: 1.0,  eyeCol: '#FFD93D', barCol: '#FFD93D' },
      { name: 'NEUTRAL',   conf: 0.88, eyeOpen: 0.60, browInner: 0,    browOuter: 0,    mouthK: 0,    mouthOpen: 0,   noseFlare: 1.0,  eyeCol: '#006FFF', barCol: '#A0A0C0' },
      { name: 'SURPRISED', conf: 0.91, eyeOpen: 1.0,  browInner: 0.85, browOuter: 0.65, mouthK: 0,    mouthOpen: 1,   noseFlare: 1.4,  eyeCol: '#FF6B35', barCol: '#FF6B35' },
      { name: 'ANGRY',     conf: 0.79, eyeOpen: 0.28, browInner: -1.0, browOuter: 0.35, mouthK: 0.55, mouthOpen: 0,   noseFlare: 0.65, eyeCol: '#FF4757', barCol: '#FF4757' },
      { name: 'SAD',       conf: 0.82, eyeOpen: 0.38, browInner: 0.55, browOuter: -0.4, mouthK: 1.1,  mouthOpen: 0,   noseFlare: 0.9,  eyeCol: '#00B4D8', barCol: '#00B4D8' },
    ];
    let eIdx = 0, eNext = 1, ep = 0;
    const lerp = (a, b, p) => a + (b - a) * p;

    const rr = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
      ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
      ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
      ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
      ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
    };

    const drawEmotionBars = (W, H) => {
      const em = EMOTIONS[eIdx], emN = EMOTIONS[eNext];
      const PX = 18, PY = H * 0.1, PW = W * 0.3;
      ctx.font = 'bold 10px monospace'; ctx.fillStyle = 'rgba(0,200,255,0.75)'; ctx.textAlign = 'left';
      ctx.fillText('◆ EMOTION ANALYSIS', PX, PY);
      const blink = Math.sin(t*5) > 0;
      ctx.beginPath(); ctx.arc(PX+4, PY+18, 3, 0, Math.PI*2);
      ctx.fillStyle = blink ? '#00FF88' : '#003312';
      ctx.shadowColor = '#00FF88'; ctx.shadowBlur = blink ? 10 : 0; ctx.fill(); ctx.shadowBlur = 0;
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(0,255,136,0.55)';
      ctx.fillText('LIVE SCANNING', PX+14, PY+22);
      EMOTIONS.forEach((e, i) => {
        const bY = PY + 46 + i * 40;
        const isActive = i === eIdx, isNext = i === eNext;
        const bW = PW - 52;
        let dispConf = isActive ? e.conf : isNext ? ep * emN.conf : 0.03 + Math.abs(Math.sin(t*0.4+i*1.1))*0.07;
        ctx.font = `${isActive?'bold ':''}10px monospace`;
        ctx.fillStyle = isActive ? e.barCol : 'rgba(255,255,255,0.28)';
        ctx.textAlign = 'left'; ctx.fillText(e.name, PX, bY);
        rr(PX, bY+6, bW, 5, 2); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
        rr(PX, bY+6, Math.max(5, bW*dispConf), 5, 2);
        ctx.fillStyle = isActive ? e.barCol : 'rgba(255,255,255,0.13)';
        if (isActive) { ctx.shadowColor = e.barCol; ctx.shadowBlur = 8; }
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.font = '9px monospace';
        ctx.fillStyle = isActive ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.18)';
        ctx.textAlign = 'right'; ctx.fillText(`${Math.round(dispConf*100)}%`, PX+bW+44, bY+12);
      });
    };

    const draw = () => {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);

      const em = EMOTIONS[eIdx], emN = EMOTIONS[eNext];
      const eyeOpen   = lerp(em.eyeOpen,   emN.eyeOpen,   ep);
      const browInner = lerp(em.browInner, emN.browInner, ep);
      const browOuter = lerp(em.browOuter, emN.browOuter, ep);
      const mouthK    = lerp(em.mouthK,    emN.mouthK,    ep);
      const mOpen     = lerp(em.mouthOpen, emN.mouthOpen, ep);
      const noseFlare = lerp(em.noseFlare, emN.noseFlare, ep);
      const eyeCol    = em.eyeCol;

      drawEmotionBars(W, H);

      // ── RIGHT: Android Face ──
      const rx = W * 0.665, ry = H * 0.42;
      const U = Math.min(W * 0.19, H * 0.22); // base unit

      // Ambient glow
      const atmo = ctx.createRadialGradient(rx, ry, 0, rx, ry, U*3);
      atmo.addColorStop(0, 'rgba(0,70,220,0.13)'); atmo.addColorStop(1, 'transparent');
      ctx.fillStyle = atmo; ctx.fillRect(0, 0, W, H);

      const HW = U * 0.92;  // head half-width
      const HH = U * 1.18;  // head half-height
      const headCY = ry - U * 0.04;

      // ── Shoulders (visible at bottom) ──
      const shoulderY = headCY + HH * 0.92;
      ctx.beginPath();
      ctx.moveTo(rx - HW*2.1, shoulderY + U*0.9);
      ctx.lineTo(rx - HW*1.3, shoulderY);
      ctx.lineTo(rx - HW*0.5, shoulderY - U*0.05);
      ctx.lineTo(rx + HW*0.5, shoulderY - U*0.05);
      ctx.lineTo(rx + HW*1.3, shoulderY);
      ctx.lineTo(rx + HW*2.1, shoulderY + U*0.9);
      ctx.lineTo(rx + HW*2.1, shoulderY + U*1.3);
      ctx.lineTo(rx - HW*2.1, shoulderY + U*1.3);
      ctx.closePath();
      const shG = ctx.createLinearGradient(rx, shoulderY, rx, shoulderY+U);
      shG.addColorStop(0,'#131328'); shG.addColorStop(1,'#07070E');
      ctx.fillStyle=shG; ctx.fill();
      ctx.strokeStyle='rgba(0,100,220,0.28)'; ctx.lineWidth=1; ctx.stroke();
      // Collarbone highlight lines
      [-1,1].forEach(s=>{
        ctx.beginPath();
        ctx.moveTo(rx+s*HW*0.4, shoulderY-U*0.05);
        ctx.bezierCurveTo(rx+s*HW*0.9, shoulderY-U*0.05, rx+s*HW*1.15, shoulderY+U*0.12, rx+s*HW*1.3, shoulderY);
        ctx.strokeStyle='rgba(0,120,200,0.22)'; ctx.lineWidth=1; ctx.stroke();
      });

      // ── Neck ──
      const neckW = HW*0.42, neckH = U*0.3, neckY = headCY + HH*0.88;
      rr(rx-neckW/2, neckY, neckW, neckH, 5);
      const nkG = ctx.createLinearGradient(rx-neckW/2, 0, rx+neckW/2, 0);
      nkG.addColorStop(0,'#0A0A1E'); nkG.addColorStop(0.5,'#16163A'); nkG.addColorStop(1,'#0A0A1E');
      ctx.fillStyle=nkG; ctx.fill();
      ctx.strokeStyle='rgba(0,100,220,0.3)'; ctx.lineWidth=1; ctx.stroke();
      for(let i=1;i<=3;i++){
        ctx.beginPath(); ctx.moveTo(rx-neckW/2+4, neckY+neckH*i/4); ctx.lineTo(rx+neckW/2-4, neckY+neckH*i/4);
        ctx.strokeStyle='rgba(0,100,200,0.18)'; ctx.lineWidth=0.8; ctx.stroke();
      }

      // ── Head — smooth oval skull ──
      ctx.beginPath();
      ctx.ellipse(rx, headCY, HW, HH, 0, 0, Math.PI*2);
      const hG = ctx.createRadialGradient(rx - HW*0.22, headCY - HH*0.28, HW*0.1, rx, headCY, HW*1.5);
      hG.addColorStop(0,'#2A3858');   // lit area
      hG.addColorStop(0.35,'#182236');
      hG.addColorStop(0.7,'#0E1525');
      hG.addColorStop(1,'#060A14');
      ctx.fillStyle=hG; ctx.fill();
      ctx.strokeStyle='rgba(80,130,255,0.45)'; ctx.lineWidth=1.5; ctx.stroke();

      // Rim light (left edge)
      ctx.save();
      ctx.beginPath(); ctx.ellipse(rx, headCY, HW, HH, 0, 0, Math.PI*2);
      ctx.clip();
      const rimG = ctx.createLinearGradient(rx-HW, headCY, rx-HW*0.6, headCY);
      rimG.addColorStop(0,'rgba(120,180,255,0.22)'); rimG.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=rimG; ctx.fillRect(rx-HW, headCY-HH, HW*0.5, HH*2);
      ctx.restore();

      // ── Forehead tech plate ──
      const plateY = headCY - HH*0.9;
      const plateH = HH*0.28;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(rx, headCY, HW, HH, 0, 0, Math.PI*2); ctx.clip();
      rr(rx - HW*0.72, plateY, HW*1.44, plateH, 4);
      ctx.fillStyle='rgba(8,12,28,0.75)'; ctx.fill();
      ctx.strokeStyle='rgba(0,100,220,0.25)'; ctx.lineWidth=0.8; ctx.stroke();
      // Circuit trace lines on plate
      for(let i=0;i<3;i++){
        const ly = plateY + plateH*0.25 + i*plateH*0.25;
        const lw = HW*(1.1 - i*0.15);
        ctx.beginPath(); ctx.moveTo(rx-lw, ly); ctx.lineTo(rx+lw, ly);
        ctx.strokeStyle=`rgba(0,100,200,${0.12+i*0.04})`; ctx.lineWidth=0.7; ctx.stroke();
      }
      // Plate seam
      ctx.beginPath(); ctx.moveTo(rx-HW*0.72, plateY+plateH); ctx.lineTo(rx+HW*0.72, plateY+plateH);
      ctx.strokeStyle='rgba(0,120,255,0.22)'; ctx.lineWidth=1; ctx.stroke();
      ctx.restore();

      // Crown LEDs
      for(let i=0;i<5;i++){
        const clx = rx+(i-2)*HW*0.2, cly = headCY-HH*0.82;
        const la = 0.3+0.6*Math.sin(t*3.2+i*0.9);
        ctx.beginPath(); ctx.arc(clx, cly, 2.5, 0, Math.PI*2);
        ctx.fillStyle=i===2?`rgba(0,255,140,${la})`:`rgba(0,140,255,${la})`;
        ctx.shadowColor=i===2?'#00FF88':'#006FFF'; ctx.shadowBlur=9*la; ctx.fill(); ctx.shadowBlur=0;
      }

      // ── Face panel seams ──
      ctx.strokeStyle='rgba(0,90,180,0.18)'; ctx.lineWidth=0.8;
      // Cheek seams
      [-1,1].forEach(s=>{
        ctx.beginPath();
        ctx.moveTo(rx+s*HW*0.55, headCY-HH*0.55);
        ctx.bezierCurveTo(rx+s*HW*0.82, headCY-HH*0.1, rx+s*HW*0.82, headCY+HH*0.4, rx+s*HW*0.6, headCY+HH*0.7);
        ctx.stroke();
      });

      // ── EYES ──
      const eyeY = headCY - HH*0.14;
      const eW = HW*0.27, eH = HW*0.145 * eyeOpen;
      const eGap = HW*0.3;

      [-1,1].forEach(side=>{
        const ex = rx + side*eGap;

        // Socket shadow
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eW*0.9, eH*1.6+6, 0, 0, Math.PI*2);
        ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();

        // Eye outer glow
        const halo = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, eW*1.4);
        halo.addColorStop(0, eyeCol+'44'); halo.addColorStop(1,'transparent');
        ctx.fillStyle=halo;
        ctx.beginPath(); ctx.ellipse(ex, eyeY, eW*1.4, eH*2.5+10, 0, 0, Math.PI*2); ctx.fill();

        // Clip to almond eye shape
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(ex - eW, eyeY);
        ctx.bezierCurveTo(ex-eW*0.55, eyeY-eH*1.05, ex+eW*0.55, eyeY-eH*1.05, ex+eW, eyeY);
        ctx.bezierCurveTo(ex+eW*0.55, eyeY+eH*0.65, ex-eW*0.55, eyeY+eH*0.65, ex-eW, eyeY);
        ctx.closePath(); ctx.clip();

        // Sclera (white part, subtle)
        ctx.fillStyle='rgba(200,220,255,0.12)'; ctx.fillRect(ex-eW, eyeY-eH-5, eW*2, eH*2+10);

        // Iris
        ctx.beginPath(); ctx.arc(ex, eyeY, eW*0.52, 0, Math.PI*2);
        ctx.fillStyle=eyeCol; ctx.shadowColor=eyeCol; ctx.shadowBlur=22; ctx.fill(); ctx.shadowBlur=0;

        // Iris ring
        ctx.beginPath(); ctx.arc(ex, eyeY, eW*0.52, 0, Math.PI*2);
        ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1.5; ctx.stroke();

        // Pupil
        ctx.beginPath(); ctx.arc(ex, eyeY, eW*0.24, 0, Math.PI*2);
        ctx.fillStyle='#000A18'; ctx.fill();

        // Shine
        ctx.beginPath(); ctx.arc(ex-eW*0.16, eyeY-eW*0.15, eW*0.1, 0, Math.PI*2);
        ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill();

        ctx.restore();

        // Upper eyelid line
        ctx.beginPath();
        ctx.moveTo(ex-eW, eyeY);
        ctx.bezierCurveTo(ex-eW*0.55, eyeY-eH*1.05, ex+eW*0.55, eyeY-eH*1.05, ex+eW, eyeY);
        ctx.strokeStyle='rgba(150,200,255,0.55)'; ctx.lineWidth=1.5; ctx.stroke();

        // Lower eyelid line
        ctx.beginPath();
        ctx.moveTo(ex-eW, eyeY);
        ctx.bezierCurveTo(ex-eW*0.55, eyeY+eH*0.65, ex+eW*0.55, eyeY+eH*0.65, ex+eW, eyeY);
        ctx.strokeStyle='rgba(100,150,220,0.35)'; ctx.lineWidth=1; ctx.stroke();

        // ── Eyebrow ──
        // inner=nose side, outer=temple side; positive=UP (negative Y)
        const innerYOff = -browInner * HW * 0.15;
        const outerYOff = -browOuter * HW * 0.15;
        // side=-1 (left eye): left end=outer, right end=inner
        // side=+1 (right eye): left end=inner, right end=outer
        const yLeft  = side === -1 ? outerYOff : innerYOff;
        const yRight = side === -1 ? innerYOff : outerYOff;
        const browBaseY = eyeY - HW*0.17;
        const bW = eW * 0.92;
        ctx.beginPath();
        ctx.moveTo(ex - bW, browBaseY + yLeft);
        ctx.bezierCurveTo(
          ex - bW*0.3, browBaseY + yLeft*0.45 + yRight*0.15 - HW*0.022,
          ex + bW*0.3, browBaseY + yLeft*0.15 + yRight*0.45 - HW*0.022,
          ex + bW, browBaseY + yRight
        );
        ctx.strokeStyle='rgba(0,180,255,0.82)'; ctx.lineWidth=3.2;
        ctx.shadowColor='rgba(0,150,255,0.5)'; ctx.shadowBlur=7; ctx.stroke(); ctx.shadowBlur=0;
      });

      // ── Nose ──
      const noseTopY = headCY + HH*0.04, noseBotY = headCY + HH*0.26;
      const nSpread = noseFlare;
      // Bridge sides (squeeze inward when angry)
      [-1,1].forEach(s=>{
        ctx.beginPath();
        ctx.moveTo(rx+s*HW*0.07*nSpread, noseTopY);
        ctx.bezierCurveTo(rx+s*HW*0.09*nSpread, noseTopY+HH*0.08, rx+s*HW*0.13*nSpread, noseBotY-HH*0.06, rx+s*HW*0.14*nSpread, noseBotY);
        ctx.strokeStyle='rgba(80,130,200,0.32)'; ctx.lineWidth=1.2; ctx.stroke();
      });
      // Nostril hints (wider when surprised, tighter when angry)
      [-1,1].forEach(s=>{
        ctx.beginPath();
        ctx.arc(rx+s*HW*0.13*nSpread, noseBotY+HH*0.02, HW*0.052*nSpread, 0, Math.PI*2);
        ctx.strokeStyle=`rgba(60,110,180,${0.22 + (nSpread-1)*0.3})`; ctx.lineWidth=1.2; ctx.stroke();
      });

      // ── Mouth ──
      const mouthY = headCY + HH*0.48;
      const mW2 = HW*0.52;
      // mouthK: negative=smile (corners UP), positive=frown (corners DOWN)
      const cornerOff = mouthK * HW * 0.2;  // how far corners shift vertically
      const cL = { x: rx - mW2*0.88, y: mouthY + cornerOff };
      const cR = { x: rx + mW2*0.88, y: mouthY + cornerOff };
      const midY = mouthY - HW*0.02;

      if (mOpen > 0.2) {
        // SURPRISED: O-shaped open mouth
        const oW = mW2 * 0.62, oH = mOpen * HW * 0.28;
        ctx.beginPath(); ctx.ellipse(rx, mouthY + oH*0.15, oW, oH, 0, 0, Math.PI*2);
        ctx.fillStyle='rgba(0,8,22,0.85)'; ctx.fill();
        ctx.strokeStyle='rgba(0,200,255,0.7)'; ctx.lineWidth=2;
        ctx.shadowColor='#00AAFF'; ctx.shadowBlur=8; ctx.stroke(); ctx.shadowBlur=0;
      } else {
        // Upper lip (M-shape with corner lift/drop)
        ctx.beginPath();
        ctx.moveTo(cL.x, cL.y);
        ctx.bezierCurveTo(rx - mW2*0.48, midY - HW*0.01 + cornerOff*0.3, rx - mW2*0.14, midY - HW*0.06, rx, midY - HW*0.03);
        ctx.bezierCurveTo(rx + mW2*0.14, midY - HW*0.06, rx + mW2*0.48, midY - HW*0.01 + cornerOff*0.3, cR.x, cR.y);
        ctx.strokeStyle='rgba(0,190,255,0.82)'; ctx.lineWidth=2.2;
        ctx.shadowColor='#00AAFF'; ctx.shadowBlur=9; ctx.stroke(); ctx.shadowBlur=0;

        // Lower lip (curves down between corners)
        const lMidY = mouthY + HW*0.065 + cornerOff*0.55;
        ctx.beginPath();
        ctx.moveTo(cL.x, cL.y);
        ctx.bezierCurveTo(rx - mW2*0.45, lMidY + HW*0.055, rx + mW2*0.45, lMidY + HW*0.055, cR.x, cR.y);
        ctx.strokeStyle='rgba(0,160,230,0.6)'; ctx.lineWidth=1.8;
        ctx.shadowColor='#00AAFF'; ctx.shadowBlur=6; ctx.stroke(); ctx.shadowBlur=0;

        // Filled lip area for depth
        ctx.beginPath();
        ctx.moveTo(cL.x, cL.y);
        ctx.bezierCurveTo(rx - mW2*0.48, midY - HW*0.01 + cornerOff*0.3, rx - mW2*0.14, midY - HW*0.06, rx, midY - HW*0.03);
        ctx.bezierCurveTo(rx + mW2*0.14, midY - HW*0.06, rx + mW2*0.48, midY - HW*0.01 + cornerOff*0.3, cR.x, cR.y);
        ctx.bezierCurveTo(rx + mW2*0.45, lMidY + HW*0.055, rx - mW2*0.45, lMidY + HW*0.055, cL.x, cL.y);
        ctx.fillStyle = 'rgba(0,30,60,0.55)'; ctx.fill();
      }

      // Lip shine
      ctx.beginPath();
      ctx.ellipse(rx, mouthY + HW*0.04 + cornerOff*0.3, mW2*0.2, HW*0.016, 0, 0, Math.PI*2);
      ctx.fillStyle='rgba(100,200,255,0.18)'; ctx.fill();

      // ── Cheekbone highlights ──
      [-1,1].forEach(s=>{
        const ckx = rx+s*HW*0.62, cky = headCY+HH*0.12;
        const ckG = ctx.createRadialGradient(ckx, cky, 0, ckx, cky, HW*0.3);
        ckG.addColorStop(0,'rgba(100,160,255,0.1)'); ckG.addColorStop(1,'transparent');
        ctx.fillStyle=ckG; ctx.beginPath(); ctx.ellipse(ckx, cky, HW*0.3, HW*0.18, 0, 0, Math.PI*2); ctx.fill();
      });

      // ── Scan line (clip to head oval) ──
      ctx.save();
      ctx.beginPath(); ctx.ellipse(rx, headCY, HW, HH, 0, 0, Math.PI*2); ctx.clip();
      const sfrac = ((t*16) % (HH*2+30));
      const scanY2 = headCY - HH - 15 + sfrac;
      const sg3 = ctx.createLinearGradient(rx-HW, scanY2, rx+HW, scanY2);
      sg3.addColorStop(0,'rgba(0,220,255,0)'); sg3.addColorStop(0.5,'rgba(0,220,255,0.16)'); sg3.addColorStop(1,'rgba(0,220,255,0)');
      ctx.fillStyle=sg3; ctx.fillRect(rx-HW, scanY2-2, HW*2, 3.5);
      ctx.restore();

      // ── HUD brackets ──
      const bpad=16, bs=22;
      const bx1=rx-HW-bpad, by1=headCY-HH-bpad;
      const bx2=rx+HW+bpad, by2=shoulderY+U*1.3+bpad;
      const ba=0.35+0.18*Math.sin(t*1.3);
      ctx.strokeStyle=`rgba(0,180,255,${ba})`; ctx.lineWidth=1.5;
      [[bx1,by1,1,1],[bx2,by1,-1,1],[bx1,by2,1,-1],[bx2,by2,-1,-1]].forEach(([px,py,sx,sy])=>{
        ctx.beginPath(); ctx.moveTo(px,py+sy*bs); ctx.lineTo(px,py); ctx.lineTo(px+sx*bs,py); ctx.stroke();
      });

      // ── Emotion label ──
      const lbY = by2 + 22;
      ctx.font='bold 11px monospace'; ctx.fillStyle='rgba(0,210,255,0.88)'; ctx.textAlign='center';
      ctx.fillText(`◆ ${em.name}`, rx, lbY);
      ctx.font='9px monospace'; ctx.fillStyle='rgba(255,255,255,0.22)';
      ctx.fillText(`${Math.round(em.conf*100)}% confidence`, rx, lbY+14);

      t += 0.022;
      raf = requestAnimationFrame(draw);
    };

    // Real-time emotion advancement (runs even when RAF is throttled in background)
    const EMOTION_MS = 3000;
    let emotionStart = Date.now();
    const emotionTimer = setInterval(() => {
      ep = Math.min((Date.now() - emotionStart) / EMOTION_MS, 1);
      if (ep >= 1) {
        eIdx = eNext;
        eNext = (eNext + 1) % EMOTIONS.length;
        ep = 0;
        emotionStart = Date.now();
      }
    }, 50);

    draw();
    return () => { cancelAnimationFrame(raf); clearInterval(emotionTimer); };
  }, []);

  return <canvas ref={ref} style={{width:'100%',height:'100%'}} width={700} height={500} />;
}

// ── Starfield + Orbs Background ─────────────────────────────────────────────

function StarfieldBackground() {
  const ref = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  // Lerped mouse for smooth pull
  const lerpMouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); let raf;

    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);

    const onMove  = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY, active: true }; };
    const onLeave = ()  => { mouseRef.current = { ...mouseRef.current, active: false }; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    // Stars — 3 parallax layers, more drift speed
    const LAYERS = [
      { count: 140, speed: 0.12, minR: 0.25, maxR: 0.75, alpha: 0.3  },
      { count: 70,  speed: 0.28, minR: 0.5,  maxR: 1.4,  alpha: 0.52 },
      { count: 32,  speed: 0.55, minR: 0.9,  maxR: 2.1,  alpha: 0.72 },
    ];
    const stars = LAYERS.flatMap(layer =>
      Array.from({ length: layer.count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: layer.minR + Math.random()*(layer.maxR-layer.minR),
        driftSpeed: layer.speed,
        alpha: layer.alpha*(0.5+Math.random()*0.5),
        twinkle: Math.random()*Math.PI*2,
        twinkleSpeed: 0.02+Math.random()*0.04,
        parallax: layer.speed,
      }))
    );

    // Shooting stars
    const shooters = [];
    let shootTimer = 0;
    const spawnShooter = () => {
      shooters.push({
        x: Math.random()*window.innerWidth,
        y: Math.random()*window.innerHeight*0.6,
        vx: 4+Math.random()*6,
        vy: 1+Math.random()*2,
        life: 1.0,
        len: 60+Math.random()*80,
      });
    };

    // Orbs — faster, more of them
    const ORBS = Array.from({ length: 18 }, () => ({
      x:   Math.random()*window.innerWidth,
      y:   Math.random()*window.innerHeight,
      vx:  (Math.random()-0.5)*0.65,
      vy:  (Math.random()-0.5)*0.65,
      r:   35+Math.random()*85,
      hue: 205+Math.random()*38,
      pulse: Math.random()*Math.PI*2,
      pulseSpeed: 0.012+Math.random()*0.018,
    }));

    const draw = () => {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);

      const { x: mx, y: my, active: mActive } = mouseRef.current;

      // Lerp mouse for smooth pull visuals
      const lm = lerpMouse.current;
      if (mActive) {
        lm.x += (mx - lm.x) * 0.1;
        lm.y += (my - lm.y) * 0.1;
      }

      // Orbs
      ORBS.forEach(o => {
        if (mActive) {
          const dx = lm.x - o.x, dy = lm.y - o.y;
          const d = Math.sqrt(dx*dx+dy*dy);
          if (d < 380 && d > 1) {
            const f = (1 - d/380) * 0.028;
            o.vx += (dx/d)*f; o.vy += (dy/d)*f;
          }
        }
        o.vx *= 0.975; o.vy *= 0.975;
        const spd = Math.sqrt(o.vx*o.vx+o.vy*o.vy);
        if (spd > 2.5) { o.vx=o.vx/spd*2.5; o.vy=o.vy/spd*2.5; }
        o.x += o.vx; o.y += o.vy; o.pulse += o.pulseSpeed;
        if(o.x<-o.r*2) o.x=W+o.r; if(o.x>W+o.r*2) o.x=-o.r;
        if(o.y<-o.r*2) o.y=H+o.r; if(o.y>H+o.r*2) o.y=-o.r;

        const br = 1+Math.sin(o.pulse)*0.22;
        const cr = o.r*br;
        const a  = 0.042+Math.sin(o.pulse)*0.022;
        const g  = ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,cr);
        g.addColorStop(0,`hsla(${o.hue},100%,65%,${a*3.8})`);
        g.addColorStop(0.4,`hsla(${o.hue},100%,58%,${a})`);
        g.addColorStop(1,`hsla(${o.hue},100%,50%,0)`);
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(o.x,o.y,cr,0,Math.PI*2); ctx.fill();
      });

      // Stars
      stars.forEach(s => {
        s.twinkle += s.twinkleSpeed;
        const tw = s.alpha*(0.5+Math.sin(s.twinkle)*0.5);
        let sx = s.x, sy = s.y;
        if (mActive) {
          sx -= (lm.x/W-0.5)*s.parallax*30;
          sy -= (lm.y/H-0.5)*s.parallax*30;
        }
        ctx.beginPath(); ctx.arc(sx,sy,s.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(255,255,255,${tw})`; ctx.fill();
        if(s.r>1.4){
          ctx.beginPath(); ctx.arc(sx,sy,s.r*3.5,0,Math.PI*2);
          ctx.fillStyle=`rgba(180,210,255,${tw*0.13})`; ctx.fill();
        }
        s.y += s.driftSpeed*0.12;
        if(s.y>H){ s.y=0; s.x=Math.random()*W; }
      });

      // Shooting stars
      shootTimer++;
      if(shootTimer % 200 === 0) spawnShooter();
      for(let k=shooters.length-1;k>=0;k--){
        const s=shooters[k];
        s.x+=s.vx; s.y+=s.vy; s.life-=0.025;
        if(s.life<=0||s.x>W||s.y>H){ shooters.splice(k,1); continue; }
        const g=ctx.createLinearGradient(s.x-s.vx*s.len/s.vx,s.y-s.vy*s.len/s.vx,s.x,s.y);
        g.addColorStop(0,'rgba(255,255,255,0)');
        g.addColorStop(1,`rgba(200,230,255,${s.life*0.8})`);
        ctx.beginPath(); ctx.moveTo(s.x-s.vx*(s.len/Math.sqrt(s.vx*s.vx+s.vy*s.vy)),s.y-s.vy*(s.len/Math.sqrt(s.vx*s.vx+s.vy*s.vy))); ctx.lineTo(s.x,s.y);
        ctx.strokeStyle=g; ctx.lineWidth=1.5; ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }} />;
}

const DEMOS = [
  { label:'Voice Emotion',     sublabel:'Web Audio API',   component:WaveDemo },
  { label:'Emotion Analytics', sublabel:'face-api.js',     component:EmotionBarsDemo },
  { label:'Gesture Control',   sublabel:'MediaPipe Hands', component:HandSkeletonDemo },
  { label:'Eye Tracking',      sublabel:'face-api.js',     component:GazeDemo },
];

// ── Main ────────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily:'Inter,system-ui,sans-serif', background:'#000', color:'#fff', minHeight:'100vh', position:'relative' }}>
      <StarfieldBackground />

      <div style={{ position:'relative', zIndex:1 }}>

        {/* Hero */}
        <section className="min-h-screen flex items-center px-8 lg:px-16">
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center py-24">

            {/* Text */}
            <div>
              <motion.h1
                initial={{ opacity:0, y:32 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:0.7, ease:[0.22,1,0.36,1] }}
                className="font-black leading-none tracking-tight mb-7"
                style={{ fontSize:'clamp(48px,7vw,88px)', letterSpacing:'-0.04em' }}
              >
                Perceive.
                <br />
                <motion.span initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.25,duration:0.6}} style={{color:ELECTRIC}}>
                  See beyond
                </motion.span>
                <br />
                <motion.span initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.4,duration:0.6}} style={{color:'rgba(255,255,255,0.35)'}}>
                  the surface.
                </motion.span>
              </motion.h1>

              <motion.p
                initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.5,duration:0.5}}
                className="text-base leading-relaxed mb-10 max-w-sm"
                style={{color:'rgba(255,255,255,0.3)'}}
              >
                Real-time face, gesture, and audio analysis.
                13 modes. No installs, no uploads.
              </motion.p>

              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.65,duration:0.4}} className="flex items-center gap-5">
                <button onClick={() => navigate('/app')}
                  className="px-7 py-2.5 rounded text-sm font-semibold text-white transition-opacity hover:opacity-85"
                  style={{background:ELECTRIC}}>
                  Open app
                </button>
                <a href="#demos" className="text-sm transition-colors" style={{color:'rgba(255,255,255,0.25)'}}
                  onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.6)'}
                  onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.25)'}>
                  See live demos ↓
                </a>
              </motion.div>
            </div>

            {/* Robot */}
            <motion.div
              initial={{opacity:0,x:40}} animate={{opacity:1,x:0}}
              transition={{delay:0.3,duration:0.8,ease:[0.22,1,0.36,1]}}
              style={{height:500}}
            >
              <RobotHeroCanvas />
            </motion.div>

          </div>
        </section>

        {/* Demo strip */}
        <section id="demos" style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          <div className="max-w-5xl mx-auto px-6 py-16">
            <motion.p initial={{opacity:0}} whileInView={{opacity:1}} viewport={{once:true}} transition={{duration:0.4}}
              className="text-xs mb-8" style={{color:'rgba(255,255,255,0.2)'}}>
              Live demos
            </motion.p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {DEMOS.map(({label,sublabel,component:Demo},i)=>(
                <motion.div key={label}
                  initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true}}
                  transition={{delay:i*0.07,duration:0.45}}
                  className="rounded-xl overflow-hidden"
                  style={{border:'1px solid rgba(255,255,255,0.07)',background:'#080810',aspectRatio:'4/3'}}>
                  <div className="w-full h-full relative">
                    <Demo />
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5"
                      style={{background:'linear-gradient(to top,rgba(8,8,16,0.95) 0%,transparent 100%)'}}>
                      <div className="text-xs font-semibold" style={{color:'rgba(255,255,255,0.8)'}}>{label}</div>
                      <div className="text-[10px] mt-0.5" style={{color:'rgba(255,255,255,0.28)'}}>{sublabel}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Mode cards */}
        <section id="modes" style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          <div className="max-w-5xl mx-auto px-6 py-20">
            <motion.div initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.4}}
              className="flex items-end justify-between mb-14">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{color:'rgba(0,111,255,0.7)'}}>Platform</div>
                <h2 className="text-2xl font-black" style={{color:'rgba(255,255,255,0.88)'}}>All 13 modes</h2>
              </div>
              <button onClick={()=>navigate('/app')}
                className="text-xs font-semibold transition-opacity hover:opacity-60"
                style={{color:'rgba(255,255,255,0.35)'}}>
                Open app →
              </button>
            </motion.div>

            <div className="space-y-12">
              {SECTIONS.map((section, si) => {
                return (
                  <motion.div key={section.label}
                    initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:'-30px'}}
                    transition={{delay:si*0.06,duration:0.45}}>
                    {/* Section header */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-[11px] font-bold uppercase tracking-widest shrink-0" style={{color:'rgba(0,111,255,0.6)'}}>
                        {section.label}
                      </span>
                      <div className="flex-1 h-px" style={{background:'linear-gradient(to right, rgba(0,111,255,0.2), transparent)'}} />
                    </div>

                    {/* Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {section.modes.map((mode, mi) => (
                        <motion.button key={mode.id}
                          initial={{opacity:0,y:10}} whileInView={{opacity:1,y:0}} viewport={{once:true}}
                          transition={{delay:si*0.06+mi*0.04,duration:0.35}}
                          onClick={()=>navigate(`/app/${mode.id}`)}
                          className="group relative text-left p-4 rounded-xl transition-all duration-200"
                          style={{
                            background:'rgba(255,255,255,0.025)',
                            border:'1px solid rgba(255,255,255,0.07)',
                          }}
                          whileHover={{
                            backgroundColor:'rgba(255,255,255,0.045)',
                            borderColor: 'rgba(0,111,255,0.3)',
                            y: -1,
                          }}
                          transition={{duration:0.15}}>
                          {/* Top row: name + arrow */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-[13px] font-semibold leading-snug transition-colors duration-150 group-hover:text-white"
                              style={{color:'rgba(255,255,255,0.72)'}}>
                              {mode.name}
                            </span>
                            <span className="text-[11px] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                              style={{color:ELECTRIC}}>
                              →
                            </span>
                          </div>
                          {/* Description */}
                          <p className="text-[11px] leading-relaxed" style={{color:'rgba(255,255,255,0.22)'}}>
                            {mode.desc}
                          </p>
                          {/* Bottom accent line on hover */}
                          <div className="absolute bottom-0 left-4 right-4 h-px rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            style={{background:'linear-gradient(to right, rgba(0,111,255,0.4), transparent)'}} />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 pt-16 pb-10" style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          <div className="max-w-5xl mx-auto">
            {/* Top row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-10 mb-12">
              {/* Brand */}
              <div>
                <div className="font-black text-xl tracking-tight mb-2" style={{color:'#fff'}}>Perceive</div>
                <p className="text-xs leading-relaxed max-w-xs" style={{color:'rgba(255,255,255,0.22)'}}>
                  Real-time face, gesture &amp; audio analysis.<br/>
                  13 modes. No installs, no uploads.
                </p>
              </div>

              {/* Links */}
              <div className="flex gap-16">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,0.2)'}}>App</div>
                  <div className="flex flex-col gap-2">
                    {[['Open app', ()=>navigate('/app')], ['Emotion Analytics', ()=>navigate('/app/emotion')], ['Face Filters', ()=>navigate('/app/filters')], ['Gesture Control', ()=>navigate('/app/gesture')]].map(([label, action])=>(
                      <button key={label} onClick={action}
                        className="text-xs text-left transition-colors"
                        style={{color:'rgba(255,255,255,0.3)'}}
                        onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.7)'}
                        onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,0.2)'}}>Links</div>
                  <div className="flex flex-col gap-2">
                    <a href="https://github.com/LightAnd2" target="_blank" rel="noreferrer"
                      className="text-xs transition-colors"
                      style={{color:'rgba(255,255,255,0.3)'}}
                      onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.7)'}
                      onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
                      GitHub
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between pt-6" style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
              <span className="text-[11px]" style={{color:'rgba(255,255,255,0.14)'}}>
                © {new Date().getFullYear()} Perceive
              </span>
              <button onClick={()=>navigate('/app')}
                className="text-xs font-semibold transition-opacity hover:opacity-60"
                style={{color:ELECTRIC}}>
                Launch app →
              </button>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
