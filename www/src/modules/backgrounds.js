/**
 * 3D Satellite Background Animation
 * A lightweight, vanilla JS canvas animation system.
 * Renders a full-screen wireframe satellite behind all UI elements.
 */

export function initBackgrounds() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = 0, height = 0, w2 = 0, h2 = 0, time = 0;

  const EMERALD = [16, 185, 129];
  const CYAN    = [34, 211, 238];
  const AMBER   = [245, 158, 11];

  // ── 3D helpers ──
  function rotate3D(p, ax, ay, az) {
    let { x, y, z } = p;
    let y1 = y*Math.cos(ax) - z*Math.sin(ax);
    let z1 = y*Math.sin(ax) + z*Math.cos(ax);
    y = y1; z = z1;
    let x2 = x*Math.cos(ay) - z*Math.sin(ay);
    let z2 = x*Math.sin(ay) + z*Math.cos(ay);
    x = x2; z = z2;
    let x3 = x*Math.cos(az) - y*Math.sin(az);
    let y3 = x*Math.sin(az) + y*Math.cos(az);
    return { x: x3, y: y3, z };
  }

  // ═══════════════════════════════════════════
  // SATELLITE (3D wireframe with orbit rings)
  // ═══════════════════════════════════════════
  const satPolys = [];
  function generateSatellite() {
    satPolys.length = 0;
    function addQuad(p1,p2,p3,p4,type) { satPolys.push({pts:[p1,p2,p3,p4],type}); }
    const bR=30, bH=90;
    for (let i=0;i<6;i++) {
      const a1=(i/6)*Math.PI*2, a2=((i+1)/6)*Math.PI*2;
      const x1=Math.cos(a1)*bR,z1=Math.sin(a1)*bR,x2=Math.cos(a2)*bR,z2=Math.sin(a2)*bR;
      addQuad({x:x1,y:-bH/2,z:z1},{x:x2,y:-bH/2,z:z2},{x:x2,y:bH/2,z:z2},{x:x1,y:bH/2,z:z1},'body');
    }
    const pW=140,pH=35;
    addQuad({x:bR,y:-pH/2,z:0},{x:bR+pW,y:-pH/2,z:0},{x:bR+pW,y:pH/2,z:0},{x:bR,y:pH/2,z:0},'panel');
    addQuad({x:-bR,y:-pH/2,z:0},{x:-bR-pW,y:-pH/2,z:0},{x:-bR-pW,y:pH/2,z:0},{x:-bR,y:pH/2,z:0},'panel');
    const dR=35,dO=bH/2+10;
    for (let i=0;i<8;i++) {
      const a1=(i/8)*Math.PI*2,a2=((i+1)/8)*Math.PI*2;
      addQuad({x:0,y:dO,z:0},{x:Math.cos(a1)*dR,y:dO+15,z:Math.sin(a1)*dR},{x:Math.cos(a2)*dR,y:dO+15,z:Math.sin(a2)*dR},{x:0,y:dO,z:0},'dish');
    }
  }

  function drawSatellite() {
    const sc=Math.min(width,height)/500, fov=400, vy=h2;
    const ax=time*0.008, ay=time*0.01, az=time*0.005;
    const projected=[];
    for (const poly of satPolys) {
      const pp=[]; let avgZ=0;
      for (const p of poly.pts) {
        const rp=rotate3D(p,ax,ay,az);
        const tz=rp.z+300+Math.sin(time*0.01)*80, ty=rp.y+Math.cos(time*0.015)*40;
        const s=fov/(fov+tz);
        pp.push({x:rp.x*s*sc+w2, y:ty*s*sc+vy}); avgZ+=tz;
      }
      projected.push({pts:pp, z:avgZ/4, type:poly.type});
    }
    projected.sort((a,b)=>b.z-a.z);
    for (const p of projected) {
      ctx.beginPath();
      for (let i=0;i<p.pts.length;i++) { if(!i) ctx.moveTo(p.pts[i].x,p.pts[i].y); else ctx.lineTo(p.pts[i].x,p.pts[i].y); }
      ctx.closePath();
      if (p.type==='panel') {
        ctx.fillStyle=`rgba(${CYAN.join(',')},0.12)`; ctx.strokeStyle=`rgba(${CYAN.join(',')},0.6)`;
      } else if (p.type==='dish') {
        ctx.fillStyle=`rgba(${AMBER.join(',')},0.1)`; ctx.strokeStyle=`rgba(${AMBER.join(',')},0.5)`;
      } else {
        ctx.fillStyle=`rgba(${EMERALD.join(',')},0.08)`; ctx.strokeStyle=`rgba(${EMERALD.join(',')},0.7)`;
      }
      ctx.lineWidth=1.5; ctx.fill(); ctx.stroke();
    }
    for (let ring=0;ring<2;ring++) {
      ctx.beginPath();
      const rR=(120+ring*60)*sc, rT=0.3+ring*0.15;
      for (let a=0;a<=Math.PI*2;a+=0.05) {
        const px=Math.cos(a+time*0.003)*rR+w2, py=Math.sin(a+time*0.003)*rR*rT+vy;
        if(!a) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.strokeStyle=`rgba(${EMERALD.join(',')},${0.08+ring*0.04})`; ctx.lineWidth=0.5; ctx.stroke();
    }
    const scanY=(time*1.5)%height;
    ctx.beginPath(); ctx.moveTo(0,scanY); ctx.lineTo(width,scanY);
    ctx.strokeStyle=`rgba(${EMERALD.join(',')},0.08)`; ctx.lineWidth=1; ctx.stroke();
  }

  // ═══════════════════════════════════════════
  // RENDER LOOP — satellite only, no transitions
  // ═══════════════════════════════════════════
  function resize() {
    width=window.innerWidth; height=window.innerHeight;
    canvas.width=width; canvas.height=height;
    w2=width/2; h2=height/2;
  }

  function render() {
    time += 1;
    ctx.clearRect(0,0,width,height);
    ctx.globalAlpha=1.0;
    ctx.lineJoin='round';

    drawSatellite();

    // Subtle vignette overlay
    const vig=ctx.createRadialGradient(w2,h2,height*0.2,w2,h2,height*0.8);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.3)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,width,height);

    requestAnimationFrame(render);
  }

  window.addEventListener('resize', resize);
  resize();
  generateSatellite();
  render();
}
