// Musée 3D – LÉGER (affiches seules) + Zoom fort + double-clic focus + cadres dorés
// Assets optionnels à la RACINE : floor_marble.jpg/png ou floor.jpg/png ; wall_plaster.jpg/png ou wall.jpg/png ; env.hdr
// Compatible Chrome / Edge / Firefox / Safari.

import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'https://esm.sh/three@0.160.0/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RGBELoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/RGBELoader.js';

const SHADOWS = false;            // ombres coupées (perf)
const ZOOM_MIN_DIST = 0.35;       // distance mini au target (zoom molette)
const ZOOM_FOCUS_DIST = 0.6;      // distance lors du double-clic focus
const ZOOM_FOCUS_TIME = 0.85;     // durée animation (s)

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.7;
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121a2a);

const pmrem = new THREE.PMREMGenerator(renderer);

// ====== utilitaires chargement d'assets à la RACINE ======
const texLoader = new THREE.TextureLoader();
function tryLoadTexture(paths, repeat=[1,1]) {
  return new Promise(resolve => {
    let i = 0;
    const next = () => {
      if (i >= paths.length) return resolve(null);
      const abs = new URL(paths[i], location.href).href;
      texLoader.load(abs, t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        t.colorSpace = THREE.SRGBColorSpace;
        t.repeat.set(repeat[0], repeat[1]);
        resolve(t);
      }, undefined, () => { i++; next(); });
    };
    next();
  });
}
async function tryLoadHDR(paths){
  return new Promise(resolve=>{
    let i=0; const loader = new RGBELoader();
    const next=()=>{
      if(i>=paths.length) return resolve(null);
      const abs = new URL(paths[i], location.href).href;
      loader.load(abs, hdr=>{
        const envMap = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose?.(); resolve(envMap);
      }, undefined, ()=>{ i++; next(); });
    };
    next();
  });
}

// ====== caméra & contrôles (zoom fort activé) ======
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 300); // near réduit pour gros zoom
camera.position.set(0, 2.1, 10);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.9, 0);
controls.minDistance = ZOOM_MIN_DIST;  // on peut s'approcher très près
controls.maxDistance = 24.0;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI/2 - 0.05;
controls.enablePan = false;
controls.enableZoom = true;
controls.zoomSpeed = 1.2;
// Zoom vers le curseur si dispo (r155+)—sinon ignoré sans erreur
if ('zoomToCursor' in controls) controls.zoomToCursor = true;

