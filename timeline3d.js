// Galerie 3D – Voyage historique (tableaux cliquables + objets d'époque)
// Compatible Chrome / Edge / Firefox / Safari (GitHub Pages)
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x162133);

// ---- Caméra & contrôles (centre, pas de sol, zoom borné) ----
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 2.1, 10);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.9, 0);
controls.minDistance = 3.0;     // zoom minimum (plus grand => empêche de trop s'approcher)
controls.maxDistance = 24.0;    // zoom maximum
controls.minPolarAngle = 0.12;  // empêche de passer sous l'horizon (ne “tombe” plus sous le sol)
controls.maxPolarAngle = Math.PI/2 - 0.05;
controls.enablePan = false;

// ---- Salle “musée” lumineuse ----
const room = new THREE.Group();
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a3b54, roughness: 0.78, metalness: 0.05 });
const wallMat  = new THREE.MeshStandardMaterial({ color: 0x314763, roughness: 0.92, metalness: 0.02 });

const W = 28, H = 20, Y = 4.8;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), floorMat);
floor.rotation.x = -Math.PI/2; room.add(floor);
const ceil  = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
ceil.rotation.x =  Math.PI/2; ceil.position.y = Y; room.add(ceil);

const wallLong = new THREE.PlaneGeometry(W, Y);
const wallShort= new THREE.PlaneGeometry(H, Y);
const back  = new THREE.Mesh(wallLong, wallMat);  back.position.set(0,Y/2,-H/2); room.add(back);
const front = new THREE.Mesh(wallLong, wallMat);  front.rotation.y = Math.PI; front.position.set(0,Y/2, H/2); room.add(front);
const left  = new THREE.Mesh(wallShort,wallMat);  left.rotation.y =  Math.PI/2; left.position.set(-W/2,Y/2,0); room.add(left);
const right = new THREE.Mesh(wallShort,wallMat);  right.rotation.y = -Math.PI/2; right.position.set( W/2,Y/2,0); room.add(right);
scene.add(room);

// Éclairage clair & homogène
scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const hemi = new THREE.HemisphereLight(0xe7f0ff, 0x1b2130, 0.9); hemi.position.set(0, Y, 0); scene.add(hemi);
const dir1 = new THREE.DirectionalLight(0xffffff, 0.9); dir1.position.set( 4, Y-1,  6); scene.add(dir1);
const dir2 = new THREE.DirectionalLight(0xffffff, 0.7); dir2.position.set(-4, Y-1, -6); scene.add(dir2);

