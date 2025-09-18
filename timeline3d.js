// Musée 3D réaliste (One-file) – charge des assets à la *racine* si présents, sinon fallback.
// Cherche : floor_marble.jpg/png ou floor.jpg/png ; wall_plaster.jpg/png ou wall.jpg/png ; env.hdr (optionnel)
// Compatible Chrome / Edge / Firefox / Safari.

import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'https://esm.sh/three@0.160.0/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/RGBELoader.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.75;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121a2a);

const pmrem = new THREE.PMREMGenerator(renderer);

// ====== ESSAIS D’ASSETS À LA RACINE ======
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
        console.log('[tex ok]', abs);
        resolve(t);
      }, undefined, () => { console.warn('[tex miss]', abs); i++; next(); });
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
        console.log('[HDR ok]', abs);
        const envMap = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose?.(); resolve(envMap);
      }, undefined, ()=>{ console.warn('[HDR miss]', abs); i++; next(); });
    };
    next();
  });
}

// ====== CAMÉRA & CONTROLS ======
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 2.1, 10);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.9, 0);
controls.minDistance = 3.0;
controls.maxDistance = 24.0;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI/2 - 0.05;
controls.enablePan = false;

// ====== TEXTURES PROCÉDURALES (fallback) ======
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
        for(let k=0;k<14;k++){
          const px=x*tx+Math.random()*tx, py=y*ty+Math.random()*ty;
          const ang=Math.random()*Math.PI*2, len=20+Math.random()*50;
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

// ====== ENVIRONNEMENT ======
(async () => {
  // Essaie env.hdr à la racine, sinon RoomEnvironment
  const hdr = await tryLoadHDR(['./env.hdr']);
  if (hdr) scene.environment = hdr;
  else     scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;

  // ====== SALLE ======
  const room = new THREE.Group();
  const W = 28, H = 20, Y = 5.0;

  const floorMap = await tryLoadTexture(['./floor_marble.jpg','./floor_marble.png','./floor.jpg','./floor.png'], [6,6]);
  const wallMap  = await tryLoadTexture(['./wall_plaster.jpg','./wall_plaster.png','./wall.jpg','./wall.png'], [4,2]);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W,H),
    new THREE.MeshStandardMaterial({ map: floorMap || floorProc, roughness:0.6, metalness:0.05 })
  );
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; room.add(floor);

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

  // ====== LUMIÈRES ======
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const hemi = new THREE.HemisphereLight(0xe7f0ff, 0x1b2130, 0.6); hemi.position.set(0,Y,0); scene.add(hemi);
  const dir1 = new THREE.DirectionalLight(0xffffff, 1.0); dir1.position.set(6, Y-1, 7);
  dir1.castShadow = true; dir1.shadow.mapSize.set(1024,1024); dir1.shadow.normalBias = 0.03; scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.65); dir2.position.set(-6, Y-1, -7);
  dir2.castShadow = true; dir2.shadow.mapSize.set(1024,1024); dir2.shadow.normalBias = 0.03; scene.add(dir2);

  RectAreaLightUniformsLib.init();
  function addStrip(x,y,z,rx,ry,rz){
    const l = new THREE.RectAreaLight(0xffffff, 55, 6.0, 0.9);
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

  // ====== Posters & Objets ======
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

  const texLoader2 = new THREE.TextureLoader();
  function loadTextureSmart(url, onOk, onErr){
    if(!url){ onErr?.(); return; }
    const first = new URL(url, location.href).href;
    const base  = url.split('/').pop();
    const fallback = new URL('./'+base, location.href).href;
    const tryLoad = (abs, next)=>{
      console.log('[image] try:', abs);
      texLoader2.load(abs, t=>{ t.colorSpace=THREE.SRGBColorSpace; console.log('[image] ok:', abs); onOk(t); }, undefined,
        e=>{ console.warn('[image] fail:', abs); next?next():onErr?.(e); });
    };
    tryLoad(first, ()=> tryLoad(fallback, ()=> onErr?.()));
  }

  const POSTER_MAX_W=2.6, POSTER_MAX_H=1.7, FRAME_THICK=0.008;
  function fitContain(w,h,maxW,maxH){ const r=w/h; let W=maxW,H=W/r; if(H>maxH){ H=maxH; W=H*r; } return {W,H}; }

  async function addPosterAndLabel({titre, periode, vignette, url, couleur}, wallPos, rotY){
    const g = new THREE.Group(); g.position.copy(wallPos); g.rotation.y = rotY||0;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(POSTER_MAX_W+0.22, POSTER_MAX_H+0.22, FRAME_THICK),
      new THREE.MeshStandardMaterial({ color:0x2f4057, metalness:0.2, roughness:0.35, envMapIntensity:0.25 })
    ); frame.castShadow = true;

    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(POSTER_MAX_W, POSTER_MAX_H),
      new THREE.MeshStandardMaterial({ roughness:0.45, metalness:0.05, envMapIntensity:0.2 })
    );
    poster.position.z = FRAME_THICK/2 + 0.04; // devant
    frame.renderOrder=0; poster.renderOrder=10;
    poster.material.polygonOffset = true; poster.material.polygonOffsetFactor = -1; poster.material.polygonOffsetUnits = 1;

    await new Promise(res=>{
      loadTextureSmart(vignette, (t)=>{
        const {W,H} = fitContain(t.image.width, t.image.height, POSTER_MAX_W, POSTER_MAX_H);
        poster.geometry.dispose(); poster.geometry = new THREE.PlaneGeometry(W,H);
        poster.material.map = t; poster.material.needsUpdate = true; res();
      }, ()=>{ poster.material.map = posterFallbackTexture(titre, periode); res(); });
    });

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.4),
      new THREE.MeshBasicMaterial({ map: labelTexture(titre, periode, couleur||'#e5e7eb'), transparent:true }));
    plate.position.set(0, -1.35, FRAME_THICK/2 + 0.045);

    // spot pour l'œuvre
    const spot = new THREE.SpotLight(0xffffff, 2.2, 8, Math.PI/7, 0.35, 1);
    spot.position.set(0, 1.6, 0.6); spot.target.position.set(0,0,0.1);
    spot.castShadow = true; g.add(spot, spot.target);

    g.userData = { url, titre };
    g.add(frame, poster, plate);
    scene.add(g); interactables.push(g);
    return g;
  }

  // Socles + objets (fallback) + glTF optionnel à la racine
  function makePedestal(color=0x9aa7bd){
    const grp=new THREE.Group();
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.72,0.18,32), new THREE.MeshStandardMaterial({ color:0x6f7e96, roughness:0.75 }));
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.52,0.7,32),   new THREE.MeshStandardMaterial({ color:0x90a0ba, roughness:0.7 }));
    const top =new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.56,0.1,32),   new THREE.MeshStandardMaterial({ color, roughness:0.6 }));
    base.receiveShadow=true; base.castShadow=true; stem.castShadow=true; top.castShadow=true;
    stem.position.y=0.44; top.position.y=0.85; grp.add(base, stem, top); return grp;
  }
  function makeEraProp(kind, color=0xffffff){
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.35, metalness:0.15, envMapIntensity:0.5 });
    let m;
    if(kind==='globe'){
      m=new THREE.Group();
      const s=new THREE.Mesh(new THREE.SphereGeometry(0.28,48,24),mat); s.position.y=0.2;
      const arc=new THREE.Mesh(new THREE.TorusGeometry(0.34,0.02,16,64),mat); arc.rotation.z=Math.PI/2;
      m.add(s,arc);
    } else if(kind==='radio'){
      m=new THREE.Group();
      const body=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.36,0.27,2,2,2),mat); body.position.y=0.2;
      const dial=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.08,32),mat); dial.rotation.z=Math.PI/2; dial.position.set(0.19,0.25,0.14);
      const spk=new THREE.Mesh(new THREE.CircleGeometry(0.095,32), new THREE.MeshStandardMaterial({ color:0x141414, roughness:1 }));
      spk.position.set(-0.19,0.23,0.14); m.add(body,dial,spk);
    } else if(kind==='rocket'){
      m=new THREE.Group();
      const body=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.45,32),mat); body.position.y=0.35;
      const tank=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.25,32),mat); tank.position.y=0.12;
      m.add(tank,body);
    } else if(kind==='banner'){
      m=new THREE.Group();
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.12,20),mat); pole.position.y=0.56;
      const flag=new THREE.Mesh(new THREE.PlaneGeometry(0.62,0.48,1,1), new THREE.MeshStandardMaterial({ color, side:THREE.DoubleSide, roughness:0.7, metalness:0.05 }));
      flag.position.set(0.36,0.86,0); flag.rotation.y=Math.PI/10; m.add(pole,flag);
    } else {
      m=new THREE.Mesh(new THREE.IcosahedronGeometry(0.26,1),mat);
    }
    m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; }});
    return m;
  }
  const gltf = new GLTFLoader();
  function addEraObject({prop, couleur, url, titre, gltfUrl}, pos){
    const holder=new THREE.Group(); holder.position.copy(pos);
    const pedestal=makePedestal(new THREE.Color(couleur||'#9aa7bd')); holder.add(pedestal);
    const place=new THREE.Group(); place.position.set(0,0.95,0); holder.add(place);

    if(gltfUrl){
      const abs=new URL(gltfUrl, location.href).href;
      gltf.load(abs, g=>{
        const model=g.scene||g.scenes?.[0];
        if(model){ model.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } }); model.scale.setScalar(0.8); place.add(model); }
        else { place.add(makeEraProp(prop, new THREE.Color(couleur||'#ffffff'))); }
      }, undefined, ()=> place.add(makeEraProp(prop, new THREE.Color(couleur||'#ffffff'))));
    } else {
      place.add(makeEraProp(prop, new THREE.Color(couleur||'#ffffff')));
    }

    const halo=new THREE.Mesh(new THREE.CircleGeometry(0.9,32), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.08 }));
    halo.rotation.x=-Math.PI/2; halo.position.y=0.011; holder.add(halo);

    holder.userData={ url, titre }; scene.add(holder); interactables.push(holder);
    return holder;
  }

  // Placement : 4 murs + objet ~1.7m devant
  const interactables=[];
  fetch('./periodes.json').then(r=>r.json()).then(async periods=>{
    const n=periods.length, perSide=Math.max(1, Math.ceil(n/4));
    const gapLong=W/(perSide+1), gapShort=H/(perSide+1), y=2.2;
    let i=0;
    for(let side=0; side<4; side++){
      for(let j=0; j<perSide && i<n; j++, i++){
        const p=periods[i];
        let wallPos, rotY=0, outward=new THREE.Vector3(0,0,1);
        if(side===0){ wallPos=new THREE.Vector3(-W/2+gapLong*(j+1), y, -H/2+0.42); outward.set(0,0,1); }
        else if(side===1){ wallPos=new THREE.Vector3(-W/2+gapLong*(j+1), y,  H/2-0.42); rotY=Math.PI; outward.set(0,0,-1); }
        else if(side===2){ wallPos=new THREE.Vector3(-W/2+0.42, y, -H/2+gapShort*(j+1)); rotY=Math.PI/2; outward.set(1,0,0); }
        else { wallPos=new THREE.Vector3( W/2-0.42, y, -H/2+gapShort*(j+1)); rotY=-Math.PI/2; outward.set(-1,0,0); }

        await addPosterAndLabel(p, wallPos, rotY);
        const objPos=wallPos.clone().add(outward.multiplyScalar(1.7)); objPos.y=0;
        addEraObject(p, objPos);
      }
    }
  });

  // Interaction (survol + clic)
  const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
  const tip=document.createElement('div');
  tip.style.cssText='position:fixed;left:0;top:0;transform:translate(-50%,-130%);pointer-events:none;display:none;z-index:10;padding:6px 8px;border-radius:8px;border:1px solid #ffffff33;background:#0f1626cc;color:#fff;font:12px system-ui,Segoe UI,Roboto;white-space:nowrap';
  document.body.appendChild(tip);

  function pick(e, onHit){
    const rect=renderer.domElement.getBoundingClientRect();
    mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
    mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(scene.children,true);
    if(!hits.length) return null;
    let g=hits[0].object; while(g && !g.userData?.url) g=g.parent;
    if(g && onHit) onHit(g); return g;
  }
  addEventListener('mousemove', e=>{
    const g=pick(e, g=>{
      tip.textContent=g.userData.titre||'Ouvrir';
      tip.style.left=e.clientX+'px'; tip.style.top=e.clientY+'px';
      tip.style.display='block'; document.body.style.cursor='pointer';
    });
    if(!g){ tip.style.display='none'; document.body.style.cursor='default'; }
  });
  addEventListener('click', e=>{ pick(e, g=> window.open(g.userData.url,'_blank','noopener')); });

  // Rendu
  addEventListener('resize', ()=>{
    renderer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  });
  (function loop(){ controls.update(); renderer.render(scene,camera); requestAnimationFrame(loop); })();

})(); // fin async IIFE