// ====== fallback textures procédurales ======
function proceduralTexture({w=1024,h=1024, draw}){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const ctx = c.getContext('2d'); draw(ctx,w,h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const floorProc = proceduralTexture({
  draw(ctx,W,H){
    ctx.fillStyle = '#ddd'; ctx.fillRect(0,0,W,H);
    const tiles=6, tx=W/tiles, ty=H/tiles;
    for(let y=0;y<tiles;y++){
      for(let x=0;x<tiles;x++){
        if((x+y)%2){ ctx.fillStyle='#cfcfcf'; ctx.fillRect(x*tx,y*ty,tx,ty); }
        ctx.strokeStyle='rgba(180,180,180,0.6)'; ctx.lineWidth=1;
        for(let k=0;k<12;k++){
          const px=x*tx+Math.random()*tx, py=y*ty+Math.random()*ty;
          const ang=Math.random()*Math.PI*2, len=15+Math.random()*40;
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+Math.cos(ang)*len, py+Math.sin(ang)*len); ctx.stroke();
        }
      }
    }
  }
});
const wallProc = proceduralTexture({
  draw(ctx,W,H){
    const img = ctx.createImageData(W,H); const d = img.data;
    for(let i=0;i<W*H;i++){
      const n = 150 + (Math.random()*36-18);
      d[i*4+0]=n*0.92; d[i*4+1]=n*0.96; d[i*4+2]=n*1.04; d[i*4+3]=255;
    } ctx.putImageData(img,0,0);
  }
});

// ====== scène principale ======
(async () => {
  // Environnement HDR optionnel
  const hdr = await tryLoadHDR(['./env.hdr']);
  scene.environment = hdr || pmrem.fromScene(new RoomEnvironment(), 0.03).texture;

  // Salle
  const room = new THREE.Group();
  const W = 28, H = 20, Y = 5.0;

  const floorMap = await tryLoadTexture(['./floor_marble.jpg','./floor_marble.png','./floor.jpg','./floor.png'], [6,6]);
  const wallMap  = await tryLoadTexture(['./wall_plaster.jpg','./wall_plaster.png','./wall.jpg','./wall.png'], [4,2]);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W,H),
    new THREE.MeshStandardMaterial({ map: floorMap || floorProc, roughness:0.6, metalness:0.05 })
  );
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = SHADOWS; room.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallMap || wallProc, roughness:0.95, metalness:0.0 });
  const ceilMat = new THREE.MeshStandardMaterial({ map: wallMap || wallProc, roughness:0.98, metalness:0.0 });

  const wallLong = new THREE.PlaneGeometry(W,Y);
  const wallShort= new THREE.PlaneGeometry(H,Y);
  const back  = new THREE.Mesh(wallLong, wallMat);  back.position.set(0,Y/2,-H/2); room.add(back);
  const front = new THREE.Mesh(wallLong, wallMat);  front.rotation.y = Math.PI; front.position.set(0,Y/2, H/2); room.add(front);
  const left  = new THREE.Mesh(wallShort,wallMat);  left.rotation.y =  Math.PI/2; left.position.set(-W/2,Y/2,0); room.add(left);
  const right = new THREE.Mesh(wallShort,wallMat);  right.rotation.y = -Math.PI/2; right.position.set( W/2,Y/2,0); room.add(right);
  const ceil  = new THREE.Mesh(new THREE.PlaneGeometry(W,H), ceilMat); ceil.rotation.x =  Math.PI/2; ceil.position.y = Y; room.add(ceil);
  scene.add(room);

  // Plinthes
  const plinthMat = new THREE.MeshStandardMaterial({ color:0x182334, roughness:0.85 });
  const baseH=0.18, bbLong=new THREE.BoxGeometry(W,baseH,0.05), bbShort=new THREE.BoxGeometry(H,baseH,0.05);
  for (const {geom,pos,rot} of [
    {geom:bbLong,pos:[0,baseH/2,-H/2+0.02],rot:0},
    {geom:bbLong,pos:[0,baseH/2, H/2-0.02],rot:0},
    {geom:bbShort,pos:[-W/2+0.02,baseH/2,0],rot:Math.PI/2},
    {geom:bbShort,pos:[ W/2-0.02,baseH/2,0],rot:Math.PI/2},
  ]){
    const m=new THREE.Mesh(geom,plinthMat); m.position.set(...pos); m.rotation.y=rot; room.add(m);
  }

  // Lumière
  scene.add(new THREE.AmbientLight(0xffffff, 0.38));
  const hemi = new THREE.HemisphereLight(0xe7f0ff, 0x1b2130, 0.65); hemi.position.set(0,Y,0); scene.add(hemi);

  const dir1 = new THREE.DirectionalLight(0xffffff, 0.9); dir1.position.set(6, Y-1, 7);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.6); dir2.position.set(-6, Y-1, -7);
  dir1.castShadow = dir2.castShadow = SHADOWS;
  if (SHADOWS){
    dir1.shadow.mapSize.set(1024,1024); dir1.shadow.normalBias = 0.03;
    dir2.shadow.mapSize.set(1024,1024); dir2.shadow.normalBias = 0.03;
  }
  scene.add(dir1, dir2);

  // Néons plafond (RectAreaLight)
  RectAreaLightUniformsLib.init();
  function addStrip(x,y,z,rx,ry,rz){
    const l = new THREE.RectAreaLight(0xffffff, 50, 6.0, 0.9);
    l.position.set(x,y,z); l.rotation.set(rx,ry,rz); scene.add(l);
  }
  const ly = Y-0.4;
  addStrip(-9, ly, -H/2+0.4, -Math.PI/2.2, 0, 0);
  addStrip(  0, ly, -H/2+0.4, -Math.PI/2.2, 0, 0);
  addStrip(  9, ly, -H/2+0.4, -Math.PI/2.2, 0, 0);
  addStrip(-9, ly,  H/2-0.4, -Math.PI/2.2, Math.PI, 0);
  addStrip(  0, ly,  H/2-0.4, -Math.PI/2.2, Math.PI, 0);
  addStrip(  9, ly,  H/2-0.4, -Math.PI/2.2, Math.PI, 0);
  addStrip(-W/2+0.4, ly, -6, -Math.PI/2.2,  Math.PI/2, 0);
  addStrip(-W/2+0.4, ly,  0, -Math.PI/2.2,  Math.PI/2, 0);
  addStrip(-W/2+0.4, ly,  6, -Math.PI/2.2,  Math.PI/2, 0);
  addStrip( W/2-0.4, ly, -6, -Math.PI/2.2, -Math.PI/2, 0);
  addStrip( W/2-0.4, ly,  0, -Math.PI/2.2, -Math.PI/2, 0);
  addStrip( W/2-0.4, ly,  6, -Math.PI/2.2, -Math.PI/2, 0);

  // ====== affiches cliquables ======
  function wrapText(ctx, text, x, y, maxW, lh){
    const words=(text||'').split(' '); let line='', yy=y;
    for(let n=0;n<words.length;n++){ const t=line+words[n]+' ';
      if(ctx.measureText(t).width>maxW && n>0){ ctx.fillText(line,x,yy); line=words[n]+' '; yy+=lh; }
      else line=t;
    } ctx.fillText(line,x,yy);
  }
  function labelTexture(title, subtitle, color='#e5e7eb'){
    const W=512,H=150,c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
    ctx.fillStyle='rgba(15,18,28,0.92)'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.strokeRect(4,4,W-8,H-8);
    ctx.fillStyle=color; ctx.font='bold 32px system-ui,Segoe UI,Roboto';
    ctx.fillText((title||'').slice(0,28), 18, 58);
    ctx.fillStyle='#bfc8d6'; ctx.font='20px system-ui,Segoe UI,Roboto';
    ctx.fillText(subtitle||'', 18, 108);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex;
  }
  function posterFallbackTexture(title, subtitle){
    const W=1024,H=768,c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#22344c'); g.addColorStop(1,'#19273a');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.28)'; ctx.lineWidth=14; ctx.strokeRect(18,18,W-36,H-36);
    ctx.fillStyle='#eef2f7'; ctx.font='bold 54px system-ui,Segoe UI,Roboto'; wrapText(ctx,title||'',64,220,W-128,58);
    ctx.fillStyle='#cfd8e6'; ctx.font='30px system-ui,Segoe UI,Roboto'; ctx.fillText(subtitle||'',64,H-80);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex;
  }

  // charge image : essaie chemin du JSON puis racine
  const texLoader2 = new THREE.TextureLoader();
  function loadTextureSmart(url, onOk, onErr){
    if(!url){ onErr?.(); return; }
    const first = new URL(url, location.href).href;
    const base  = url.split('/').pop();
    const fallback = new URL('./'+base, location.href).href;
    const tryLoad = (abs, next)=>{
      texLoader2.load(abs, t=>{ t.colorSpace=THREE.SRGBColorSpace; onOk(t); }, undefined,
        e=>{ next?next():onErr?.(e); });
    };
    tryLoad(first, ()=> tryLoad(fallback, ()=> onErr?.()));
  }

  // Cadre doré PBR
  function goldMaterial(){
    return new THREE.MeshPhysicalMaterial({
      color: 0xC8A64B, // doré
      metalness: 1.0,
      roughness: 0.22,
      envMapIntensity: 1.2,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2
    });
  }

  const POSTER_MAX_W=2.6, POSTER_MAX_H=1.7, FRAME_THICK=0.02;
  function fitContain(w,h,maxW,maxH){ const r=w/h; let W=maxW,H=W/r; if(H>maxH){ H=maxH; W=H*r; } return {W,H}; }

  const interactables = [];

  async function addPosterAndLabel({titre, periode, vignette, url, couleur}, wallPos, rotY){
    const g = new THREE.Group(); g.position.copy(wallPos); g.rotation.y = rotY||0;

    // Cadre doré (fine boîte)
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(POSTER_MAX_W+0.24, POSTER_MAX_H+0.24, FRAME_THICK),
      goldMaterial()
    );
    frame.castShadow = SHADOWS;

    // Image (devant le cadre)
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(POSTER_MAX_W, POSTER_MAX_H),
      new THREE.MeshStandardMaterial({ roughness:0.45, metalness:0.05, envMapIntensity:0.2 })
    );
    poster.position.z = FRAME_THICK/2 + 0.04; // clairement devant
    frame.renderOrder=0; poster.renderOrder=10;
    poster.material.polygonOffset = true; poster.material.polygonOffsetFactor = -1; poster.material.polygonOffsetUnits = 1;

    await new Promise(res=>{
      loadTextureSmart(vignette, (t)=>{
        const {W,H} = fitContain(t.image.width, t.image.height, POSTER_MAX_W, POSTER_MAX_H);
        poster.geometry.dispose(); poster.geometry = new THREE.PlaneGeometry(W,H);
        poster.material.map = t; poster.material.needsUpdate = true; res();
      }, ()=>{ poster.material.map = posterFallbackTexture(titre, periode); res(); });
    });

    // Cartel
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.4),
      new THREE.MeshBasicMaterial({ map: labelTexture(titre, periode, couleur||'#e5e7eb'), transparent:true }));
    plate.position.set(0, -1.35, FRAME_THICK/2 + 0.045);

    g.userData = { url, titre, _isPoster:true };
    g.add(frame, poster, plate);
    scene.add(g); interactables.push(g);
    return g;
  }

  // Placement : répartit les affiches sur 4 murs
  fetch('./periodes.json').then(r=>r.json()).then(async periods=>{
    const n=periods.length, perSide=Math.max(1, Math.ceil(n/4));
    const gapLong=W/(perSide+1), gapShort=H/(perSide+1), y=2.2;
    let i=0;
    for(let side=0; side<4; side++){
      for(let j=0; j<perSide && i<n; j++, i++){
        const p=periods[i];
        let wallPos, rotY=0;
        if(side===0){ wallPos=new THREE.Vector3(-W/2+gapLong*(j+1), y, -H/2+0.42); }
        else if(side===1){ wallPos=new THREE.Vector3(-W/2+gapLong*(j+1), y,  H/2-0.42); rotY=Math.PI; }
        else if(side===2){ wallPos=new THREE.Vector3(-W/2+0.42, y, -H/2+gapShort*(j+1)); rotY=Math.PI/2; }
        else { wallPos=new THREE.Vector3( W/2-0.42, y, -H/2+gapShort*(j+1)); rotY=-Math.PI/2; }
        await addPosterAndLabel(p, wallPos, rotY);
      }
    }
  });

  // ====== Interaction (survol, clic, double-clic focus) ======
  const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
  const tip=document.createElement('div');
  tip.style.cssText='position:fixed;left:0;top:0;transform:translate(-50%,-130%);pointer-events:none;display:none;z-index:10;padding:6px 8px;border-radius:8px;border:1px solid #ffffff33;background:#0f1626cc;color:#fff;font:12px system-ui,Segoe UI,Roboto;white-space:nowrap';
  document.body.appendChild(tip);

  function pick(clientX, clientY){
    const rect=renderer.domElement.getBoundingClientRect();
    mouse.x=((clientX-rect.left)/rect.width)*2-1;
    mouse.y=-((clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(interactables, true);
    if(!hits.length) return null;
    let g=hits[0].object; while(g && !g.userData?.url) g=g.parent;
    return g;
  }

  addEventListener('mousemove', e=>{
    const g = pick(e.clientX, e.clientY);
    if(g){
      tip.textContent=g.userData.titre||'Ouvrir';
      tip.style.left=e.clientX+'px'; tip.style.top=e.clientY+'px';
      tip.style.display='block'; document.body.style.cursor='pointer';
    } else {
      tip.style.display='none'; document.body.style.cursor='default';
    }
  });

  // Clic = ouvrir la page
  addEventListener('click', e=>{
    const g = pick(e.clientX, e.clientY);
    if (g) window.open(g.userData.url,'_blank','noopener');
  });

  // Double-clic = focus / zoom smooth sur le tableau
  let zoomAnim = null; // {t0, dur, fromPos, fromTarget, toPos, toTarget}
  addEventListener('dblclick', e=>{
    const g = pick(e.clientX, e.clientY);
    if(!g || !g.userData?._isPoster) return;

    // cible = position monde du groupe (centre du cadre)
    const target = new THREE.Vector3();
    g.getWorldPosition(target);

    // direction depuis centre de la salle vers le tableau → on se place "en face"
    const toCenter = new THREE.Vector3(0, target.y, 0);
    const dir = target.clone().sub(toCenter).normalize().multiplyScalar(-1); // vers la salle
    if (dir.lengthSq() < 1e-6) dir.set(0,0,1); // fallback

    const toTarget = target.clone();
    const toPos    = target.clone().add(dir.multiplyScalar(ZOOM_FOCUS_DIST)).setY(1.85);

    zoomAnim = {
      t0: performance.now()/1000,
      dur: ZOOM_FOCUS_TIME,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos, toTarget
    };
  });

  // Rendu + animation zoom
  addEventListener('resize', ()=>{
    renderer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  });

  function ease(t){ // easeInOutCubic
    return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
  }

  (function loop(){
    const now = performance.now()/1000;

    if (zoomAnim){
      const u = (now - zoomAnim.t0) / zoomAnim.dur;
      if (u >= 1){
        camera.position.copy(zoomAnim.toPos);
        controls.target.copy(zoomAnim.toTarget);
        zoomAnim = null;
      } else {
        const k = ease(Math.max(0, Math.min(1, u)));
        camera.position.lerpVectors(zoomAnim.fromPos, zoomAnim.toPos, k);
        controls.target.lerpVectors(zoomAnim.fromTarget, zoomAnim.toTarget, k);
      }
    }

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })();

})();