// ----- utilitaires étiquettes & textures -----
function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const words=(text||'').split(' '); let line=''; let yy=y;
  for (let n=0;n<words.length;n++){ const t=line+words[n]+' ';
    if (ctx.measureText(t).width>maxWidth && n>0){ ctx.fillText(line,x,yy); line=words[n]+' '; yy+=lineHeight; }
    else line=t;
  } ctx.fillText(line, x, yy);
}
function labelTexture(title, subtitle, color='#e5e7eb'){
  const W=512,H=150,c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(15,18,28,0.92)'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.strokeRect(4,4,W-8,H-8);
  ctx.fillStyle=color; ctx.font='bold 32px system-ui,Segoe UI,Roboto';
  ctx.fillText(title.slice(0,28), 18, 58);
  ctx.fillStyle='#bfc8d6'; ctx.font='20px system-ui,Segoe UI,Roboto';
  ctx.fillText(subtitle, 18, 108);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
function posterFallbackTexture(title, subtitle){
  const W=1024,H=768,c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#22344c'); g.addColorStop(1,'#19273a');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,0.28)'; ctx.lineWidth=14; ctx.strokeRect(18,18,W-36,H-36);
  ctx.fillStyle='#eef2f7'; ctx.font='bold 54px system-ui,Segoe UI,Roboto'; wrapText(ctx,title,64,220,W-128,58);
  ctx.fillStyle='#cfd8e6'; ctx.font='30px system-ui,Segoe UI,Roboto'; ctx.fillText(subtitle||'',64,H-80);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
const texLoader = new THREE.TextureLoader();
function loadTextureAbs(url, onOk, onErr){
  if(!url){ onErr?.(); return; }
  const abs = new URL(url, location.href).href; // résout en URL absolue (OK pour /HENRIDECODE/)
  texLoader.load(abs, (t)=>{ t.colorSpace=THREE.SRGBColorSpace; onOk(t); }, undefined, onErr);
}

// ----- création d’un “tableau” cliquable sur le mur -----
const POSTER_MAX_W = 2.6, POSTER_MAX_H = 1.7;
const FRAME_THICK  = 0.02; // cadre fin pour ne pas cacher l'image
function fitContain(w,h,maxW,maxH){ const r=w/h; let W=maxW,H=W/r; if(H>maxH){ H=maxH; W=H*r; } return {W,H}; }

async function addPosterAndLabel({titre, periode, vignette, url, couleur}, wallPos, rotY){
  const group = new THREE.Group(); group.position.copy(wallPos); group.rotation.y = rotY||0;

  // cadre (boîte très peu profonde)
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(POSTER_MAX_W+0.22, POSTER_MAX_H+0.22, FRAME_THICK),
    new THREE.MeshStandardMaterial({ color:0x2f4057, metalness:0.2, roughness:0.35 })
  );

  // image (devant le cadre)
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(POSTER_MAX_W, POSTER_MAX_H),
    new THREE.MeshStandardMaterial({ roughness:0.5 }));
  poster.position.z = FRAME_THICK/2 + 0.01;

  await new Promise(res=>{
    loadTextureAbs(vignette, (t)=>{
      const {W,H} = fitContain(t.image.width, t.image.height, POSTER_MAX_W, POSTER_MAX_H);
      poster.geometry.dispose(); poster.geometry = new THREE.PlaneGeometry(W,H);
      poster.material.map = t; poster.material.needsUpdate = true; res();
    }, ()=>{ poster.material.map = posterFallbackTexture(titre, periode); res(); });
  });

  // cartel
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.4),
    new THREE.MeshBasicMaterial({ map: labelTexture(titre, periode, couleur||'#e5e7eb'), transparent:true }));
  plate.position.set(0, -1.35, FRAME_THICK/2 + 0.012);

  // clic
  group.userData = { url, titre };
  group.add(frame, poster, plate);
  scene.add(group);
  interactables.push(group);
  return group;
}

// ----- objets d’époque (socle + prop primitive) -----
function makePedestal(color=0x9aa7bd){
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.7,0.2,24), new THREE.MeshStandardMaterial({ color:0x6f7e96, roughness:0.7 }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.5,0.7,24), new THREE.MeshStandardMaterial({ color:0x90a0ba, roughness:0.7 }));
  const top  = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.1,24), new THREE.MeshStandardMaterial({ color, roughness:0.6 }));
  stem.position.y = 0.45; top.position.y = 0.85;
  g.add(base, stem, top); return g;
}
function makeEraProp(kind, color=0xffffff){
  const mat = new THREE.MeshStandardMaterial({ color, roughness:0.4, metalness:0.1 });
  if(kind==='column'){
    const col = new THREE.Group();
    col.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2,1.0,24), mat));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.06,24), mat); cap.position.y = 0.53; col.add(cap);
    return col;
  }
  if(kind==='banner'){
    const p = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.1,16), mat); pole.position.y=0.55;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6,0.45), new THREE.MeshStandardMaterial({ color, roughness:0.6, side:THREE.DoubleSide }));
    flag.position.set(0.35, 0.85, 0); flag.rotation.y = Math.PI/10;
    p.add(pole, flag); return p;
  }
  if(kind==='globe'){
    const g = new THREE.Group();
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16), mat); sphere.position.y=0.2;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.02, 16, 48), mat); arc.rotation.z = Math.PI/2;
    g.add(sphere, arc); return g;
  }
  if(kind==='radio'){
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.35,0.25), mat); body.position.y=0.2;
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.08,24), mat); dial.rotation.z = Math.PI/2; dial.position.set(0.18,0.25,0.13);
    const spk  = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), new THREE.MeshStandardMaterial({ color:0x111, metalness:0, roughness:1 })); spk.position.set(-0.18,0.23,0.13);
    b.add(body, dial, spk); return b;
  }
  if(kind==='rocket'){
    const r = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.12,0.45,24), mat); body.position.y = 0.35;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.25,24), mat); tank.position.y=0.12;
    r.add(tank, body); return r;
  }
  return new THREE.Mesh(new THREE.IcosahedronGeometry(0.25,0), mat);
}
function addEraObject({prop, couleur, url, titre}, anchorPos, outward){
  const holder = new THREE.Group(); holder.position.copy(anchorPos);
  const pedestal = makePedestal(new THREE.Color(couleur||'#9aa7bd')); holder.add(pedestal);
  const place = new THREE.Group(); place.position.set(0, 0.95, 0); holder.add(place);
  place.add(makeEraProp(prop, new THREE.Color(couleur||'#ffffff')));
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.08 }));
  halo.rotation.x = -Math.PI/2; halo.position.y = 0.01; holder.add(halo);
  holder.userData = { url, titre };
  scene.add(holder);
  interactables.push(holder);
  return holder;
}

