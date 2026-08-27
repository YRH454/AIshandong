import{r as c,j as e,m as u}from"./index-DGfOxHmF.js";import{C as h,S as g,u as x}from"./Stars-DhoXyOwS.js";import{A as v,B as y,D as b}from"./three.core-Da7bBtEq.js";const j=`
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`,w=`
uniform float uTime;
varying vec3 vWorldPosition;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  float dist = length(vWorldPosition.xz);

  float innerR = 2.5;
  float outerR = 6.5;

  float innerEdge = smoothstep(innerR - 0.3, innerR, dist);
  float outerEdge = 1.0 - smoothstep(outerR - 0.5, outerR, dist);
  float radialMask = innerEdge * outerEdge;

  if (radialMask < 0.01) discard;

  float t = (dist - innerR) / (outerR - innerR);
  float angle = atan(vWorldPosition.z, vWorldPosition.x);

  float spiral1 = sin(angle * 6.0 + log(dist + 0.1) * 3.0 - uTime * 0.6) * 0.5 + 0.5;
  float spiral2 = sin(angle * 4.0 - log(dist + 0.1) * 2.0 + uTime * 0.4) * 0.5 + 0.5;
  float spiral = spiral1 * 0.6 + spiral2 * 0.4;

  float turb = noise(vec2(angle * 2.0, dist * 1.5 - uTime * 0.3)) * 0.3 + 0.7;
  float brightness = (1.0 - t * 0.6) * (0.25 + 0.75 * spiral) * turb;

  vec3 innerColor = vec3(1.0, 0.97, 0.88);
  vec3 outerColor = vec3(0.92, 0.38, 0.15);
  vec3 color = mix(innerColor, outerColor, t);

  float doppler = cos(angle - uTime * 0.25);
  vec3 blueSide = vec3(0.65, 0.82, 1.0);
  vec3 redSide = vec3(1.0, 0.35, 0.18);
  vec3 dopplerColor = mix(redSide, blueSide, doppler * 0.5 + 0.5);
  color = mix(color, dopplerColor, 0.25);

  float hotCore = (1.0 - smoothstep(innerR, innerR + 1.2, dist)) * 0.5;
  color += vec3(0.3, 0.25, 0.2) * hotCore;

  vec3 finalColor = color * brightness;

  float glow = exp(-abs(dist - outerR) * 2.0) * 0.4 + exp(-abs(dist - innerR) * 3.0) * 0.3;
  finalColor += vec3(0.35, 0.55, 0.75) * glow;

  float outerGlow = exp(-dist * 0.5) * 0.08;
  finalColor += vec3(0.2, 0.4, 0.6) * outerGlow;

  gl_FragColor = vec4(finalColor, radialMask * 0.92);
}
`,M=`
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`,P=`
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 4.0);
  vec3 glowColor = vec3(0.25, 0.45, 0.65) * fresnel * 1.2;
  float alpha = fresnel * 0.7;
  gl_FragColor = vec4(glowColor, alpha);
}
`;function C(){const r=c.useRef(null),s=c.useRef(null),i=c.useMemo(()=>({uTime:{value:0}}),[]);return x(t=>{s.current&&(s.current.uniforms.uTime.value=t.clock.elapsedTime),r.current&&(r.current.rotation.z=t.clock.elapsedTime*.08)}),e.jsxs("mesh",{ref:r,rotation:[-Math.PI/2,0,0],children:[e.jsx("ringGeometry",{args:[2.2,6.8,128]}),e.jsx("shaderMaterial",{ref:s,vertexShader:j,fragmentShader:w,uniforms:i,transparent:!0,side:b,depthWrite:!1,blending:v})]})}function k(){return e.jsxs("group",{children:[e.jsxs("mesh",{children:[e.jsx("sphereGeometry",{args:[1.5,64,64]}),e.jsx("meshBasicMaterial",{color:"#000000"})]}),e.jsxs("mesh",{scale:[1.02,1.02,1.02],children:[e.jsx("sphereGeometry",{args:[1.5,64,64]}),e.jsx("shaderMaterial",{vertexShader:M,fragmentShader:P,transparent:!0,side:y,depthWrite:!1,blending:v})]})]})}function R(){const r=c.useRef(null),s=c.useMemo(()=>{const t=new Float32Array(900),n=new Float32Array(300),l=new Float32Array(300),d=new Float32Array(300),m=new Float32Array(300);for(let o=0;o<300;o++)n[o]=Math.random()*Math.PI*2,l[o]=8+Math.random()*35,d[o]=2e-4+Math.random()*8e-4,m[o]=(Math.random()-.5)*4,t[o*3]=Math.cos(n[o])*l[o],t[o*3+1]=m[o],t[o*3+2]=Math.sin(n[o])*l[o];return{positions:t,angles:n,radii:l,speeds:d,yOffsets:m,count:300}},[]);return x(i=>{if(!r.current)return;const t=r.current.geometry.attributes.position.array,{angles:n,radii:l,speeds:d,yOffsets:m}=s,o=i.clock.elapsedTime;for(let a=0;a<s.count;a++){n[a]+=d[a];const f=l[a],p=Math.sin(o*.15+a*.1)*.002;m[a]+=p,t[a*3]=Math.cos(n[a])*f,t[a*3+1]=m[a],t[a*3+2]=Math.sin(n[a])*f}r.current.geometry.attributes.position.needsUpdate=!0}),e.jsxs("points",{ref:r,children:[e.jsx("bufferGeometry",{children:e.jsx("bufferAttribute",{attach:"attributes-position",args:[s.positions,3]})}),e.jsx("pointsMaterial",{size:.07,color:"#aaccee",transparent:!0,opacity:.45,sizeAttenuation:!0,blending:v,depthWrite:!1})]})}function N({mouseX:r,mouseY:s}){return x(i=>{const t=r*1.5,n=3+s*.8;i.camera.position.x+=(t-i.camera.position.x)*.015,i.camera.position.y+=(n-i.camera.position.y)*.015,i.camera.lookAt(0,0,0)}),null}function A({onEnter:r}){const[s,i]=c.useState(!1),[t,n]=c.useState({x:0,y:0}),l=c.useCallback(d=>{n({x:(d.clientX/window.innerWidth-.5)*2,y:(d.clientY/window.innerHeight-.5)*2})},[]);return e.jsxs("div",{className:"fixed inset-0 z-40",style:{background:"#000000"},onMouseMove:l,children:[e.jsxs(h,{camera:{position:[0,3,18],fov:50,near:.1,far:500},gl:{antialias:!0,alpha:!1},children:[e.jsx("color",{attach:"background",args:["#000000"]}),e.jsx(N,{mouseX:t.x,mouseY:t.y}),e.jsx(k,{}),e.jsx(C,{}),e.jsx(R,{}),e.jsx(g,{radius:400,depth:100,count:15e3,factor:5,saturation:.1,fade:!0,speed:.15})]}),e.jsxs("div",{className:"absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-20 sm:pb-28",children:[e.jsxs(u.div,{initial:{opacity:0,y:30},animate:{opacity:1,y:0},transition:{duration:1.5,delay:.5,ease:"easeOut"},className:"text-center mb-10 sm:mb-14",children:[e.jsx("h1",{className:"text-4xl sm:text-5xl md:text-6xl font-bold text-sci-white sci-text-glow tracking-[0.12em] mb-3",style:{fontFamily:"Orbitron, sans-serif"},children:"太阳系 3D 探索"}),e.jsx("p",{className:"text-xs sm:text-sm text-sci-cyan/50 tracking-[0.4em] uppercase font-light",children:"Interstellar Exploration"})]}),e.jsx(u.div,{initial:{opacity:0},animate:{opacity:1},transition:{duration:1,delay:1.8},children:e.jsxs(u.button,{onClick:r,onMouseEnter:()=>i(!0),onMouseLeave:()=>i(!1),whileHover:{scale:1.05},whileTap:{scale:.95},className:"pointer-events-auto sci-button-primary text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-3.5 rounded-md relative overflow-hidden",style:{boxShadow:s?"0 0 40px rgba(78, 205, 196, 0.35), 0 0 80px rgba(78, 205, 196, 0.1)":"0 0 20px rgba(78, 205, 196, 0.1)"},children:[e.jsxs("span",{className:"relative z-10 flex items-center gap-2",children:["进入探索",e.jsxs("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"}),e.jsx("path",{d:"m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"}),e.jsx("path",{d:"M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"}),e.jsx("path",{d:"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"})]})]}),e.jsx(u.div,{className:"absolute inset-0 bg-sci-cyan/20",initial:{x:"-100%"},animate:{x:s?"0%":"-100%"},transition:{duration:.3}})]})}),e.jsx(u.p,{initial:{opacity:0},animate:{opacity:1},transition:{duration:1,delay:2.5},className:"text-[10px] sm:text-xs text-sci-white/25 mt-6 tracking-wider",children:"移动鼠标探索深空 · 点击按钮开始旅程"})]}),e.jsxs("div",{className:"absolute inset-0 pointer-events-none overflow-hidden",children:[e.jsx("div",{className:"welcome-light-beam",style:{left:"15%",animationDelay:"0s"}}),e.jsx("div",{className:"welcome-light-beam",style:{left:"38%",animationDelay:"2.5s"}}),e.jsx("div",{className:"welcome-light-beam",style:{left:"62%",animationDelay:"5s"}}),e.jsx("div",{className:"welcome-light-beam",style:{left:"85%",animationDelay:"1.2s"}})]})]})}export{A as default};
//# sourceMappingURL=BlackHoleWelcome-i4ayCEl_.js.map
