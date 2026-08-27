import{r as f,c as Yt,u as B,g as Zt,a as Tt,b as Ze,j as c,p as vt,d as $t,e as Xt,S as Ct,O as Ie,f as lt,h as Dt,s as Kt}from"./index-DGfOxHmF.js";import{a as Q,u as be,U as xt,C as qt,S as Qt}from"./Stars-DhoXyOwS.js";import{g as Jt,a as en}from"./planetTextures-DkBLy-_2.js";import{D as xe,V as C,a as $,P as ze,O as Be,R as tn,S as yt,Q as bt,M as Ee,T as Pe,b as nn,c as sn,I as on,F as wt,d as it,e as je,W as rn,f as ut,g as Rt,h as an,U as St,i as cn,j as _e,L as ln,k as un,l as dn,C as ot,B as rt}from"./three.core-Da7bBtEq.js";function Ae(){return Ae=Object.assign?Object.assign.bind():function(i){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var e in n)({}).hasOwnProperty.call(n,e)&&(i[e]=n[e])}return i},Ae.apply(null,arguments)}const Ue=new C,dt=new C,fn=new C,Mt=new $;function hn(i,t,n){const e=Ue.setFromMatrixPosition(i.matrixWorld);e.project(t);const o=n.width/2,r=n.height/2;return[e.x*o+o,-(e.y*r)+r]}function pn(i,t){const n=Ue.setFromMatrixPosition(i.matrixWorld),e=dt.setFromMatrixPosition(t.matrixWorld),o=n.sub(e),r=t.getWorldDirection(fn);return o.angleTo(r)>Math.PI/2}function mn(i,t,n,e){const o=Ue.setFromMatrixPosition(i.matrixWorld),r=o.clone();r.project(t),Mt.set(r.x,r.y),n.setFromCamera(Mt,t);const p=n.intersectObjects(e,!0);if(p.length){const a=p[0].distance;return o.distanceTo(n.ray.origin)<a}return!0}function gn(i,t){if(t instanceof Be)return t.zoom;if(t instanceof ze){const n=Ue.setFromMatrixPosition(i.matrixWorld),e=dt.setFromMatrixPosition(t.matrixWorld),o=t.fov*Math.PI/180,r=n.distanceTo(e);return 1/(2*Math.tan(o/2)*r)}else return 1}function vn(i,t,n){if(t instanceof ze||t instanceof Be){const e=Ue.setFromMatrixPosition(i.matrixWorld),o=dt.setFromMatrixPosition(t.matrixWorld),r=e.distanceTo(o),p=(n[1]-n[0])/(t.far-t.near),a=n[1]-p*t.far;return Math.round(p*r+a)}}const at=i=>Math.abs(i)<1e-10?0:i;function It(i,t,n=""){let e="matrix3d(";for(let o=0;o!==16;o++)e+=at(t[o]*i.elements[o])+(o!==15?",":")");return n+e}const xn=(i=>t=>It(t,i))([1,-1,1,1,1,-1,1,1,1,-1,1,1,1,-1,1,1]),yn=(i=>(t,n)=>It(t,i(n),"translate(-50%,-50%)"))(i=>[1/i,1/i,1/i,1,-1/i,-1/i,-1/i,-1,1/i,1/i,1/i,1,1,1,1,1]);function bn(i){return i&&typeof i=="object"&&"current"in i}const wn=f.forwardRef(({children:i,eps:t=.001,style:n,className:e,prepend:o,center:r,fullscreen:p,portal:a,distanceFactor:d,sprite:A=!1,transform:h=!1,occlude:g,onOcclude:E,castShadow:U,receiveShadow:S,material:x,geometry:N,zIndexRange:L=[16777271,0],calculatePosition:P=hn,as:b="div",wrapperClass:M,pointerEvents:j="auto",...m},_)=>{const{gl:R,camera:u,scene:y,size:O,raycaster:Z,events:z,viewport:V}=Q(),[D]=f.useState(()=>document.createElement(b)),X=f.useRef(),H=f.useRef(null),re=f.useRef(0),de=f.useRef([0,0]),J=f.useRef(null),me=f.useRef(null),ae=(a==null?void 0:a.current)||z.connected||R.domElement.parentNode,K=f.useRef(null),ge=f.useRef(!1),we=f.useMemo(()=>g&&g!=="blending"||Array.isArray(g)&&g.length&&bn(g[0]),[g]);f.useLayoutEffect(()=>{const Y=R.domElement;g&&g==="blending"?(Y.style.zIndex=`${Math.floor(L[0]/2)}`,Y.style.position="absolute",Y.style.pointerEvents="none"):(Y.style.zIndex=null,Y.style.position=null,Y.style.pointerEvents=null)},[g]),f.useLayoutEffect(()=>{if(H.current){const Y=X.current=Yt(D);if(y.updateMatrixWorld(),h)D.style.cssText="position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;";else{const I=P(H.current,u,O);D.style.cssText=`position:absolute;top:0;left:0;transform:translate3d(${I[0]}px,${I[1]}px,0);transform-origin:0 0;`}return ae&&(o?ae.prepend(D):ae.appendChild(D)),()=>{ae&&ae.removeChild(D),Y.unmount()}}},[ae,h]),f.useLayoutEffect(()=>{M&&(D.className=M)},[M]);const Oe=f.useMemo(()=>h?{position:"absolute",top:0,left:0,width:O.width,height:O.height,transformStyle:"preserve-3d",pointerEvents:"none"}:{position:"absolute",transform:r?"translate3d(-50%,-50%,0)":"none",...p&&{top:-O.height/2,left:-O.width/2,width:O.width,height:O.height},...n},[n,r,p,O,h]),$e=f.useMemo(()=>({position:"absolute",pointerEvents:j}),[j]);f.useLayoutEffect(()=>{if(ge.current=!1,h){var Y;(Y=X.current)==null||Y.render(f.createElement("div",{ref:J,style:Oe},f.createElement("div",{ref:me,style:$e},f.createElement("div",{ref:_,className:e,style:n,children:i}))))}else{var I;(I=X.current)==null||I.render(f.createElement("div",{ref:_,style:Oe,className:e,children:i}))}});const fe=f.useRef(!0);be(Y=>{if(H.current){u.updateMatrixWorld(),H.current.updateWorldMatrix(!0,!1);const I=h?de.current:P(H.current,u,O);if(h||Math.abs(re.current-u.zoom)>t||Math.abs(de.current[0]-I[0])>t||Math.abs(de.current[1]-I[1])>t){const ee=pn(H.current,u);let q=!1;we&&(Array.isArray(g)?q=g.map(te=>te.current):g!=="blending"&&(q=[y]));const he=fe.current;if(q){const te=mn(H.current,u,Z,q);fe.current=te&&!ee}else fe.current=!ee;he!==fe.current&&(E?E(!fe.current):D.style.display=fe.current?"block":"none");const Se=Math.floor(L[0]/2),Xe=g?we?[L[0],Se]:[Se-1,0]:L;if(D.style.zIndex=`${vn(H.current,u,Xe)}`,h){const[te,Le]=[O.width/2,O.height/2],Me=u.projectionMatrix.elements[5]*Le,{isOrthographicCamera:Fe,top:Ke,left:He,bottom:Te,right:ve}=u,qe=xn(u.matrixWorldInverse),Qe=Fe?`scale(${Me})translate(${at(-(ve+He)/2)}px,${at((Ke+Te)/2)}px)`:`translateZ(${Me}px)`;let ne=H.current.matrixWorld;A&&(ne=u.matrixWorldInverse.clone().transpose().copyPosition(ne).scale(H.current.scale),ne.elements[3]=ne.elements[7]=ne.elements[11]=0,ne.elements[15]=1),D.style.width=O.width+"px",D.style.height=O.height+"px",D.style.perspective=Fe?"":`${Me}px`,J.current&&me.current&&(J.current.style.transform=`${Qe}${qe}translate(${te}px,${Le}px)`,me.current.style.transform=yn(ne,1/((d||10)/400)))}else{const te=d===void 0?1:gn(H.current,u)*d;D.style.transform=`translate3d(${I[0]}px,${I[1]}px,0) scale(${te})`}de.current=I,re.current=u.zoom}}if(!we&&K.current&&!ge.current)if(h){if(J.current){const I=J.current.children[0];if(I!=null&&I.clientWidth&&I!=null&&I.clientHeight){const{isOrthographicCamera:ee}=u;if(ee||N)m.scale&&(Array.isArray(m.scale)?m.scale instanceof C?K.current.scale.copy(m.scale.clone().divideScalar(1)):K.current.scale.set(1/m.scale[0],1/m.scale[1],1/m.scale[2]):K.current.scale.setScalar(1/m.scale));else{const q=(d||10)/400,he=I.clientWidth*q,Se=I.clientHeight*q;K.current.scale.set(he,Se,1)}ge.current=!0}}}else{const I=D.children[0];if(I!=null&&I.clientWidth&&I!=null&&I.clientHeight){const ee=1/V.factor,q=I.clientWidth*ee,he=I.clientHeight*ee;K.current.scale.set(q,he,1),ge.current=!0}K.current.lookAt(Y.camera.position)}});const Ne=f.useMemo(()=>({vertexShader:h?void 0:`
          /*
            This shader is from the THREE's SpriteMaterial.
            We need to turn the backing plane into a Sprite
            (make it always face the camera) if "transfrom"
            is false.
          */
          #include <common>

          void main() {
            vec2 center = vec2(0., 1.);
            float rotation = 0.0;

            // This is somewhat arbitrary, but it seems to work well
            // Need to figure out how to derive this dynamically if it even matters
            float size = 0.03;

            vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
            vec2 scale;
            scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
            scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );

            bool isPerspective = isPerspectiveMatrix( projectionMatrix );
            if ( isPerspective ) scale *= - mvPosition.z;

            vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale * size;
            vec2 rotatedPosition;
            rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
            rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
            mvPosition.xy += rotatedPosition;

            gl_Position = projectionMatrix * mvPosition;
          }
      `,fragmentShader:`
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      `}),[h]);return f.createElement("group",Ae({},m,{ref:H}),g&&!we&&f.createElement("mesh",{castShadow:U,receiveShadow:S,ref:K},N||f.createElement("planeGeometry",null),x||f.createElement("shaderMaterial",{side:xe,vertexShader:Ne.vertexShader,fragmentShader:Ne.fragmentShader})))}),zt=parseInt(tn.replace(/\D+/g,"")),Bt=zt>=125?"uv1":"uv2";var Sn=Object.defineProperty,Mn=(i,t,n)=>t in i?Sn(i,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):i[t]=n,En=(i,t,n)=>(Mn(i,t+"",n),n);class Pn{constructor(){En(this,"_listeners")}addEventListener(t,n){this._listeners===void 0&&(this._listeners={});const e=this._listeners;e[t]===void 0&&(e[t]=[]),e[t].indexOf(n)===-1&&e[t].push(n)}hasEventListener(t,n){if(this._listeners===void 0)return!1;const e=this._listeners;return e[t]!==void 0&&e[t].indexOf(n)!==-1}removeEventListener(t,n){if(this._listeners===void 0)return;const o=this._listeners[t];if(o!==void 0){const r=o.indexOf(n);r!==-1&&o.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const e=this._listeners[t.type];if(e!==void 0){t.target=this;const o=e.slice(0);for(let r=0,p=o.length;r<p;r++)o[r].call(this,t);t.target=null}}}var jn=Object.defineProperty,An=(i,t,n)=>t in i?jn(i,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):i[t]=n,v=(i,t,n)=>(An(i,typeof t!="symbol"?t+"":t,n),n);const We=new nn,Et=new sn,_n=Math.cos(70*(Math.PI/180)),Pt=(i,t)=>(i%t+t)%t;let On=class extends Pn{constructor(t,n){super(),v(this,"object"),v(this,"domElement"),v(this,"enabled",!0),v(this,"target",new C),v(this,"minDistance",0),v(this,"maxDistance",1/0),v(this,"minZoom",0),v(this,"maxZoom",1/0),v(this,"minPolarAngle",0),v(this,"maxPolarAngle",Math.PI),v(this,"minAzimuthAngle",-1/0),v(this,"maxAzimuthAngle",1/0),v(this,"enableDamping",!1),v(this,"dampingFactor",.05),v(this,"enableZoom",!0),v(this,"zoomSpeed",1),v(this,"enableRotate",!0),v(this,"rotateSpeed",1),v(this,"enablePan",!0),v(this,"panSpeed",1),v(this,"screenSpacePanning",!0),v(this,"keyPanSpeed",7),v(this,"zoomToCursor",!1),v(this,"autoRotate",!1),v(this,"autoRotateSpeed",2),v(this,"reverseOrbit",!1),v(this,"reverseHorizontalOrbit",!1),v(this,"reverseVerticalOrbit",!1),v(this,"keys",{LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"}),v(this,"mouseButtons",{LEFT:Ee.ROTATE,MIDDLE:Ee.DOLLY,RIGHT:Ee.PAN}),v(this,"touches",{ONE:Pe.ROTATE,TWO:Pe.DOLLY_PAN}),v(this,"target0"),v(this,"position0"),v(this,"zoom0"),v(this,"_domElementKeyEvents",null),v(this,"getPolarAngle"),v(this,"getAzimuthalAngle"),v(this,"setPolarAngle"),v(this,"setAzimuthalAngle"),v(this,"getDistance"),v(this,"getZoomScale"),v(this,"listenToKeyEvents"),v(this,"stopListenToKeyEvents"),v(this,"saveState"),v(this,"reset"),v(this,"update"),v(this,"connect"),v(this,"dispose"),v(this,"dollyIn"),v(this,"dollyOut"),v(this,"getScale"),v(this,"setScale"),this.object=t,this.domElement=n,this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this.getPolarAngle=()=>h.phi,this.getAzimuthalAngle=()=>h.theta,this.setPolarAngle=s=>{let l=Pt(s,2*Math.PI),w=h.phi;w<0&&(w+=2*Math.PI),l<0&&(l+=2*Math.PI);let T=Math.abs(l-w);2*Math.PI-T<T&&(l<w?l+=2*Math.PI:w+=2*Math.PI),g.phi=l-w,e.update()},this.setAzimuthalAngle=s=>{let l=Pt(s,2*Math.PI),w=h.theta;w<0&&(w+=2*Math.PI),l<0&&(l+=2*Math.PI);let T=Math.abs(l-w);2*Math.PI-T<T&&(l<w?l+=2*Math.PI:w+=2*Math.PI),g.theta=l-w,e.update()},this.getDistance=()=>e.object.position.distanceTo(e.target),this.listenToKeyEvents=s=>{s.addEventListener("keydown",Je),this._domElementKeyEvents=s},this.stopListenToKeyEvents=()=>{this._domElementKeyEvents.removeEventListener("keydown",Je),this._domElementKeyEvents=null},this.saveState=()=>{e.target0.copy(e.target),e.position0.copy(e.object.position),e.zoom0=e.object.zoom},this.reset=()=>{e.target.copy(e.target0),e.object.position.copy(e.position0),e.object.zoom=e.zoom0,e.object.updateProjectionMatrix(),e.dispatchEvent(o),e.update(),d=a.NONE},this.update=(()=>{const s=new C,l=new C(0,1,0),w=new bt().setFromUnitVectors(t.up,l),T=w.clone().invert(),F=new C,ce=new bt,pe=2*Math.PI;return function(){const gt=e.object.position;w.setFromUnitVectors(t.up,l),T.copy(w).invert(),s.copy(gt).sub(e.target),s.applyQuaternion(w),h.setFromVector3(s),e.autoRotate&&d===a.NONE&&V(Z()),e.enableDamping?(h.theta+=g.theta*e.dampingFactor,h.phi+=g.phi*e.dampingFactor):(h.theta+=g.theta,h.phi+=g.phi);let le=e.minAzimuthAngle,ue=e.maxAzimuthAngle;isFinite(le)&&isFinite(ue)&&(le<-Math.PI?le+=pe:le>Math.PI&&(le-=pe),ue<-Math.PI?ue+=pe:ue>Math.PI&&(ue-=pe),le<=ue?h.theta=Math.max(le,Math.min(ue,h.theta)):h.theta=h.theta>(le+ue)/2?Math.max(le,h.theta):Math.min(ue,h.theta)),h.phi=Math.max(e.minPolarAngle,Math.min(e.maxPolarAngle,h.phi)),h.makeSafe(),e.enableDamping===!0?e.target.addScaledVector(U,e.dampingFactor):e.target.add(U),e.zoomToCursor&&u||e.object.isOrthographicCamera?h.radius=K(h.radius):h.radius=K(h.radius*E),s.setFromSpherical(h),s.applyQuaternion(T),gt.copy(e.target).add(s),e.object.matrixAutoUpdate||e.object.updateMatrix(),e.object.lookAt(e.target),e.enableDamping===!0?(g.theta*=1-e.dampingFactor,g.phi*=1-e.dampingFactor,U.multiplyScalar(1-e.dampingFactor)):(g.set(0,0,0),U.set(0,0,0));let Ce=!1;if(e.zoomToCursor&&u){let De=null;if(e.object instanceof ze&&e.object.isPerspectiveCamera){const Re=s.length();De=K(Re*E);const ke=Re-De;e.object.position.addScaledVector(_,ke),e.object.updateMatrixWorld()}else if(e.object.isOrthographicCamera){const Re=new C(R.x,R.y,0);Re.unproject(e.object),e.object.zoom=Math.max(e.minZoom,Math.min(e.maxZoom,e.object.zoom/E)),e.object.updateProjectionMatrix(),Ce=!0;const ke=new C(R.x,R.y,0);ke.unproject(e.object),e.object.position.sub(ke).add(Re),e.object.updateMatrixWorld(),De=s.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),e.zoomToCursor=!1;De!==null&&(e.screenSpacePanning?e.target.set(0,0,-1).transformDirection(e.object.matrix).multiplyScalar(De).add(e.object.position):(We.origin.copy(e.object.position),We.direction.set(0,0,-1).transformDirection(e.object.matrix),Math.abs(e.object.up.dot(We.direction))<_n?t.lookAt(e.target):(Et.setFromNormalAndCoplanarPoint(e.object.up,e.target),We.intersectPlane(Et,e.target))))}else e.object instanceof Be&&e.object.isOrthographicCamera&&(Ce=E!==1,Ce&&(e.object.zoom=Math.max(e.minZoom,Math.min(e.maxZoom,e.object.zoom/E)),e.object.updateProjectionMatrix()));return E=1,u=!1,Ce||F.distanceToSquared(e.object.position)>A||8*(1-ce.dot(e.object.quaternion))>A?(e.dispatchEvent(o),F.copy(e.object.position),ce.copy(e.object.quaternion),Ce=!1,!0):!1}})(),this.connect=s=>{e.domElement=s,e.domElement.style.touchAction="none",e.domElement.addEventListener("contextmenu",pt),e.domElement.addEventListener("pointerdown",He),e.domElement.addEventListener("pointercancel",ve),e.domElement.addEventListener("wheel",ne)},this.dispose=()=>{var s,l,w,T,F,ce;e.domElement&&(e.domElement.style.touchAction="auto"),(s=e.domElement)==null||s.removeEventListener("contextmenu",pt),(l=e.domElement)==null||l.removeEventListener("pointerdown",He),(w=e.domElement)==null||w.removeEventListener("pointercancel",ve),(T=e.domElement)==null||T.removeEventListener("wheel",ne),(F=e.domElement)==null||F.ownerDocument.removeEventListener("pointermove",Te),(ce=e.domElement)==null||ce.ownerDocument.removeEventListener("pointerup",ve),e._domElementKeyEvents!==null&&e._domElementKeyEvents.removeEventListener("keydown",Je)};const e=this,o={type:"change"},r={type:"start"},p={type:"end"},a={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6};let d=a.NONE;const A=1e-6,h=new yt,g=new yt;let E=1;const U=new C,S=new $,x=new $,N=new $,L=new $,P=new $,b=new $,M=new $,j=new $,m=new $,_=new C,R=new $;let u=!1;const y=[],O={};function Z(){return 2*Math.PI/60/60*e.autoRotateSpeed}function z(){return Math.pow(.95,e.zoomSpeed)}function V(s){e.reverseOrbit||e.reverseHorizontalOrbit?g.theta+=s:g.theta-=s}function D(s){e.reverseOrbit||e.reverseVerticalOrbit?g.phi+=s:g.phi-=s}const X=(()=>{const s=new C;return function(w,T){s.setFromMatrixColumn(T,0),s.multiplyScalar(-w),U.add(s)}})(),H=(()=>{const s=new C;return function(w,T){e.screenSpacePanning===!0?s.setFromMatrixColumn(T,1):(s.setFromMatrixColumn(T,0),s.crossVectors(e.object.up,s)),s.multiplyScalar(w),U.add(s)}})(),re=(()=>{const s=new C;return function(w,T){const F=e.domElement;if(F&&e.object instanceof ze&&e.object.isPerspectiveCamera){const ce=e.object.position;s.copy(ce).sub(e.target);let pe=s.length();pe*=Math.tan(e.object.fov/2*Math.PI/180),X(2*w*pe/F.clientHeight,e.object.matrix),H(2*T*pe/F.clientHeight,e.object.matrix)}else F&&e.object instanceof Be&&e.object.isOrthographicCamera?(X(w*(e.object.right-e.object.left)/e.object.zoom/F.clientWidth,e.object.matrix),H(T*(e.object.top-e.object.bottom)/e.object.zoom/F.clientHeight,e.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),e.enablePan=!1)}})();function de(s){e.object instanceof ze&&e.object.isPerspectiveCamera||e.object instanceof Be&&e.object.isOrthographicCamera?E=s:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),e.enableZoom=!1)}function J(s){de(E/s)}function me(s){de(E*s)}function ae(s){if(!e.zoomToCursor||!e.domElement)return;u=!0;const l=e.domElement.getBoundingClientRect(),w=s.clientX-l.left,T=s.clientY-l.top,F=l.width,ce=l.height;R.x=w/F*2-1,R.y=-(T/ce)*2+1,_.set(R.x,R.y,1).unproject(e.object).sub(e.object.position).normalize()}function K(s){return Math.max(e.minDistance,Math.min(e.maxDistance,s))}function ge(s){S.set(s.clientX,s.clientY)}function we(s){ae(s),M.set(s.clientX,s.clientY)}function Oe(s){L.set(s.clientX,s.clientY)}function $e(s){x.set(s.clientX,s.clientY),N.subVectors(x,S).multiplyScalar(e.rotateSpeed);const l=e.domElement;l&&(V(2*Math.PI*N.x/l.clientHeight),D(2*Math.PI*N.y/l.clientHeight)),S.copy(x),e.update()}function fe(s){j.set(s.clientX,s.clientY),m.subVectors(j,M),m.y>0?J(z()):m.y<0&&me(z()),M.copy(j),e.update()}function Ne(s){P.set(s.clientX,s.clientY),b.subVectors(P,L).multiplyScalar(e.panSpeed),re(b.x,b.y),L.copy(P),e.update()}function Y(s){ae(s),s.deltaY<0?me(z()):s.deltaY>0&&J(z()),e.update()}function I(s){let l=!1;switch(s.code){case e.keys.UP:re(0,e.keyPanSpeed),l=!0;break;case e.keys.BOTTOM:re(0,-e.keyPanSpeed),l=!0;break;case e.keys.LEFT:re(e.keyPanSpeed,0),l=!0;break;case e.keys.RIGHT:re(-e.keyPanSpeed,0),l=!0;break}l&&(s.preventDefault(),e.update())}function ee(){if(y.length==1)S.set(y[0].pageX,y[0].pageY);else{const s=.5*(y[0].pageX+y[1].pageX),l=.5*(y[0].pageY+y[1].pageY);S.set(s,l)}}function q(){if(y.length==1)L.set(y[0].pageX,y[0].pageY);else{const s=.5*(y[0].pageX+y[1].pageX),l=.5*(y[0].pageY+y[1].pageY);L.set(s,l)}}function he(){const s=y[0].pageX-y[1].pageX,l=y[0].pageY-y[1].pageY,w=Math.sqrt(s*s+l*l);M.set(0,w)}function Se(){e.enableZoom&&he(),e.enablePan&&q()}function Xe(){e.enableZoom&&he(),e.enableRotate&&ee()}function te(s){if(y.length==1)x.set(s.pageX,s.pageY);else{const w=et(s),T=.5*(s.pageX+w.x),F=.5*(s.pageY+w.y);x.set(T,F)}N.subVectors(x,S).multiplyScalar(e.rotateSpeed);const l=e.domElement;l&&(V(2*Math.PI*N.x/l.clientHeight),D(2*Math.PI*N.y/l.clientHeight)),S.copy(x)}function Le(s){if(y.length==1)P.set(s.pageX,s.pageY);else{const l=et(s),w=.5*(s.pageX+l.x),T=.5*(s.pageY+l.y);P.set(w,T)}b.subVectors(P,L).multiplyScalar(e.panSpeed),re(b.x,b.y),L.copy(P)}function Me(s){const l=et(s),w=s.pageX-l.x,T=s.pageY-l.y,F=Math.sqrt(w*w+T*T);j.set(0,F),m.set(0,Math.pow(j.y/M.y,e.zoomSpeed)),J(m.y),M.copy(j)}function Fe(s){e.enableZoom&&Me(s),e.enablePan&&Le(s)}function Ke(s){e.enableZoom&&Me(s),e.enableRotate&&te(s)}function He(s){var l,w;e.enabled!==!1&&(y.length===0&&((l=e.domElement)==null||l.ownerDocument.addEventListener("pointermove",Te),(w=e.domElement)==null||w.ownerDocument.addEventListener("pointerup",ve)),Gt(s),s.pointerType==="touch"?kt(s):qe(s))}function Te(s){e.enabled!==!1&&(s.pointerType==="touch"?Wt(s):Qe(s))}function ve(s){var l,w,T;Vt(s),y.length===0&&((l=e.domElement)==null||l.releasePointerCapture(s.pointerId),(w=e.domElement)==null||w.ownerDocument.removeEventListener("pointermove",Te),(T=e.domElement)==null||T.ownerDocument.removeEventListener("pointerup",ve)),e.dispatchEvent(p),d=a.NONE}function qe(s){let l;switch(s.button){case 0:l=e.mouseButtons.LEFT;break;case 1:l=e.mouseButtons.MIDDLE;break;case 2:l=e.mouseButtons.RIGHT;break;default:l=-1}switch(l){case Ee.DOLLY:if(e.enableZoom===!1)return;we(s),d=a.DOLLY;break;case Ee.ROTATE:if(s.ctrlKey||s.metaKey||s.shiftKey){if(e.enablePan===!1)return;Oe(s),d=a.PAN}else{if(e.enableRotate===!1)return;ge(s),d=a.ROTATE}break;case Ee.PAN:if(s.ctrlKey||s.metaKey||s.shiftKey){if(e.enableRotate===!1)return;ge(s),d=a.ROTATE}else{if(e.enablePan===!1)return;Oe(s),d=a.PAN}break;default:d=a.NONE}d!==a.NONE&&e.dispatchEvent(r)}function Qe(s){if(e.enabled!==!1)switch(d){case a.ROTATE:if(e.enableRotate===!1)return;$e(s);break;case a.DOLLY:if(e.enableZoom===!1)return;fe(s);break;case a.PAN:if(e.enablePan===!1)return;Ne(s);break}}function ne(s){e.enabled===!1||e.enableZoom===!1||d!==a.NONE&&d!==a.ROTATE||(s.preventDefault(),e.dispatchEvent(r),Y(s),e.dispatchEvent(p))}function Je(s){e.enabled===!1||e.enablePan===!1||I(s)}function kt(s){switch(mt(s),y.length){case 1:switch(e.touches.ONE){case Pe.ROTATE:if(e.enableRotate===!1)return;ee(),d=a.TOUCH_ROTATE;break;case Pe.PAN:if(e.enablePan===!1)return;q(),d=a.TOUCH_PAN;break;default:d=a.NONE}break;case 2:switch(e.touches.TWO){case Pe.DOLLY_PAN:if(e.enableZoom===!1&&e.enablePan===!1)return;Se(),d=a.TOUCH_DOLLY_PAN;break;case Pe.DOLLY_ROTATE:if(e.enableZoom===!1&&e.enableRotate===!1)return;Xe(),d=a.TOUCH_DOLLY_ROTATE;break;default:d=a.NONE}break;default:d=a.NONE}d!==a.NONE&&e.dispatchEvent(r)}function Wt(s){switch(mt(s),d){case a.TOUCH_ROTATE:if(e.enableRotate===!1)return;te(s),e.update();break;case a.TOUCH_PAN:if(e.enablePan===!1)return;Le(s),e.update();break;case a.TOUCH_DOLLY_PAN:if(e.enableZoom===!1&&e.enablePan===!1)return;Fe(s),e.update();break;case a.TOUCH_DOLLY_ROTATE:if(e.enableZoom===!1&&e.enableRotate===!1)return;Ke(s),e.update();break;default:d=a.NONE}}function pt(s){e.enabled!==!1&&s.preventDefault()}function Gt(s){y.push(s)}function Vt(s){delete O[s.pointerId];for(let l=0;l<y.length;l++)if(y[l].pointerId==s.pointerId){y.splice(l,1);return}}function mt(s){let l=O[s.pointerId];l===void 0&&(l=new $,O[s.pointerId]=l),l.set(s.pageX,s.pageY)}function et(s){const l=s.pointerId===y[0].pointerId?y[1]:y[0];return O[l.pointerId]}this.dollyIn=(s=z())=>{me(s),e.update()},this.dollyOut=(s=z())=>{J(s),e.update()},this.getScale=()=>E,this.setScale=s=>{de(s),e.update()},this.getZoomScale=()=>z(),n!==void 0&&this.connect(n),this.update()}};const jt=new ut,Ge=new C;class ft extends on{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry";const t=[-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],n=[-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],e=[0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5];this.setIndex(e),this.setAttribute("position",new wt(t,3)),this.setAttribute("uv",new wt(n,2))}applyMatrix4(t){const n=this.attributes.instanceStart,e=this.attributes.instanceEnd;return n!==void 0&&(n.applyMatrix4(t),e.applyMatrix4(t),n.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(t){let n;t instanceof Float32Array?n=t:Array.isArray(t)&&(n=new Float32Array(t));const e=new it(n,6,1);return this.setAttribute("instanceStart",new je(e,3,0)),this.setAttribute("instanceEnd",new je(e,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(t,n=3){let e;t instanceof Float32Array?e=t:Array.isArray(t)&&(e=new Float32Array(t));const o=new it(e,n*2,1);return this.setAttribute("instanceColorStart",new je(o,n,0)),this.setAttribute("instanceColorEnd",new je(o,n,n)),this}fromWireframeGeometry(t){return this.setPositions(t.attributes.position.array),this}fromEdgesGeometry(t){return this.setPositions(t.attributes.position.array),this}fromMesh(t){return this.fromWireframeGeometry(new rn(t.geometry)),this}fromLineSegments(t){const n=t.geometry;return this.setPositions(n.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ut);const t=this.attributes.instanceStart,n=this.attributes.instanceEnd;t!==void 0&&n!==void 0&&(this.boundingBox.setFromBufferAttribute(t),jt.setFromBufferAttribute(n),this.boundingBox.union(jt))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Rt),this.boundingBox===null&&this.computeBoundingBox();const t=this.attributes.instanceStart,n=this.attributes.instanceEnd;if(t!==void 0&&n!==void 0){const e=this.boundingSphere.center;this.boundingBox.getCenter(e);let o=0;for(let r=0,p=t.count;r<p;r++)Ge.fromBufferAttribute(t,r),o=Math.max(o,e.distanceToSquared(Ge)),Ge.fromBufferAttribute(n,r),o=Math.max(o,e.distanceToSquared(Ge));this.boundingSphere.radius=Math.sqrt(o),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}applyMatrix(t){return console.warn("THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4()."),this.applyMatrix4(t)}}class Ut extends ft{constructor(){super(),this.isLineGeometry=!0,this.type="LineGeometry"}setPositions(t){const n=t.length-3,e=new Float32Array(2*n);for(let o=0;o<n;o+=3)e[2*o]=t[o],e[2*o+1]=t[o+1],e[2*o+2]=t[o+2],e[2*o+3]=t[o+3],e[2*o+4]=t[o+4],e[2*o+5]=t[o+5];return super.setPositions(e),this}setColors(t,n=3){const e=t.length-n,o=new Float32Array(2*e);if(n===3)for(let r=0;r<e;r+=n)o[2*r]=t[r],o[2*r+1]=t[r+1],o[2*r+2]=t[r+2],o[2*r+3]=t[r+3],o[2*r+4]=t[r+4],o[2*r+5]=t[r+5];else for(let r=0;r<e;r+=n)o[2*r]=t[r],o[2*r+1]=t[r+1],o[2*r+2]=t[r+2],o[2*r+3]=t[r+3],o[2*r+4]=t[r+4],o[2*r+5]=t[r+5],o[2*r+6]=t[r+6],o[2*r+7]=t[r+7];return super.setColors(o,n),this}fromLine(t){const n=t.geometry;return this.setPositions(n.attributes.position.array),this}}class ht extends an{constructor(t){super({type:"LineMaterial",uniforms:St.clone(St.merge([xt.common,xt.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new $(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${zt>=154?"colorspace_fragment":"encodings_fragment"}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA="1":delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(n){this.uniforms.diffuse.value=n}},worldUnits:{enumerable:!0,get:function(){return"WORLD_UNITS"in this.defines},set:function(n){n===!0?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(n){this.uniforms.linewidth.value=n}},dashed:{enumerable:!0,get:function(){return"USE_DASH"in this.defines},set(n){!!n!="USE_DASH"in this.defines&&(this.needsUpdate=!0),n===!0?this.defines.USE_DASH="":delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(n){this.uniforms.dashScale.value=n}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(n){this.uniforms.dashSize.value=n}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(n){this.uniforms.dashOffset.value=n}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(n){this.uniforms.gapSize.value=n}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(n){this.uniforms.opacity.value=n}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(n){this.uniforms.resolution.value.copy(n)}},alphaToCoverage:{enumerable:!0,get:function(){return"USE_ALPHA_TO_COVERAGE"in this.defines},set:function(n){!!n!="USE_ALPHA_TO_COVERAGE"in this.defines&&(this.needsUpdate=!0),n===!0?(this.defines.USE_ALPHA_TO_COVERAGE="",this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(t)}}const tt=new _e,At=new C,_t=new C,k=new _e,W=new _e,se=new _e,nt=new C,st=new un,G=new ln,Ot=new C,Ve=new ut,Ye=new Rt,ie=new _e;let oe,ye;function Lt(i,t,n){return ie.set(0,0,-t,1).applyMatrix4(i.projectionMatrix),ie.multiplyScalar(1/ie.w),ie.x=ye/n.width,ie.y=ye/n.height,ie.applyMatrix4(i.projectionMatrixInverse),ie.multiplyScalar(1/ie.w),Math.abs(Math.max(ie.x,ie.y))}function Ln(i,t){const n=i.matrixWorld,e=i.geometry,o=e.attributes.instanceStart,r=e.attributes.instanceEnd,p=Math.min(e.instanceCount,o.count);for(let a=0,d=p;a<d;a++){G.start.fromBufferAttribute(o,a),G.end.fromBufferAttribute(r,a),G.applyMatrix4(n);const A=new C,h=new C;oe.distanceSqToSegment(G.start,G.end,h,A),h.distanceTo(A)<ye*.5&&t.push({point:h,pointOnLine:A,distance:oe.origin.distanceTo(h),object:i,face:null,faceIndex:a,uv:null,[Bt]:null})}}function Tn(i,t,n){const e=t.projectionMatrix,r=i.material.resolution,p=i.matrixWorld,a=i.geometry,d=a.attributes.instanceStart,A=a.attributes.instanceEnd,h=Math.min(a.instanceCount,d.count),g=-t.near;oe.at(1,se),se.w=1,se.applyMatrix4(t.matrixWorldInverse),se.applyMatrix4(e),se.multiplyScalar(1/se.w),se.x*=r.x/2,se.y*=r.y/2,se.z=0,nt.copy(se),st.multiplyMatrices(t.matrixWorldInverse,p);for(let E=0,U=h;E<U;E++){if(k.fromBufferAttribute(d,E),W.fromBufferAttribute(A,E),k.w=1,W.w=1,k.applyMatrix4(st),W.applyMatrix4(st),k.z>g&&W.z>g)continue;if(k.z>g){const b=k.z-W.z,M=(k.z-g)/b;k.lerp(W,M)}else if(W.z>g){const b=W.z-k.z,M=(W.z-g)/b;W.lerp(k,M)}k.applyMatrix4(e),W.applyMatrix4(e),k.multiplyScalar(1/k.w),W.multiplyScalar(1/W.w),k.x*=r.x/2,k.y*=r.y/2,W.x*=r.x/2,W.y*=r.y/2,G.start.copy(k),G.start.z=0,G.end.copy(W),G.end.z=0;const x=G.closestPointToPointParameter(nt,!0);G.at(x,Ot);const N=dn.lerp(k.z,W.z,x),L=N>=-1&&N<=1,P=nt.distanceTo(Ot)<ye*.5;if(L&&P){G.start.fromBufferAttribute(d,E),G.end.fromBufferAttribute(A,E),G.start.applyMatrix4(p),G.end.applyMatrix4(p);const b=new C,M=new C;oe.distanceSqToSegment(G.start,G.end,M,b),n.push({point:M,pointOnLine:b,distance:oe.origin.distanceTo(M),object:i,face:null,faceIndex:E,uv:null,[Bt]:null})}}}class Nt extends cn{constructor(t=new ft,n=new ht({color:Math.random()*16777215})){super(t,n),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){const t=this.geometry,n=t.attributes.instanceStart,e=t.attributes.instanceEnd,o=new Float32Array(2*n.count);for(let p=0,a=0,d=n.count;p<d;p++,a+=2)At.fromBufferAttribute(n,p),_t.fromBufferAttribute(e,p),o[a]=a===0?0:o[a-1],o[a+1]=o[a]+At.distanceTo(_t);const r=new it(o,2,1);return t.setAttribute("instanceDistanceStart",new je(r,1,0)),t.setAttribute("instanceDistanceEnd",new je(r,1,1)),this}raycast(t,n){const e=this.material.worldUnits,o=t.camera;o===null&&!e&&console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');const r=t.params.Line2!==void 0&&t.params.Line2.threshold||0;oe=t.ray;const p=this.matrixWorld,a=this.geometry,d=this.material;ye=d.linewidth+r,a.boundingSphere===null&&a.computeBoundingSphere(),Ye.copy(a.boundingSphere).applyMatrix4(p);let A;if(e)A=ye*.5;else{const g=Math.max(o.near,Ye.distanceToPoint(oe.origin));A=Lt(o,g,d.resolution)}if(Ye.radius+=A,oe.intersectsSphere(Ye)===!1)return;a.boundingBox===null&&a.computeBoundingBox(),Ve.copy(a.boundingBox).applyMatrix4(p);let h;if(e)h=ye*.5;else{const g=Math.max(o.near,Ve.distanceToPoint(oe.origin));h=Lt(o,g,d.resolution)}Ve.expandByScalar(h),oe.intersectsBox(Ve)!==!1&&(e?Ln(this,n):Tn(this,o,n))}onBeforeRender(t){const n=this.material.uniforms;n&&n.resolution&&(t.getViewport(tt),this.material.uniforms.resolution.value.set(tt.z,tt.w))}}class Cn extends Nt{constructor(t=new Ut,n=new ht({color:Math.random()*16777215})){super(t,n),this.isLine2=!0,this.type="Line2"}}const Ft=f.forwardRef(function({points:t,color:n=16777215,vertexColors:e,linewidth:o,lineWidth:r,segments:p,dashed:a,...d},A){var h,g;const E=Q(L=>L.size),U=f.useMemo(()=>p?new Nt:new Cn,[p]),[S]=f.useState(()=>new ht),x=(e==null||(h=e[0])==null?void 0:h.length)===4?4:3,N=f.useMemo(()=>{const L=p?new ft:new Ut,P=t.map(b=>{const M=Array.isArray(b);return b instanceof C||b instanceof _e?[b.x,b.y,b.z]:b instanceof $?[b.x,b.y,0]:M&&b.length===3?[b[0],b[1],b[2]]:M&&b.length===2?[b[0],b[1],0]:b});if(L.setPositions(P.flat()),e){n=16777215;const b=e.map(M=>M instanceof ot?M.toArray():M);L.setColors(b.flat(),x)}return L},[t,p,e,x]);return f.useLayoutEffect(()=>{U.computeLineDistances()},[t,U]),f.useLayoutEffect(()=>{a?S.defines.USE_DASH="":delete S.defines.USE_DASH,S.needsUpdate=!0},[a,S]),f.useEffect(()=>()=>{N.dispose(),S.dispose()},[N]),f.createElement("primitive",Ae({object:U,ref:A},d),f.createElement("primitive",{object:N,attach:"geometry"}),f.createElement("primitive",Ae({object:S,attach:"material",color:n,vertexColors:!!e,resolution:[E.width,E.height],linewidth:(g=o??r)!==null&&g!==void 0?g:1,dashed:a,transparent:x===4},d)))}),Dn=f.forwardRef(({makeDefault:i,camera:t,regress:n,domElement:e,enableDamping:o=!0,keyEvents:r=!1,onChange:p,onStart:a,onEnd:d,...A},h)=>{const g=Q(m=>m.invalidate),E=Q(m=>m.camera),U=Q(m=>m.gl),S=Q(m=>m.events),x=Q(m=>m.setEvents),N=Q(m=>m.set),L=Q(m=>m.get),P=Q(m=>m.performance),b=t||E,M=e||S.connected||U.domElement,j=f.useMemo(()=>new On(b),[b]);return be(()=>{j.enabled&&j.update()},-1),f.useEffect(()=>(r&&j.connect(r===!0?M:r),j.connect(M),()=>void j.dispose()),[r,M,n,j,g]),f.useEffect(()=>{const m=u=>{g(),n&&P.regress(),p&&p(u)},_=u=>{a&&a(u)},R=u=>{d&&d(u)};return j.addEventListener("change",m),j.addEventListener("start",_),j.addEventListener("end",R),()=>{j.removeEventListener("start",_),j.removeEventListener("end",R),j.removeEventListener("change",m)}},[p,a,d,j,g,x]),f.useEffect(()=>{if(i){const m=L().controls;return N({controls:j}),()=>N({controls:m})}},[i,j]),f.createElement("primitive",Ae({ref:h,object:j,enableDamping:o},A))}),Rn={"1x":1,"10x":10,"100x":100,"1000x":1e3};function In({radius:i}){const t=f.useRef(null),n=f.useRef(null);return be(({clock:e})=>{if(t.current&&(t.current.rotation.z=e.elapsedTime*.8,t.current.rotation.x=Math.sin(e.elapsedTime*.3)*.15),n.current){const o=e.elapsedTime*.6%1;n.current.position.y=Math.sin(o*Math.PI*2)*i*.6;const r=Math.sin(o*Math.PI)*.4,p=n.current.material;p&&(p.opacity=r)}}),c.jsxs("group",{children:[c.jsxs("mesh",{ref:t,rotation:[Math.PI/2,0,0],children:[c.jsx("ringGeometry",{args:[i*1.3,i*1.35,64]}),c.jsx("meshBasicMaterial",{color:"#4ECDC4",transparent:!0,opacity:.5,side:xe})]}),c.jsxs("mesh",{rotation:[Math.PI/2,0,0],children:[c.jsx("ringGeometry",{args:[i*1.15,i*1.18,64]}),c.jsx("meshBasicMaterial",{color:"#4ECDC4",transparent:!0,opacity:.3,side:xe})]}),c.jsxs("mesh",{ref:n,rotation:[0,0,0],children:[c.jsx("planeGeometry",{args:[i*3,i*.15]}),c.jsx("meshBasicMaterial",{color:"#4ECDC4",transparent:!0,opacity:.3,side:xe})]}),c.jsxs("mesh",{children:[c.jsx("sphereGeometry",{args:[i*1.12,32,32]}),c.jsx("meshBasicMaterial",{color:"#4ECDC4",transparent:!0,opacity:.08,side:rt})]})]})}function zn({color:i,size:t}){const n=f.useRef(null),e=f.useRef(null);return be(({clock:o})=>{if(e.current){const r=o.getElapsedTime(),p=.5+.5*Math.sin(r*3);e.current.opacity=.3+p*.7}if(n.current){const r=o.getElapsedTime();n.current.scale.setScalar(1+.3*Math.sin(r*3))}}),c.jsxs("mesh",{ref:n,children:[c.jsx("sphereGeometry",{args:[t,16,16]}),c.jsx("meshBasicMaterial",{ref:e,color:i,transparent:!0,opacity:.8})]})}function ct({body:i,parentPosition:t=[0,0,0],isSatellite:n=!1}){var R;const e=f.useRef(null),o=f.useRef(!1),r=B(u=>u.currentDay),p=B(u=>u.selectedBody),a=B(u=>u.setSelectedBody),d=B(u=>u.setCameraFocus),A=B(u=>u.planetScale),h=B(u=>u.showLabels),g=B(u=>u.showOrbits),E=B(u=>u.addExploredBody),U=B(u=>u.addMissionExploredBody),S=B(u=>u.addMissionCompareBody),x=B(u=>u.activeMissionIds),N=B(u=>u.timeSpeed),L=(p==null?void 0:p.id)===i.id,P=f.useMemo(()=>{const u=Zt(i.radiusKm);return i.id==="sun"?u:u*A},[i.radiusKm,i.id,A]),b=f.useMemo(()=>{if(i.id==="sun")return[0,0,0];const u=n?Tt(i.orbit,r):Ze(i.orbit,r);return n?u:[u[0]+t[0],u[1]+t[1],u[2]+t[2]]},[i.id,i.orbit,r,n]);be((u,y)=>{if(e.current){if(i.isTidallyLocked&&n)e.current.lookAt(0,0,0),e.current.rotateZ(Math.PI);else if(i.rotationPeriod>0){const O=N==="pause"?0:Rn[N]||1,z=y*Ct*O/(i.rotationPeriod/24)*Math.PI*2,V=i.id==="venus"?-1:1;e.current.rotation.y=(e.current.rotation.y+z*V)%(Math.PI*2)}}});const M=f.useMemo(()=>{if(n||i.id==="sun")return null;const u=[],y=128;for(let O=0;O<=y;O++){const Z=i.orbit.period*O/y,z=Ze(i.orbit,Z);u.push([z[0],z[1],z[2]])}return u},[i.id,i.orbit,n]),j=f.useMemo(()=>new ot(i.color),[i.color]),m=f.useMemo(()=>new ot(0),[]),_=f.useMemo(()=>Jt(i.id),[i.id]);return c.jsxs(c.Fragment,{children:[g&&M&&M.length>0&&c.jsx(Ft,{points:M,color:L?"#4ECDC4":i.color,lineWidth:L?2:1,transparent:!0,opacity:L?.5:.2}),c.jsxs("group",{position:b,children:[c.jsxs("group",{rotation:[i.axialTilt*(Math.PI/180),0,0],children:[c.jsxs("mesh",{ref:e,onPointerOver:()=>{o.current||(o.current=!0,vt("hover"))},onPointerOut:()=>{o.current=!1},onClick:u=>{u.stopPropagation(),vt("click"),a(i);const y=b[0]+(n?t[0]:0),O=b[1]+(n?t[1]:0),Z=b[2]+(n?t[2]:0),z=Math.max(P*5,3);i.id==="sun"?d([z,z*.3,z],[0,0,0]):d([y+z,O+z*.3,Z+z],[y,O,Z]),E(i.id),x.forEach(V=>{var X;const D=$t(V);D&&((D.type==="explore"||D.type==="identify")&&U(V,i.id),D.type==="compare"&&((X=D.target.bodyIds)!=null&&X.includes(i.id))&&S(V,i.id))}),Xt()},castShadow:!0,receiveShadow:!0,children:[c.jsx("sphereGeometry",{args:[P,48,48]}),_?c.jsx("meshStandardMaterial",{map:_,color:i.id==="sun"?j:void 0,roughness:i.id==="sun"?.9:.75,metalness:i.id==="sun"?0:.05,emissive:i.id==="sun"?j:m,emissiveIntensity:i.id==="sun"?.6:0,emissiveMap:i.id==="sun"?_:void 0}):c.jsx("meshStandardMaterial",{color:j,roughness:.7,metalness:.1,emissive:i.id==="sun"?j:m,emissiveIntensity:i.id==="sun"?.8:0})]}),i.id!=="sun"&&c.jsxs("mesh",{rotation:[Math.PI/2,0,0],children:[c.jsx("ringGeometry",{args:[P*1.01,P*1.02,64]}),c.jsx("meshBasicMaterial",{color:"#FFFFFF",transparent:!0,opacity:.08,side:xe})]}),i.hasRings&&(()=>{const u=en(),y=P*(i.ringInnerRadius||1.2),Z=P*(i.ringOuterRadius||2.3)-y,z=[[0,.27,.45],[.27,.68,.75],[.73,.97,.6]];return c.jsxs("group",{rotation:[Math.PI/2,0,0],children:[z.map(([V,D,X])=>c.jsxs("mesh",{children:[c.jsx("ringGeometry",{args:[y+Z*V,y+Z*D,128]}),c.jsx("meshStandardMaterial",{map:u,transparent:!0,opacity:X,side:xe,depthWrite:!1,emissive:"#FFF8DC",emissiveIntensity:.06})]},`${V}-${D}`)),c.jsxs("mesh",{children:[c.jsx("ringGeometry",{args:[P*1.01,P*1.25,64]}),c.jsx("meshBasicMaterial",{color:"#000000",transparent:!0,opacity:.2,side:xe,depthWrite:!1})]})]})})()]}),i.id==="sun"&&c.jsxs(c.Fragment,{children:[c.jsxs("mesh",{children:[c.jsx("sphereGeometry",{args:[P*1.3,32,32]}),c.jsx("meshBasicMaterial",{color:"#FDB813",transparent:!0,opacity:.12,side:rt})]}),c.jsxs("mesh",{children:[c.jsx("sphereGeometry",{args:[P*1.8,32,32]}),c.jsx("meshBasicMaterial",{color:"#FFD700",transparent:!0,opacity:.04,side:rt})]})]}),P<.09&&i.id!=="sun"&&c.jsx(zn,{color:i.color,size:Math.max(P*2,.09)}),L&&c.jsx(In,{radius:P}),h&&c.jsx(wn,{distanceFactor:15,position:[0,P*1.5,0],center:!0,children:c.jsx("div",{className:`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap transition-all ${L?"bg-sci-cyan/20 text-sci-cyan border border-sci-cyan/40":"bg-space-800/60 text-sci-white/70 border border-white/10"}`,style:{fontFamily:"Noto Sans SC, sans-serif",pointerEvents:"none"},children:i.nameZh})}),(R=i.satellites)==null?void 0:R.map(u=>c.jsx(ct,{body:u,parentPosition:b,isSatellite:!0},u.id))]})]})}function Bn(){const i=f.useRef(null),t=f.useMemo(()=>{const e=[],o=[];for(let r=0;r<1200;r++){const p=2.1+Math.pow(Math.random(),1.5)*1.2,a=Math.random()*Math.PI*2,d=(Math.random()*20-10)*(Math.PI/180),A=p*Ie,h=A*Math.cos(a),g=A*Math.sin(a)*Math.cos(d),E=A*Math.sin(a)*Math.sin(d);e.push(h,g,E);const U=Math.random();if(U<.6){const S=.3+Math.random()*.4,x=Math.random()*.15;o.push(S+x,S,S*.8)}else if(U<.85){const S=.2+Math.random()*.3;o.push(S,S*1.1,S*1.2)}else{const S=.25+Math.random()*.25;o.push(S+.15,S*.8,S*.6)}}return{positions:new Float32Array(e),colors:new Float32Array(o)}},[]);return be((n,e)=>{i.current&&(i.current.rotation.z+=e*.025)}),c.jsxs("group",{ref:i,children:[c.jsxs("points",{children:[c.jsxs("bufferGeometry",{children:[c.jsx("bufferAttribute",{attach:"attributes-position",args:[t.positions,3]}),c.jsx("bufferAttribute",{attach:"attributes-color",args:[t.colors,3]})]}),c.jsx("pointsMaterial",{size:1.2,transparent:!0,opacity:.65,vertexColors:!0,sizeAttenuation:!0,depthWrite:!1})]}),c.jsxs("points",{children:[c.jsx("bufferGeometry",{children:c.jsx("bufferAttribute",{attach:"attributes-position",args:[t.positions,3]})}),c.jsx("pointsMaterial",{size:3,transparent:!0,opacity:.12,color:"#C8B898",sizeAttenuation:!0,depthWrite:!1})]})]})}const Un={"1x":1,"10x":10,"100x":100,"1000x":1e3},Nn=[...lt,...Dt],Ht={};function Fn(){lt.forEach(i=>{var t;(t=i.satellites)==null||t.forEach(n=>{Ht[n.id]={parentOrbit:i.orbit}})})}Fn();function Hn(){const i=B(x=>x.setCurrentDay),t=B(x=>x.timeSpeed),n=B(x=>x.cameraTarget),e=B(x=>x.setCameraTarget),o=B(x=>x.cameraLookAt),r=B(x=>x.setCameraLookAt),p=B(x=>x.setCameraAnimating),a=B(x=>x.addTimeAdvanced),d=B(x=>x.selectedBody),{camera:A}=Q(),h=Q(x=>x.controls),g=f.useRef(null),E=f.useRef(new C),U=f.useRef(new C),S=f.useRef(null);return be((x,N)=>{var P,b,M,j;const L=Math.min(N,.1);if(t!=="pause"){const m=Un[t]||1,_=L*m*Ct;i(R=>R+_),a(Math.abs(_))}if((P=g.current)!=null&&P.active){const m=g.current;m.elapsed+=L;const _=Math.min(m.elapsed/m.duration,1),R=_<.5?4*_*_*_:1-Math.pow(-2*_+2,3)/2;A.position.lerpVectors(m.startPos,m.endPos,R),_>=1&&(m.active=!1,e(null),r(null),p(!1))}if((b=S.current)!=null&&b.active){const m=S.current;m.elapsed+=L;const _=Math.min(m.elapsed/m.duration,1),R=_<.5?4*_*_*_:1-Math.pow(-2*_+2,3)/2;E.current.lerpVectors(m.startTarget,m.endTarget,R),A.lookAt(E.current),h&&h.target.copy(E.current),_>=1&&(m.active=!1)}if(d&&d.id!=="sun"&&!((M=g.current)!=null&&M.active)&&!((j=S.current)!=null&&j.active)){const m=B.getState().currentDay;let _,R,u,y=!1;if(Nn.some(O=>O.id===d.id))[_,R,u]=Ze(d.orbit,m),y=!0;else{const O=Ht[d.id];if(O){const[Z,z,V]=Ze(O.parentOrbit,m),[D,X,H]=Tt(d.orbit,m);_=Z+D,R=z+X,u=V+H,y=!0}}y&&(U.current.set(_,R,u),h&&h.target.copy(U.current))}}),f.useEffect(()=>{n&&(p(!0),g.current={active:!0,startPos:A.position.clone(),endPos:new C(...n),elapsed:0,duration:2}),o&&(S.current={active:!0,startTarget:E.current.clone(),endTarget:new C(...o),elapsed:0,duration:2})},[n,o,A,p]),c.jsxs("group",{children:[lt.map(x=>c.jsx(ct,{body:x},x.id)),Dt.map(x=>c.jsx(ct,{body:x},x.id)),c.jsx(Bn,{})]})}function kn({spacecraft:i}){const{setSelectedSpacecraft:t,setShowSpacecraftPanel:n}=B(),e=f.useMemo(()=>{const r=[];for(const p of i.trajectory){const a=p.angle*Math.PI/180,d=Math.cos(a)*p.distanceAU*Ie,A=Math.sin(a)*p.distanceAU*Ie;r.push([d,.5,A])}return r},[i]),o=f.useCallback(r=>{r.stopPropagation(),t(i.id),n(!0)},[i.id,t,n]);return c.jsxs("group",{children:[c.jsx(Ft,{points:e,color:i.color,lineWidth:1,transparent:!0,opacity:.6}),i.trajectory.map((r,p)=>{const a=r.angle*Math.PI/180,d=[Math.cos(a)*r.distanceAU*Ie,.5,Math.sin(a)*r.distanceAU*Ie];return c.jsxs("mesh",{position:d,onClick:o,children:[c.jsx("sphereGeometry",{args:[.15,16,16]}),c.jsx("meshBasicMaterial",{color:i.color,transparent:!0,opacity:.9})]},r.date||p)})]})}function Wn(){const i=B(e=>e.selectedSpacecraft);if(!B(e=>e.showSpacecraftPanel)||!i)return null;const n=Kt.find(e=>e.id===i);return n?c.jsx("group",{children:c.jsx(kn,{spacecraft:n})}):null}function Kn(){return c.jsxs(qt,{camera:{position:[0,300,1e3],fov:50,near:.1,far:4e3},gl:{antialias:!0,alpha:!1},shadows:!0,style:{background:"#050B14"},children:[c.jsx("color",{attach:"background",args:["#050B14"]}),c.jsx("fog",{attach:"fog",args:["#050B14",50,3500]}),c.jsx("ambientLight",{intensity:.08,color:"#2A3F5F"}),c.jsx("directionalLight",{position:[0,0,0],intensity:2,color:"#FFF8DC",castShadow:!0,"shadow-mapSize":[1024,1024],"shadow-camera-near":.5,"shadow-camera-far":1e3,"shadow-camera-left":-200,"shadow-camera-right":200,"shadow-camera-top":200,"shadow-camera-bottom":-200}),c.jsx("pointLight",{position:[0,0,0],intensity:1e3,color:"#FFF8DC",distance:600,decay:1.2}),c.jsx("directionalLight",{position:[50,30,20],intensity:.3,color:"#AED6F1"}),c.jsxs(f.Suspense,{fallback:null,children:[c.jsx(Qt,{radius:500,depth:100,count:8e3,factor:4,saturation:.2,fade:!0,speed:.5}),c.jsx(Hn,{}),c.jsx(Wn,{})]}),c.jsx(Dn,{makeDefault:!0,enablePan:!0,enableZoom:!0,enableRotate:!0,minDistance:2,maxDistance:2500,zoomSpeed:.8,rotateSpeed:.5,panSpeed:.5})]})}export{Kn as default};
//# sourceMappingURL=MainCanvas-BbmGJfZb.js.map