// ----- Placement périodique : 4 murs + objet devant -----
const interactables = [];  // tableaux et objets cliquables

fetch('./periodes.json').then(r=>r.json()).then(async periods=>{
  const n = periods.length;
  const perSide = Math.max(1, Math.ceil(n/4));
  const gapLong = W  / (perSide + 1);
  const gapShort= H  / (perSide + 1);
  const posterY = 2.1;
  let i = 0;

  for (let side=0; side<4; side++){
    for (let j=0; j<perSide && i<n; j++, i++){
      const p = periods[i];
      let wallPos, rotY = 0, outward = new THREE.Vector3(0,0,1);

      if (side===0){ // fond (z < 0)
        wallPos = new THREE.Vector3(-W/2 + gapLong*(j+1), posterY, -H/2+0.4);
        outward.set(0,0,1);
      } else if (side===1){ // devant (z > 0)
        wallPos = new THREE.Vector3(-W/2 + gapLong*(j+1), posterY, H/2-0.4);
        rotY = Math.PI; outward.set(0,0,-1);
      } else if (side===2){ // gauche (x < 0)
        wallPos = new THREE.Vector3(-W/2+0.4, posterY, -H/2 + gapShort*(j+1));
        rotY = Math.PI/2; outward.set(1,0,0);
      } else { // droite (x > 0)
        wallPos = new THREE.Vector3(W/2-0.4, posterY, -H/2 + gapShort*(j+1));
        rotY = -Math.PI/2; outward.set(-1,0,0);
      }

      const poster = await addPosterAndLabel({
        titre: p.titre, periode: p.periode, vignette: p.vignette, url: p.url, couleur: p.couleur
      }, wallPos, rotY);

      // objet à ~1.6m du mur vers le centre
      const objPos = wallPos.clone().add(outward.clone().multiplyScalar(1.6)).setY(0);
      addEraObject({prop:p.prop, couleur:p.couleur, url:p.url, titre:p.titre}, objPos, outward);
    }
  }
});

// ----- Survol + clic -----
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
const tip = document.createElement('div');
tip.style.cssText='position:fixed;left:0;top:0;transform:translate(-50%,-130%);pointer-events:none;display:none;z-index:10;padding:6px 8px;border-radius:8px;border:1px solid #ffffff33;background:#0f1626cc;color:#fff;font:12px system-ui,Segoe UI,Roboto;white-space:nowrap';
document.body.appendChild(tip);

function pick(e, onHit){
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(interactables, true);
  if (!hits.length) return null;
  let g = hits[0].object;
  while (g && !g.userData.url) g = g.parent;
  if (g && onHit) onHit(g);
  return g;
}
addEventListener('mousemove', e=>{
  const g = pick(e, g=>{
    tip.textContent = (g.userData.titre || 'Ouvrir');
    tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
    tip.style.display = 'block'; document.body.style.cursor = 'pointer';
  });
  if (!g){ tip.style.display='none'; document.body.style.cursor='default'; }
});
addEventListener('click', e=>{
  pick(e, g=> window.open(g.userData.url, '_blank', 'noopener'));
});

// ----- Resize + rendu -----
addEventListener('resize', ()=>{
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
(function loop(){ controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();
