/* ==========================================================================
   AF Inventions - BOOK HUB  (af-book-hub.js)
   Versione 0.6.4 - 30/10/2026 (Luigi): con "With photo" (copertina davanti e costa) una foto disegnata scende dall'alto
   ed entra nella tasca, con un riflesso che la attraversa (ALFI: "non si vede bene dove sta la foto"); poi resta nella tasca
   nell'anteprima 3D (solo anteprima: nel file da stampare non c'e'). Togliendo la foto, la foto si alza e svanisce.
   0.6.3 - 30/10/2026 (Luigi): formati nuovi 6 x 9 cm (VERTICAL e HORIZONTAL) e PHOTOBOX (solo VERTICAL) (ALFI): un formato
   che c'e' in una sola direzione non blocca piu' il cambio di direzione, si passa al formato piu' simile dell'altra direzione.
   0.6.2 - 29/10/2026 (Luigi): scritte su piu' righe allineate a sinistra, al centro o a destra (ALFI); le righe
   restano una sotto l'altra e il riquadro della scritta non si sposta.
   0.6.1 - 28/10/2026 (Luigi): disegni a cavallo tra due pezzi della copertina (ALFI): il colore nel file da stampare
   arriva fino al bordo vero del pezzo (sagoma) e non piu' solo fino alla faccia piatta: prima sui cilindri della cerniera e sui
   bordi arrotondati gli strati 2-4 restavano del colore della copertina (si vedeva l'interruzione nella cucitura).
   0.6.0 - 28/10/2026 (Luigi): nel foglio del disegno anche il colore a scelta (la tavolozza con tutti i colori,
   come per scritte e immagini); il riquadro dei colori conta solo quelli della copertina, cioe' quelli da caricare nella
   stampante per stamparla; le pagine a parte, perche' si stampano da sole (ALFI). Col gioco 0,20 (server v20) la foto nella
   costa ci sta da 18 pagine.
   0.5.9 - 28/10/2026 (Luigi): foto anche dentro la costa (dorso), con la tasca come quella della copertina davanti,
   solo quando con quelle pagine ci sta (Instax Mini e Polaroid Go verticali da 17 pagine in su) (ALFI).
   0.5.8 - 28/10/2026 (Luigi): secondo giro di prove (ALFI): disegni piccoli in mezzo al bianco tagliati prima (non piu'
   a scalini), disegni fitti a righe sottili non piu' trasformati in macchie, righe sottili non piu' perse nelle immagini lunghe.
   0.5.7 - 27/10/2026 (Luigi): prove a tappeto (ALFI): icone SVG e immagini piccole nitide (prima a 16 punti: macchie),
   emoji nelle scritte in bianco e nero col colore della scritta (prima colorate e in tutte le maschere), avviso se un pezzo
   esce dalla copertina o cade tra due pezzi, immagini grandi che non si perdono ricaricando o dopo l'accesso, foto fino a
   40 MB e messaggi giusti (troppo grande, HEIC), immagine tutta sfondo tenuta col suo sfondo, errore vecchio che non resta.
   0.5.6 - 27/10/2026 (Luigi): fori a muro della misura scelta (2, 3, 4, 5, 6 mm; 4 di base), perche' i chiodini sono gia'
   nel muro e la testa deve passare (ALFI). Foro passante dal lato muro + sede per la testa dentro (Ø 5, o D+1), come nel 3MF.
   Immagini: le parti grigie chiare col bordo netto (aste della valigia di ALFI) non si tolgono piu' come se fossero l'ombra.
   0.5.5 - 27/10/2026 (Luigi): disegno modificabile dopo averlo confermato (matita nella lista, tasto subito sotto la lista,
   doppio tocco) e piu' strumenti nel foglio: linea, rettangolo, cerchio, secchiello (riempi una zona chiusa), rifai (ALFI).
   Copia / incolla di testi, disegni e immagini (tasti Copy e Paste sotto la lista, Ctrl/Cmd+C, V, D) (ALFI).
   0.5.4 - 27/10/2026 (Luigi): "Attached" si puo' scegliere sempre, anche se la copertina aperta non sta nel piatto da 256 (con avviso);
   misure come negli altri configuratori (righe col numero nero di fianco al libro) al posto del riquadro della 0.5.3.
   0.5.3 - 27/10/2026 (Luigi): le misure del libro (chiuso e copertina aperta) sempre in vista nell'angolo del 3D (ALFI).
   0.5.2 - 27/10/2026 (Luigi): nel passo 6, sotto la lista, il totale dei colori del libro con i pallini (ALFI).
   0.5.1 - 27/10/2026 (Luigi): tasti avanti/indietro subito sotto la lista di testi e immagini (ALFI); nella lista in alto
   c'e' quello che sta davanti. Immagini grandi: bordo dello sfondo rifatto punto per punto (niente piu' contorni a scalini).
   I colori scelti per un'immagine restano giusti anche se la divisione in colori cambia.
   0.5.0 - 27/10/2026 (Luigi): richieste di ALFI come nel Magnet Maker: colore invisibile, tocco su una parte per
   cambiarle colore, disegni avanti/indietro, immagini disegnate a contorni (nitide anche ingrandite), copertina 3D a 12 punti/mm.
   Contorni fini da 0,08 mm, sfondo tolto deciso anche sui punti fini (niente bordini bianchi), immagini lunghe divise in colori
   con piu' punti (righe sottili e dettagli non si perdono).
   0.4.5 - 27/10/2026 (Luigi): immagini grandi con i contorni rifatti sull'immagine vera (circa 0,18 mm), niente piu' quadretti.
   0.4.4 - 27/10/2026 (Luigi): di nuovo i modelli veri nell'anteprima (ALFI ha tolto la protezione "da vetrina");
   immagini grandi senza quadretti (contorni morbidi a circa 0,12 mm, anche nella stampa).
   0.4.0 - 22/10/2026 (Luigi): richieste di ALFI dopo la prova dal vivo: giro V/H sul tavolo, pagine che escono una dopo l'altra e svaniscono, fori solo nel VERTICAL, viste della cerniera (filamenti che entrano, copertine che si staccano, stampata unita).
   0.3.0 - 22/10/2026 (Luigi): copertine nuove di ALFI, cerniera montata, fori per appendere. 0.2.0 - 21/10/2026 (Luigi): i pezzi VERI di ALFI in 14 formati (7 VERTICAL + 7 HORIZONTAL).

   Configuratore dei libri portafoto: direzione delle pagine -> formato della foto -> pagine (2-20) ->
   copertina (davanti BLANK / WITH PHOTO, cerniera SNAP FIT / FILAMENT PIN) -> disegni sulla copertina
   (scritte, disegno a mano libera, immagine a colori col motore del Magnet Maker) -> colori.
   I disegni si sistemano sulla copertina aperta in piano vista da fuori (dietro | dorso | davanti), anche a
   cavallo di piu' pezzi; diventano modificatori di 0,8 mm (4 strati) sulla faccia esterna, che si stampa sul piatto.
   Il 3MF lo crea la funzione configurator-3mf (bh3mf.ts) con i file privati: qui solo modelli protetti per vedere.

   Interfaccia pubblica:
     AFBookHub.open({slug: 'book-hub', basePath, state, price, points, initialChoice, admin,
                     onBuy(choice), onLogin(choice), onDownload(choice), onClose()})
     AFBookHub.update({...}); AFBookHub.close()
   ========================================================================== */
(function () {
  'use strict';
  var DEG = Math.PI / 180;

  /* ------------------------------------------------------------------ math */
  function m4() { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function T(x, y, z) { var m = m4(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function S(x, y, z) { var m = m4(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function RX(a) { var c = Math.cos(a), s = Math.sin(a), m = m4(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function RY(a) { var c = Math.cos(a), s = Math.sin(a), m = m4(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function RZ(a) { var c = Math.cos(a), s = Math.sin(a), m = m4(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function euler(r) { // gradi, ordine X poi Y poi Z
    if (!r) return m4();
    return mul(RZ(r[2] * DEG), mul(RY(r[1] * DEG), RX(r[0] * DEG)));
  }
  function persp(fovy, asp, n, f) {
    var t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  }
  function ortho(l, r, b, t, n, f) {
    var m = m4();
    m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); return m;
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function lookAt(eye, c, up) {
    var z = norm(sub(eye, c)), x = norm(cross(up, z)), y = cross(z, x), m = m4();
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -dot(x, eye); m[13] = -dot(y, eye); m[14] = -dot(z, eye); return m;
  }
  function normalMat(m) { // inversa trasposta della 3x3
    var a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    var det = a * A + b * B + c * C || 1e-20, k = 1 / det;
    return new Float32Array([
      A * k, B * k, C * k,
      -(b * i - c * h) * k, (a * i - c * g) * k, -(a * h - b * g) * k,
      (b * f - c * e) * k, -(a * f - c * d) * k, (a * e - b * d) * k]);
  }
  function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInQuad(t) { t = clamp(t, 0, 1); return t * t; }
  function easeInOutCubic(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function partT(p) { var q = p.pos || [0, 0, 0]; return mul(T(q[0], q[1], q[2]), euler(p.rot)); }
  function easeOutBack(t) { t = clamp(t, 0, 1); var c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

  /* --------------------------------------------------------------- shaders */
  var VS_MAIN = '#version 300 es\n' +
    'layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor;\n' +
    'uniform mat4 uModel; uniform mat4 uVP; uniform mat3 uNM;\n' +
    'out vec3 vW; out vec3 vN; out vec3 vL; out vec3 vLN;\n' +
    'void main(){ vec4 w=uModel*vec4(aPos,1.0); vW=w.xyz; vN=uNM*aNor; vL=aPos; vLN=aNor; gl_Position=uVP*w; }';
  var FS_MAIN = '#version 300 es\nprecision highp float;\n' +
    'in vec3 vW; in vec3 vN; out vec4 o;\n' +
    'uniform vec3 uColor; uniform float uRough; uniform float uAlpha; uniform vec3 uCam; uniform vec3 uKey; uniform vec3 uFill;\n' +
    'void main(){\n' +
    ' vec3 n=normalize(vN); vec3 v=normalize(uCam-vW); if(dot(n,v)<0.0) n=-n;\n' +
    ' vec3 base=pow(uColor,vec3(2.2));\n' +
    ' float hz=n.z*0.5+0.5;\n' +
    ' vec3 amb=mix(vec3(0.30,0.28,0.27),vec3(0.92,0.95,1.0),hz)*0.50;\n' +
    ' float ao=mix(0.72,1.0,smoothstep(0.0,14.0,vW.z));\n' +
    ' vec3 L=normalize(-uKey); float nl=dot(n,L);\n' +
    ' vec3 key=vec3(1.0,0.96,0.90)*max((nl+0.3)/1.3,0.0)*0.88;\n' +
    ' vec3 F=normalize(-uFill); vec3 fill=vec3(0.78,0.84,1.0)*max(dot(n,F),0.0)*0.32;\n' +
    ' float shin=mix(70.0,6.0,uRough);\n' +
    ' vec3 h=normalize(L+v); float sp=pow(max(dot(n,h),0.0),shin)*max(nl,0.0)*(1.0-uRough)*0.55;\n' +
    ' float fr=pow(1.0-max(dot(n,v),0.0),5.0)*0.22*(1.0-0.6*uRough);\n' +
    ' vec3 c=base*(amb*ao+key+fill)+vec3(sp+fr);\n' +
    ' c=c*(2.51*c+0.03)/(c*(2.43*c+0.59)+0.14);\n' +   // ACES (Narkowicz)
    ' float env=0.0; if(uAlpha<1.0){ vec3 rr=reflect(-v,n); env=0.10+0.30*smoothstep(-0.1,0.7,rr.z)+0.25*pow(1.0-abs(dot(n,v)),2.0); c+=vec3(env*0.55); }\n' +
    ' vec3 g=pow(clamp(c,0.0,1.0),vec3(1.0/2.2)); float a=clamp(uAlpha+fr*0.6+sp*0.5+env*0.35,0.0,1.0);\n' +
    ' o=uAlpha<1.0 ? vec4(g*a,a) : vec4(g,1.0);\n' +
    '}';
  var VS_DEPTH = '#version 300 es\nlayout(location=0) in vec3 aPos;\nuniform mat4 uModel; uniform mat4 uVP;\nvoid main(){ gl_Position=uVP*uModel*vec4(aPos,1.0); }';
  var FS_PICK = '#version 300 es\nprecision mediump float;\nuniform vec4 uId; out vec4 o;\nvoid main(){ o=uId; }';
  var FS_DEPTH = '#version 300 es\nprecision mediump float;\nout vec4 o;\nvoid main(){ o=vec4(1.0); }';
  var VS_GROUND = '#version 300 es\nlayout(location=0) in vec2 aXY;\n' +
    'uniform mat4 uVP; uniform vec3 uCenter; uniform float uSize;\nout vec3 vW;\n' +
    'void main(){ vW=vec3(uCenter.xy+aXY*uSize,-0.05); gl_Position=uVP*vec4(vW,1.0); }';
  var FS_GROUND = '#version 300 es\nprecision highp float;\n' +
    'in vec3 vW; out vec4 o;\n' +
    'uniform highp sampler2DShadow uShadow; uniform mat4 uLVP; uniform vec3 uCenter; uniform float uFade; uniform float uTexel;\n' +
    'const vec2 P[12]=vec2[12](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),vec2(0.962,-0.195),vec2(0.473,-0.480),vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),vec2(0.896,0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598));\n' +
    'float pcf(vec3 p,float r){ float s=0.0; for(int i=0;i<12;i++){ s+=texture(uShadow,vec3(p.xy+P[i]*r*uTexel,p.z)); } return s/12.0; }\n' +
    'void main(){\n' +
    ' vec4 l=uLVP*vec4(vW,1.0); vec3 p=l.xyz/l.w*0.5+0.5; p.z-=0.0015;\n' +
    ' float lit=0.0; float soft=0.0;\n' +
    ' if(p.x>0.0&&p.x<1.0&&p.y>0.0&&p.y<1.0){ lit=1.0-pcf(p,2.5); soft=1.0-pcf(p,9.0); }\n' +
    ' float d=length(vW.xy-uCenter.xy)/uFade; float fade=1.0-smoothstep(0.35,1.0,d);\n' +
    ' float a=(lit*0.22+soft*0.20)*fade;\n' +
    ' o=vec4(0.0,0.0,0.0,a);\n' +
    '}';
  function compile(gl, vs, fs) {
    function sh(t, src) {
      var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }

  /* ==========================================================================
     MAGNETE CON SCRITTA: tutto nel browser (canvas -> contorni -> triangoli -> 3MF)
     ========================================================================== */
  var TM = (function () {
    // ---- triangolazione di poligoni con buchi (ear clipping, schema "earcut")
    function earcut(data, holeIndices) {
      var hasHoles = holeIndices && holeIndices.length, outerLen = hasHoles ? holeIndices[0] * 2 : data.length;
      var outer = linkedList(data, 0, outerLen, true), tris = [];
      if (!outer || outer.next === outer.prev) return tris;
      if (hasHoles) outer = eliminateHoles(data, holeIndices, outer);
      earcutLinked(outer, tris, 0);
      return tris;
    }
    function linkedList(data, start, end, clockwise) {
      var i, last;
      if (clockwise === (signedArea(data, start, end) > 0)) { for (i = start; i < end; i += 2) last = insertNode(i / 2, data[i], data[i + 1], last); }
      else { for (i = end - 2; i >= start; i -= 2) last = insertNode(i / 2, data[i], data[i + 1], last); }
      if (last && equals(last, last.next)) { removeNode(last); last = last.next; }
      return last;
    }
    function filterPoints(start, end) {
      if (!start) return start; if (!end) end = start;
      var p = start, again;
      do {
        again = false;
        if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) { removeNode(p); p = end = p.prev; if (p === p.next) break; again = true; }
        else p = p.next;
      } while (again || p !== end);
      return end;
    }
    function earcutLinked(ear, tris, pass) {
      if (!ear) return;
      var stop = ear, prev, next;
      while (ear.prev !== ear.next) {
        prev = ear.prev; next = ear.next;
        if (isEar(ear)) {
          tris.push(prev.i, ear.i, next.i); removeNode(ear);
          ear = next.next; stop = next.next; continue;
        }
        ear = next;
        if (ear === stop) {
          if (!pass) earcutLinked(filterPoints(ear), tris, 1);
          else if (pass === 1) { ear = cureLocalIntersections(filterPoints(ear), tris); earcutLinked(ear, tris, 2); }
          else if (pass === 2) splitEarcut(ear, tris);
          break;
        }
      }
    }
    function isEar(ear) {
      var a = ear.prev, b = ear, c = ear.next;
      if (area(a, b, c) >= 0) return false;
      var p = ear.next.next;
      while (p !== ear.prev) {
        if (pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
        p = p.next;
      }
      return true;
    }
    function cureLocalIntersections(start, tris) {
      var p = start;
      do {
        var a = p.prev, b = p.next.next;
        if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
          tris.push(a.i, p.i, b.i); removeNode(p); removeNode(p.next); p = start = b;
        }
        p = p.next;
      } while (p !== start);
      return filterPoints(p);
    }
    function splitEarcut(start, tris) {
      var a = start;
      do {
        var b = a.next.next;
        while (b !== a.prev) {
          if (a.i !== b.i && isValidDiagonal(a, b)) {
            var c = splitPolygon(a, b);
            a = filterPoints(a, a.next); c = filterPoints(c, c.next);
            earcutLinked(a, tris, 0); earcutLinked(c, tris, 0); return;
          }
          b = b.next;
        }
        a = a.next;
      } while (a !== start);
    }
    function eliminateHoles(data, holeIndices, outer) {
      var queue = [], i, len, start, end, list;
      for (i = 0, len = holeIndices.length; i < len; i++) {
        start = holeIndices[i] * 2; end = i < len - 1 ? holeIndices[i + 1] * 2 : data.length;
        list = linkedList(data, start, end, false);
        if (list === list.next) list.steiner = true;
        queue.push(getLeftmost(list));
      }
      queue.sort(function (a, b) { return a.x - b.x; });
      for (i = 0; i < queue.length; i++) outer = eliminateHole(queue[i], outer);
      return outer;
    }
    function eliminateHole(hole, outer) {
      var bridge = findHoleBridge(hole, outer);
      if (!bridge) return outer;
      var bridgeReverse = splitPolygon(bridge, hole);
      filterPoints(bridgeReverse, bridgeReverse.next);
      return filterPoints(bridge, bridge.next);
    }
    function findHoleBridge(hole, outer) {
      var p = outer, hx = hole.x, hy = hole.y, qx = -Infinity, m;
      do {
        if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
          var x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
          if (x <= hx && x > qx) { qx = x; m = p.x < p.next.x ? p : p.next; if (x === hx) return m; }
        }
        p = p.next;
      } while (p !== outer);
      if (!m) return null;
      var stop = m, mx = m.x, my = m.y, tanMin = Infinity, tan;
      p = m;
      do {
        if (hx >= p.x && p.x >= mx && hx !== p.x && pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
          tan = Math.abs(hy - p.y) / (hx - p.x);
          if (locallyInside(p, hole) && (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) { m = p; tanMin = tan; }
        }
        p = p.next;
      } while (p !== stop);
      return m;
    }
    function sectorContainsSector(m, p) { return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0; }
    function getLeftmost(start) { var p = start, l = start; do { if (p.x < l.x || (p.x === l.x && p.y < l.y)) l = p; p = p.next; } while (p !== start); return l; }
    function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
      return (cx - px) * (ay - py) >= (ax - px) * (cy - py) && (ax - px) * (by - py) >= (bx - px) * (ay - py) && (bx - px) * (cy - py) >= (cx - px) * (by - py);
    }
    function isValidDiagonal(a, b) {
      return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) &&
        (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && (area(a.prev, a, b.prev) || area(a, b.prev, b)) || equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0);
    }
    function area(p, q, r) { return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y); }
    function equals(p1, p2) { return p1.x === p2.x && p1.y === p2.y; }
    function intersects(p1, q1, p2, q2) {
      var o1 = sign(area(p1, q1, p2)), o2 = sign(area(p1, q1, q2)), o3 = sign(area(p2, q2, p1)), o4 = sign(area(p2, q2, q1));
      if (o1 !== o2 && o3 !== o4) return true;
      if (o1 === 0 && onSegment(p1, p2, q1)) return true;
      if (o2 === 0 && onSegment(p1, q2, q1)) return true;
      if (o3 === 0 && onSegment(p2, p1, q2)) return true;
      if (o4 === 0 && onSegment(p2, q1, q2)) return true;
      return false;
    }
    function onSegment(p, q, r) { return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y); }
    function sign(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }
    function intersectsPolygon(a, b) {
      var p = a;
      do { if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && intersects(p, p.next, a, b)) return true; p = p.next; } while (p !== a);
      return false;
    }
    function locallyInside(a, b) { return area(a.prev, a, a.next) < 0 ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0; }
    function middleInside(a, b) {
      var p = a, inside = false, px = (a.x + b.x) / 2, py = (a.y + b.y) / 2;
      do { if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y && (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x)) inside = !inside; p = p.next; } while (p !== a);
      return inside;
    }
    function splitPolygon(a, b) {
      var a2 = new Node(a.i, a.x, a.y), b2 = new Node(b.i, b.x, b.y), an = a.next, bp = b.prev;
      a.next = b; b.prev = a; a2.next = an; an.prev = a2; b2.next = a2; a2.prev = b2; bp.next = b2; b2.prev = bp;
      return b2;
    }
    function insertNode(i, x, y, last) {
      var p = new Node(i, x, y);
      if (!last) { p.prev = p; p.next = p; } else { p.next = last.next; p.prev = last; last.next.prev = p; last.next = p; }
      return p;
    }
    function removeNode(p) { p.next.prev = p.prev; p.prev.next = p.next; }
    function Node(i, x, y) { this.i = i; this.x = x; this.y = y; this.prev = null; this.next = null; this.steiner = false; }
    function signedArea(data, start, end) { var s = 0; for (var i = start, j = end - 2; i < end; i += 2) { s += (data[j] - data[i]) * (data[i + 1] + data[j + 1]); j = i; } return s; }

    // ---- contorni di una maschera (marching squares su campo sfumato, livello 0.5)
    function contours(field, W, H) {
      // field: Float32Array W*H con bordo a 0
      var segs = [], ends = {};
      function v(x, y) { return field[y * W + x]; }
      function lerpPt(ax, ay, bx, by) { var va = v(ax, ay), vb = v(bx, by), t = (0.5 - va) / (vb - va); return [ax + (bx - ax) * t, ay + (by - ay) * t]; }
      function edgePt(id) {
        var p = id.split(','), k = p[0], x = +p[1], y = +p[2];
        return k === 'h' ? lerpPt(x, y, x + 1, y) : lerpPt(x, y, x, y + 1);
      }
      function add(e1, e2) {
        var k = segs.length; segs.push([e1, e2]);
        (ends[e1] = ends[e1] || []).push(k); (ends[e2] = ends[e2] || []).push(k);
      }
      for (var y = 0; y < H - 1; y++) for (var x = 0; x < W - 1; x++) {
        var a = v(x, y) >= 0.5, b = v(x + 1, y) >= 0.5, c = v(x + 1, y + 1) >= 0.5, d = v(x, y + 1) >= 0.5;
        var code = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
        if (code === 0 || code === 15) continue;
        var T = 'h,' + x + ',' + y, B = 'h,' + x + ',' + (y + 1), L = 'v,' + x + ',' + y, R = 'v,' + (x + 1) + ',' + y;
        switch (code) {
          case 1: case 14: add(L, B); break;
          case 2: case 13: add(B, R); break;
          case 3: case 12: add(L, R); break;
          case 4: case 11: add(T, R); break;
          case 6: case 9: add(T, B); break;
          case 7: case 8: add(L, T); break;
          case 5: case 10:
            var cen = (v(x, y) + v(x + 1, y) + v(x + 1, y + 1) + v(x, y + 1)) / 4 >= 0.5;
            if ((code === 5) === cen) { add(L, T); add(B, R); } else { add(L, B); add(T, R); }
            break;
        }
      }
      var used = new Uint8Array(segs.length), rings = [];
      for (var s = 0; s < segs.length; s++) {
        if (used[s]) continue;
        var ring = [], cur = s, from = segs[s][0];
        while (cur != null && !used[cur]) {
          used[cur] = 1; var sg = segs[cur], to = sg[0] === from ? sg[1] : sg[0];
          ring.push(edgePt(to));
          var nx = (ends[to] || []).filter(function (q) { return !used[q]; })[0];
          from = to; cur = nx;
        }
        if (ring.length >= 4) rings.push(ring);
      }
      return rings;
    }
    // semplificazione (Ramer-Douglas-Peucker) per anelli chiusi
    function simplify(ring, eps) {
      if (ring.length < 8) return ring;
      function rdp(pts, a, b, keep) {
        var max = 0, idx = -1, ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay, L = Math.hypot(dx, dy) || 1e-9;
        for (var i = a + 1; i < b; i++) { var d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > max) { max = d; idx = i; } }
        if (max > eps) { keep[idx] = 1; rdp(pts, a, idx, keep); rdp(pts, idx, b, keep); }
      }
      var n = ring.length, half = n >> 1, pts = ring.concat([ring[0]]), keep = new Uint8Array(n + 1);
      keep[0] = keep[half] = keep[n] = 1; rdp(pts, 0, half, keep); rdp(pts, half, n, keep);
      var out = []; for (var i = 0; i < n; i++) if (keep[i]) out.push(ring[i]);
      return out.length >= 3 ? out : ring;
    }
    function ringArea(r) { var s = 0; for (var i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; }   // >0 = antiorario (y in su)
    function inRing(p, r) {
      var c = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        if (((r[i][1] > p[1]) !== (r[j][1] > p[1])) && (p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) c = !c;
      } return c;
    }
    // anelli -> poligoni {outer, holes} (esterni antiorari, buchi orari)
    function polygons(rings) {
      var info = rings.map(function (r, i) {
        var depth = 0; rings.forEach(function (o, j) { if (j !== i && inRing(r[0], o)) depth++; });
        return { r: r, depth: depth, hole: depth % 2 === 1 };
      });
      var polys = [];
      info.forEach(function (o) {
        if (o.hole) return;
        if (ringArea(o.r) < 0) o.r = o.r.slice().reverse();
        polys.push({ outer: o.r, holes: [], depth: o.depth });
      });
      info.forEach(function (o) {
        if (!o.hole) return;
        if (ringArea(o.r) > 0) o.r = o.r.slice().reverse();
        // il buco appartiene all'esterno piu' vicino (profondita' = la sua - 1) che lo contiene
        var host = polys.filter(function (p) { return p.depth === o.depth - 1 && inRing(o.r[0], p.outer); })[0];
        if (host) host.holes.push(o.r);
      });
      return polys;
    }
    // poligono estruso da z0 a z1 -> lista di triangoli [x,y,z]*3
    function prism(poly, z0, z1, out) {
      var data = [], holes = [], rings = [poly.outer].concat(poly.holes);
      rings.forEach(function (r, k) { if (k) holes.push(data.length / 2); r.forEach(function (p) { data.push(p[0], p[1]); }); });
      var t = earcut(data, holes);
      for (var i = 0; i < t.length; i += 3) {
        var a = t[i] * 2, b = t[i + 1] * 2, c = t[i + 2] * 2;
        var cr = (data[b] - data[a]) * (data[c + 1] - data[a + 1]) - (data[b + 1] - data[a + 1]) * (data[c] - data[a]);
        if (cr < 0) { var tmp = b; b = c; c = tmp; }
        out.push([data[a], data[a + 1], z1], [data[b], data[b + 1], z1], [data[c], data[c + 1], z1]);
        out.push([data[a], data[a + 1], z0], [data[c], data[c + 1], z0], [data[b], data[b + 1], z0]);
      }
      rings.forEach(function (r) {
        for (var k = 0; k < r.length; k++) {
          var p = r[k], q = r[(k + 1) % r.length];
          out.push([p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1]);
          out.push([p[0], p[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]);
        }
      });
      return out;
    }
    // come prism, ma lo spigolo esterno della faccia z0 (la faccia che si vede, stampata sul piatto) e' arrotondato:
    // il bordo esterno rientra di rad a z0 e torna pieno a z0+rad (quarto di cerchio). I buchi restano dritti.
    function segX(a, b, c, d) {
      var d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
      var d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]), d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
      return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
    }
    function simpleRing(r) {
      var n = r.length, i, j, x0 = [], x1 = [];
      for (i = 0; i < n; i++) { var a = r[i], b = r[(i + 1) % n]; x0.push(Math.min(a[0], b[0])); x1.push(Math.max(a[0], b[0])); }
      for (i = 0; i < n; i++) for (j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        if (x1[i] < x0[j] || x1[j] < x0[i]) continue;
        if (segX(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return false;
      }
      return true;
    }
    function prismRound(poly, z0, z1, rad, out) {
      var outer = poly.outer, n = outer.length, i;
      // direzione verso l'interno di ogni vertice (antiorario: a sinistra del lato), media sui vicini per non avere punte
      var en = [];
      for (i = 0; i < n; i++) { var a = outer[i], b = outer[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; en.push([-dy / l, dx / l, l]); }
      var vn = [];
      for (i = 0; i < n; i++) {
        var sx = 0, sy = 0, acc = 0, k;
        for (k = 0; k < n && acc < 0.6; k++) { var e1 = en[(i - 1 - k + 2 * n) % n]; sx += e1[0] * e1[2]; sy += e1[1] * e1[2]; acc += e1[2]; }
        acc = 0; for (k = 0; k < n && acc < 0.6; k++) { var e2 = en[(i + k) % n]; sx += e2[0] * e2[2]; sy += e2[1] * e2[2]; acc += e2[2]; }
        var L = Math.hypot(sx, sy) || 1, nx = sx / L, ny = sy / L;
        var fn = poly.normalAt && poly.normalAt(outer[i]);
        if (fn && fn[0] * nx + fn[1] * ny > 0.3) { vn.push(fn); continue; }   // campo di distanza: gia' la direzione giusta, niente scalini
        var eA = en[(i - 1 + n) % n], eB = en[i], c = Math.max(0.7, Math.min(nx * eA[0] + ny * eA[1], nx * eB[0] + ny * eB[1]));
        vn.push([nx / c, ny / c]);
      }
      var steps = 6, lev = [];
      for (k = 0; k <= steps; k++) {
        var z = rad * k / steps, d = rad - Math.sqrt(Math.max(0, rad * rad - (rad - z) * (rad - z)));
        lev.push({ z: z0 + z, ring: outer.map(function (p, j) { return [p[0] + vn[j][0] * d, p[1] + vn[j][1] * d]; }) });
      }
      lev[steps].ring = outer;
      // controllo: se il bordo rientrato si incrocia (punte strettissime) quel pezzo resta col bordo dritto
      if (!simpleRing(lev[0].ring) || ringArea(lev[0].ring) <= 0) return prism(poly, z0, z1, out);
      function cap(ring, z, up) {
        var data = [], holes = [], rings = [ring].concat(poly.holes);
        rings.forEach(function (r, q) { if (q) holes.push(data.length / 2); r.forEach(function (p) { data.push(p[0], p[1]); }); });
        var t = earcut(data, holes);
        for (var m = 0; m < t.length; m += 3) {
          var A = t[m] * 2, B = t[m + 1] * 2, C = t[m + 2] * 2;
          var cr = (data[B] - data[A]) * (data[C + 1] - data[A + 1]) - (data[B + 1] - data[A + 1]) * (data[C] - data[A]);
          if ((cr < 0) === up) { var tmp = B; B = C; C = tmp; }
          out.push([data[A], data[A + 1], z], [data[B], data[B + 1], z], [data[C], data[C + 1], z]);
        }
      }
      cap(lev[0].ring, z0, false); cap(outer, z1, true);
      function wall(ra, za, rb, zb) {
        for (var m = 0; m < ra.length; m++) {
          var p = ra[m], q = ra[(m + 1) % ra.length], P = rb[m], Q = rb[(m + 1) % rb.length];
          out.push([p[0], p[1], za], [q[0], q[1], za], [Q[0], Q[1], zb]);
          out.push([p[0], p[1], za], [Q[0], Q[1], zb], [P[0], P[1], zb]);
        }
      }
      for (k = 0; k < steps; k++) wall(lev[k].ring, lev[k].z, lev[k + 1].ring, lev[k + 1].z);
      wall(outer, z0 + rad, outer, z1);
      poly.holes.forEach(function (h) { wall(h, z0, h, z1); });
      return out;
    }
    function circleRing(cx, cy, r, n, cw) {
      var o = []; for (var i = 0; i < n; i++) { var a = (cw ? -1 : 1) * i / n * 2 * Math.PI; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o;
    }

    // ---- contorni dal testo
    var PX = 20;          // pixel per mm (0.05 mm): bordi lisci in stampa
    // campo continuo dal bordo sfumato (antialias) del testo: i contorni cadono a meta' pixel, niente scalini
    function alphaField(cv) {
      var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = cv.width * cv.height, f = new Float32Array(n);
      for (var i = 0; i < n; i++) f[i] = d[i * 4 + 3] / 255;
      return f;
    }
    function smoothField(m, W, H) {
      var f = new Float32Array(W * H), g = new Float32Array(W * H);
      for (var y = 0; y < H; y++) for (var x = 1; x < W - 1; x++) { var i = y * W + x; f[i] = (m[i - 1] + 2 * m[i] + m[i + 1]) / 4; }
      for (var y2 = 1; y2 < H - 1; y2++) for (var x2 = 0; x2 < W; x2++) { var j = y2 * W + x2; g[j] = (f[j - W] + 2 * f[j] + f[j + W]) / 4; }
      return g;
    }
    // rettangolo con angoli arrotondati, centrato in 0 (mm, antiorario): disegnato esatto, non ricalcato
    function roundRectRing(hw, hh, r, n) {
      var o = [], cs = [[hw - r, hh - r, 0], [r - hw, hh - r, 90], [r - hw, r - hh, 180], [hw - r, r - hh, 270]];
      cs.forEach(function (c) { for (var i = 0; i <= n; i++) { var a = (c[2] + 90 * i / n) * Math.PI / 180; o.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } });
      return o.filter(function (p, i) { var q = o[(i + 1) % o.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
    }

    /* build(text, font): parti del magnete gia' pronte per la stampa (faccia colorata a z=0, specchiato in X),
       origine = centro del foro del magnete */
    function build(text, o) {
      o = o || {};
      // targhetta: rettangolo con angoli arrotondati (tipo tasto), scritta colorata dentro
      var TOP = 0.8, Hh = 3.0, HOLE = o.hole || 10.4, EDGE = o.edge != null ? o.edge : 0.6, maxW = o.maxW || 84, minW = o.minW || 28, plateH = o.plateH || 20, rad = o.radius || 6;
      var mx = o.marginX || 4.5, tH = o.height || 11, minH = o.minHeight || 7;
      var font = o.font || '900 100px sans-serif';
      text = (text || '').trim() || 'AF';
      var tmp = document.createElement('canvas').getContext('2d');
      var base = 100; tmp.font = font.replace(/\d+px/, base + 'px');
      var mt = tmp.measureText(text), asc = mt.actualBoundingBoxAscent || base * 0.75, desc = mt.actualBoundingBoxDescent || 0;
      var left = mt.actualBoundingBoxLeft != null ? mt.actualBoundingBoxLeft : 0, wpx = (mt.actualBoundingBoxRight != null ? left + mt.actualBoundingBoxRight : mt.width);
      // grandezza: lettere alte tH mm, ma la targhetta non supera maxW; sotto minH mm la scritta e' troppo lunga
      var s = Math.min(tH * PX / (asc + desc), (maxW - 2 * mx) * PX / wpx);
      if ((asc + desc) * s / PX < minH - 1e-6) return { tooLong: true, text: text };
      var pw = Math.max(minW, wpx * s / PX + 2 * mx), ph = plateH, pad = 8;
      // il canvas copre solo la scritta (centrata nella targhetta)
      var W = Math.ceil(wpx * s) + 2 * pad, H = Math.ceil((asc + desc) * s) + 2 * pad, cx = W / 2, cy = H / 2;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var c = cv.getContext('2d'); c.font = font.replace(/\d+px/, (base * s).toFixed(2) + 'px'); c.textBaseline = 'alphabetic';
      c.fillStyle = '#000'; c.fillText(text, cx - (wpx * s) / 2 + left * s, cy - ((asc + desc) * s) / 2 + asc * s);
      function toMM(rr) { return rr.map(function (p) { return [-(p[0] - cx) / PX, (cy - p[1]) / PX]; }); }
      var rings = contours(smoothField(alphaField(cv), W, H), W, H)
        .map(function (rr) { return toMM(simplify(rr, 0.3)); })
        .filter(function (rr) { return rr.length >= 3 && Math.abs(ringArea(rr)) > 0.05; });
      var plate = roundRectRing(pw / 2, ph / 2, Math.min(rad, ph / 2), 18);
      // stessi identici bordi per lettere e nero: niente fessure o sovrapposizioni tra i due colori
      var pL = polygons(rings), pB = polygons([plate].concat(rings));
      var color = [], blackTop = [], body = [];
      pL.forEach(function (p) { prism(p, 0, TOP, color); });
      pB.forEach(function (p) { if (p.depth === 0) prismRound(p, 0, TOP, EDGE, blackTop); else prism(p, 0, TOP, blackTop); });
      prism({ outer: plate, holes: [circleRing(0, 0, HOLE / 2, 72, true)] }, TOP, Hh, body);
      return { black: blackTop.concat(body), blackTop: blackTop, body: body, color: color, size: [pw, ph, Hh], text: text, letterH: (asc + desc) * s / PX };
    }

    // ---- file: STL e 3MF (zip senza compressione)
    function stl(tris, name) {
      var n = tris.length / 3, buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
      for (var i = 0; i < 80; i++) dv.setUint8(i, i < name.length ? name.charCodeAt(i) & 127 : 32);
      dv.setUint32(80, n, true);
      for (var t = 0; t < n; t++) {
        var a = tris[3 * t], b = tris[3 * t + 1], c = tris[3 * t + 2], o = 84 + t * 50;
        var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
        dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
        [a, b, c].forEach(function (p, k) { dv.setFloat32(o + 12 + k * 12, p[0], true); dv.setFloat32(o + 16 + k * 12, p[1], true); dv.setFloat32(o + 20 + k * 12, p[2], true); });
      }
      return new Uint8Array(buf);
    }
    function meshXML(tris, id, name) {
      var map = {}, verts = [], idx = [];
      tris.forEach(function (p) {
        var k = p[0].toFixed(4) + ',' + p[1].toFixed(4) + ',' + p[2].toFixed(4);
        if (map[k] == null) { map[k] = verts.length; verts.push(k); } idx.push(map[k]);
      });
      var s = ['<object id="' + id + '" name="' + name + '" type="model"><mesh><vertices>'];
      verts.forEach(function (k) { var v = k.split(','); s.push('<vertex x="' + (+v[0]) + '" y="' + (+v[1]) + '" z="' + (+v[2]) + '"/>'); });
      s.push('</vertices><triangles>');
      for (var i = 0; i < idx.length; i += 3) if (idx[i] !== idx[i + 1] && idx[i + 1] !== idx[i + 2] && idx[i] !== idx[i + 2]) s.push('<triangle v1="' + idx[i] + '" v2="' + idx[i + 1] + '" v3="' + idx[i + 2] + '"/>');
      s.push('</triangles></mesh></object>');
      return s.join('');
    }
    var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
    function zip(files) {
      var enc = new TextEncoder(), parts = [], central = [], off = 0;
      files.forEach(function (f) {
        var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
        var h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true);
        h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
        parts.push(new Uint8Array(h.buffer), name, data);
        var c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true);
        c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
        central.push(new Uint8Array(c.buffer), name);
        off += 30 + name.length + data.length;
      });
      var csize = central.reduce(function (s, a) { return s + a.length; }, 0), e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
      return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/octet-stream' });
    }
    // 3MF con un oggetto per colore (Bambu Studio: si assegna un filamento a ogni oggetto)
    function threeMFParts(list, title) {
      list = list.filter(function (q) { return q.tris && q.tris.length; });
      // colori: un gruppo m:colorgroup e ogni pezzo punta al suo colore (pid/pindex).
      // Bambu Studio recente propone di abbinarli ai filamenti; in piu' Metadata/model_settings.config
      // assegna a ogni pezzo il suo filamento (1, 2, 3...), cosi' anche le versioni vecchie non lo fanno tutto nero
      var hexOf = function (q) { var h = String(q.hex || '#808080').replace(/[^#0-9a-fA-F]/g, ''); if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return (h.length === 7 ? h : '#808080').toUpperCase() + 'FF'; };
      // pezzi con lo stesso colore (q.key, es. fronte e retro della base) vanno sullo stesso filamento
      var keys = [], fil = list.map(function (q) { var kk = q.key || q.name, j = keys.indexOf(kk); if (j < 0) { keys.push(kk); j = keys.length - 1; } return j; });
      var hexes = keys.map(function (kk) { return hexOf(list[fil.indexOf(keys.indexOf(kk))]); });
      var k = list.length + 1, cg = list.length + 2;
      var objs = list.map(function (q, i) { return meshXML(q.tris, i + 1, q.name).replace('<object ', '<object pid="' + cg + '" pindex="' + fil[i] + '" '); }).join('');
      var model = '<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">' +
        '<metadata name="Title">' + title + '</metadata><metadata name="Designer">AF Inventions</metadata><resources>' +
        '<m:colorgroup id="' + cg + '">' + hexes.map(function (h) { return '<m:color color="' + h + '"/>'; }).join('') + '</m:colorgroup>' + objs +
        '<object id="' + k + '" name="' + title + '" type="model"><components>' + list.map(function (q, i) { return '<component objectid="' + (i + 1) + '"/>'; }).join('') + '</components></object>' +
        '</resources><build><item objectid="' + k + '"/></build></model>';
      var cfg = '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  <object id="' + k + '">\n    <metadata key="name" value="' + title + '"/>\n    <metadata key="extruder" value="1"/>\n    <metadata key="wall_loops" value="1"/>\n' +
        list.map(function (q, i) { return '    <part id="' + (i + 1) + '" subtype="normal_part">\n      <metadata key="name" value="' + q.name + '"/>\n      <metadata key="extruder" value="' + (fil[i] + 1) + '"/>\n    </part>\n'; }).join('') +
        '  </object>\n</config>\n';
      return zip([
        { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>' },
        { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>' },
        { name: '3D/3dmodel.model', data: model },
        { name: 'Metadata/model_settings.config', data: cfg }
      ]);
    }
    function threeMF(m, colorName, title, bgName, colorHex, bgHex) {
      var bn = bgName || 'BLACK', bh = bgHex || '#1E1E20';
      // fronte e retro della targhetta come due pezzi chiusi (stesso filamento): niente facce interne, niente errori in Bambu
      return threeMFParts([{ name: bn, tris: m.blackTop, hex: bh }, { name: bn + ' (BACK)', key: bn, tris: m.body, hex: bh }, { name: colorName, tris: m.color, hex: colorHex }], title);
    }
    return { build: build, threeMF: threeMF, threeMFParts: threeMFParts, stl: stl, zip: zip, earcut: earcut,
      lib: { contours: contours, simplify: simplify, polygons: polygons, prism: prism, prismRound: prismRound, circleRing: circleRing, ringArea: ringArea, inRing: inRing, smoothField: smoothField } };
  })();

  /* ==========================================================================
     MAGNETE: tutto nel browser (immagine e scritte non lasciano il dispositivo)
     immagine / scritta -> pochi colori -> forma -> misura -> magneti -> triangoli -> 3MF
     ========================================================================== */
  var MM = (function () {
    var L = TM.lib, TOP = 0.8, EDGE = 0.6, MINW = 0.6, MINA = 0.8, WALL = 1.0, SIGMM = 0.3;
    function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function f3(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    function lab(r, g, b) {
      var R = lin(r), G = lin(g), B = lin(b);
      var fx = f3((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), fy = f3(0.2126 * R + 0.7152 * G + 0.0722 * B), fz = f3((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
      return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    }
    function hexLab(h) { var n = parseInt(h.slice(1), 16); return lab(n >> 16 & 255, n >> 8 & 255, n & 255); }
    function dist2(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; }
    // ---- maschere: distanza (smussata 1 / radice 2), componenti, buchi
    // distanza euclidea esatta (Felzenszwalb): per ogni pixel della maschera, distanza dal centro del pixel fuori piu' vicino
    // inside: oltre il bordo dell'immagine e' "dentro" (altrimenti e' fuori, a 1 pixel dal bordo)
    function sqdt(t, W, H) {   // t: 1 = cerca la distanza, 0 = bersaglio -> distanza al quadrato dal bersaglio piu' vicino
      var INF = 1e20, n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
      var out = new Float64Array(W * H), x, y, i;
      function pass(len) {
        var k = 0, q, s; v[0] = 0; z[0] = -INF; z[1] = INF;
        for (q = 1; q < len; q++) {
          s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
          while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
          k++; v[k] = q; z[k] = s; z[k + 1] = INF;
        }
        k = 0; for (q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
      }
      for (x = 0; x < W; x++) { for (y = 0; y < H; y++) f[y] = t[y * W + x] ? INF : 0; pass(H); for (y = 0; y < H; y++) out[y * W + x] = d[y]; }
      for (y = 0; y < H; y++) { for (x = 0; x < W; x++) f[x] = out[y * W + x]; pass(W); for (x = 0; x < W; x++) out[y * W + x] = d[x]; }
      return out;
    }
    function edtC(m, W, H) {   // distanza smussata (1 / radice 2): veloce, basta per raggi piccoli
      var d = new Float32Array(W * H), INF = 1e9, b = Math.SQRT2, i, x, y, v;
      for (i = 0; i < W * H; i++) d[i] = m[i] ? INF : 0;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        i = y * W + x; if (!d[i]) continue; v = d[i];
        v = x > 0 ? Math.min(v, d[i - 1] + 1) : Math.min(v, 1);
        if (y > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + b); if (x < W - 1) v = Math.min(v, d[i - W + 1] + b); } else v = Math.min(v, 1);
        d[i] = v;
      }
      for (y = H - 1; y >= 0; y--) for (x = W - 1; x >= 0; x--) {
        i = y * W + x; if (!d[i]) continue; v = d[i];
        v = x < W - 1 ? Math.min(v, d[i + 1] + 1) : Math.min(v, 1);
        if (y < H - 1) { v = Math.min(v, d[i + W] + 1); if (x < W - 1) v = Math.min(v, d[i + W + 1] + b); if (x > 0) v = Math.min(v, d[i + W - 1] + b); } else v = Math.min(v, 1);
        d[i] = v;
      }
      return d;
    }
    function edt(m, W, H, inside) {
      var W2 = W + 2, H2 = H + 2, t = new Uint8Array(W2 * H2), x, y;
      if (inside) t.fill(1);
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) t[(y + 1) * W2 + x + 1] = m[y * W + x] ? 1 : 0;
      var q = sqdt(t, W2, H2), d = new Float32Array(W * H);
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) d[y * W + x] = m[y * W + x] ? Math.min(1e9, Math.sqrt(q[(y + 1) * W2 + x + 1])) : 0;
      return d;
    }
    // bordo liscio: distanza con segno dal contorno (in pixel, + dentro), poi sfumata con una gaussiana
    function signedDist(m, W, H) {
      var din = edt(m, W, H, false), dout = edt(not(m), W, H, true), sd = new Float32Array(W * H);
      for (var i = 0; i < W * H; i++) sd[i] = m[i] ? din[i] - 0.5 : 0.5 - dout[i];
      return sd;
    }
    function blur(f, W, H, sig) {
      var r = Math.max(1, Math.ceil(3 * sig)), K = new Float32Array(2 * r + 1), t = 0, k, x, y, a, row;
      for (k = -r; k <= r; k++) { K[k + r] = Math.exp(-k * k / (2 * sig * sig)); t += K[k + r]; }
      for (k = 0; k < K.length; k++) K[k] /= t;
      var tmp = new Float32Array(W * H), o = new Float32Array(W * H);
      for (y = 0; y < H; y++) {
        row = y * W;
        for (x = 0; x < W; x++) {
          a = 0;
          if (x >= r && x < W - r) { var b0 = row + x - r; for (k = 0; k <= 2 * r; k++) a += K[k] * f[b0 + k]; }
          else for (k = -r; k <= r; k++) a += K[k + r] * f[row + Math.min(W - 1, Math.max(0, x + k))];
          tmp[row + x] = a;
        }
      }
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        a = 0;
        if (y >= r && y < H - r) { var c0 = (y - r) * W + x; for (k = 0; k <= 2 * r; k++) a += K[k] * tmp[c0 + k * W]; }
        else for (k = -r; k <= r; k++) a += K[k + r] * tmp[Math.min(H - 1, Math.max(0, y + k)) * W + x];
        o[y * W + x] = a;
      }
      return o;
    }
    // distanza con segno sfumata, calcolata solo nel riquadro della figura (molto piu' veloce), fuori = lontano
    function smoothSD(m, W, H, sig) {
      var x0 = W, x1 = -1, y0 = H, y1 = -1, x, y, i;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (m[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      var out = new Float32Array(W * H).fill(-1000); if (x1 < 0) return out;
      var M = Math.ceil(3 * sig) + 4; x0 = Math.max(0, x0 - M); y0 = Math.max(0, y0 - M); x1 = Math.min(W - 1, x1 + M); y1 = Math.min(H - 1, y1 + M);
      var w = x1 - x0 + 1, h = y1 - y0 + 1, sub = new Uint8Array(w * h);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) sub[y * w + x] = m[(y + y0) * W + x + x0];
      var sd = blur(signedDist(sub, w, h), w, h, sig);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) out[(y + y0) * W + x + x0] = sd[y * w + x];
      return out;
    }
    function fieldOf(sd, W, H) {   // per contours(): soglia 0.5 = distanza 0, bordo dell'immagine fuori
      var f = new Float32Array(W * H), x, y;
      for (var i = 0; i < W * H; i++) f[i] = Math.max(0, Math.min(1, sd[i] + 0.5));
      for (x = 0; x < W; x++) { f[x] = 0; f[(H - 1) * W + x] = 0; } for (y = 0; y < H; y++) { f[y * W] = 0; f[y * W + W - 1] = 0; }
      return f;
    }
    function not(m) { var o = new Uint8Array(m.length); for (var i = 0; i < m.length; i++) o[i] = m[i] ? 0 : 1; return o; }
    function dilate(m, W, H, r) { var d = edt(not(m), W, H, true), o = new Uint8Array(m.length); for (var i = 0; i < m.length; i++) o[i] = d[i] <= r ? 1 : 0; return o; }
    function dilateC(m, W, H, r) { var d = edtC(not(m), W, H), o = new Uint8Array(m.length); for (var i = 0; i < m.length; i++) o[i] = d[i] <= r ? 1 : 0; return o; }
    function erodeC(m, W, H, r) { var d = edtC(m, W, H), o = new Uint8Array(m.length); for (var i = 0; i < m.length; i++) o[i] = d[i] > r ? 1 : 0; return o; }
    function erode(m, W, H, r) { var d = edt(m, W, H), o = new Uint8Array(m.length); for (var i = 0; i < m.length; i++) o[i] = d[i] > r ? 1 : 0; return o; }
    function components(m, W, H) {   // etichette 1..n (4-vicini), aree
      var lab_ = new Int32Array(W * H), areas = [0], st = new Int32Array(W * H), n = 0;
      for (var s = 0; s < W * H; s++) {
        if (!m[s] || lab_[s]) continue; n++; var top = 0, area = 0; st[top++] = s; lab_[s] = n;
        while (top) {
          var i = st[--top], x = i % W; area++;
          if (x > 0 && m[i - 1] && !lab_[i - 1]) { lab_[i - 1] = n; st[top++] = i - 1; }
          if (x < W - 1 && m[i + 1] && !lab_[i + 1]) { lab_[i + 1] = n; st[top++] = i + 1; }
          if (i >= W && m[i - W] && !lab_[i - W]) { lab_[i - W] = n; st[top++] = i - W; }
          if (i < W * (H - 1) && m[i + W] && !lab_[i + W]) { lab_[i + W] = n; st[top++] = i + W; }
        }
        areas.push(area);
      }
      return { lab: lab_, areas: areas, n: n };
    }
    function fillHoles(m, W, H) { var c = components(not(m), W, H), o = new Uint8Array(m.length), out = {};
      for (var x = 0; x < W; x++) { out[c.lab[x]] = 1; out[c.lab[(H - 1) * W + x]] = 1; } for (var y = 0; y < H; y++) { out[c.lab[y * W]] = 1; out[c.lab[y * W + W - 1]] = 1; }
      for (var i = 0; i < m.length; i++) o[i] = m[i] || !out[c.lab[i]] ? 1 : 0; return o; }
    // come fieldOf, ma nessun valore cade esatto sul bordo: due contorni non possono toccarsi in un punto (pezzo "pizzicato")
    function fieldOfMM(sd, W, H) {
      var f = new Float32Array(W * H), x, y, v;
      for (var i = 0; i < W * H; i++) { v = sd[i]; if (v > -0.03 && v < 0.03) v = v < 0 ? -0.03 : 0.03; f[i] = Math.max(0, Math.min(1, v + 0.5)); }
      for (x = 0; x < W; x++) { f[x] = 0; f[(H - 1) * W + x] = 0; } for (y = 0; y < H; y++) { f[y * W] = 0; f[y * W + W - 1] = 0; }
      return f;
    }
    // differenza di colore "come la vede l'occhio" (CIEDE2000): sceglie il filamento giusto anche per rosa, rossi e gialli accesi
    // kH < 1: la tinta conta un po' di piu' della luminosita' (un lilla chiaro deve restare lilla, non diventare rosa)
    function de00(p, q, kH) {
      var L1 = p[0], a1 = p[1], b1 = p[2], L2 = q[0], a2 = q[1], b2 = q[2], R = Math.PI / 180;
      var Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, c7 = Math.pow(Cm, 7), G = 0.5 * (1 - Math.sqrt(c7 / (c7 + 6103515625)));
      var a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
      var h1 = C1 ? (Math.atan2(b1, a1p) / R + 360) % 360 : 0, h2 = C2 ? (Math.atan2(b2, a2p) / R + 360) % 360 : 0;
      var dL = L2 - L1, dC = C2 - C1, dh = 0;
      if (C1 * C2) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
      var dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * R / 2), Lm = (L1 + L2) / 2, Cp = (C1 + C2) / 2, hm = h1 + h2;
      if (C1 * C2) hm = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2);
      var T = 1 - 0.17 * Math.cos((hm - 30) * R) + 0.24 * Math.cos(2 * hm * R) + 0.32 * Math.cos((3 * hm + 6) * R) - 0.2 * Math.cos((4 * hm - 63) * R);
      var Sl = 1 + 0.015 * (Lm - 50) * (Lm - 50) / Math.sqrt(20 + (Lm - 50) * (Lm - 50)), Sc = 1 + 0.045 * Cp, Sh = 1 + 0.015 * Cp * T;
      var cp7 = Math.pow(Cp, 7), Rt = -2 * Math.sqrt(cp7 / (cp7 + 6103515625)) * Math.sin(60 * Math.exp(-Math.pow((hm - 275) / 25, 2)) * R);
      var x = dL / Sl, y = dC / Sc, z = dH / Sh / (kH || 1); return Math.sqrt(Math.max(0, x * x + y * y + z * z + Rt * y * z));
    }
    // tinta "come la vede l'occhio" (Oklab): in CIELab il blu puro sta vicino al viola, e cosi' un blu da bandiera o da logo
    // finiva sul filamento viola. Se due colori accesi hanno tinte lontane piu' di 20 gradi, la distanza cresce un po'
    function labOk(c) {
      var fy = (c[0] + 16) / 116, fx = fy + c[1] / 500, fz = fy - c[2] / 200, iv = function (t) { return t > 6 / 29 ? t * t * t : 3 * (6 / 29) * (6 / 29) * (t - 4 / 29); };
      var X = 0.95047 * iv(fx), Y = iv(fy), Z = 1.08883 * iv(fz);
      var r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
      var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      var A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * q, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * q;
      return { c: Math.hypot(A, B), h: Math.atan2(B, A) * 180 / Math.PI };
    }
    function huePen(o1, o2) {
      if (o1.c < 0.08 || o2.c < 0.08) return 0;
      var d = Math.abs(o1.h - o2.h) % 360; if (d > 180) d = 360 - d; return 0.35 * Math.max(0, d - 20);
    }
    function dFil(p, c, co) { return de00(p.lab || (p.lab = hexLab(p.hex)), c, 0.8) + huePen(p.ok || (p.ok = labOk(p.lab)), co || labOk(c)); }
    // filamenti per tutti i colori dell'immagine, DIVERSI tra loro quando si puo': il colore piu' grande sceglie per primo;
    // se il suo filamento e' gia' preso, gli altri prendono il secondo piu' vicino (se non e' troppo diverso), invece di
    // finire in due colori uguali (es. corpo lilla e ombra lilla). fixed[ci] = filamento gia' deciso (es. il contorno)
    function nearestSet(palette, cs, areas, fixed, minA) {
      var out = cs.map(function () { return null; }), used = {}, ord = cs.map(function (c, i) { return i; });
      fixed = fixed || {}; Object.keys(fixed).forEach(function (ci) { out[ci] = fixed[ci]; used[fixed[ci]] = +ci + 1; });
      ord.sort(function (a, b) { return areas[b] - areas[a]; });
      ord.forEach(function (ci) {
        if (out[ci]) return;
        var co = labOk(cs[ci]), ds = palette.map(function (p) { return { id: p.id, d: dFil(p, cs[ci], co) }; }).sort(function (a, b) { return a.d - b.d; });
        var pick = ds[0], own = used[pick.id];
        // due colori quasi uguali dell'immagine (es. due toni dell'arancione della testa) vanno sullo STESSO filamento,
        // anche se stanno a cavallo tra due filamenti: altrimenti la testa viene a macchie arancione e marrone chiaro
        var twin = -1, tw = 10 * 10; ord.forEach(function (cj) { if (out[cj] && cj !== ci) { var dq = dist2(cs[cj], cs[ci]); if (dq < tw) { tw = dq; twin = cj; } } });
        if (twin >= 0) { var tid = out[twin], td = ds.filter(function (q) { return q.id === tid; })[0]; if (td && td.d <= ds[0].d + 8) { out[ci] = tid; return; } }
        // solo se i due colori dell'immagine sono davvero diversi (corpo e ombra): due toni quasi uguali restano uniti
        // (il filamento "di riserva" non deve essere molto piu' spento del colore: un arancione scuro diventa arancione,
        //  non marrone chiaro/tan, che vicino agli altri colori accesi sembra sporco. Es. faccia in ombra del blocco "?".
        //  Un filamento piu' scuro invece puo' essere meno acceso: e' l'ombra, es. il lato scuro del tubo verde)
        if (own && areas[ci] >= minA && dist2(cs[own - 1], cs[ci]) > 15 * 15) {
          var cS = Math.hypot(cs[ci][1], cs[ci][2]), lim = Math.max(15, ds[0].d + 6);
          var alt = ds.slice(1).map(function (q) { var pl = palette.filter(function (p) { return p.id === q.id; })[0].lab, cC = Math.hypot(pl[1], pl[2]); return { id: q.id, d: q.d, e: q.d + (pl[0] >= cs[ci][0] - 8 ? Math.max(0, cS * 0.75 - cC) * 0.2 : 0) }; })
            .filter(function (q) { return q.d <= lim && !used[q.id]; }).sort(function (a, b) { return a.e - b.e; });
          if (alt.length) pick = alt[0];
        }
        out[ci] = pick.id; if (!used[pick.id]) used[pick.id] = ci + 1;
      });
      return out;
    }
    function nearest(palette, c) { var b = palette[0], bd = 1e18, co = labOk(c); palette.forEach(function (p) { var d = dFil(p, c, co); if (d < bd) { bd = d; b = p; } }); return b; }

    /* 1) immagine -> canvas con lo sfondo tolto (trasparente), ritagliato sulla figura */
    function cutout(src, maxPx, removeBg, force) {
      var w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height, busyBg = false, thickN = 0;
      var sc = Math.min(1, maxPx / Math.max(w0, h0)), pad = 3;
      var w = Math.max(8, Math.round(w0 * sc)), h = Math.max(8, Math.round(h0 * sc)), W = w + 2 * pad, H = h + 2 * pad;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(src, pad, pad, w, h);
      var id = c.getImageData(0, 0, W, H), d = id.data, n = W * H, fg = new Uint8Array(n), rgb = new Uint8Array(n * 3), al = new Uint8Array(n), i;
      var maxA = 0; for (i = 0; i < n; i++) if (d[i * 4 + 3] > maxA) maxA = d[i * 4 + 3];
      if (!maxA) return { empty: true, blank: true };   // immagine tutta trasparente
      if (maxA < 128) for (i = 0; i < n; i++) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * 255 / maxA);   // tutta semitrasparente: si rende piena (prima: "nessuna forma")
      for (i = 0; i < n; i++) { rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2]; al[i] = d[i * 4 + 3]; fg[i] = d[i * 4 + 3] >= 128 ? 1 : 0; }
      if (removeBg) {
        // colore dello sfondo = colore piu' comune sul bordo dell'immagine (se il bordo non e' gia' trasparente)
        var ring = [], x, y;
        for (x = pad; x < W - pad; x++) ring.push(pad * W + x, (H - pad - 1) * W + x);
        for (y = pad; y < H - pad; y++) ring.push(y * W + pad, y * W + W - pad - 1);
        var op = ring.filter(function (k) { return fg[k]; });
        if (op.length > ring.length * 0.4) {
          var ch = [0, 1, 2].map(function (q) { var v = op.map(function (k) { return rgb[k * 3 + q]; }).sort(function (a, b) { return a - b; }); return v[v.length >> 1]; });
          var LB = new Float32Array(n * 3); for (i = 0; i < n; i++) { var lq = lab(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]); LB[i * 3] = lq[0]; LB[i * 3 + 1] = lq[1]; LB[i * 3 + 2] = lq[2]; }
          var dL = function (k, c) { var a = LB[k * 3] - c[0], b2 = LB[k * 3 + 1] - c[1], c2 = LB[k * 3 + 2] - c[2]; return a * a + b2 * b2 + c2 * c2; };
          var dL0 = function (p, q) { var a = p[0] - q[0], b2 = p[1] - q[1], c2 = p[2] - q[2]; return a * a + b2 * b2 + c2 * c2; };
          // distanza (al quadrato) dal tratto tra due colori: i pixel "a meta'" tra due colori dello sfondo sono sfondo anche loro
          var segD = function (k, c1, c2) { var v = [c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]], w = [LB[k * 3] - c1[0], LB[k * 3 + 1] - c1[1], LB[k * 3 + 2] - c1[2]];
            var t = Math.max(0, Math.min(1, (v[0] * w[0] + v[1] * w[1] + v[2] * w[2]) / Math.max(1e-6, v[0] * v[0] + v[1] * v[1] + v[2] * v[2])));
            var a = w[0] - t * v[0], b2 = w[1] - t * v[1], c2 = w[2] - t * v[2]; return a * a + b2 * b2 + c2 * c2; };
          var dK = function (k, k2) { var a = LB[k * 3] - LB[k2 * 3], b2 = LB[k * 3 + 1] - LB[k2 * 3 + 1], c2 = LB[k * 3 + 2] - LB[k2 * 3 + 2]; return a * a + b2 * b2 + c2 * c2; };
          var bg = lab(ch[0], ch[1], ch[2]);
          // finto trasparente (scacchiera bianca e grigia, tipica delle immagini "PNG" scaricate): il bordo e' fatto di due
          // grigi chiari. Si tolgono tutti e due, e anche i pixel di passaggio tra uno e l'altro (JPEG), poi niente altro
          var chk = (function () {
            var Ls = op.map(function (k) { return LB[k * 3]; }).sort(function (a, b) { return a - b; }), mL = Ls[Ls.length >> 1];
            var med = function (sel) { var ks = op.filter(sel); if (ks.length < op.length * 0.2) return null; return [0, 1, 2].map(function (q) { var v = ks.map(function (k) { return LB[k * 3 + q]; }).sort(function (a, b) { return a - b; }); return v[v.length >> 1]; }); };
            var c1 = med(function (k) { return LB[k * 3] > mL + 1; }), c2 = med(function (k) { return LB[k * 3] < mL - 1; });
            if (!c1 || !c2) return null;
            var dd = Math.sqrt(dL0(c1, c2)); if (dd < 6 || dd > 40) return null;
            if ([c1, c2].some(function (c) { return c[0] < 55 || Math.hypot(c[1], c[2]) > 10; })) return null;
            var on = op.filter(function (k) { return segD(k, c1, c2) <= 16; }).length;
            if (on < op.length * 0.9) return null;
            // (una scacchiera cambia colore tante volte lungo il bordo; una carta fotografata con la luce che cambia, una volta o due)
            var sw = 0, side = function (k0, step, cnt) { var last = -1; for (var j = 0; j < cnt; j++) { var k = k0 + j * step; if (!fg[k]) continue; var c = dL(k, c1) < dL(k, c2) ? 1 : 2; if (last > 0 && c !== last) sw++; last = c; } };
            side(pad * W + pad, 1, W - 2 * pad); side((H - pad - 1) * W + pad, 1, W - 2 * pad); side(pad * W + pad, W, H - 2 * pad); side(pad * W + W - pad - 1, W, H - 2 * pad);
            return sw >= 16 ? [c1, c2] : null;
          })();
          // quanto "rumore" ha lo sfondo (JPEG, carta): la tolleranza si adatta, ma resta stretta. Prima era larga (18) e
          // con sfondi chiari si mangiava anche figure chiare (uovo bianco su azzurro, navetta grigia su bianco, gatto crema)
          var nd = op.map(function (k) { return Math.sqrt(dL(k, bg)); }).sort(function (a, b) { return a - b; });
          // (dalla mediana: se sul bordo c'e' un pezzo di un'altra figura non deve allargare la tolleranza)
          var TOL1 = Math.max(3.5, Math.min(12, 2 * nd[nd.length >> 1] + 2.5)), T1 = TOL1 * TOL1, CAP = (TOL1 + 5) * (TOL1 + 5);
          // sfondo non unito (foto con prato, foglie, stanza, carta fotografata storta): il bordo dell'immagine e' di tanti
          // colori. Toglierlo a pezzi lascia buchi e macchie (gatto sull'erba, viso sul muro chiaro): si tiene tutta la foto
          // e il configuratore lo dice. Sfondi uniti: mediana fino a ~4 (anche JPEG e carta); foto con sfondo: da ~5,4 in su
          var busyC = nd[nd.length >> 1] > 5 && !force && !chk;
          // disegno a tratti sottili su fondo unito (disegno di un bambino a matita, scritta a mano, logo a filo): i tratti di
          // 1-2 pixel si perdono (si stampano solo da ~0,8 mm). Se TUTTO il disegno e' fatto di tratti sottili, si ingrossano
          // di 3 pixel col loro colore, prima di togliere lo sfondo (cosi' le righe restano anche unite)
          if (!chk && nd[nd.length >> 1] <= 2.8) (function () {
            var ink = new Uint8Array(n), inkN = 0; for (i = 0; i < n; i++) if (fg[i] && dL(i, bg) > 22 * 22) { ink[i] = 1; inkN++; }
            if (inkN < n * 0.002 || inkN > n * 0.2) return;
            var dI = edtC(ink, W, H), arr = []; for (i = 0; i < n; i++) if (ink[i]) arr.push(dI[i]); arr.sort(function (a, b) { return a - b; });
            if (arr[Math.floor(arr.length * 0.95)] > 2.5) return;
            // (filtro "minimo": ogni pixel prende il colore piu' scuro tra lui e i vicini, 3 volte: le righe diventano larghe
            //  7 pixel col colore pieno del tratto, non quello sfumato del bordo)
            // 0.5.8 (prove 28/10): nei disegni fitti (mandala a righe sottili, labirinti, scarabocchi pieni di forme) ingrossando
            // di 3 punti gli spazi tra le righe si chiudevano e il disegno diventava una macchia nera. Si prova prima sulla
            // maschera: si ingrossa di 3, 2, 1 o 0 punti, il massimo che lascia aperti 3 spazi chiusi su 4 (se ce ne sono almeno 8)
            // e non copre piu' di meta' del riquadro del disegno.
            var holesOf = function (m) { var nm = new Uint8Array(n), c = 0, i2; for (i2 = 0; i2 < n; i2++) nm[i2] = fg[i2] && !m[i2] ? 1 : 0; var cc = components(nm, W, H); for (i2 = 1; i2 <= cc.n; i2++) if (cc.areas[i2] >= 6) c++; return c; };
            var h0n = holesOf(ink), mk = ink, NIT = 0, bx0 = W, by0 = H, bx1 = -1, by1 = -1;
            for (i = 0; i < n; i++) if (ink[i]) { var ixb = i % W, iyb = (i - ixb) / W; if (ixb < bx0) bx0 = ixb; if (ixb > bx1) bx1 = ixb; if (iyb < by0) by0 = iyb; if (iyb > by1) by1 = iyb; }
            var bA = Math.max(1, (bx1 - bx0 + 1) * (by1 - by0 + 1));   // (e in ogni caso l'inchiostro ingrossato non deve coprire piu' di meta' del disegno)
            {
              for (var t2 = 0; t2 < 3; t2++) {
                var m2 = new Uint8Array(n);
                for (i = 0; i < n; i++) {
                  if (mk[i]) { m2[i] = 1; continue; } if (!fg[i]) continue; var ix3 = i % W;
                  var nb3 = t2 === 1 ? [ix3 > 0 ? i - 1 : -1, ix3 < W - 1 ? i + 1 : -1, i - W, i + W] : [ix3 > 0 ? i - 1 : -1, ix3 < W - 1 ? i + 1 : -1, i - W, i + W, ix3 > 0 ? i - W - 1 : -1, ix3 < W - 1 ? i - W + 1 : -1, ix3 > 0 ? i + W - 1 : -1, ix3 < W - 1 ? i + W + 1 : -1];
                  for (var j3 = 0; j3 < nb3.length; j3++) { var q3 = nb3[j3]; if (q3 >= 0 && q3 < n && mk[q3]) { m2[i] = 1; break; } }
                }
                var cov = 0; for (i = 0; i < n; i++) cov += m2[i]; if (cov > bA * 0.5) break;
                if (h0n >= 8 && holesOf(m2) < h0n * 0.75) break;
                mk = m2; NIT = t2 + 1;
              }
            }
            thickN = NIT;
            for (var it = 0; it < NIT; it++) {
              var src = new Int32Array(n);
              for (i = 0; i < n; i++) {
                src[i] = i; if (!fg[i]) continue; var ix = i % W, bL = LB[i * 3];
                (it === 1 ? [ix > 0 ? i - 1 : -1, ix < W - 1 ? i + 1 : -1, i - W, i + W] : [ix > 0 ? i - 1 : -1, ix < W - 1 ? i + 1 : -1, i - W, i + W, ix > 0 ? i - W - 1 : -1, ix < W - 1 ? i - W + 1 : -1, ix > 0 ? i + W - 1 : -1, ix < W - 1 ? i + W + 1 : -1]).forEach(function (q) { if (q >= 0 && q < n && fg[q] && LB[q * 3] < bL) { bL = LB[q * 3]; src[i] = q; } });
              }
              var cR = rgb.slice(), cL = LB.slice(), cD = d.slice();
              for (i = 0; i < n; i++) if (src[i] !== i) { var q2 = src[i]; for (var c3 = 0; c3 < 3; c3++) { rgb[i * 3 + c3] = cR[q2 * 3 + c3]; LB[i * 3 + c3] = cL[q2 * 3 + c3]; d[i * 4 + c3] = cD[q2 * 4 + c3]; } }
            }
          })();
          // si segue lo sfondo anche se cambia piano piano (ombre leggere, vignettatura): ogni pixel tolto si porta dietro
          // il colore "locale" dello sfondo, che si sposta lentamente. Si va avanti solo dai pixel piatti: i pixel di passaggio
          // verso la figura (bordo sfumato) si tolgono ma non fanno entrare nella figura (uovo bianco, navetta grigio chiaro).
          var rem = new Uint8Array(n), seen = new Uint8Array(n), RF = new Float32Array(n * 3), st = [], AL = 0.04;
          var flat = function (k) { var kx = k % W, m = 0; if (kx > 0) m = Math.max(m, dK(k, k - 1)); if (kx < W - 1) m = Math.max(m, dK(k, k + 1)); if (k >= W) m = Math.max(m, dK(k, k - W)); if (k + W < n) m = Math.max(m, dK(k, k + W)); return m <= 3 * 3; };
          // contorni con buchini (JPEG, linee a mano): lo sfondo entrava dal buchino e si portava via tutto il bianco dentro
          // la figura (pancia, faccia), che poi diventava del colore della base. Ora i pixel vicinissimi ai tratti netti
          // (entro LKR pixel) fanno da diga: prima si toglie lo sfondo senza passarci, poi si rifinisce il bordo entrando
          // nella diga solo per LKR+1 passi (troppo pochi per attraversare il tratto e il buchino)
          var LKR = 2, bar = null;
          if (!chk) {
            // (solo i tratti sottili, cioe' le linee di contorno: dove la figura stessa e' scura e piena, es. un cavallo bianco
            //  su nero, lo spazietto tra coda e zampa e' sfondo vero e resta da togliere)
            var ink = new Uint8Array(n), nInk = new Uint8Array(n); for (i = 0; i < n; i++) { ink[i] = fg[i] && dL(i, bg) > 900 ? 1 : 0; nInk[i] = 1 - ink[i]; }
            var dIn = edtC(ink, W, H), er = new Uint8Array(n); for (i = 0; i < n; i++) er[i] = dIn[i] > 3 ? 0 : 1;
            var dEr = edtC(er, W, H), thinNot = new Uint8Array(n);
            for (i = 0; i < n; i++) thinNot[i] = ink[i] && !(er[i] === 0 || dEr[i] <= 3.5) ? 0 : 1;   // 0 = tratto sottile (sparisce con l'apertura di raggio 3)
            var dIk = edtC(thinNot, W, H); bar = new Uint8Array(n); for (i = 0; i < n; i++) bar[i] = nInk[i] && dIk[i] <= LKR ? 1 : 0;
          }
          if (!chk) op.forEach(function (k) { if (dL(k, bg) <= T1 && !bar[k]) { seen[k] = 1; rem[k] = 1; RF[k * 3] = bg[0]; RF[k * 3 + 1] = bg[1]; RF[k * 3 + 2] = bg[2]; st.push(k); } });
          while (st.length) {
            var k = st.pop(), kx = k % W, r0 = RF[k * 3], r1 = RF[k * 3 + 1], r2 = RF[k * 3 + 2];
            [kx > 0 ? k - 1 : -1, kx < W - 1 ? k + 1 : -1, k - W, k + W].forEach(function (q) {
              if (q < 0 || q >= n || seen[q] || !fg[q] || (bar && bar[q])) return; var e = dL(q, bg);
              var a = LB[q * 3] - r0, b2 = LB[q * 3 + 1] - r1, c2 = LB[q * 3 + 2] - r2, er = a * a + b2 * b2 + c2 * c2;
              if (!(e <= T1 || (e <= CAP && er <= T1))) return;
              seen[q] = 1; rem[q] = 1;
              if (e <= T1 && er <= T1 || flat(q)) { RF[q * 3] = r0 + AL * a; RF[q * 3 + 1] = r1 + AL * b2; RF[q * 3 + 2] = r2 + AL * c2; st.push(q); }
            });
          }
          if (bar) {   // rifinitura del bordo dentro la diga, pochi passi (cosi' non attraversa i buchini dei contorni)
            var fr = []; for (i = 0; i < n; i++) if (rem[i]) { var ix4 = i % W; if ((ix4 > 0 && bar[i - 1]) || (ix4 < W - 1 && bar[i + 1]) || (i >= W && bar[i - W]) || (i + W < n && bar[i + W])) fr.push(i); }
            for (var dep = 0; dep <= LKR && fr.length; dep++) {
              var nf = [];
              fr.forEach(function (k) {
                var kx = k % W, r0 = RF[k * 3] || bg[0], r1 = RF[k * 3 + 1] || bg[1], r2 = RF[k * 3 + 2] || bg[2];
                [kx > 0 ? k - 1 : -1, kx < W - 1 ? k + 1 : -1, k - W, k + W].forEach(function (q) {
                  if (q < 0 || q >= n || seen[q] || !fg[q] || !bar[q]) return; var e = dL(q, bg);
                  var a = LB[q * 3] - r0, b2 = LB[q * 3 + 1] - r1, c2 = LB[q * 3 + 2] - r2, er = a * a + b2 * b2 + c2 * c2;
                  if (!(e <= T1 || (e <= CAP && er <= T1))) return;
                  seen[q] = 1; rem[q] = 1; RF[q * 3] = r0; RF[q * 3 + 1] = r1; RF[q * 3 + 2] = r2; nf.push(q);
                });
              });
              fr = nf;
            }
          }
          if (chk) {   // scacchiera: via tutto quello che sta tra i due grigi, partendo dal bordo
            var stK = [], TK = 25;
            op.forEach(function (k) { if (segD(k, chk[0], chk[1]) <= TK) { rem[k] = 1; seen[k] = 1; stK.push(k); } });
            while (stK.length) {
              var kk = stK.pop(), kx2 = kk % W;
              [kx2 > 0 ? kk - 1 : -1, kx2 < W - 1 ? kk + 1 : -1, kk - W, kk + W].forEach(function (q) { if (q < 0 || q >= n || seen[q] || !fg[q]) return; if (segD(q, chk[0], chk[1]) <= TK) { seen[q] = 1; rem[q] = 1; stK.push(q); } });
            }
            // (anche i pezzi di scacchiera chiusi dentro la figura, es. tra le zampe: ci sono tutti e due i grigi)
            var pm = new Uint8Array(n); for (i = 0; i < n; i++) pm[i] = fg[i] && !rem[i] && segD(i, chk[0], chk[1]) <= TK ? 1 : 0;
            var pcK = components(pm, W, H), n1 = new Int32Array(pcK.n + 1), n2 = new Int32Array(pcK.n + 1);
            for (i = 0; i < n; i++) if (pm[i]) { if (dL(i, chk[0]) < dL(i, chk[1])) n1[pcK.lab[i]]++; else n2[pcK.lab[i]]++; }
            for (i = 0; i < n; i++) if (pm[i]) { var lk = pcK.lab[i], ak = pcK.areas[lk]; if (ak >= 60 && n1[lk] >= ak * 0.2 && n2[lk] >= ak * 0.2) rem[i] = 1; }
          }
          // (se da un bordo cosi' si toglie quasi niente, es. una bandiera che riempie l'immagine, non c'e' niente da dire)
          if (busyC) { var remN = 0; for (i = 0; i < n; i++) if (rem[i]) remN++; if (remN > n * 0.03) { busyBg = true; for (i = 0; i < n; i++) rem[i] = 0; } }
          // sfondo "a cartoncino": un riquadro (spesso arrotondato) di un colore unito con la figura dentro, sopra lo sfondo
          // vero (immagini prese da un sito: luna sul blu, joystick sul grigio, scheda SD sul beige). Si toglie anche quello,
          // solo se: il bordo e' quasi tutto di un colore, la parte rimasta e' un rettangolo pieno e grande quanto l'immagine,
          // e quel colore e' tanto (non il contorno sottile di una cassetta VHS o di un Game Boy).
          (function () {
            // (il colore del cartoncino si legge 2-4 pixel dentro: sul bordo ci sono i pixel sfumati verso lo sfondo)
            if (busyBg || chk) return;
            var cx0 = W, cx1 = -1, cy0 = H, cy1 = -1, cA = 0, sdC = [], nr0 = new Uint8Array(n);
            for (i = 0; i < n; i++) nr0[i] = rem[i] || !fg[i] ? 0 : 1;
            var d0 = edtC(nr0, W, H);
            for (i = 0; i < n; i++) if (nr0[i]) {
              cA++; var ix = i % W, iy = (i - ix) / W; if (ix < cx0) cx0 = ix; if (ix > cx1) cx1 = ix; if (iy < cy0) cy0 = iy; if (iy > cy1) cy1 = iy;
              if (d0[i] > 2.2 && d0[i] <= 4) sdC.push(i);
            }
            if (cA < 100 || sdC.length < 40) return;
            var bw = cx1 - cx0 + 1, bh = cy1 - cy0 + 1, imA = (W - 2 * pad) * (H - 2 * pad);
            // (un cartoncino vero riempie quasi tutto il suo riquadro: 0,99. Quattro anelli neri uniti come un logo di auto
            //  arrivano a 0,9 e prima venivano tolti come "cartoncino", lasciando solo il bianco dentro gli anelli)
            if (cA < bw * bh * 0.95 || bw * bh < imA * 0.6) return;
            var mcC = [0, 1, 2].map(function (q) { var v = sdC.map(function (k) { return LB[k * 3 + q]; }).sort(function (a, b) { return a - b; }); return v[v.length >> 1]; });
            var dC = sdC.map(function (k) { return Math.sqrt(dL(k, mcC)); }).sort(function (a, b) { return a - b; });
            if (dC[Math.floor(dC.length * 0.6)] > 8) return;
            var TC = Math.max(5, Math.min(12, 2 * dC[dC.length >> 1] + 3)), TC2 = TC * TC, CAPC = (TC + 5) * (TC + 5);
            var remC = new Uint8Array(n), seenC = new Uint8Array(n), RC = new Float32Array(n * 3), stC = [], cnt = 0;
            sdC.forEach(function (k) { if (dL(k, mcC) <= TC2) { seenC[k] = 1; remC[k] = 1; RC[k * 3] = mcC[0]; RC[k * 3 + 1] = mcC[1]; RC[k * 3 + 2] = mcC[2]; stC.push(k); } });
            while (stC.length) {
              var k = stC.pop(), kx = k % W, r0 = RC[k * 3], r1 = RC[k * 3 + 1], r2 = RC[k * 3 + 2]; cnt++;
              [kx > 0 ? k - 1 : -1, kx < W - 1 ? k + 1 : -1, k - W, k + W].forEach(function (q) {
                if (q < 0 || q >= n || seenC[q] || !fg[q] || rem[q]) return; var e = dL(q, mcC);
                var a = LB[q * 3] - r0, b2 = LB[q * 3 + 1] - r1, c2 = LB[q * 3 + 2] - r2, er = a * a + b2 * b2 + c2 * c2;
                if (!(e <= TC2 || (e <= CAPC && er <= TC2))) return;
                seenC[q] = 1; remC[q] = 1;
                if (e <= TC2 && er <= TC2 || flat(q)) { RC[q * 3] = r0 + AL * a; RC[q * 3 + 1] = r1 + AL * b2; RC[q * 3 + 2] = r2 + AL * c2; stC.push(q); }
              });
            }
            if (cnt < cA * 0.3 || cA - cnt < cA * 0.03) return;
            // (via anche la sottile riga sfumata tra lo sfondo e il cartoncino)
            var dCd = edtC(remC.map(function (v) { return v ? 0 : 1; }), W, H);
            for (i = 0; i < n; i++) if (remC[i] || (nr0[i] && d0[i] <= 3.5 && dCd[i] <= 3.5)) rem[i] = 1;
            // (e i pixel sfumati tra il cartoncino e la figura, es. l'alone scuro intorno alla luna: piu' vicini al cartoncino)
            for (i = 0; i < n; i++) if (nr0[i] && !remC[i] && dCd[i] <= 2.5 && dL(i, mcC) < 30 * 30) rem[i] = 1;
          })();
          // bordo degli adesivi (fascia bianca e/o ombra intorno alla figura, attaccata allo sfondo): si toglie solo se e'
          // una fascia, cioe' non arriva mai lontano dallo sfondo (uovo bianco, gatto crema con il contorno aperto: no).
          // Piu' giri: prima l'eventuale ombra, poi la fascia bianca.
          var lim = 0.045 * Math.max(W, H), left = 0, mcW = null, shDone = false; for (i = 0; i < n; i++) if (fg[i] && !rem[i]) left++;
          // ombra portata sullo sfondo (es. ombra azzurra sotto la pancetta): stesso colore dello sfondo ma piu' scuro
          // (in RGB tutti i canali calano nella stessa proporzione). Si toglie solo se e' una fascia vicina allo sfondo.
          (function () {
            if (chk || busyBg) return;
            var isSh = function (k) { var t0 = rgb[k * 3] / Math.max(1, ch[0]), t1 = rgb[k * 3 + 1] / Math.max(1, ch[1]), t2 = rgb[k * 3 + 2] / Math.max(1, ch[2]), tm = (t0 + t1 + t2) / 3; return tm >= 0.4 && tm <= 0.93 && Math.abs(t0 - tm) <= 0.07 && Math.abs(t1 - tm) <= 0.07 && Math.abs(t2 - tm) <= 0.07; };
            var R3 = new Uint8Array(n), st3 = [], c3 = 0, sd3 = 0;
            for (i = 0; i < n; i++) if (!rem[i] && fg[i]) { var ix3 = i % W; if ((ix3 > 0 && rem[i - 1]) || (ix3 < W - 1 && rem[i + 1]) || (i >= W && rem[i - W]) || (i + W < n && rem[i + W])) { sd3++; if (isSh(i)) { R3[i] = 1; st3.push(i); } } }
            if (st3.length < 20) return; var seed3 = st3.length;
            // 0.5.6 (ALFI, valigia): un'ombra vera sfuma nello sfondo, quindi dove tocca lo sfondo ha quasi il suo colore. Se il bordo
            // e' netto (grigio pieno subito dopo lo sfondo, es. le aste grigio chiaro di una valigia) e' una parte della figura: resta
            var e3 = st3.map(function (k) { return Math.sqrt(dL(k, bg)); }).sort(function (a, b) { return a - b; });
            if (e3[e3.length >> 1] > TOL1 + 10) return;
            while (st3.length) { var k3 = st3.pop(), k3x = k3 % W; c3++; [k3x > 0 ? k3 - 1 : -1, k3x < W - 1 ? k3 + 1 : -1, k3 - W, k3 + W].forEach(function (q) { if (q >= 0 && q < n && !R3[q] && !rem[q] && fg[q] && isSh(q)) { R3[q] = 1; st3.push(q); } }); }
            var nr3 = new Uint8Array(n); for (i = 0; i < n; i++) nr3[i] = rem[i] ? 0 : 1;
            var dB3 = edtC(nr3, W, H), far3 = 0, cut3 = 0; for (i = 0; i < n; i++) if (R3[i]) { if (dB3[i] > lim) far3++; else if (dB3[i] > lim - 1.5) cut3++; }
            if (c3 > left * 0.3 || (far3 > c3 * 0.01 && cut3 > sd3 * 0.35)) return;
            for (i = 0; i < n; i++) if (R3[i] && dB3[i] <= lim) { rem[i] = 1; left--; }
            shDone = seed3 >= sd3 * 0.5;
          })();
          for (var pass = 0; pass < 3 && !chk && !busyBg; pass++) {
            var sd = []; for (i = 0; i < n; i++) if (!rem[i] && fg[i]) { var ix = i % W; if ((ix > 0 && rem[i - 1]) || (ix < W - 1 && rem[i + 1]) || (i >= W && rem[i - W]) || (i + W < n && rem[i + W])) sd.push(i); }
            // (il colore della fascia: quello piu' comune lungo il bordo, chiaro e diverso dallo sfondo)
            var sdW = sd.filter(function (k) { return LB[k * 3] >= 70 && dL(k, bg) > (TOL1 + 2) * (TOL1 + 2); });
            // (dopo un'ombra tolta, la fascia puo' essere dello stesso colore dello sfondo: es. adesivo bianco su fondo bianco)
            var mc = bg;
            if (sdW.length >= 20 && sdW.length >= sd.length * 0.1) mc = [0, 1, 2].map(function (q) { var v = sdW.map(function (k) { return LB[k * 3 + q]; }).sort(function (a, b) { return a - b; }); return v[v.length >> 1]; });
            else if (!pass && !shDone) break;
            var R2 = new Uint8Array(n), st2 = [], cnt2 = 0, T2 = 8 * 8;
            sd.forEach(function (k) { if (dL(k, mc) <= T2) { R2[k] = 1; st2.push(k); } });
            while (st2.length) {
              var k2 = st2.pop(); cnt2++; var k2x = k2 % W;
              [k2x > 0 ? k2 - 1 : -1, k2x < W - 1 ? k2 + 1 : -1, k2 - W, k2 + W].forEach(function (q) { if (q >= 0 && q < n && !R2[q] && !rem[q] && fg[q] && dL(q, mc) <= T2) { R2[q] = 1; st2.push(q); } });
            }
            var nr = new Uint8Array(n); for (i = 0; i < n; i++) nr[i] = rem[i] ? 0 : 1;
            // (se il bianco entra nella figura da un buchino del contorno, es. il muso crema del gatto, si taglia alla larghezza
            // della fascia: lo si riconosce perche' il "taglio" e' corto. Un uovo bianco invece e' aperto su tutto il bordo.)
            var dB = edtC(nr, W, H), far = 0, cut = 0; for (i = 0; i < n; i++) if (R2[i]) { if (dB[i] > lim) far++; else if (dB[i] > lim - 1.5) cut++; }
            // (una fascia vera gira intorno a quasi tutta la figura: i suoi pixel sono la maggior parte del bordo)
            var seedN = 0; sd.forEach(function (k) { if (R2[k]) seedN++; });
            if (!cnt2 || cnt2 > left * 0.4 || seedN < sd.length * 0.5 || (far > cnt2 * 0.01 && (cut > sd.length * 0.35 || far > cnt2 * 0.15))) break;
            for (i = 0; i < n; i++) if (R2[i] && dB[i] <= lim) { rem[i] = 1; left--; }
            if (mc[0] >= 94 && mc[1] * mc[1] + mc[2] * mc[2] <= 100) { mcW = mc; break; }   // la fascia bianca e' sempre l'ultimo strato
          }
          // pezzetti della fascia bianca rimasti chiusi tra due parti della figura (es. tra la coda e il corpo del gatto):
          // piccoli, del colore della fascia e tutti vicini al bordo
          if (mcW) {
            var pm = new Uint8Array(n); for (i = 0; i < n; i++) pm[i] = fg[i] && !rem[i] && dL(i, mcW) <= 7 * 7 ? 1 : 0;
            var pc = components(pm, W, H), nr2 = new Uint8Array(n); for (i = 0; i < n; i++) nr2[i] = rem[i] ? 0 : 1;
            var dB2 = edtC(nr2, W, H), pFar = new Int32Array(pc.n + 1);
            for (i = 0; i < n; i++) if (pm[i] && dB2[i] > lim) pFar[pc.lab[i]]++;
            for (i = 0; i < n; i++) if (pm[i] && pFar[pc.lab[i]] <= pc.areas[pc.lab[i]] * 0.05 && pc.areas[pc.lab[i]] < left * 0.02) rem[i] = 1;
          }
          for (i = 0; i < n; i++) if (rem[i]) { fg[i] = 0; al[i] = 0; }
        }
      }
      // via i puntini sparsi (sotto lo 0.3% della figura)
      var cc = components(fg, W, H), tot = 0; for (i = 1; i <= cc.n; i++) tot += cc.areas[i];
      for (i = 0; i < n; i++) if (fg[i] && cc.areas[cc.lab[i]] < tot * 0.003) fg[i] = 0;
      var cnt = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (i = 0; i < n; i++) {
        if (!fg[i] && al[i] >= 128) al[i] = 0;
        d[i * 4 + 3] = al[i];
        if (fg[i]) { cnt++; var px = i % W, py = (i - px) / W; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
      }
      if (cnt < 30) return { empty: true };
      c.putImageData(id, 0, 0);
      x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
      var out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(cv, -x0, -y0);
      return { cv: out, empty: false, busy: busyBg, ox: x0, oy: y0, sc: sc, pad: pad, thick: thickN };
    }

    /* 2) scritta: una o due righe, con o senza contorno delle lettere (colori esatti dei filamenti) */
    function textCanvas(t) {
      var F = 160, lines = (t.lines || []).map(function (s) { return String(s || '').trim(); }).filter(function (s) { return s; });
      if (!lines.length) return null;
      var sw = t.stroke ? F * (t.strokeW || 0.09) : 0, font = t.font.replace(/\d+px/, F + 'px');
      var m = document.createElement('canvas').getContext('2d'); m.font = font;
      var ms = lines.map(function (s) {
        var q = m.measureText(s), l = q.actualBoundingBoxLeft != null ? q.actualBoundingBoxLeft : 0, r = q.actualBoundingBoxRight != null ? q.actualBoundingBoxRight : q.width;
        return { s: s, l: l, r: r, a: q.actualBoundingBoxAscent || F * 0.75, d: q.actualBoundingBoxDescent || 0 };
      });
      var capA = Math.max.apply(null, ms.map(function (q) { return q.a; })), capD = Math.max.apply(null, ms.map(function (q) { return q.d; }));
      var lh = (capA + capD) * 1.12, pad = Math.ceil(sw) + 6;
      var W = Math.ceil(Math.max.apply(null, ms.map(function (q) { return q.l + q.r; }))) + 2 * pad, H = Math.ceil(capA + capD + lh * (ms.length - 1)) + 2 * pad;
      function draw(mode) {
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var c = cv.getContext('2d');
        c.font = font; c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.miterLimit = 2;
        ms.forEach(function (q, i) {
          var x = W / 2 - (q.r - q.l) / 2, y = pad + capA + i * lh;
          if (mode === 'stroke') { c.strokeStyle = t.stroke; c.lineWidth = 2 * sw; c.strokeText(q.s, x, y); c.fillStyle = t.stroke; c.fillText(q.s, x, y); }
          else { c.fillStyle = t.fill; c.fillText(q.s, x, y); }
        });
        return cv;
      }
      return { W: W, H: H, fill: draw('fill'), stroke: sw ? draw('stroke') : null, letterH: capA, lines: ms.length };
    }

    /* 3) immagine + scritte in un solo disegno. Unita' = larghezza dell'immagine (1 se non c'e' immagine).
       layers: [{text, font, fill, stroke, fid, sid, size (altezza lettere in unita'), rot (gradi), x, y (centro, unita')}]
       le scritte stanno sopra all'immagine e il loro colore vince sempre (pixel con colore fisso) */
    function compose(img, layers, o) {
      o = o || {}; layers = (layers || []).filter(function (L) { return L && String(L.text || '').trim(); });
      if (!img && !layers.length) return null;
      var REF = 1000, iw = img ? REF : 0, ih = img ? REF * img.height / img.width : 0;
      var x0 = img ? 0 : 1e9, y0 = img ? 0 : 1e9, x1 = img ? iw : -1e9, y1 = img ? ih : -1e9;
      var items = layers.map(function (L) {
        var tc = textCanvas({ lines: [L.text], font: L.font, fill: L.fill, stroke: L.stroke, strokeW: 0.09 });
        var ts = L.size * REF / tc.letterH, w = tc.W * ts, h = tc.H * ts, cx = L.x * REF, cy = L.y * REF, a = (L.rot || 0) * Math.PI / 180;
        [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].forEach(function (q) {
          var X = cx + q[0] * Math.cos(a) - q[1] * Math.sin(a), Y = cy + q[0] * Math.sin(a) + q[1] * Math.cos(a);
          x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
        });
        return { L: L, tc: tc, w: w, h: h, cx: cx, cy: cy, a: a };
      });
      var Wl = x1 - x0, Hl = y1 - y0, k = (o.maxPx || 640) / Math.max(Wl, Hl);
      if (img && !layers.length) k = Math.min(k, img.width / REF);
      var pad = 4, W = Math.round(Wl * k) + 2 * pad, H = Math.round(Hl * k) + 2 * pad, ox = pad - x0 * k, oy = pad - y0 * k;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var c = cv.getContext('2d', { willReadFrequently: true });
      if (img) c.drawImage(img, ox, oy, iw * k, ih * k);
      function put(g, it, src) { g.save(); g.translate(ox + it.cx * k, oy + it.cy * k); g.rotate(it.a); g.drawImage(src, -it.w * k / 2, -it.h * k / 2, it.w * k, it.h * k); g.restore(); }
      var fixed = null, ids = [], hexes = [];
      if (items.length && !o.noFixed) {
        fixed = new Int8Array(W * H).fill(-1);
        var tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; var tg = tmp.getContext('2d', { willReadFrequently: true });
        var idx = function (id, hex) { var i = ids.indexOf(id); if (i < 0) { ids.push(id); hexes.push(hex); i = ids.length - 1; } return i; };
        items.forEach(function (it) {
          [[it.tc.stroke, it.L.sid, it.L.stroke], [it.tc.fill, it.L.fid, it.L.fill]].forEach(function (q) {
            if (!q[0]) return;
            var ci = idx(q[1], q[2]); tg.clearRect(0, 0, W, H); put(tg, it, q[0]);
            var d = tg.getImageData(0, 0, W, H).data; for (var i = 0; i < W * H; i++) if (d[i * 4 + 3] >= 128) fixed[i] = ci;
          });
        });
      }
      items.forEach(function (it) { if (it.tc.stroke) put(c, it, it.tc.stroke); put(c, it, it.tc.fill); });
      var minL = items.length ? Math.min.apply(null, items.map(function (it) { return it.L.size * REF * k; })) : 0;
      return { cv: cv, fixed: fixed, ids: ids, hexes: hexes, letterPx: minL, unit: { k: REF * k, ox: ox, oy: oy },
        boxes: items.map(function (it) { return { cx: ox + it.cx * k, cy: oy + it.cy * k, w: it.w * k, h: it.h * k, a: it.a }; }) };
    }
    function prepare(C) {
      var cv = C.cv, W = cv.width, H = cv.height, d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, n = W * H;
      var fg = new Uint8Array(n), rgb = new Uint8Array(n * 3), al = new Uint8Array(n), cnt = 0;
      for (var i = 0; i < n; i++) { rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2]; al[i] = d[i * 4 + 3]; fg[i] = d[i * 4 + 3] >= 128 ? 1 : 0; cnt += fg[i]; }
      return { W: W, H: H, rgb: rgb, fg: fg, al: al, fixed: C.fixed, letterPx: C.letterPx, empty: cnt < 30 };
    }

    /* 4) pochi colori: k-means in Lab sui pixel dell'immagine; i pixel della scritta hanno gia' il loro colore */
    // baseLab: colore del contorno/retro. E' gia' un filamento, quindi diventa un colore FISSO anche per l'immagine
    // (indice 0): le parti dell'immagine di quel colore (es. occhi e bocca neri) lo usano, senza rubare un colore.
    function quantize(P, k, fixedLabs, baseLab) {
      var W = P.W, H = P.H, n = W * H, fg = P.fg, rgb = P.rgb, fx = P.fixed, i, j;
      function free(q) { return fg[q] && !(fx && fx[q] >= 0); }
      // colori in Lab, calcolati una volta per immagine: LAB0 = originali (servono per capire dove sono i bordi),
      // LAB = ripuliti dal rumore (servono per scegliere i colori e le zone)
      var LAB = P._lab, LAB0 = P._lab0, newLab = !LAB;
      if (newLab) { LAB = new Float32Array(n * 3); for (i = 0; i < n; i++) if (fg[i]) { var l = lab(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]); LAB[i * 3] = l[0]; LAB[i * 3 + 1] = l[1]; LAB[i * 3 + 2] = l[2]; } LAB0 = new Float32Array(LAB); P._lab0 = LAB0; }
      // via il rumore della foto (JPEG, grana) senza toccare i bordi: ogni pixel fa la media con i vicini DEL SUO STESSO colore
      // (filtro bilaterale, 2 passate). Le zone sfumate diventano lisce: niente chiazze di colori vicini.
      if (newLab) (function () {
        var R5 = 2, sS = 2 * 1.6 * 1.6, sC = 2 * 9 * 9, out = new Float32Array(n * 3), ws = [], dd = [], yy5, xx5;
        for (yy5 = -R5; yy5 <= R5; yy5++) for (xx5 = -R5; xx5 <= R5; xx5++) { dd.push(yy5 * W + xx5); ws.push(Math.exp(-(xx5 * xx5 + yy5 * yy5) / sS)); }
        for (var pass5 = 0; pass5 < 2; pass5++) {
          for (var p5 = 0; p5 < n; p5++) {
            if (!free(p5)) { out[p5 * 3] = LAB[p5 * 3]; out[p5 * 3 + 1] = LAB[p5 * 3 + 1]; out[p5 * 3 + 2] = LAB[p5 * 3 + 2]; continue; }
            var px5 = p5 % W, py5 = (p5 - px5) / W, a0 = LAB[p5 * 3], b0 = LAB[p5 * 3 + 1], c0 = LAB[p5 * 3 + 2], sw = 0, s0 = 0, s1 = 0, s2 = 0;
            for (var k5 = 0; k5 < dd.length; k5++) {
              var ox5 = (k5 % (2 * R5 + 1)) - R5, oy5 = Math.floor(k5 / (2 * R5 + 1)) - R5;
              if (px5 + ox5 < 0 || px5 + ox5 >= W || py5 + oy5 < 0 || py5 + oy5 >= H) continue;
              var q5 = p5 + dd[k5]; if (!free(q5)) continue;
              var e0 = LAB[q5 * 3] - a0, e1 = LAB[q5 * 3 + 1] - b0, e2 = LAB[q5 * 3 + 2] - c0, w5 = ws[k5] * Math.exp(-(e0 * e0 + e1 * e1 + e2 * e2) / sC);
              sw += w5; s0 += w5 * LAB[q5 * 3]; s1 += w5 * LAB[q5 * 3 + 1]; s2 += w5 * LAB[q5 * 3 + 2];
            }
            out[p5 * 3] = s0 / sw; out[p5 * 3 + 1] = s1 / sw; out[p5 * 3 + 2] = s2 / sw;
          }
          LAB.set(out);
        }
        P._lab = LAB;
      })();
      // i colori si imparano solo dai pixel "piatti": i bordi sfumati tra due colori (antialias) non diventano colori finti
      // (prima creavano anelli sottili che poi sparivano e lasciavano righe nere). Foto o immagini sfumate: soglia piu' larga.
      function gd(a, b) { var x = LAB0[a * 3] - LAB0[b * 3], y = LAB0[a * 3 + 1] - LAB0[b * 3 + 1], z = LAB0[a * 3 + 2] - LAB0[b * 3 + 2]; return x * x + y * y + z * z; }
      // "piattezza" di ogni pixel: la differenza di colore piu' grande con gli 8 vicini (i bordi sfumati hanno valori alti)
      var gmax = new Float32Array(n).fill(1e9), inner = [], pts = [], NB8 = [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1];
      for (i = W + 1; i < n - W - 1; i++) {
        if (!free(i)) continue; var x8 = i % W; if (x8 === 0 || x8 === W - 1) continue; var gm = 0, okN = true;
        for (j = 0; j < 8; j++) { var q8 = i + NB8[j]; if (!fg[q8]) { okN = false; break; } var g8 = gd(i, q8); if (g8 > gm) gm = g8; }
        if (okN) { gmax[i] = gm; inner.push(i); }
      }
      var tFlat = 1e18;
      [4, 6, 9, 13, 20, 1e9].some(function (t) {
        var t2 = t * t; pts = inner.filter(function (q) { return gmax[q] <= t2; }); tFlat = t2;
        return pts.length >= Math.max(50, inner.length * 0.4);
      });
      if (pts.length < 50) { pts = []; for (i = 0; i < n; i++) if (free(i)) pts.push(i); }
      if (pts.length > 24000) { var stp = pts.length / 24000, p2 = []; for (j = 0; j < 24000; j++) p2.push(pts[Math.floor(j * stp)]); pts = p2; }
      var P3 = function (q) { return [LAB[q * 3], LAB[q * 3 + 1], LAB[q * 3 + 2]]; };
      var seed = 7, rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      // ---- 1) colori "fini": tanti gruppi piccoli (20 + il colore del contorno), uguali per qualsiasi numero di colori.
      //      Si calcolano una volta per immagine (e colore del contorno); cambiare il numero di colori li unisce soltanto.
      var nFix = baseLab ? 1 : 0, KF = 20, RBK = 14 * 14, RBS = 25 * 25;
      // il colore del contorno attira solo i colori davvero vicini (es. occhi neri), non i chiari o i medi
      var dGate = function (e, ci, R) { return ci < nFix && e > R ? R + (e - R) * 4 : e; };
      var fkey = baseLab ? baseLab.map(function (v) { return v.toFixed(1); }).join(',') : '-';
      var F = P._fine && P._fine.key === fkey ? P._fine : null;
      if (k > 0 && pts.length && !F) {
        var best = null;
        for (var trial = 0; trial < 3; trial++) {
          var C = baseLab ? [baseLab.slice(), P3(pts[Math.floor(rnd() * pts.length)])] : [P3(pts[Math.floor(rnd() * pts.length)])], D = new Float32Array(pts.length);
          while (C.length < KF + nFix) {
            var sum = 0; for (j = 0; j < pts.length; j++) { var q = P3(pts[j]), m = 1e18; for (var c1 = 0; c1 < C.length; c1++) m = Math.min(m, dGate(dist2(q, C[c1]), c1, RBK)); D[j] = m; sum += m; }
            if (sum <= 0) break; var r = rnd() * sum, acc = 0; for (j = 0; j < pts.length; j++) { acc += D[j]; if (acc >= r) break; }
            C.push(P3(pts[Math.min(j, pts.length - 1)]));
          }
          var sse = 0;
          for (var it = 0; it < 14; it++) {
            var S = C.map(function () { return [0, 0, 0, 0]; }); sse = 0;
            for (j = 0; j < pts.length; j++) { var qq = P3(pts[j]), bi = 0, bd = 1e18; for (var c2 = 0; c2 < C.length; c2++) { var dd = dGate(dist2(qq, C[c2]), c2, RBK); if (dd < bd) { bd = dd; bi = c2; } } sse += bd; var s4 = S[bi]; s4[0] += qq[0]; s4[1] += qq[1]; s4[2] += qq[2]; s4[3]++; }
            C = C.map(function (c, ci) { var s4 = S[ci]; return ci < nFix ? c : s4[3] ? [s4[0] / s4[3], s4[1] / s4[3], s4[2] / s4[3]] : c; });
          }
          if (!best || sse < best.sse) best = { C: C, sse: sse };
        }
        var CF = best.C, nF = CF.length, labF = new Int8Array(n).fill(-1);
        // 2) pixel piatti e vicini a un colore fine: sicuri. Tutti gli altri (bordi sfumati, antialias, rumore JPEG)
        // prendono il colore della zona vicina che gli somiglia di piu', crescendo dai pixel sicuri (come un allagamento).
        var pend = new Uint8Array(n), SEED = 12 * 12, SEEDX = 30 * 30;
        // righe sottili (occhi, bocca, contorni di 2-4 pixel) non hanno pixel "piatti": il loro centro pero' NON sta "in mezzo"
        // tra i vicini (come un bordo sfumato), e' un estremo (es. il piu' scuro). Quei pixel possono fare da seme.
        var ext = P._ext;
        if (!ext) {
          ext = new Uint8Array(n); P._ext = ext;
          var dE = function (a, b) { return Math.sqrt(gd(a, b)); }, DR = [[1, 0], [0, 1], [1, 1], [1, -1]];
          inner.forEach(function (q) {
            if (gmax[q] <= tFlat) return;
            var qx = q % W, qy = (q - qx) / W;
            // non vicino al bordo della figura (dove lo sfondo e' stato tolto)
            for (var ey = -3; ey <= 3; ey++) for (var ex = -3; ex <= 3; ex++) { var ex2 = qx + ex, ey2 = qy + ey; if (ex2 < 0 || ey2 < 0 || ex2 >= W || ey2 >= H || !fg[ey2 * W + ex2]) return; }
            for (var r6 = 0; r6 < 4; r6++) for (var s6 = 1; s6 <= 3; s6++) {
              var dx6 = DR[r6][0] * s6, dy6 = DR[r6][1] * s6;
              if (qx - dx6 < 0 || qx + dx6 >= W || qy - dy6 < 0 || qy + dy6 >= H || qy + dy6 < 0 || qy - dy6 >= H) continue;
              var a6 = q - dy6 * W - dx6, b6 = q + dy6 * W + dx6; if (!fg[a6] || !fg[b6]) continue;
              var ab = dE(a6, b6), ai = dE(a6, q), ib = dE(q, b6);
              if (ab > 8 && ai > 0.15 * ab && ib > 0.15 * ab && ai + ib <= ab * 1.2 + 2) return;
            }
            ext[q] = 1;
          });
        }
        // il piu' vicino; e il piu' vicino tra quelli DIVERSI da lui (oltre 20 ΔE): tra due toni quasi uguali non serve scegliere
        var nearF = function (q, A) {
          A = A || LAB; var b3 = 0, d3 = 1e18, ds = new Float64Array(nF);
          for (var c3 = 0; c3 < nF; c3++) { var e0 = A[q * 3] - CF[c3][0], e1 = A[q * 3 + 1] - CF[c3][1], e2 = A[q * 3 + 2] - CF[c3][2]; ds[c3] = dGate(e0 * e0 + e1 * e1 + e2 * e2, c3, RBS); if (ds[c3] < d3) { d3 = ds[c3]; b3 = c3; } }
          var d4 = 1e18; for (c3 = 0; c3 < nF; c3++) if (c3 !== b3 && ds[c3] < d4 && dist2(CF[c3], CF[b3]) > 20 * 20) d4 = ds[c3];
          return [b3, d3, d4];
        };
        for (i = 0; i < n; i++) {
          if (!fg[i] || (fx && fx[i] >= 0)) continue;
          var nb3 = nearF(i), flat = gmax[i] <= tFlat;
          // sicuro solo se piatto, vicino a un colore e CHIARAMENTE di quel colore (non a meta' tra due colori diversi)
          if (flat && nb3[1] <= SEEDX && nb3[1] * 3 < nb3[2] && (nb3[1] <= SEED || nb3[2] < 1e17)) { labF[i] = nb3[0]; continue; }
          // centro di una riga sottile: si guarda il colore originale (la pulizia dal rumore lo schiarisce un po')
          if (ext[i]) { var nx3 = nearF(i, LAB0); if (nx3[1] <= SEEDX && nx3[1] * 2 < nx3[2]) { labF[i] = nx3[0]; continue; } }
          pend[i] = 1;
        }
        // coda con priorita' (heap): prima i pixel piu' simili al colore della zona accanto
        var cap = 4 * n + 16, hk = new Float32Array(cap), hq = new Int32Array(cap), hl = new Int8Array(cap), hn = 0;
        var hpush = function (key, q, l) {
          if (hn >= cap) return; var k5 = hn++;
          while (k5 > 0) { var p5 = (k5 - 1) >> 1; if (hk[p5] <= key) break; hk[k5] = hk[p5]; hq[k5] = hq[p5]; hl[k5] = hl[p5]; k5 = p5; }
          hk[k5] = key; hq[k5] = q; hl[k5] = l;
        };
        var popQ = 0, popL = 0, hpop = function () {
          popQ = hq[0]; popL = hl[0]; var lk = hk[--hn], lq = hq[hn], ll = hl[hn], k6 = 0;
          for (;;) { var c6 = 2 * k6 + 1; if (c6 >= hn) break; if (c6 + 1 < hn && hk[c6 + 1] < hk[c6]) c6++; if (hk[c6] >= lk) break; hk[k6] = hk[c6]; hq[k6] = hq[c6]; hl[k6] = hl[c6]; k6 = c6; }
          hk[k6] = lk; hq[k6] = lq; hl[k6] = ll;
        };
        var near4 = function (q, l) {
          var qx = q % W, cc = CF[l];
          [qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1, q - W, q + W].forEach(function (r4) {
            if (r4 < 0 || r4 >= n || !pend[r4]) return;
            var a4 = LAB[r4 * 3] - cc[0], b4 = LAB[r4 * 3 + 1] - cc[1], c4 = LAB[r4 * 3 + 2] - cc[2];
            hpush(a4 * a4 + b4 * b4 + c4 * c4, r4, l);
          });
        };
        for (i = 0; i < n; i++) if (labF[i] >= 0) near4(i, labF[i]);
        while (hn > 0) { hpop(); if (!pend[popQ]) continue; pend[popQ] = 0; labF[popQ] = popL; near4(popQ, popL); }
        for (i = 0; i < n; i++) if (pend[i]) labF[i] = nearF(i)[0];   // zone chiuse senza pixel sicuri
        // area, colore medio e "sottigliezza" (quanti pixel stanno sul confine) di ogni colore fine
        var areaF = new Float64Array(nF), smF = CF.map(function () { return [0, 0, 0]; }), bnd = new Float64Array(nF);
        for (i = 0; i < n; i++) {
          var lf = labF[i]; if (lf < 0) continue; areaF[lf]++; var sq = smF[lf]; sq[0] += rgb[i * 3]; sq[1] += rgb[i * 3 + 1]; sq[2] += rgb[i * 3 + 2];
          var ix = i % W;
          if ((ix > 0 && labF[i - 1] >= 0 && labF[i - 1] !== lf) || (ix < W - 1 && labF[i + 1] >= 0 && labF[i + 1] !== lf) || (i >= W && labF[i - W] >= 0 && labF[i - W] !== lf) || (i + W < n && labF[i + W] >= 0 && labF[i + W] !== lf)) bnd[lf]++;
        }
        F = { key: fkey, C: CF, lab: labF, area: areaF, thin: Array.prototype.map.call(areaF, function (a, f) { return a ? bnd[f] / a : 0; }),
          rgb: smF.map(function (sq, f) { var a = areaF[f] || 1; return [Math.round(sq[0] / a), Math.round(sq[1] / a), Math.round(sq[2] / a)]; }) };
        P._fine = F;
      }
      // ---- 3) i colori fini si uniscono fino ad averne k (+ il contorno). Si uniscono prima i colori simili e piccoli,
      //      e quelli fatti solo di bordini sottili (aloni chiari intorno alle righe, sfumature): restano a lungo i colori
      //      piccoli ma DIVERSI (occhi, guance). Ogni gruppo ha il colore del suo pezzo piu' grande (non la media:
      //      la media di verde e giallo e' un verde oliva che nell'immagine non c'e').
      var groups = [], cen0 = [], rgb0 = [], gOf = null;
      if (k > 0 && F) {
        var nF2 = F.C.length, totA = 0; for (j = 0; j < nF2; j++) totA += F.area[j];
        for (j = 0; j < nF2; j++) if (F.area[j] > 0 || j < nFix) groups.push({ m: [j], a: F.area[j], L: F.C[j].slice(), fixed: j < nFix });
        var freeN = function () { return groups.filter(function (g) { return !g.fixed; }).length; };
        // (anche con meno di k gruppi si continua a unire i colori quasi uguali: sfumature e aloni del JPEG non devono
        //  diventare filamenti diversi, es. un bordino rosa intorno al Ditto lilla)
        // (con un solo colore oltre al contorno si fa una "sagoma": il colore e' quello della parte piu' grande, e ogni
        //  altra parte va al contorno o a quel colore, a quello piu' vicino. Es. razzo: bianco col contorno, non nero.)
        var kk = k === 1 && nFix ? 3 : k;
        for (;;) {
          var fN = freeN(); if (fN <= 1) break;
          var bc = 1e18, ba = -1, bb = -1;
          for (var g1 = 0; g1 < groups.length; g1++) for (var g2 = g1 + 1; g2 < groups.length; g2++) {
            var G1 = groups[g1], G2 = groups[g2]; if (G1.fixed && G2.fixed) continue;
            var sm1 = G1.a <= G2.a ? G1 : G2, th = sm1.m.length === 1 && F.thin[sm1.m[0]] > 0.6 ? 0.35 : 1;
            // (peso = area che cambia colore: unire al contorno fa diventare nero tutto il gruppo libero, anche se il contorno e' sottile)
            var wA = G1.fixed ? G2.a : G2.fixed ? G1.a : Math.min(G1.a, G2.a);
            // (con un contorno chiaro, es. bianco, i colori chiari del disegno non finiscono nel contorno: lo schermo verde
            //  chiaro del Game Boy restava bianco. Con il contorno scuro invece le righe scure si uniscono volentieri al contorno)
            var fxG = G1.fixed || G2.fixed, cst = dist2(G1.L, G2.L) * Math.sqrt(Math.max(1e-9, wA / Math.max(1, totA))) * th * (fxG && baseLab && baseLab[0] > 50 && dist2(G1.L, G2.L) > 8 * 8 ? 3 : 1);
            if (cst < bc) { bc = cst; ba = g1; bb = g2; }
          }
          if (ba < 0 || (fN <= kk && !(bc < 8 && dist2(groups[ba].L, groups[bb].L) < 12 * 12))) break;
          var A1 = groups[ba], A2 = groups[bb]; if (A2.fixed) { var tt0 = A1; A1 = A2; A2 = tt0; }
          var na = A1.a + A2.a;
          if (!A1.fixed && na > 0) A1.L = [0, 1, 2].map(function (q) { return (A1.L[q] * A1.a + A2.L[q] * A2.a) / na; });
          A1.a = na; A1.m = A1.m.concat(A2.m); groups.splice(groups.indexOf(A2), 1);
        }
        if (kk !== k && freeN() > 1) {
          var gFx = groups.filter(function (g) { return g.fixed; })[0], gBig = null;
          groups.forEach(function (g) { if (!g.fixed && (!gBig || g.a > gBig.a)) gBig = g; });
          groups.slice().forEach(function (g) {
            if (g.fixed || g === gBig) return;
            var to = dist2(g.L, gFx.L) < dist2(g.L, gBig.L) ? gFx : gBig;
            to.a += g.a; to.m = to.m.concat(g.m); groups.splice(groups.indexOf(g), 1);
          });
        }
        gOf = new Int8Array(nF2).fill(-1);
        groups.forEach(function (g, gi) {
          var rep = g.m[0]; g.m.forEach(function (f) { if (F.area[f] > F.area[rep]) rep = f; });
          if (g.fixed) rep = g.m[0];
          cen0.push(g.fixed ? baseLab.slice() : F.C[rep].slice()); rgb0.push(F.rgb[rep]);
          g.m.forEach(function (f) { gOf[f] = gi; });
        });
      }
      var nImg = cen0.length, cen = cen0.concat(fixedLabs || []), lab_ = new Int8Array(n).fill(-1);
      for (i = 0; i < n; i++) {
        if (!fg[i]) continue;
        if (fx && fx[i] >= 0) { lab_[i] = nImg + fx[i]; continue; }
        if (gOf && F.lab[i] >= 0) lab_[i] = gOf[F.lab[i]]; else if (!nImg) lab_[i] = fixedLabs && fixedLabs.length ? nImg : -1;
      }
      var area = cen.map(function () { return 0; }), sm = cen.map(function () { return [0, 0, 0]; });
      for (i = 0; i < n; i++) if (lab_[i] >= 0) { area[lab_[i]]++; var sq2 = sm[lab_[i]]; sq2[0] += rgb[i * 3]; sq2[1] += rgb[i * 3 + 1]; sq2[2] += rgb[i * 3 + 2]; }
      var rgbM = sm.map(function (sq3, ci) { if (ci < nImg && rgb0[ci]) return rgb0[ci]; var a = area[ci] || 1; return [Math.round(sq3[0] / a), Math.round(sq3[1] / a), Math.round(sq3[2] / a)]; });
      return { centers: cen, labels: lab_, area: area, rgb: rgbM, nImg: nImg, baseIdx: baseLab && nImg ? 0 : -1 };
    }

    /* 5) sagome (in pixel della griglia fine): disegnate col canvas, poi bordo liscio */
    function heartPts(n) {
      var o = []; for (var i = 0; i < n; i++) { var t = i / n * 2 * Math.PI, s = Math.sin(t); o.push([16 * s * s * s, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
      return o;
    }
    function shapeMask(shape, GW, GH, cx, cy, Wp, Hp, PX) {
      var cv = document.createElement('canvas'); cv.width = GW; cv.height = GH; var c = cv.getContext('2d', { willReadFrequently: true });
      c.fillStyle = '#000'; c.beginPath();
      if (shape === 'circle') c.arc(cx, cy, Wp / 2, 0, 2 * Math.PI);
      else if (shape === 'oval') c.ellipse(cx, cy, Wp / 2, Hp / 2, 0, 0, 2 * Math.PI);
      else if (shape === 'hexagon') { for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; c.lineTo(cx + Wp / 2 * Math.cos(a), cy + Wp / 2 * Math.sin(a)); } c.closePath(); }
      else if (shape === 'heart') {
        var P = heartPts(240), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        P.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
        P.forEach(function (p, i) { var x = cx + (p[0] - (x0 + x1) / 2) / (x1 - x0) * Wp, y = cy + (p[1] - (y0 + y1) / 2) / (y1 - y0) * Hp; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
        c.closePath();
      } else if (shape === 'stamp') {
        // francobollo: rettangolo con la dentellatura (mezzi cerchi tolti lungo i bordi, raggio 1,5 mm, passo ~4,6 mm;
        // gli angoli restano pieni come nei francobolli veri)
        var x0s = cx - Wp / 2, y0s = cy - Hp / 2, rp = 1.5 * (PX || 8), pitch = 4.6 * (PX || 8);
        c.rect(x0s, y0s, Wp, Hp); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath();
        [[Wp, 0], [Hp, 1]].forEach(function (e) {
          var nn = Math.max(3, Math.round(e[0] / pitch)), stp = e[0] / nn;
          for (var q = 0; q < nn; q++) {
            var t = (q + 0.5) * stp;
            if (e[1] === 0) { c.moveTo(x0s + t + rp, y0s); c.arc(x0s + t, y0s, rp, 0, 2 * Math.PI); c.moveTo(x0s + t + rp, y0s + Hp); c.arc(x0s + t, y0s + Hp, rp, 0, 2 * Math.PI); }
            else { c.moveTo(x0s + rp, y0s + t); c.arc(x0s, y0s + t, rp, 0, 2 * Math.PI); c.moveTo(x0s + Wp + rp, y0s + t); c.arc(x0s + Wp, y0s + t, rp, 0, 2 * Math.PI); }
          }
        });
        c.fill(); c.globalCompositeOperation = 'source-over';
      } else {   // square / rect: angoli arrotondati
        var r = Math.min(Wp, Hp) * 0.14, x = cx - Wp / 2, y = cy - Hp / 2;
        c.moveTo(x + r, y); c.arcTo(x + Wp, y, x + Wp, y + Hp, r); c.arcTo(x + Wp, y + Hp, x, y + Hp, r); c.arcTo(x, y + Hp, x, y, r); c.arcTo(x, y, x + Wp, y, r); c.closePath();
      }
      c.fill();
      var d = c.getImageData(0, 0, GW, GH).data, m = new Uint8Array(GW * GH);
      for (var k = 0; k < GW * GH; k++) m[k] = d[k * 4 + 3] >= 128 ? 1 : 0;
      return m;
    }
    function shapeDims(shape, size, aspect) {
      if (shape === 'circle' || shape === 'square') return [size, size];
      if (shape === 'hexagon') return [size, size * Math.sqrt(3) / 2];
      if (shape === 'heart') return [size, size * 0.9];
      if (shape === 'stamp') { var as = Math.max(0.3, Math.min(3.3, aspect)); return as >= 1 ? [size, size / as] : [size * as, size]; }
      var a = Math.max(shape === 'oval' ? 0.55 : 0.4, Math.min(shape === 'oval' ? 1.8 : 2.5, aspect));
      return a >= 1 ? [size, size / a] : [size * a, size];
    }

    /* 5a) disegno del francobollo (senza la dentellatura, che fa la sagoma): finestra con l'immagine + fascia per le scritte.
       o = {fmt: 'square'|'portrait'|'landscape', tpos: 'below'|'above'|'inside'|'none', fit: 'fit'|'fill', lines, paper, win (hex), pic: {x, y, s, r}}
       Larghezza 1000 px. La carta e' del colore del contorno/retro: e' tutt'uno con il bordo dentellato. */
    function stampLayout(o) {
      var A = o.fmt === 'portrait' ? 0.8 : o.fmt === 'landscape' ? 1.32 : 1, W = 1000, H = Math.round(W / A);
      var cb = 0; if (o.tpos === 'below' || o.tpos === 'above') cb = Math.round(W * (o.lines >= 2 ? (A > 1.1 ? 0.25 : 0.29) : (A > 1.1 ? 0.17 : 0.19)));
      var wy0 = o.tpos === 'above' ? cb : 0, wy1 = o.tpos === 'below' ? H - cb : H;
      return { W: W, H: H, cb: cb, win: [0, wy0, W, wy1], band: cb ? (o.tpos === 'above' ? [0, 0, W, cb] : [0, H - cb, W, H]) : null };
    }
    function stampDesign(pic, o) {
      var L = stampLayout(o), cv = document.createElement('canvas'); cv.width = L.W; cv.height = L.H;
      var c = cv.getContext('2d'), w = L.win, ww = w[2] - w[0], wh = w[3] - w[1], gap = L.cb ? Math.round(L.W * 0.025) : 0;
      c.fillStyle = o.paper; c.fillRect(0, 0, L.W, L.H);
      // finestra (un filo di carta tra finestra e fascia delle scritte)
      var y0 = w[1] + (o.tpos === 'above' ? gap : 0), y1 = w[3] - (o.tpos === 'below' ? gap : 0), r = Math.round(L.W * 0.018);
      c.save(); c.beginPath(); c.moveTo(w[0] + r, y0); c.arcTo(w[2], y0, w[2], y1, r); c.arcTo(w[2], y1, w[0], y1, r); c.arcTo(w[0], y1, w[0], y0, r); c.arcTo(w[0], y0, w[2], y0, r); c.closePath(); c.clip();
      c.fillStyle = o.win; c.fillRect(w[0], y0, ww, y1 - y0);
      var info = { win: [w[0], y0, w[2], y1], base: null, box: null };
      if (pic && pic.width && pic.height) {
        var bw = ww, bh = y1 - y0, k;
        if (o.fit === 'fill') k = Math.max(bw / pic.width, bh / pic.height);
        else { k = Math.min(bw * 0.86 / pic.width, bh * 0.86 / pic.height); }
        var dw = pic.width * k, dh = pic.height * k, ox = w[0] + (bw - dw) / 2, oy = y0 + (bh - dh) / 2;
        if (o.fit !== 'fill' && (o.tpos === 'inside')) oy = y0 + (bh - dh) * 0.8;   // con le scritte dentro, l'immagine scende un po'
        // posizione scelta dal cliente (o.pic): spostamento (in larghezze del francobollo), grandezza (%), rotazione (gradi)
        var pp = o.pic || {}, sc = Math.max(0.05, (pp.s == null ? 100 : pp.s) / 100), a = (pp.r || 0) * Math.PI / 180;
        var bcx = ox + dw / 2, bcy = oy + dh / 2, cx = bcx + (pp.x || 0) * L.W, cy = bcy + (pp.y || 0) * L.W;
        info.base = { cx: bcx, cy: bcy, w: dw, h: dh }; info.box = { cx: cx, cy: cy, w: dw * sc, h: dh * sc, a: a };
        c.imageSmoothingQuality = 'high'; c.translate(cx, cy); c.rotate(a); c.drawImage(pic, -dw * sc / 2, -dh * sc / 2, dw * sc, dh * sc);
      }
      c.restore();
      return { cv: cv, L: L, info: info };
    }
    /* 5b) una "parte" del disegno toccata dal cliente: i pixel di quel colore attaccati al punto toccato.
       I pezzi dello stesso colore molto vicini (es. i fili di un gomitolo separati da righe sottili) fanno parte della stessa
       parte; quelli lontani (le orecchie, le pupille, i riflessi) no. x, y = pixel dell'immagine preparata */
    function region(P, Q, x, y, ci) {
      var W = P.W, H = P.H, n = W * H, lab_ = Q.labels, m = new Uint8Array(n), i, cnt = 0;
      for (i = 0; i < n; i++) if (lab_[i] === ci) { m[i] = 1; cnt++; }
      if (!cnt) return null;
      x = Math.max(0, Math.min(W - 1, Math.round(x))); y = Math.max(0, Math.min(H - 1, Math.round(y)));
      var r = Math.max(2, Math.round(0.012 * Math.max(W, H))), at = y * W + x;
      if (!m[at]) {   // tocco sul bordo: il pixel piu' vicino di quel colore
        var bd = 1e18, R = 3 * r; at = -1;
        for (var yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy++) for (var xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx++) {
          var k = yy * W + xx; if (!m[k]) continue; var d = (xx - x) * (xx - x) + (yy - y) * (yy - y); if (d < bd) { bd = d; at = k; }
        }
        if (at < 0) return null;
      }
      var dm = dilateC(m, W, H, r), cc = components(dm, W, H), id = cc.lab[at], out = new Uint8Array(n), c2 = 0;
      for (i = 0; i < n; i++) if (m[i] && cc.lab[i] === id) { out[i] = 1; c2++; }
      return { mask: out, n: c2, all: cnt, at: at };
    }
    // parti separate: ogni parte diventa un "colore" in piu' (stesso colore dell'immagine, filamento suo)
    function withRegions(Q, regs) {
      if (!regs || !regs.length) return Q;
      var lab2 = Q.labels.slice(), cen = Q.centers.slice(), area = Q.area.slice(), rgb = Q.rgb.slice();
      regs.forEach(function (R) {
        var li = cen.length, a = 0, src = -1; for (var i = 0; i < lab2.length; i++) if (R.mask[i] && lab2[i] >= 0) { if (src < 0) src = lab2[i]; lab2[i] = li; a++; }
        cen.push((cen[src] || cen[0]).slice()); rgb.push((rgb[src] || rgb[0]).slice()); area.push(a); if (src >= 0) area[src] -= a;
      });
      return { centers: cen, labels: lab2, area: area, rgb: rgb, nImg: Q.nImg, baseIdx: Q.baseIdx, regFrom: Q.centers.length };
    }
    /* 6) magnete: cluster -> filamento, figura nella sagoma, misura, bordo, pulizia, fori dei magneti, anello, triangoli
       o = {shape, base, map, size, border, nMag, holeD, magT, holes, key} */
    // chiusura (dilata e poi erode) su una griglia piu' grande: cosi' il bordo della griglia non taglia la dilatazione
    // e l'erosione non mangia la figura dai lati (prima la chiusura grande tagliava via pezzi del disegno)
    function closeP(m, W, H, r) {
      var p = Math.ceil(r) + 2, W2 = W + 2 * p, H2 = H + 2 * p, m2 = new Uint8Array(W2 * H2), o = new Uint8Array(W * H), x, y;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) m2[(y + p) * W2 + x + p] = m[y * W + x];
      var c2 = erode(dilate(m2, W2, H2, r), W2, H2, r);
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) o[y * W + x] = c2[(y + p) * W2 + x + p];
      return o;
    }
    function build(P, Q, o) {
      var shape = o.shape || 'outline', baseId = o.base, map = o.map, B = o.border || 1.2, nM = o.nMag | 0, HOLE = o.holeD || 10.4;
      var HT = nM ? TOP + (o.magT || 2) + 0.2 : 3.0;
      // tag NFC chiuso dentro (o.pocket = {d, h} in mm): tasca da z0 a z1 (strati da 0,2 mm), sopra almeno 0,8 mm di copertura;
      // la stampa si ferma al primo strato sopra la tasca per mettere il tag
      var PK = o.pocket && o.pocket.d > 0 ? o.pocket : null, pz0 = 0, pz1 = 0;
      if (PK) { pz0 = TOP + 0.4; pz1 = pz0 + Math.ceil((PK.h || 1.2) / 0.2 - 1e-6) * 0.2; HT = Math.max(HT, pz1 + 0.8); HT = Math.ceil(HT / 0.2 - 1e-6) * 0.2; }
      var hz = nM ? HT - (o.magT || 2) - 0.2 : HT;   // i fori dei magneti partono da qui (aperti sul retro)
      var colIds = []; map.forEach(function (id, ci) { if (Q.area[ci] && id !== baseId && id !== 'none' && colIds.indexOf(id) < 0) colIds.push(id); });
      var cl2 = map.map(function (id) { return id === baseId ? -2 : id === 'none' ? -3 : colIds.indexOf(id); });
      var W = P.W, Hh = P.H, fg = P.fg, labels = Q.labels, i, x, y;
      function keep(k) { return fg[k] && !(labels[k] >= 0 && cl2[labels[k]] === -3); }
      var x0 = W, x1 = -1, y0 = Hh, y1 = -1;
      for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) if (keep(y * W + x)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < x0) return { empty: true, warn: { empty: true } };
      var wpx = x1 - x0 + 1, hpx = y1 - y0 + 1, bx = (x0 + x1 + 1) / 2, by = (y0 + y1 + 1) / 2;
      // misura della sagoma (mm) e griglia fine
      var s, Wm, Hm;
      if (shape === 'outline') { s = (o.size - 2 * B) / Math.max(wpx, hpx); Wm = wpx * s + 2 * B; Hm = hpx * s + 2 * B; }
      else { var dm = shapeDims(shape, o.size, (wpx + 2 * B) / (hpx + 2 * B)); Wm = dm[0]; Hm = dm[1]; }
      var key = o.key && o.key !== 'none' ? o.key : null, mg = 2 + (key ? 9 : 0) + (o.boss && nM ? HOLE / 2 + 2.5 : 0);   // (scarabocchio: il tondo del magnete puo' sporgere oltre la linea)
      var PX = Math.max(5, Math.min(16, 1100 / Math.max(Wm, Hm))), pad = 6;
      var GW = Math.ceil((Wm + 2 * mg) * PX) + 2 * pad, GH = Math.ceil((Hm + 2 * mg) * PX) + 2 * pad, N = GW * GH, cx = GW / 2, cy = GH / 2;
      var S = null, dIn = null, acx = cx, acy = cy;
      if (shape !== 'outline') {
        S = shapeMask(shape, GW, GH, cx, cy, Wm * PX, Hm * PX, PX);
        // figura piu' grande possibile dentro la sagoma, a "bordo" mm dal contorno
        dIn = edt(S, GW, GH);
        var bp = [];
        for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
          var kk = y * W + x; if (!keep(kk)) continue;
          if (x === 0 || y === 0 || x === W - 1 || y === Hh - 1 || !keep(kk - 1) || !keep(kk + 1) || !keep(kk - W) || !keep(kk + W)) bp.push(x + 0.5, y + 0.5);
        }
        if (bp.length > 6000) { var st2 = Math.ceil(bp.length / 6000) * 2, b2 = []; for (i = 0; i < bp.length; i += st2) b2.push(bp[i], bp[i + 1]); bp = b2; }
        var need0 = (B + 0.2) * PX;
        var fits = function (sv, ox, oy) {
          for (var q = 0; q < bp.length; q += 2) {
            var gx = Math.floor(ox + (bp[q] - bx) * sv * PX), gy = Math.floor(oy + (bp[q + 1] - by) * sv * PX);
            if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || dIn[gy * GW + gx] < need0) return false;
          }
          return true;
        };
        var fitAt = function (ox, oy) { var lo = 0, hi = Math.max(Wm, Hm) / Math.min(wpx, hpx); for (var itb = 0; itb < 22; itb++) { var mid = (lo + hi) / 2; if (fits(mid, ox, oy)) lo = mid; else hi = mid; } return lo; };
        // posizione migliore: si prova il centro e qualche punto attorno (nel cuore la figura scende sotto la punta in alto)
        s = fitAt(acx, acy);
        var bestS = s, bo = [acx, acy];
        for (var gyi = -4; gyi <= 4; gyi++) for (var gxi = 0; gxi <= 0; gxi++) {   // sagome simmetriche: si sposta solo in su / in giu'
          if (!gyi) continue;
          var ox = cx + gxi * 0.05 * Wm * PX, oy = cy + gyi * 0.05 * Hm * PX, sv2 = fitAt(ox, oy);
          if (sv2 > bestS * 1.02) { bestS = sv2; bo = [ox, oy]; }
        }
        s = bestS; acx = bo[0]; acy = bo[1];
        if (!(s > 0)) return { empty: true, warn: { empty: true } };
      }
      // appartenenza "morbida" ai colori (bordi tra i pixel, non a scalini)
      var nc = colIds.length, K2 = nc + 3, KT = nc + 2, SM = new Float32Array(W * Hh * K2), cen = Q.centers, rgb = P.rgb;
      function clsOf(li) { return cl2[li] === -2 ? 1 : cl2[li] === -3 ? KT : cl2[li] + 2; }
      for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) {
        i = y * W + x; var li0 = labels[i], aa = P.al ? P.al[i] / 255 : 1;
        if (li0 < 0) {
          var nb = -1; if (aa > 0) for (var dy0 = -1; dy0 <= 1 && nb < 0; dy0++) for (var dx0 = -1; dx0 <= 1; dx0++) { var x0b = x + dx0, y0b = y + dy0; if (x0b >= 0 && y0b >= 0 && x0b < W && y0b < Hh && labels[y0b * W + x0b] >= 0) { nb = labels[y0b * W + x0b]; break; } }
          if (nb >= 0) { SM[i * K2 + clsOf(nb)] = aa; SM[i * K2] = 1 - aa; } else SM[i * K2] = 1;
          continue;
        }
        if (aa < 1) SM[i * K2] = 1 - aa; else aa = 1;
        var cand = [li0];
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) continue;
          var ln = labels[yy * W + xx]; if (ln >= 0 && cand.indexOf(ln) < 0) cand.push(ln);
        }
        if (cand.length === 1) { SM[i * K2 + clsOf(li0)] = aa; continue; }
        var pl = lab(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
        cand.sort(function (u, w2) { return dist2(pl, cen[u]) - dist2(pl, cen[w2]); });
        var A = cen[cand[0]], Bc = cen[cand[1]], ab = dist2(A, Bc) || 1;
        var tt = ((pl[0] - Bc[0]) * (A[0] - Bc[0]) + (pl[1] - Bc[1]) * (A[1] - Bc[1]) + (pl[2] - Bc[2]) * (A[2] - Bc[2])) / ab;
        tt = Math.max(0, Math.min(1, tt));
        SM[i * K2 + clsOf(cand[0])] += tt * aa; SM[i * K2 + clsOf(cand[1])] += (1 - tt) * aa;
      }
      var hi8 = new Int8Array(N).fill(-2), wts = new Float32Array(K2), tm = new Uint8Array(N), anyT = false, k2, txm = P.fixed ? new Uint8Array(N) : null, anyTx = false;
      var sp = 1 / (PX * s), ax0 = bx - acx * sp - 0.5, ay0 = by - acy * sp - 0.5;
      for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
        var ax = ax0 + (x + 0.5) * sp, ay = ay0 + (y + 0.5) * sp;
        if (ax < -1 || ay < -1 || ax > W || ay > Hh) continue;
        var ix = Math.floor(ax), iy = Math.floor(ay), fx = ax - ix, fy = ay - iy; wts.fill(0);
        for (var q = 0; q < 4; q++) {
          var qx = ix + (q & 1), qy = iy + (q >> 1), w = ((q & 1) ? fx : 1 - fx) * ((q >> 1) ? fy : 1 - fy);
          if (qx < 0 || qy < 0 || qx >= W || qy >= Hh) { wts[0] += w; continue; }
          var o2 = (qy * W + qx) * K2; for (k2 = 0; k2 < K2; k2++) wts[k2] += w * SM[o2 + k2];
        }
        var bi = 0; for (k2 = 1; k2 < K2; k2++) if (wts[k2] > wts[bi]) bi = k2;
        if (bi === KT) { tm[y * GW + x] = 1; anyT = true; } else hi8[y * GW + x] = bi - 2;   // -2 sfondo, -1 base, 0.. colori
        // dove ci sono le scritte (pixel con colore fisso)
        if (txm && bi >= 2) { var nx5 = Math.min(W - 1, Math.max(0, Math.round(ax - 0.5))), ny5 = Math.min(Hh - 1, Math.max(0, Math.round(ay - 0.5))); if (P.fixed[ny5 * W + nx5] >= 0) { txm[y * GW + x] = 1; anyTx = true; } }
      }
      var warn = {}, art = new Uint8Array(N), nArt = 0;
      for (i = 0; i < N; i++) { art[i] = hi8[i] > -2 ? 1 : 0; nArt += art[i]; }
      if (nArt < 4 * PX * PX) return { empty: true, warn: { empty: true } };
      if (shape === 'outline') {
        // scarabocchio (o.open): i giri chiusi della linea (es. un cuore disegnato) restano vuoti, si chiudono solo i buchini
        var fillIn = o.open ? function (m) { var f = fillHoles(m, GW, GH), d = new Uint8Array(N), q2; for (q2 = 0; q2 < N; q2++) d[q2] = f[q2] && !m[q2] ? 1 : 0; var cd = components(d, GW, GH); for (q2 = 0; q2 < N; q2++) if (d[q2] && cd.areas[cd.lab[q2]] < 6 * PX * PX) m[q2] = 1; return m; } : function (m) { return fillHoles(m, GW, GH); };
        S = dilate(fillIn(art.slice()), GW, GH, B * PX);
        // fessure strette nel contorno (es. tra un braccio e il corpo): si chiudono, invece di restare tagli sottili
        // con il bordo intorno che sembrano sbavature. Chiusura di 1,2 mm: le rientranze larghe restano.
        S = fillIn(closeP(S, GW, GH, 1.2 * PX));
        var cc = components(S, GW, GH);
        if (cc.n > 1) {
          // pezzi staccati (es. la libellula vicino alla rana, la scritta "hi!"): si uniscono al pezzo grande con un ponticello
          // dritto largo 2,5 mm, nel punto in cui sono piu' vicini. Prima si usava una "chiusura" che riempiva di nero tutto
          // lo spazio tra i pezzi (macchie enormi). Pezzi a piu' di 1 cm restano fuori.
          var lab3 = cc.lab, mainL = 1; for (i = 2; i <= cc.n; i++) if (cc.areas[i] > cc.areas[mainL]) mainL = i;
          var inMain = new Uint8Array(cc.n + 1); inMain[mainL] = 1;
          var bnd = []; for (i = 0; i <= cc.n; i++) bnd.push([]);
          for (y = 1; y < GH - 1; y++) for (x = 1; x < GW - 1; x++) { i = y * GW + x; if (S[i] && (!S[i - 1] || !S[i + 1] || !S[i - GW] || !S[i + GW])) bnd[lab3[i]].push(i); }
          var stepOf = function (L) { return Math.max(1, Math.floor(L.length / 1500)); };
          var RB = 1.25 * PX, GAP = 10 * PX, joinedAny = false;
          for (;;) {
            var best = null;
            for (var cI = 1; cI <= cc.n; cI++) {
              if (inMain[cI] || !bnd[cI].length) continue;
              var sB = stepOf(bnd[cI]);
              for (var mI = 1; mI <= cc.n; mI++) {
                if (!inMain[mI]) continue; var sM = stepOf(bnd[mI]);
                for (var u = 0; u < bnd[cI].length; u += sB) {
                  var pu = bnd[cI][u], ux = pu % GW, uy = (pu - ux) / GW;
                  for (var v = 0; v < bnd[mI].length; v += sM) {
                    var pv = bnd[mI][v], vx = pv % GW, vy = (pv - vx) / GW, dd = (ux - vx) * (ux - vx) + (uy - vy) * (uy - vy);
                    if (!best || dd < best.d) best = { d: dd, c: cI, ax: ux, ay: uy, bx: vx, by: vy };
                  }
                }
              }
            }
            if (!best || Math.sqrt(best.d) > GAP) break;
            // ponticello: capsula tra i due punti (si allunga un poco dentro i pezzi)
            var ddx = best.bx - best.ax, ddy = best.by - best.ay, Lb = Math.sqrt(ddx * ddx + ddy * ddy) || 1, ex = ddx / Lb, ey = ddy / Lb;
            var pAx = best.ax - ex * RB, pAy = best.ay - ey * RB, pBx = best.bx + ex * RB, pBy = best.by + ey * RB;
            var bx0 = Math.max(0, Math.floor(Math.min(pAx, pBx) - RB - 1)), bx1 = Math.min(GW - 1, Math.ceil(Math.max(pAx, pBx) + RB + 1));
            var by0 = Math.max(0, Math.floor(Math.min(pAy, pBy) - RB - 1)), by1 = Math.min(GH - 1, Math.ceil(Math.max(pAy, pBy) + RB + 1));
            var sx = pBx - pAx, sy = pBy - pAy, sl = sx * sx + sy * sy || 1;
            for (y = by0; y <= by1; y++) for (x = bx0; x <= bx1; x++) {
              var tq = Math.max(0, Math.min(1, ((x + 0.5 - pAx) * sx + (y + 0.5 - pAy) * sy) / sl)), qx2 = pAx + tq * sx - x - 0.5, qy2 = pAy + tq * sy - y - 0.5;
              if (qx2 * qx2 + qy2 * qy2 <= RB * RB) S[y * GW + x] = 1;
            }
            inMain[best.c] = 1; joinedAny = true;
          }
          if (joinedAny) { S = fillIn(S); cc = components(S, GW, GH); warn.joined = cc.n === 1; }
        }
        if (cc.n > 1) { var big = 1; for (i = 2; i <= cc.n; i++) if (cc.areas[i] > cc.areas[big]) big = i; for (i = 0; i < N; i++) if (cc.lab[i] !== big) S[i] = 0; warn.split = true; }
      }
      // colori trasparenti chiusi dentro la figura: diventano buchi veri (col bordo intorno)
      if (anyT) {
        var inside = shape === 'outline' ? fillHoles(art, GW, GH) : S, Hm2 = new Uint8Array(N);
        for (i = 0; i < N; i++) Hm2[i] = tm[i] && inside[i] && !art[i] ? 1 : 0;
        Hm2 = erodeC(Hm2, GW, GH, B * PX); for (i = 0; i < N; i++) if (Hm2[i]) S[i] = 0;
      }
      // scarabocchio (o.boss): la linea e' troppo sottile per il magnete, quindi sotto ogni magnete c'e' un tondo di plastica
      // attaccato alla linea (centro sempre SULLA linea). Il cliente sposta il magnete lungo la linea e il tondo lo segue.
      // Un magnete solo: nel baricentro del disegno (portato sulla linea), cosi' non gira e non scivola.
      var bossS = null, bossH = null;
      if (o.boss && nM > 0) {
        bossS = S.slice();
        var Rb = HOLE / 2 + (o.boss.wall || 2.0), sepB = (HOLE + 1.2) * PX, bpts = [], stp4 = Math.max(1, Math.round(PX / 3));
        for (y = 0; y < GH; y += stp4) for (x = 0; x < GW; x += stp4) if (bossS[y * GW + x]) bpts.push([x + 0.5, y + 0.5]);
        if (bpts.length) {
          var snapB = function (px0, py0, avoid) {
            var b = null, bd = 1e18;
            bpts.forEach(function (p) {
              if (avoid) for (var t = 0; t < avoid.length; t++) if (Math.hypot(p[0] - avoid[t][0], p[1] - avoid[t][1]) < sepB) return;
              var d = (p[0] - px0) * (p[0] - px0) + (p[1] - py0) * (p[1] - py0); if (d < bd) { bd = d; b = p; }
            });
            return b ? b.slice() : null;
          };
          var CB = [], bmx = 0, bmy = 0;
          bpts.forEach(function (p) { bmx += p[0]; bmy += p[1]; }); bmx /= bpts.length; bmy /= bpts.length;
          if (o.holes && o.holes.length === nM) CB = o.holes.map(function (h) { return snapB(cx + h[0] * PX, cy + h[1] * PX); });
          else if (nM === 1) CB = [snapB(bmx, bmy)];
          else {
            var f0 = null, fd0 = -1; bpts.forEach(function (p) { var d = Math.hypot(p[0] - bmx, p[1] - bmy); if (d > fd0) { fd0 = d; f0 = p; } });
            CB = [f0.slice()];
            while (CB.length < nM) { var f1 = null, fd1 = -1; bpts.forEach(function (p) { var m4 = 1e18; CB.forEach(function (c4) { m4 = Math.min(m4, Math.hypot(p[0] - c4[0], p[1] - c4[1])); }); if (m4 > fd1) { fd1 = m4; f1 = p; } }); CB.push(f1.slice()); }
            for (var itb2 = 0; itb2 < 15; itb2++) {
              var accB = CB.map(function () { return [0, 0, 0]; });
              bpts.forEach(function (p) { var bj = 0, bd6 = 1e18; CB.forEach(function (c4, j) { var d = (p[0] - c4[0]) * (p[0] - c4[0]) + (p[1] - c4[1]) * (p[1] - c4[1]); if (d < bd6) { bd6 = d; bj = j; } }); accB[bj][0] += p[0]; accB[bj][1] += p[1]; accB[bj][2]++; });
              CB = CB.map(function (c4, j) { return accB[j][2] ? snapB(accB[j][0] / accB[j][2], accB[j][1] / accB[j][2]) : c4; });
            }
          }
          // due magneti troppo vicini: il secondo va al punto della linea piu' vicino dove ci sta
          for (i = 1; i < CB.length; i++) {
            var prevB = CB.slice(0, i).filter(Boolean), tooNear = prevB.some(function (c4) { return CB[i] && Math.hypot(CB[i][0] - c4[0], CB[i][1] - c4[1]) < sepB; });
            if (tooNear || !CB[i]) { var alt = snapB(CB[i] ? CB[i][0] : bmx, CB[i] ? CB[i][1] : bmy, prevB); if (alt) CB[i] = alt; }
          }
          CB = CB.filter(Boolean);
          var RbP = Rb * PX;
          CB.forEach(function (c4) {
            for (y = Math.max(0, Math.floor(c4[1] - RbP - 1)); y <= Math.min(GH - 1, Math.ceil(c4[1] + RbP + 1)); y++)
              for (x = Math.max(0, Math.floor(c4[0] - RbP - 1)); x <= Math.min(GW - 1, Math.ceil(c4[0] + RbP + 1)); x++)
                if (Math.hypot(x + 0.5 - c4[0], y + 0.5 - c4[1]) <= RbP) S[y * GW + x] = 1;
          });
          bossH = CB.map(function (c4) { return [(c4[0] - cx) / PX, (c4[1] - cy) / PX]; });
        }
      }
      // anello portachiavi: linguetta tonda sul bordo, foro da 4 mm. Posizione = direzione dal centro della sagoma
      // (gradi: 0 destra, 90 sotto, 180 sinistra, 270 sopra); la linguetta si attacca al punto piu' esterno in quella direzione
      var keyHole = null, keyRays = null, S0k = key ? S.slice() : null, keyG = null;
      if (key) {
        var Rt = 4.5 * PX, ov = 2.2 * PX, sx0 = GW, sx1 = -1, sy0 = GH, sy1 = -1, kcx, kcy;
        for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) if (S[y * GW + x]) { if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1) sy1 = y; }
        var mcx = (sx0 + sx1 + 1) / 2, mcy = (sy0 + sy1 + 1) / 2, tMax = Math.hypot(GW, GH);
        // bordo esterno in ogni direzione (serve anche all'anteprima per trascinare l'anello)
        var edgeAt = function (deg) {
          var dx = Math.cos(deg * Math.PI / 180), dy = Math.sin(deg * Math.PI / 180);
          for (var t = tMax; t > 0; t -= 0.5) { var px = Math.floor(mcx + dx * t), py = Math.floor(mcy + dy * t); if (px >= 0 && py >= 0 && px < GW && py < GH && S[py * GW + px]) return t; }
          return 0;
        };
        // centro dell'anello: appena fuori dal bordo; se li' il disegno e' concavo (es. tra testa e piede) l'anello
        // si allontana finche' il foro non tocca piu' il disegno
        var dBg = edtC(not(S), GW, GH), needK = Rt - ov;
        var ringAt = function (deg, te) {
          var dx = Math.cos(deg * Math.PI / 180), dy = Math.sin(deg * Math.PI / 180);
          for (var t = te + needK; t < te + needK + 3 * Rt; t += 0.5) { var px = Math.floor(mcx + dx * t), py = Math.floor(mcy + dy * t); if (px < 0 || py < 0 || px >= GW || py >= GH || dBg[py * GW + px] >= needK) return t; }
          return te + needK + 3 * Rt;
        };
        keyRays = new Float32Array(360); var keyRk = new Float32Array(360);
        for (var dg = 0; dg < 360; dg++) { keyRays[dg] = edgeAt(dg); keyRk[dg] = ringAt(dg, keyRays[dg]); }
        var ka = typeof key === 'number' ? key : key === 'top' ? 270 : key === 'left' ? 180 : key === 'right' ? 0 : key === 'bottom' ? 90 : 270;
        ka = ((ka % 360) + 360) % 360;
        // in quella direzione il raggio dal centro non tocca il disegno (es. freccia scarabocchiata: il centro e' vuoto):
        // si usa la direzione piu' vicina che lo tocca, se no l'anello restava staccato in mezzo al vuoto
        if (!keyRays[Math.round(ka) % 360]) { for (var dk = 1; dk <= 180; dk++) { var a1 = (Math.round(ka) + dk) % 360, a2 = (Math.round(ka) - dk + 360) % 360; if (keyRays[a1]) { ka = a1; break; } if (keyRays[a2]) { ka = a2; break; } } }
        var kdx = Math.cos(ka * Math.PI / 180), kdy = Math.sin(ka * Math.PI / 180), te = edgeAt(ka), tk = ringAt(ka, te);
        var pix = mcx + kdx * (te - ov), piy = mcy + kdy * (te - ov), Lk = Rt;   // dentro il bordo di ov, linguetta lunga fino al centro dell'anello
        kcx = mcx + kdx * tk; kcy = mcy + kdy * tk; Lk = Math.hypot(kcx - pix, kcy - piy);
        var bxa = Math.floor(Math.min(pix, kcx) - Rt - 2), bxb = Math.ceil(Math.max(pix, kcx) + Rt + 2), bya = Math.floor(Math.min(piy, kcy) - Rt - 2), byb = Math.ceil(Math.max(piy, kcy) + Rt + 2);
        for (y = Math.max(0, bya); y < Math.min(GH, byb); y++) for (x = Math.max(0, bxa); x < Math.min(GW, bxb); x++) {
          var qx = x + 0.5 - pix, qy = y + 0.5 - piy, u = qx * kdx + qy * kdy, v = Math.abs(qx * kdy - qy * kdx);
          // solo un cerchio (niente linguetta dritta, che su molte figure veniva storta): il centro e' a (Rt - ov) dal punto
          // piu' vicino del disegno, quindi il cerchio entra nel disegno di ov e resta sempre attaccato
          if (Math.hypot(x + 0.5 - kcx, y + 0.5 - kcy) <= Rt) S[y * GW + x] = 1;
        }
        keyHole = { x: kcx, y: kcy, r: 2.0 * PX }; keyG = { cx: mcx, cy: mcy, rays: keyRays, rk: keyRk, Rt: Rt, ov: ov, hr: 2.0 * PX, a: ka };
        for (y = Math.floor(kcy - keyHole.r - 1); y <= kcy + keyHole.r + 1; y++) for (x = Math.floor(kcx - keyHole.r - 1); x <= kcx + keyHole.r + 1; x++) if (Math.hypot(x + 0.5 - kcx, y + 0.5 - kcy) <= keyHole.r + 0.5) S[y * GW + x] = 0;
      }
      // colori: via le isolette sotto 0,8 mm2 (puntini); i tratti sottili restano e vengono solo lisciati
      var masks = [], c;
      for (c = 0; c < nc; c++) {
        var m = new Uint8Array(N), n0 = 0, n1 = 0; for (i = 0; i < N; i++) { m[i] = hi8[i] === c && S[i] ? 1 : 0; n0 += m[i]; }
        // (i puntini delle scritte, es. il punto della i e le dieresi di Ö, restano fino a 0,3 mm2: prima sparivano e
        //  "Giulia" diventava "Gıulıa" e "Öl" diventava "Ol")
        var mc = components(m, GW, GH), mtx = anyTx ? new Int32Array(mc.n + 1) : null;
        if (mtx) for (i = 0; i < N; i++) if (m[i] && txm[i]) mtx[mc.lab[i]]++;
        for (i = 0; i < N; i++) if (m[i]) { var la = mc.lab[i], ar = mc.areas[la]; if (ar < (mtx && mtx[la] * 2 > ar ? 0.3 : MINA) * PX * PX) m[i] = 0; }
        // colore di una scritta con lettere molto sottili: si avvisa (possono perdere pezzi)
        // (si contano solo i pixel delle scritte: se l'immagine usa lo stesso colore con righe sottili, es. il blu scuro dei
        //  contorni di un disegno nel francobollo con "ITALY" blu, l'avviso parlava di lettere sottili che non c'erano)
        if (o.textIds && o.textIds.indexOf(colIds[c]) >= 0 && n0 > 50) {
          var mo0 = dilateC(erodeC(m, GW, GH, MINW / 2 * PX), GW, GH, MINW / 2 * PX), nt0 = 0;
          for (i = 0; i < N; i++) if (m[i] && (!anyTx || txm[i])) { nt0++; if (mo0[i]) n1++; }
          if (nt0 > 50 && n1 < nt0 * 0.82) warn.thinText = true;
        }
        masks.push(m);
      }
      var sdS;
      if (shape === 'circle' && !key) { sdS = new Float32Array(N); var R0 = Wm / 2 * PX; for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) sdS[y * GW + x] = R0 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy); }
      else sdS = smoothSD(S, GW, GH, shape === 'outline' ? 0.375 * PX : Math.max(1.2, 0.09 * PX));
      if (keyHole) for (y = Math.floor(keyHole.y - keyHole.r - 4); y <= keyHole.y + keyHole.r + 4; y++) for (x = Math.floor(keyHole.x - keyHole.r - 4); x <= keyHole.x + keyHole.r + 4; x++) {
        if (x < 0 || y < 0 || x >= GW || y >= GH) continue; var ii = y * GW + x; sdS[ii] = Math.min(sdS[ii], Math.hypot(x + 0.5 - keyHole.x, y + 0.5 - keyHole.y) - keyHole.r);
      }
      // pixel tolti (tratti troppo sottili, isolette): prendono il colore che hanno accanto invece della base
      // (cosi' tra due colori non resta una riga del colore del contorno). Si allarga a strati dai pixel gia' decisi.
      var own = new Int8Array(N).fill(-3), fr = [], nf, qi;   // -3 fuori, -2 da decidere, -1 base, 0.. colori
      // sagoma "contorno": anche lo sfondo vicino al bordo prende il colore accanto, cosi' il bordo della base e' una fascia
      // della stessa larghezza tutto intorno (come un adesivo), non segue i pixel sfumati del bordo dell'immagine
      var bandO = shape === 'outline' ? (B + 0.4) * PX : -1, gapC0 = shape === 'outline' ? B * PX : Math.max(1, (EDGE + 0.25) * PX);
      // (ma non vicino alle scritte: li' le lettere restano come sono, con intorno il colore della base; prima lo sfondo
      // tra le lettere prendeva il colore delle lettere o dell'immagine e le scritte diventavano storte e macchiate)
      var nearTx = anyTx ? dilateC(txm, GW, GH, bandO > 0 ? bandO + 1 : 2) : null;
      // (solo lo sfondo attaccato al disegno, entro 0,4 mm: e' la sfumatura del bordo dell'immagine. Lo sfondo nelle rientranze,
      // es. tra un braccio sottile e il corpo, resta del colore della base: prima si riempiva del colore del braccio e
      // lasciava macchie del colore della base in mezzo)
      var dArt = bandO > 0 ? edtC(not(art), GW, GH) : null, nearA = 0.4 * PX + 0.5;
      for (i = 0; i < N; i++) if (S[i]) own[i] = hi8[i] >= 0 || (hi8[i] === -2 && sdS[i] < bandO && dArt[i] <= nearA && !(nearTx && nearTx[i])) ? -2 : -1;
      // puntini del colore della base (o di sfondo) in mezzo ai colori: anche loro prendono il colore accanto
      var bm = new Uint8Array(N); for (i = 0; i < N; i++) bm[i] = own[i] === -1 ? 1 : 0;
      // (ma un puntino che nell'immagine E' del colore della base, es. un occhio nero piccolo, resta se non e' minuscolo)
      var bc = components(bm, GW, GH), bReal = new Int32Array(bc.n + 1); for (i = 0; i < N; i++) if (bm[i] && hi8[i] === -1) bReal[bc.lab[i]]++;
      for (i = 0; i < N; i++) if (bm[i]) { var cl = bc.lab[i]; if (bc.areas[cl] < (bReal[cl] * 2 > bc.areas[cl] ? 0.4 : 1) * MINA * PX * PX) own[i] = -2; }
      for (c = 0; c < nc; c++) for (i = 0; i < N; i++) if (masks[c][i]) own[i] = c;
      for (i = 0; i < N; i++) if (own[i] === -2) fr.push(i);
      for (var lay = 0; fr.length && lay < 4 * PX; lay++) {
        var set = [], rest = [];
        fr.forEach(function (q) {
          var qx = q % GW, best2 = -3;
          [qx > 0 ? q - 1 : -1, qx < GW - 1 ? q + 1 : -1, q - GW, q + GW].forEach(function (r2) { if (r2 >= 0 && r2 < N && own[r2] >= -1 && (best2 < -1 || (own[r2] >= 0 && best2 === -1))) best2 = own[r2]; });
          if (best2 >= -1) set.push([q, best2]); else rest.push(q);
        });
        if (!set.length) break;
        set.forEach(function (sv) { own[sv[0]] = sv[1]; }); fr = rest;
      }
      for (c = 0; c < nc; c++) { var mk = masks[c]; for (i = 0; i < N; i++) mk[i] = own[i] === c ? 1 : 0; }
      // ---- fori dei magneti: dove li mette il cliente, altrimenti sparsi bene nella zona dove ci stanno (parete >= 1 mm)
      var ds = edtC(S, GW, GH), need = (HOLE / 2 + WALL) * PX, sep = (HOLE + 1.2) * PX, holes = [], stp3 = Math.max(1, Math.round(PX / 2)), vp = [];
      // tasca del tag: nel punto piu' "dentro" la sagoma (lontano da tutti i bordi), vicino al centro a parita'
      var pocket = null;
      if (PK) {
        var pr = PK.d / 2 * PX, bestP = -1, pgx = 0, pgy = 0, ccx0 = 0, ccy0 = 0, ccn = 0;
        for (y = 0; y < GH; y += 2) for (x = 0; x < GW; x += 2) if (S[y * GW + x]) { ccx0 += x; ccy0 += y; ccn++; }
        ccx0 /= ccn || 1; ccy0 /= ccn || 1;
        var pAt = o.pocketAt, pOk = false;
        if (pAt && isFinite(pAt[0]) && isFinite(pAt[1])) {   // dove l'ha messo il cliente: il punto valido piu' vicino (tasca con 1 mm di parete)
          var tx0 = cx + pAt[0] * PX, ty0 = cy + pAt[1] * PX, needP = (PK.d / 2 + 1.0) * PX, bdP = 1e18;
          for (y = 0; y < GH; y += stp3) for (x = 0; x < GW; x += stp3) if (ds[y * GW + x] >= needP) { var dq = (x + 0.5 - tx0) * (x + 0.5 - tx0) + (y + 0.5 - ty0) * (y + 0.5 - ty0); if (dq < bdP) { bdP = dq; pgx = x + 0.5; pgy = y + 0.5; pOk = true; } }
        }
        if (!pOk) for (y = 0; y < GH; y += stp3) for (x = 0; x < GW; x += stp3) { var dv = ds[y * GW + x] - 0.02 * Math.hypot(x - ccx0, y - ccy0); if (dv > bestP) { bestP = dv; pgx = x + 0.5; pgy = y + 0.5; } }
        var room = ds[Math.floor(pgy) * GW + Math.floor(pgx)] / PX;
        pocket = { gx: pgx, gy: pgy, r: PK.d / 2, room: room };
        if (room < PK.d / 2 + 1.0) warn.tagSmall = Math.ceil(o.size * (PK.d / 2 + 1.2) / Math.max(0.1, room));
      }
      for (y = 0; y < GH; y += stp3) for (x = 0; x < GW; x += stp3) if (ds[y * GW + x] >= need && !(pocket && Math.hypot(x + 0.5 - pocket.gx, y + 0.5 - pocket.gy) < (pocket.r + HOLE / 2 + 3) * PX)) vp.push([x + 0.5, y + 0.5]);
      function nearestFree(px0, py0, taken) {
        var best = null, bd = 1e18;
        vp.forEach(function (p) {
          for (var t = 0; t < taken.length; t++) if (Math.hypot(p[0] - taken[t][0], p[1] - taken[t][1]) < sep) return;
          var d = (p[0] - px0) * (p[0] - px0) + (p[1] - py0) * (p[1] - py0); if (d < bd) { bd = d; best = p; }
        });
        return best;
      }
      var gcx = 0, gcy = 0, gn = 0; for (y = 0; y < GH; y += 2) for (x = 0; x < GW; x += 2) if (S[y * GW + x]) { gcx += x + 0.5; gcy += y + 0.5; gn++; }
      gcx /= gn || 1; gcy /= gn || 1;   // baricentro della sagoma: un magnete solo sta qui (il magnete tiene dritto)
      var picked = false;
      if (nM && vp.length) {
        var wantH = bossH || o.holes;
        if (wantH && wantH.length === nM) {
          picked = true;
          for (i = 0; i < nM; i++) { var hp = nearestFree(cx + wantH[i][0] * PX, cy + wantH[i][1] * PX, holes); if (!hp) { picked = false; break; } holes.push(hp.slice()); }
          if (!picked) holes = [];
        }
        if (!picked) {
          if (nM === 1) { var h1 = nearestFree(gcx, gcy, []); if (h1) holes.push(h1.slice()); }
          else {
            // punti lontani tra loro, poi "Lloyd": ogni foro al centro della sua zona
            var C0 = [], far = null, fd = -1;
            vp.forEach(function (p) { var d = Math.hypot(p[0] - gcx, p[1] - gcy); if (d > fd) { fd = d; far = p; } });
            C0.push(far.slice());
            while (C0.length < nM) { var bp2 = null, bd2 = -1; vp.forEach(function (p) { var m2 = 1e18; C0.forEach(function (cc0) { m2 = Math.min(m2, Math.hypot(p[0] - cc0[0], p[1] - cc0[1])); }); if (m2 > bd2) { bd2 = m2; bp2 = p; } }); C0.push(bp2.slice()); }
            for (var itl = 0; itl < 18; itl++) {
              var acc2 = C0.map(function () { return [0, 0, 0]; });
              vp.forEach(function (p) { var bi2 = 0, bd3 = 1e18; C0.forEach(function (cc0, j) { var d = (p[0] - cc0[0]) * (p[0] - cc0[0]) + (p[1] - cc0[1]) * (p[1] - cc0[1]); if (d < bd3) { bd3 = d; bi2 = j; } }); acc2[bi2][0] += p[0]; acc2[bi2][1] += p[1]; acc2[bi2][2]++; });
              C0 = C0.map(function (cc0, j) { if (!acc2[j][2]) return cc0; var mx = acc2[j][0] / acc2[j][2], my = acc2[j][1] / acc2[j][2], bp3 = cc0, bd4 = 1e18; vp.forEach(function (p) { var d = (p[0] - mx) * (p[0] - mx) + (p[1] - my) * (p[1] - my); if (d < bd4) { bd4 = d; bp3 = p; } }); return bp3.slice(); });
            }
            var okSep = true; for (i = 0; i < nM; i++) for (var j2 = i + 1; j2 < nM; j2++) if (Math.hypot(C0[i][0] - C0[j2][0], C0[i][1] - C0[j2][1]) < sep) okSep = false;
            if (okSep) holes = C0;
            else {
              // non ci stanno sparsi cosi': uno alla volta, il piu' lontano dagli altri
              holes = [];
              for (i = 0; i < nM; i++) {
                var bp4 = null, bd5 = -1e18;
                vp.forEach(function (p) {
                  var m3 = 1e18; for (var t = 0; t < holes.length; t++) m3 = Math.min(m3, Math.hypot(p[0] - holes[t][0], p[1] - holes[t][1]));
                  if (holes.length && m3 < sep) return; var sc0 = holes.length ? m3 : -Math.hypot(p[0] - gcx, p[1] - gcy); if (sc0 > bd5) { bd5 = sc0; bp4 = p; }
                });
                if (!bp4) break; holes.push(bp4.slice());
              }
            }
          }
        }
      }
      if (nM && holes.length < nM) warn.fewer = holes.length;
      if (nM && !holes.length) warn.tooThin = true;
      var wall = 99; holes.forEach(function (h) { wall = Math.min(wall, ds[Math.floor(h[1]) * GW + Math.floor(h[0])] / PX - HOLE / 2); });
      // anteprima per spostare i magneti: disegno rimpicciolito + zona valida
      var F = Math.max(1, Math.ceil(Math.max(GW, GH) / 300)), pw = Math.ceil(GW / F), ph = Math.ceil(GH / F);
      var pv = { w: pw, h: ph, F: F, PX: PX, cx: cx, cy: cy, holeR: HOLE / 2, sep: sep / PX, colIds: colIds, cell: new Int8Array(pw * ph), safe: new Uint8Array(pw * ph),
        holes: holes.map(function (h) { return [(h[0] - cx) / PX, (h[1] - cy) / PX]; }), key: keyHole ? [(keyHole.x - cx) / PX, (keyHole.y - cy) / PX, 2.0] : null,
        keyG: keyG, tab: new Uint8Array(pw * ph), pocket: pocket ? [(pocket.gx - cx) / PX, (pocket.gy - cy) / PX, pocket.r] : null, psafe: pocket ? new Uint8Array(pw * ph) : null };
      for (y = 0; y < ph; y++) for (x = 0; x < pw; x++) {
        var fxp = Math.min(GW - 1, x * F + (F >> 1)), fyp = Math.min(GH - 1, y * F + (F >> 1)), fi = fyp * GW + fxp, cvl = -2;
        if (S[fi]) { cvl = -1; for (var cc2 = 0; cc2 < nc; cc2++) if (masks[cc2][fi]) { cvl = cc2; break; } }
        pv.cell[y * pw + x] = cvl; pv.safe[y * pw + x] = (bossS ? bossS[fi] : ds[fi] >= need) ? 1 : 0; if (pv.psafe) pv.psafe[y * pw + x] = ds[fi] >= (pocket.r + 1.0) * PX ? 1 : 0; if (S0k && !S0k[fi] && cvl === -1) pv.tab[y * pw + x] = 1;
      }
      // ---- triangoli (origine = centro della sagoma, specchiato in X: la faccia colorata si stampa sul piatto)
      var mh = holes.map(function (h) { return [-(h[0] - cx) / PX, (cy - h[1]) / PX]; });
      function rings(sd) {
        return L.contours(fieldOfMM(sd, GW, GH), GW, GH)
          .map(function (r) { return L.simplify(r, 0.2).map(function (p) { return [-(p[0] - cx) / PX, (cy - p[1]) / PX]; }); })
          .filter(function (r) { return r.length >= 3 && Math.abs(L.ringArea(r)) > 0.05; });
      }
      var pkM = pocket ? [-(pocket.gx - cx) / PX, (cy - pocket.gy) / PX] : null;
      function solid(sd, z0, z1, withHoles, round, withPocket) {
        var out = [], f = sd;
        function normalAt(pt) {
          var px = cx - pt[0] * PX, py = cy - pt[1] * PX, ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
          function g(x, y) { x = Math.max(1, Math.min(GW - 2, x)); y = Math.max(1, Math.min(GH - 2, y)); return [(f[y * GW + x + 1] - f[y * GW + x - 1]) / 2, (f[(y + 1) * GW + x] - f[(y - 1) * GW + x]) / 2]; }
          var a = g(ix, iy), b = g(ix + 1, iy), c = g(ix, iy + 1), d = g(ix + 1, iy + 1);
          var gx = (a[0] * (1 - fx) + b[0] * fx) * (1 - fy) + (c[0] * (1 - fx) + d[0] * fx) * fy, gy = (a[1] * (1 - fx) + b[1] * fx) * (1 - fy) + (c[1] * (1 - fx) + d[1] * fx) * fy;
          var l = Math.hypot(gx, gy); return l > 1e-6 ? [-gx / l, -gy / l] : null;
        }
        L.polygons(rings(sd)).forEach(function (p) {
          var qn = { outer: p.outer, holes: p.holes.slice(), normalAt: normalAt };
          if (withHoles) mh.forEach(function (h) { if (L.inRing(h, p.outer) && !p.holes.some(function (hh) { return L.inRing(h, hh); })) qn.holes.push(L.circleRing(h[0], h[1], HOLE / 2, 72, true)); });
          if (withPocket && pkM && L.inRing(pkM, p.outer) && !p.holes.some(function (hh) { return L.inRing(pkM, hh); })) qn.holes.push(L.circleRing(pkM[0], pkM[1], pocket.r + 0.3, 96, true));
          if (round && p.depth === 0) L.prismRound(qn, z0, z1, EDGE, out); else L.prism(qn, z0, z1, out);
        });
        return out;
      }
      var gapC = Math.max(1, (EDGE + 0.25) * PX);   // i colori restano ad almeno 0,85 mm dal bordo: lo spigolo arrotondato non li tocca
      if (shape === 'outline') gapC = Math.max(gapC, B * PX);   // contorno: fascia della base larga esattamente quanto il bordo scelto
      var gapT = Math.max(1, (EDGE + 0.25) * PX);   // vicino alle scritte basta lo stacco minimo: le punte delle lettere non vengono tagliate
      // bordi dei colori lisci come in un disegno vettoriale e IN COMUNE tra i colori vicini:
      // ogni zona (base, colori, fuori) viene "sfumata" con la stessa misura, poi ogni punto va alla zona piu' forte.
      // Il confine tra due colori e' quindi la stessa linea per entrambi (niente fessure nere ne' sovrapposizioni)
      // e i piccoli scalini dei pixel dell'immagine spariscono. Misura della sfumatura: 0,3 mm (di piu' se l'immagine e' piccola).
      var sigJ = Math.min(0.5 * PX, Math.max(SIGMM * PX, 1.4 * s * PX, 2.2)), wB = Math.sqrt(4 * sigJ * sigJ + 1), rb = Math.max(1, Math.round((wB - 1) / 2));
      var rx0 = GW, rx1 = -1, ry0 = GH, ry1 = -1;
      for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) if (S[y * GW + x]) { if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; if (y < ry0) ry0 = y; if (y > ry1) ry1 = y; }
      var mg = 3 * rb + 3; rx0 = Math.max(0, rx0 - mg); ry0 = Math.max(0, ry0 - mg); rx1 = Math.min(GW - 1, rx1 + mg); ry1 = Math.min(GH - 1, ry1 + mg);
      var rw = rx1 - rx0 + 1, rh = ry1 - ry0 + 1, RN = rw * rh, tmpB = new Float32Array(Math.max(rw, rh));
      function boxLine(a, off, stride, len) {   // media mobile di larghezza 2rb+1 su una riga o colonna (bordi: valore ripetuto)
        var acc = 0, k2, j2;
        for (k2 = -rb; k2 <= rb; k2++) acc += a[off + Math.min(len - 1, Math.max(0, k2)) * stride];
        for (j2 = 0; j2 < len; j2++) { tmpB[j2] = acc / (2 * rb + 1); acc += a[off + Math.min(len - 1, j2 + rb + 1) * stride] - a[off + Math.max(0, j2 - rb) * stride]; }
        for (j2 = 0; j2 < len; j2++) a[off + j2 * stride] = tmpB[j2];
      }
      function softOf(lb) {   // zona "lb" sfumata (3 medie mobili = quasi una gaussiana), solo nel riquadro della figura
        var f = new Float32Array(RN), yy2, xx2, pass2;
        for (yy2 = 0; yy2 < rh; yy2++) for (xx2 = 0; xx2 < rw; xx2++) f[yy2 * rw + xx2] = own[(yy2 + ry0) * GW + xx2 + rx0] === lb ? 1 : 0;
        for (pass2 = 0; pass2 < 3; pass2++) { for (yy2 = 0; yy2 < rh; yy2++) boxLine(f, yy2 * rw, 1, rw); for (xx2 = 0; xx2 < rw; xx2++) boxLine(f, xx2, rw, rh); }
        return f;
      }
      var labs = [-3, -1]; for (c = 0; c < nc; c++) labs.push(c);
      var top1 = new Float32Array(RN).fill(-1), top2 = new Float32Array(RN).fill(-1), arg1 = new Int8Array(RN).fill(-9);
      labs.forEach(function (lb) { var f = softOf(lb); for (var t = 0; t < RN; t++) { var v = f[t]; if (v > top1[t]) { top2[t] = top1[t]; top1[t] = v; arg1[t] = lb; } else if (v > top2[t]) top2[t] = v; } });
      var kS = 1.25 * sigJ, sdCols = masks.map(function (m, ci) {   // circa la distanza dal confine (in pixel), + dentro il colore
        var q = new Float32Array(N).fill(-1000), f = softOf(ci);
        for (var yy3 = 0; yy3 < rh; yy3++) for (var xx3 = 0; xx3 < rw; xx3++) {
          var t2 = yy3 * rw + xx3, gi = (yy3 + ry0) * GW + xx3 + rx0;
          q[gi] = Math.min((f[t2] - (arg1[t2] === ci ? top2[t2] : top1[t2])) * kS, sdS[gi] - (nearTx && nearTx[gi] ? gapT : gapC));
        }
        return q;
      });
      var sdBase = new Float32Array(N);
      for (i = 0; i < N; i++) { var v2 = sdS[i]; for (c = 0; c < nc; c++) v2 = Math.min(v2, -sdCols[c][i]); sdBase[i] = v2; }
      var baseTop = solid(sdBase, 0, TOP, false, true), body;
      if (!PK && hz <= TOP + 1e-6) body = solid(sdS, TOP, HT, true);
      else {   // una sola pelle chiusa: fori ciechi dei magneti (da hz in su) e tasca del tag chiusa dentro (vuoto a parte)
        // (prima erano strati impilati con facce in comune: maglia non chiusa per lo slicer)
        body = [];
        var hzB = Math.max(TOP, hz);
        function capT(rs, z, up) {   // tappo piano (rs[0] esterno, gli altri buchi), normale verso +z se up: le facce di un prism alla quota giusta
          var t = [], k; L.prism({ outer: rs[0], holes: rs.slice(1) }, up ? z - 1 : z, up ? z : z + 1, t);
          for (k = 0; k < t.length; k += 3) if (t[k][2] === z && t[k + 1][2] === z && t[k + 2][2] === z) body.push(t[k], t[k + 1], t[k + 2]);
        }
        function wallT(r, z0, z1) {
          for (var k = 0; k < r.length; k++) { var a = r[k], b = r[(k + 1) % r.length]; body.push([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]); }
        }
        L.polygons(rings(sdS)).forEach(function (p) {
          var mine = nM ? mh.filter(function (h) { return L.inRing(h, p.outer) && !p.holes.some(function (hh) { return L.inRing(h, hh); }); })
            .map(function (h) { return L.circleRing(h[0], h[1], HOLE / 2, 72, true); }) : [];
          var base = [p.outer].concat(p.holes);
          base.forEach(function (r) { wallT(r, TOP, HT); });
          capT(base.concat(mine), HT, true);
          capT(hzB <= TOP + 1e-6 ? base.concat(mine) : base, TOP, false);
          mine.forEach(function (r) { wallT(r, hzB, HT); if (hzB > TOP + 1e-6) capT([r.slice().reverse()], hzB, true); });
          if (PK && pkM && L.inRing(pkM, p.outer) && !p.holes.some(function (hh) { return L.inRing(pkM, hh); })) {
            var pr = L.circleRing(pkM[0], pkM[1], pocket.r + 0.3, 96, true);
            wallT(pr, pz0, pz1); var pc = [pr.slice().reverse()];
            capT(pc, pz0, true); capT(pc, pz1, false);
          }
        });
      }
      var colors = colIds.map(function (id, k) { return { id: id, tris: solid(sdCols[k], 0, TOP) }; }).filter(function (q) { return q.tris.length; });
      var bx0 = GW, bx1 = 0, by0 = GH, by1 = 0, area = 0;
      for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) if (S[y * GW + x]) { area++; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
      area /= PX * PX;
      var vol = area * HT - holes.length * Math.PI * HOLE * HOLE / 4 * (HT - Math.max(TOP, hz)) - (pkM ? Math.PI * (pocket.r + 0.3) * (pocket.r + 0.3) * (pz1 - pz0) : 0);
      return {
        base: { id: baseId, tris: baseTop.concat(body), top: baseTop, body: body }, colors: colors, warn: warn, wall: wall, preview: pv, holesPicked: picked,
        size: [(bx1 - bx0 + 1) / PX, (by1 - by0 + 1) / PX, HT],
        bbox: [-(bx1 + 1 - cx) / PX, -(bx0 - cx) / PX, (cy - by1 - 1) / PX, (cy - by0) / PX],   // xmin, xmax, ymin, ymax (coordinate del modello)
        imgMap: { ax0: ax0, ay0: ay0, sp: sp, cx: cx, cy: cy, PX: PX, W: W, H: Hh },
        magnets: mh.map(function (h) { return { x: h[0], y: h[1] }; }), magD: HOLE - 0.4, magT: o.magT || 2, HT: HT, TOP: TOP,
        pocket: pkM ? { x: pkM[0], y: pkM[1], d: PK.d, z0: pz0, z1: pz1, pauseZ: Math.round((pz1 + 0.2) * 100) / 100, layer: Math.round((pz1 + 0.2) / 0.2) } : null,
        area: area, grams: vol / 1000 * 1.24, letterMM: P.letterPx ? P.letterPx * s : 0, scale: s
      };
    }

    /* 6) cornice magnetica per foto (o = {pw, ph: misura foto mm, thick: spessore della fessura, border, edge, win, caption,
       font, capColor, base, nMag, holeD, magT}). Si stampa a faccia in giu' come i magneti:
       davanti (con la finestra) -> fessura (tasca della foto, aperta in alto) -> retro (aperto a U: la foto entra dall'alto
       e il retro la tiene ai lati e sotto). Cosi' nessun ponte lungo: solo i bordini sopra la tasca (4 mm). */
    function buildFrame(o) {
      var pw = o.pw + 1.0, ph = o.ph + 1.0, lip = 3, lipB = 4, b = Math.max(6, o.border || 12), bb = o.caption ? Math.max(b * 2.2, b + 12) : b;
      var Tf = 1.2, Ts = o.thick || 0.6, Tb = 1.2, HT = Math.round((Tf + Ts + Tb) * 100) / 100, HOLE = o.holeD || 8.4, nM = o.nMag | 0, magT = o.magT || 2;
      var hz = nM ? Math.max(TOP, HT - magT - 0.2) : HT, ow = pw + 2 * b, oh = ph + b + bb;
      var PX = Math.max(5, Math.min(14, 1100 / Math.max(ow, oh))), pad = 10, GW = Math.ceil(ow * PX) + 2 * pad, GH = Math.ceil(oh * PX) + 2 * pad, N = GW * GH, cx = GW / 2, cy = GH / 2;
      var pcx = 0, pcy = (b - bb) / 2;   // centro della tasca (mm, rispetto al centro della cornice, y in giu')
      var cv = document.createElement('canvas'); cv.width = GW; cv.height = GH; var g = cv.getContext('2d', { willReadFrequently: true });
      var X = function (mm) { return cx + mm * PX; }, Y = function (mm) { return cy + mm * PX; };
      function mask(draw, nz) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, GW, GH); g.fillStyle = '#000'; draw(); g.fill(nz ? 'nonzero' : 'evenodd');
        var d = g.getImageData(0, 0, GW, GH).data, m = new Uint8Array(N); for (var i = 0; i < N; i++) m[i] = d[i * 4 + 3] >= 128 ? 1 : 0; return m;
      }
      function rrect(x0, y0, x1, y1, r) { r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2); g.moveTo(X(x0 + r), Y(y0)); g.arcTo(X(x1), Y(y0), X(x1), Y(y1), r * PX); g.arcTo(X(x1), Y(y1), X(x0), Y(y1), r * PX); g.arcTo(X(x0), Y(y1), X(x0), Y(y0), r * PX); g.arcTo(X(x0), Y(y0), X(x1), Y(y0), r * PX); g.closePath(); }
      var ox0 = -ow / 2, ox1 = ow / 2, oy0 = -oh / 2, oy1 = oh / 2, edge = o.edge || 'round';
      // ---- fuori: angoli tondi, dritti, a onde, dentellato (francobollo)
      var OUT = mask(function () {
        g.beginPath();
        if (edge === 'square') rrect(ox0, oy0, ox1, oy1, 1.5);
        else if (edge === 'wave') {
          var bumpR = Math.max(2.5, Math.min(5, b * 0.38)), per = [], k;
          var side = function (ax, ay, bx2, by2) { var L = Math.hypot(bx2 - ax, by2 - ay), n2 = Math.max(2, Math.round(L / (bumpR * 2))); for (k = 0; k < n2; k++) per.push([ax + (bx2 - ax) * k / n2, ay + (by2 - ay) * k / n2, (bx2 - ax) / L, (by2 - ay) / L, L / n2]); };
          var ix0 = ox0 + bumpR, ix1 = ox1 - bumpR, iy0 = oy0 + bumpR, iy1 = oy1 - bumpR;
          side(ix0, iy0, ix1, iy0); side(ix1, iy0, ix1, iy1); side(ix1, iy1, ix0, iy1); side(ix0, iy1, ix0, iy0);
          g.moveTo(X(per[0][0]), Y(per[0][1]));
          per.forEach(function (q) { var mx = q[0] + q[2] * q[4] / 2, my = q[1] + q[3] * q[4] / 2, nx = q[3], ny = -q[2]; g.quadraticCurveTo(X(mx + nx * bumpR * 1.9), Y(my + ny * bumpR * 1.9), X(q[0] + q[2] * q[4]), Y(q[1] + q[3] * q[4])); });
          g.closePath();
        } else rrect(ox0, oy0, ox1, oy1, edge === 'stamp' ? 0.01 : Math.min(8, b * 0.8));
      });
      // francobollo: i mezzi cerchi si TOLGONO dal rettangolo (prima con "evenodd" la meta' fuori diventava piena: pezzetti staccati)
      if (edge === 'stamp') { var CUT = mask(function () {
        g.beginPath();
        if (edge === 'stamp') {   // mezzi cerchi tolti lungo i bordi (raggio 1,5 mm, passo ~4,6 mm), angoli pieni
          var rp = 1.5, pitch = 4.6, cm = 1.6;   // cm: angoli pieni (prima i due mezzi cerchi vicino all'angolo lo staccavano quasi del tutto)
          [[ow, 0], [oh, 1]].forEach(function (e) {
            var Lu = e[0] - 2 * cm, nn = Math.max(3, Math.round(Lu / pitch)), stp = Lu / nn;
            for (var q = 0; q < nn; q++) { var t = cm + (q + 0.5) * stp;
              if (e[1] === 0) { g.moveTo(X(ox0 + t + rp), Y(oy0)); g.arc(X(ox0 + t), Y(oy0), rp * PX, 0, 2 * Math.PI); g.moveTo(X(ox0 + t + rp), Y(oy1)); g.arc(X(ox0 + t), Y(oy1), rp * PX, 0, 2 * Math.PI); }
              else { g.moveTo(X(ox0 + rp), Y(oy0 + t)); g.arc(X(ox0), Y(oy0 + t), rp * PX, 0, 2 * Math.PI); g.moveTo(X(ox1 + rp), Y(oy0 + t)); g.arc(X(ox1), Y(oy0 + t), rp * PX, 0, 2 * Math.PI); } }
          });
        }
      }, true); for (var ci = 0; ci < N; ci++) if (CUT[ci]) OUT[ci] = 0; }
      // ---- finestra (dentro la foto di "lip" mm per lato): rettangolo, angoli tondi, ovale, cerchio, cuore, arco
      var wx0 = pcx - pw / 2 + lip, wx1 = pcx + pw / 2 - lip, wy0 = pcy - ph / 2 + lip, wy1 = pcy + ph / 2 - lip, ww = wx1 - wx0, wh = wy1 - wy0, wcx = (wx0 + wx1) / 2, wcy = (wy0 + wy1) / 2, win = o.win || 'rect';
      var WIN = mask(function () {
        g.beginPath();
        if (win === 'oval') g.ellipse(X(wcx), Y(wcy), ww / 2 * PX, wh / 2 * PX, 0, 0, 2 * Math.PI);
        else if (win === 'circle') { var rr = Math.min(ww, wh) / 2; g.arc(X(wcx), Y(wcy), rr * PX, 0, 2 * Math.PI); }
        else if (win === 'heart') { var hs = Math.min(ww, wh / 0.9); heartRing(hs, hs * 0.9).forEach(function (p, i2) { var px2 = X(wcx + p[0]), py2 = Y(wcy + p[1]); if (i2) g.lineTo(px2, py2); else g.moveTo(px2, py2); }); g.closePath(); }
        else if (win === 'arch') { var ar = ww / 2; g.moveTo(X(wx0), Y(wy1)); g.lineTo(X(wx0), Y(wy0 + ar)); g.arc(X(wcx), Y(wy0 + ar), ar * PX, Math.PI, 2 * Math.PI); g.lineTo(X(wx1), Y(wy1)); g.closePath(); }
        else rrect(wx0, wy0, wx1, wy1, win === 'round' ? Math.min(ww, wh) * 0.12 : 1.2);
      });
      // ---- tasca della foto + entrata dall'alto (fino a fuori); retro aperto a U
      var VOID = mask(function () { g.beginPath(); g.rect(X(pcx - pw / 2), Y(oy0 - 5), pw * PX, (pcy + ph / 2 - oy0 + 5) * PX); });
      var BOP = mask(function () { g.beginPath(); g.rect(X(pcx - pw / 2 + lipB), Y(oy0 - 5), (pw - 2 * lipB) * PX, (pcy + ph / 2 - lipB - oy0 + 5) * PX); });
      // ---- scritta sotto (bordo largo, come una polaroid)
      var TXT = null;
      if (o.caption && o.font) {
        TXT = mask(function () {
          var fs = (bb - 4) * 0.55 * PX, maxW = (ow - 8) * PX; g.font = o.font.replace(/\d+px/, Math.round(fs) + 'px');
          var w = g.measureText(o.caption).width; if (w > maxW) { fs *= maxW / w; g.font = o.font.replace(/\d+px/, Math.round(fs) + 'px'); }
          g.textAlign = 'center'; g.textBaseline = 'middle'; g.beginPath(); g.fillText(o.caption, X(0), Y(pcy + ph / 2 + bb / 2));
        });
        var cnt = 0; for (var t0 = 0; t0 < N; t0++) cnt += TXT[t0]; if (cnt < 20) TXT = null;
      }
      var F = new Uint8Array(N), S1 = new Uint8Array(N), BK = new Uint8Array(N), i;
      for (i = 0; i < N; i++) { F[i] = OUT[i] && !WIN[i] ? 1 : 0; S1[i] = OUT[i] && !VOID[i] ? 1 : 0; BK[i] = OUT[i] && !BOP[i] ? 1 : 0; }
      var warn = {};
      // ---- fori dei magneti: dove il pezzo e' pieno per tutta l'altezza del foro
      var V = new Uint8Array(N); for (i = 0; i < N; i++) V[i] = S1[i] && BK[i] && (hz >= Tf || F[i]) ? 1 : 0;
      var dV = edtC(V, GW, GH), need = (HOLE / 2 + WALL) * PX, holes = [];
      if (nM) {
        var tg = nM === 1 ? [[0, pcy + ph / 2 + bb / 2]] : nM === 2 ? [[-(pw / 2 + b / 2), pcy], [pw / 2 + b / 2, pcy]] : nM === 3 ? [[-(pw / 2 + b / 2), pcy - ph / 4], [pw / 2 + b / 2, pcy - ph / 4], [0, pcy + ph / 2 + bb / 2]] : [[-(pw / 2 + b / 2), oy0 + b], [pw / 2 + b / 2, oy0 + b], [-(pw / 2 + b / 2), oy1 - b], [pw / 2 + b / 2, oy1 - b]].concat(nM === 5 ? [[0, oy1 - bb / 2]] : nM >= 6 ? [[-(pw / 2 + b / 2), pcy], [pw / 2 + b / 2, pcy]] : []);   // 5: anche in basso al centro; 6: anche a meta' dei lati
        var stp2 = Math.max(1, Math.round(PX / 3));
        tg.forEach(function (tq) {
          var best = null, bd = 1e18, tx = X(tq[0]), ty = Y(tq[1]);
          for (var yy = 0; yy < GH; yy += stp2) for (var xx = 0; xx < GW; xx += stp2) {
            if (dV[yy * GW + xx] < need) continue;
            var ok = holes.every(function (h) { return Math.hypot(h[0] - xx, h[1] - yy) >= (HOLE + 1.2) * PX; }); if (!ok) continue;
            var dd = (xx - tx) * (xx - tx) + (yy - ty) * (yy - ty); if (dd < bd) { bd = dd; best = [xx + 0.5, yy + 0.5]; }
          }
          if (best) holes.push(best);
        });
        if (holes.length < nM) warn.fewer = holes.length;
        if (!holes.length) warn.tooThin = true;
      }
      var mh = holes.map(function (h) { return [-(h[0] - cx) / PX, (cy - h[1]) / PX]; });
      function rings(sd) {
        return L.contours(fieldOfMM(sd, GW, GH), GW, GH)
          .map(function (r) { return L.simplify(r, 0.15).map(function (p) { return [-(p[0] - cx) / PX, (cy - p[1]) / PX]; }); })
          .filter(function (r) { return r.length >= 3 && Math.abs(L.ringArea(r)) > 0.05; });
      }
      function solidF(sd, z0, z1, withHoles, round) {
        var out = [], f = sd;
        function normalAt(pt) {
          var px = cx - pt[0] * PX, py = cy - pt[1] * PX, ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
          function gg(x, y) { x = Math.max(1, Math.min(GW - 2, x)); y = Math.max(1, Math.min(GH - 2, y)); return [(f[y * GW + x + 1] - f[y * GW + x - 1]) / 2, (f[(y + 1) * GW + x] - f[(y - 1) * GW + x]) / 2]; }
          var a = gg(ix, iy), b2 = gg(ix + 1, iy), c = gg(ix, iy + 1), d = gg(ix + 1, iy + 1);
          var gx = (a[0] * (1 - fx) + b2[0] * fx) * (1 - fy) + (c[0] * (1 - fx) + d[0] * fx) * fy, gy = (a[1] * (1 - fx) + b2[1] * fx) * (1 - fy) + (c[1] * (1 - fx) + d[1] * fx) * fy;
          var l = Math.hypot(gx, gy); return l > 1e-6 ? [-gx / l, -gy / l] : null;
        }
        L.polygons(rings(sd)).forEach(function (p) {
          var qn = { outer: p.outer, holes: p.holes.slice(), normalAt: normalAt };
          if (withHoles) mh.forEach(function (h) { if (L.inRing(h, p.outer) && !p.holes.some(function (hh) { return L.inRing(h, hh); })) qn.holes.push(L.circleRing(h[0], h[1], HOLE / 2, 72, true)); });
          if (round && p.depth === 0) L.prismRound(qn, z0, z1, EDGE, out); else L.prism(qn, z0, z1, out);
        });
        return out;
      }
      var sig = Math.max(1.0, 0.2 * PX), sdOf = function (m) { return smoothSD(m, GW, GH, sig); };
      // faccia (0..TOP): cornice + scritta (colore suo, staccata dal bordo di almeno 0,85 mm)
      var Fbase = F, colors = [];
      if (TXT) {
        var dF = edtC(F, GW, GH), gap = (EDGE + 0.25) * PX, T2 = new Uint8Array(N); Fbase = new Uint8Array(N);
        for (i = 0; i < N; i++) { T2[i] = TXT[i] && F[i] && dF[i] > gap ? 1 : 0; Fbase[i] = F[i] && !T2[i] ? 1 : 0; }
        colors.push({ id: o.capColor, tris: solidF(sdOf(T2), 0, TOP, false, false) });
      }
      var zs = [0, TOP, Tf, Tf + Ts, HT]; if (nM && hz > 0) zs.push(hz);
      zs = zs.map(function (z) { return Math.round(z * 1000) / 1000; }).filter(function (z, k, A) { return A.indexOf(z) === k; }).sort(function (a, c) { return a - c; });
      var top = [], body = [], parts = [], sdCache = {};   // parts: ogni strato del retro e' un pezzo chiuso a se' (insieme farebbero facce in comune: maglia non chiusa)
      var sdFor = function (key, m) { return sdCache[key] || (sdCache[key] = sdOf(m)); };
      for (var zi = 0; zi + 1 < zs.length; zi++) {
        var za = zs[zi], zb = zs[zi + 1], key = za < Tf - 1e-6 ? (za < TOP - 1e-6 ? 'Fb' : 'F') : za < Tf + Ts - 1e-6 ? 'S' : 'B';
        var m2 = key === 'Fb' ? Fbase : key === 'F' ? F : key === 'S' ? S1 : BK, tri = solidF(sdFor(key, m2), za, zb, nM && za >= hz - 1e-6, za < 1e-6);
        if (za < 1e-6) top = top.concat(tri); else { body = body.concat(tri); if (tri.length) parts.push(tri); }
      }
      var area = 0; for (i = 0; i < N; i++) area += F[i] + S1[i] + BK[i]; area /= PX * PX;
      var vol = area / 3 * HT;
      return {
        base: { id: o.base, tris: top.concat(body), top: top, body: body, parts: parts }, colors: colors.filter(function (q) { return q.tris.length; }), warn: warn, wall: 99,
        size: [ow, oh, HT], bbox: [-ow / 2, ow / 2, -oh / 2, oh / 2],
        magnets: mh.map(function (h) { return { x: h[0], y: h[1] }; }), magD: HOLE - 0.4, magT: magT, HT: HT, TOP: TOP,
        area: area / 3, grams: vol / 1000 * 1.24, letterMM: 0, scale: 1, frame: { pocket: [pw, ph], window: [ww, wh], slot: Ts, border: b, bottom: bb }
      };
    }
    function heartRing(w, h) {   // cuore centrato in (0, 0), largo w e alto h (y in giu')
      var P = [], a = 1e9, b = -1e9, c = 1e9, d = -1e9, i, t, s1;
      for (i = 0; i < 160; i++) { t = i / 160 * 2 * Math.PI; s1 = Math.sin(t); P.push([16 * s1 * s1 * s1, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
      P.forEach(function (p) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); });
      return P.map(function (p) { return [(p[0] - (a + b) / 2) / (b - a) * w, (p[1] - (c + d) / 2) / (d - c) * h]; });
    }

    function sample() {
      var cv = document.createElement('canvas'); cv.width = cv.height = 240; var c = cv.getContext('2d');
      c.fillStyle = '#F2C230'; c.beginPath(); c.moveTo(98, 168); c.quadraticCurveTo(120, 238, 142, 168); c.closePath(); c.fill();     // fiamma
      c.fillStyle = '#2F6FD6';
      c.beginPath(); c.moveTo(86, 120); c.lineTo(56, 176); c.lineTo(92, 162); c.closePath(); c.fill();                                // alette
      c.beginPath(); c.moveTo(154, 120); c.lineTo(184, 176); c.lineTo(148, 162); c.closePath(); c.fill();
      c.fillStyle = '#D62839'; c.beginPath(); c.moveTo(120, 18); c.bezierCurveTo(168, 52, 166, 128, 150, 172); c.lineTo(90, 172); c.bezierCurveTo(74, 128, 72, 52, 120, 18); c.closePath(); c.fill();   // corpo
      c.fillStyle = '#F3F2EE'; c.beginPath(); c.arc(120, 92, 24, 0, 2 * Math.PI); c.fill();                                            // oblo'
      c.fillStyle = '#2F6FD6'; c.beginPath(); c.arc(120, 92, 15, 0, 2 * Math.PI); c.fill();
      return cv;
    }
    function badSample() {
      var cv = document.createElement('canvas'); cv.width = cv.height = 240; var c = cv.getContext('2d');
      var g = c.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, '#5b7fbf'); g.addColorStop(0.55, '#f0a35e'); g.addColorStop(1, '#5a4636'); c.fillStyle = g; c.fillRect(0, 0, 240, 240);
      var r = c.createRadialGradient(150, 120, 4, 150, 120, 70); r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = r; c.fillRect(0, 0, 240, 240);
      c.fillStyle = 'rgba(40,30,25,0.85)'; c.beginPath(); c.moveTo(0, 190); c.quadraticCurveTo(70, 150, 130, 185); c.quadraticCurveTo(190, 160, 240, 180); c.lineTo(240, 240); c.lineTo(0, 240); c.fill();
      var d = c.getImageData(0, 0, 240, 240); for (var i = 0; i < d.data.length; i += 4) { var nz = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 26; d.data[i] += nz; d.data[i + 1] += nz; d.data[i + 2] += nz; } c.putImageData(d, 0, 0);
      return cv;
    }
    return { cutout: cutout, compose: compose, prepare: prepare, quantize: quantize, build: build, buildFrame: buildFrame, region: region, withRegions: withRegions, stampDesign: stampDesign, stampLayout: stampLayout, nearest: nearest, nearestSet: nearestSet, sample: sample, badSample: badSample, dist2: dist2, hexLab: hexLab };
  })();


  // mesh WebGL da una lista di triangoli (normali piatte)
  function meshFromTris(gl, tris) {
    var n = tris.length, P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), I = new Uint32Array(n), F = new Float32Array(n), FA = new Float32Array(n), t, k;
    for (t = 0; t < n; t += 3) {
      var a = tris[t], b = tris[t + 1], c = tris[t + 2];
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      F[t] = nx / l; F[t + 1] = ny / l; F[t + 2] = nz / l; FA[t] = l;   // FA = area (x2): i triangoli sottilissimi contano poco nella media
      // 27/10 (Luigi): normali delle facce quasi dritte (entro ~13 gradi da un asse) messe dritte: le anteprime "da vetrina"
      // hanno i punti spostati di qualche decimo e senza questo la luce faceva righe e pieghe sulle facce piatte
      var sxA = Math.abs(F[t]), syA = Math.abs(F[t + 1]), szA = Math.abs(F[t + 2]);
      if (sxA > 0.975) { F[t] = F[t] > 0 ? 1 : -1; F[t + 1] = 0; F[t + 2] = 0; } else if (syA > 0.975) { F[t] = 0; F[t + 1] = F[t + 1] > 0 ? 1 : -1; F[t + 2] = 0; } else if (szA > 0.975) { F[t] = 0; F[t + 1] = 0; F[t + 2] = F[t + 2] > 0 ? 1 : -1; }
      for (k = 0; k < 3; k++) { var q = tris[t + k], o = (t + k) * 3; P[o] = q[0]; P[o + 1] = q[1]; P[o + 2] = q[2]; I[t + k] = t + k; }
    }
    // normali morbide: nei punti in comune si fa la media delle facce quasi allineate (curve lisce, spigoli veri restano netti)
    var at = {}, key;
    for (t = 0; t < n; t++) { key = Math.round(P[t * 3] * 1e3) + ',' + Math.round(P[t * 3 + 1] * 1e3) + ',' + Math.round(P[t * 3 + 2] * 1e3); (at[key] = at[key] || []).push(t - t % 3); }
    // 27/10 (Luigi): triangoli sottilissimi (2 x area < 5% del lato piu' lungo al quadrato): coi punti spostati di qualche
    // centesimo la loro normale non e' affidabile (righe che partono dagli angoli). Prendono la media, pesata sull'area,
    // delle facce attorno ai loro tre punti (se quasi dritta diventa dritta)
    var FT = F.slice();
    for (t = 0; t < n; t += 3) {
      var mE = 0; for (k = 0; k < 3; k++) { var i0 = (t + k) * 3, i1 = (t + (k + 1) % 3) * 3, ddx = P[i1] - P[i0], ddy = P[i1 + 1] - P[i0 + 1], ddz = P[i1 + 2] - P[i0 + 2]; mE = Math.max(mE, ddx * ddx + ddy * ddy + ddz * ddz); }
      if (FA[t] >= 0.05 * mE) continue;
      var rx = 0, ry = 0, rz = 0;
      for (k = 0; k < 3; k++) { var lst = at[Math.round(P[(t + k) * 3] * 1e3) + ',' + Math.round(P[(t + k) * 3 + 1] * 1e3) + ',' + Math.round(P[(t + k) * 3 + 2] * 1e3)]; for (var q2 = 0; q2 < lst.length; q2++) { var g = lst[q2]; rx += F[g] * FA[g]; ry += F[g + 1] * FA[g]; rz += F[g + 2] * FA[g]; } }
      var rl = Math.hypot(rx, ry, rz); if (!rl) continue;
      FT[t] = rx / rl; FT[t + 1] = ry / rl; FT[t + 2] = rz / rl;
      var px = Math.abs(FT[t]), py = Math.abs(FT[t + 1]), pz = Math.abs(FT[t + 2]);
      if (px > 0.975) { FT[t] = FT[t] > 0 ? 1 : -1; FT[t + 1] = 0; FT[t + 2] = 0; } else if (py > 0.975) { FT[t] = 0; FT[t + 1] = FT[t + 1] > 0 ? 1 : -1; FT[t + 2] = 0; } else if (pz > 0.975) { FT[t] = 0; FT[t + 1] = 0; FT[t + 2] = FT[t + 2] > 0 ? 1 : -1; }
    }
    F.set(FT);
    for (t = 0; t < n; t++) {
      var f0 = t - t % 3, list = at[Math.round(P[t * 3] * 1e3) + ',' + Math.round(P[t * 3 + 1] * 1e3) + ',' + Math.round(P[t * 3 + 2] * 1e3)], sx = 0, sy = 0, sz = 0;
      for (k = 0; k < list.length; k++) { var f = list[k]; if (F[f] * F[f0] + F[f + 1] * F[f0 + 1] + F[f + 2] * F[f0 + 2] > 0.82) { var wA = FA[f] + 1e-9; sx += F[f] * wA; sy += F[f + 1] * wA; sz += F[f + 2] * wA; } }
      var L2 = Math.hypot(sx, sy, sz) || 1; Nn[t * 3] = sx / L2; Nn[t * 3 + 1] = sy / L2; Nn[t * 3 + 2] = sz / L2;
      var qx = Math.abs(Nn[t * 3]), qy = Math.abs(Nn[t * 3 + 1]), qz = Math.abs(Nn[t * 3 + 2]);   // e la normale finale quasi dritta diventa dritta
      if (qx > 0.975) { Nn[t * 3] = Nn[t * 3] > 0 ? 1 : -1; Nn[t * 3 + 1] = 0; Nn[t * 3 + 2] = 0; } else if (qy > 0.975) { Nn[t * 3] = 0; Nn[t * 3 + 1] = Nn[t * 3 + 1] > 0 ? 1 : -1; Nn[t * 3 + 2] = 0; } else if (qz > 0.975) { Nn[t * 3] = 0; Nn[t * 3 + 1] = 0; Nn[t * 3 + 2] = Nn[t * 3 + 2] > 0 ? 1 : -1; }
    }
    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    var pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, P, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    var nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, Nn, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao: vao, count: n, type: gl.UNSIGNED_INT, node: m4(), src: null, bufs: [pb, nb, ib] };
  }
  function meshFromIndexed(gl, P, I) {
    var nt = I.length / 3, nv = P.length / 3, FN = new Float32Array(nt * 3), FA = new Float32Array(nt), t, k;
    for (t = 0; t < nt; t++) {
      var a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      var ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      FN[t * 3] = nx / l; FN[t * 3 + 1] = ny / l; FN[t * 3 + 2] = nz / l; FA[t] = l;   // FA = area (x2): i triangoli sottilissimi contano poco nella media
      // 27/10 (Luigi): normali delle facce quasi dritte (entro ~13 gradi da un asse) messe dritte: le anteprime "da vetrina"
      // hanno i punti spostati di qualche decimo e senza questo la luce faceva righe e pieghe sulle facce piatte
      var sxA = Math.abs(FN[t * 3]), syA = Math.abs(FN[t * 3 + 1]), szA = Math.abs(FN[t * 3 + 2]);
      if (sxA > 0.975) { FN[t * 3] = FN[t * 3] > 0 ? 1 : -1; FN[t * 3 + 1] = 0; FN[t * 3 + 2] = 0; } else if (syA > 0.975) { FN[t * 3] = 0; FN[t * 3 + 1] = FN[t * 3 + 1] > 0 ? 1 : -1; FN[t * 3 + 2] = 0; } else if (szA > 0.975) { FN[t * 3] = 0; FN[t * 3 + 1] = 0; FN[t * 3 + 2] = FN[t * 3 + 2] > 0 ? 1 : -1; }
    }
    var cnt = new Int32Array(nv + 1); for (k = 0; k < I.length; k++) cnt[I[k] + 1]++;
    for (k = 0; k < nv; k++) cnt[k + 1] += cnt[k];
    var adj = new Int32Array(I.length), fill = cnt.slice(0, nv); for (k = 0; k < I.length; k++) adj[fill[I[k]]++] = (k / 3) | 0;
    // 27/10 (Luigi): triangoli sottilissimi (2 x area < 5% del lato piu' lungo al quadrato): coi punti spostati di qualche
    // centesimo la loro normale non e' affidabile (righe che partono dagli angoli). Prendono la media, pesata sull'area,
    // delle facce attorno ai loro tre punti (se quasi dritta diventa dritta)
    var FT = FN.slice();
    for (t = 0; t < nt; t++) {
      var mE = 0; for (k = 0; k < 3; k++) { var i0 = I[t * 3 + k] * 3, i1 = I[t * 3 + (k + 1) % 3] * 3, ddx = P[i1] - P[i0], ddy = P[i1 + 1] - P[i0 + 1], ddz = P[i1 + 2] - P[i0 + 2]; mE = Math.max(mE, ddx * ddx + ddy * ddy + ddz * ddz); }
      if (FA[t] >= 0.05 * mE) continue;
      var rx = 0, ry = 0, rz = 0;
      for (k = 0; k < 3; k++) { var vv = I[t * 3 + k]; for (var q2 = cnt[vv]; q2 < cnt[vv + 1]; q2++) { var g = adj[q2]; rx += FN[g * 3] * FA[g]; ry += FN[g * 3 + 1] * FA[g]; rz += FN[g * 3 + 2] * FA[g]; } }
      var rl = Math.hypot(rx, ry, rz); if (!rl) continue;
      FT[t * 3] = rx / rl; FT[t * 3 + 1] = ry / rl; FT[t * 3 + 2] = rz / rl;
      var px = Math.abs(FT[t * 3]), py = Math.abs(FT[t * 3 + 1]), pz = Math.abs(FT[t * 3 + 2]);
      if (px > 0.975) { FT[t * 3] = FT[t * 3] > 0 ? 1 : -1; FT[t * 3 + 1] = 0; FT[t * 3 + 2] = 0; } else if (py > 0.975) { FT[t * 3] = 0; FT[t * 3 + 1] = FT[t * 3 + 1] > 0 ? 1 : -1; FT[t * 3 + 2] = 0; } else if (pz > 0.975) { FT[t * 3] = 0; FT[t * 3 + 1] = 0; FT[t * 3 + 2] = FT[t * 3 + 2] > 0 ? 1 : -1; }
    }
    FN.set(FT);
    var n3 = nt * 3, Pos = new Float32Array(n3 * 3), Nor = new Float32Array(n3 * 3), Idx = new Uint32Array(n3);
    for (t = 0; t < nt; t++) for (var j = 0; j < 3; j++) {
      var vi = I[t * 3 + j], o = (t * 3 + j) * 3, sx = 0, sy = 0, sz = 0;
      Pos[o] = P[vi * 3]; Pos[o + 1] = P[vi * 3 + 1]; Pos[o + 2] = P[vi * 3 + 2];
      for (k = cnt[vi]; k < cnt[vi + 1]; k++) { var f = adj[k]; if (FN[f * 3] * FN[t * 3] + FN[f * 3 + 1] * FN[t * 3 + 1] + FN[f * 3 + 2] * FN[t * 3 + 2] > 0.82) { var wA = FA[f] + 1e-9; sx += FN[f * 3] * wA; sy += FN[f * 3 + 1] * wA; sz += FN[f * 3 + 2] * wA; } }
      var L2 = Math.hypot(sx, sy, sz) || 1; Nor[o] = sx / L2; Nor[o + 1] = sy / L2; Nor[o + 2] = sz / L2; Idx[t * 3 + j] = t * 3 + j;
      var qx = Math.abs(Nor[o]), qy = Math.abs(Nor[o + 1]), qz = Math.abs(Nor[o + 2]);   // e la normale finale quasi dritta diventa dritta
      if (qx > 0.975) { Nor[o] = Nor[o] > 0 ? 1 : -1; Nor[o + 1] = 0; Nor[o + 2] = 0; } else if (qy > 0.975) { Nor[o] = 0; Nor[o + 1] = Nor[o + 1] > 0 ? 1 : -1; Nor[o + 2] = 0; } else if (qz > 0.975) { Nor[o] = 0; Nor[o + 1] = 0; Nor[o + 2] = Nor[o + 2] > 0 ? 1 : -1; }
    }
    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    var pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, Pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    var nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, Nor, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao: vao, count: n3, type: gl.UNSIGNED_INT, node: m4(), src: null, bufs: [pb, nb, ib] };
  }
  function freeMesh(gl, m) { if (!m || !m.bufs) return; gl.deleteVertexArray(m.vao); m.bufs.forEach(function (b) { gl.deleteBuffer(b); }); }

  function toScreen(v, p) {
    var VP = v.lastVP, c = v.c;
    var cx = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], cy = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], cw = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    return [(cx / cw * 0.5 + 0.5) * c.clientWidth, (1 - (cy / cw * 0.5 + 0.5)) * c.clientHeight];
  }

  /* ================================================================ Vista 3D del KEY BOOK */
  // luce del KEY BOOK: come gli altri configuratori ma con le ombre anche SUI pezzi (pagine sulla copertina, ripiani
  // della libreria, bordi degli incavi), luce piu' direzionale e bordi un po' piu' scuri: le forme si leggono meglio
  var FS_KB = '#version 300 es\nprecision highp float;\n' +
    'in vec3 vW; in vec3 vN; in vec3 vL; in vec3 vLN; out vec4 o;\n' +
    'uniform sampler2D uDecal; uniform float uDecalOn; uniform vec4 uDecalBox; uniform float uYOut; uniform float uShine;\n' +
    'uniform vec3 uColor; uniform float uRough; uniform float uAlpha; uniform vec3 uCam; uniform vec3 uKey; uniform vec3 uFill;\n' +
    'uniform highp sampler2DShadow uShadow; uniform mat4 uLVP; uniform float uTexel;\n' +
    'const vec2 P[8]=vec2[8](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),vec2(0.962,-0.195),vec2(0.473,-0.480),vec2(0.519,0.767),vec2(0.185,-0.893));\n' +
    'float shade(vec3 w,vec3 n,vec3 L){\n' +
    ' vec4 l=uLVP*vec4(w+n*0.25,1.0); vec3 p=l.xyz/l.w*0.5+0.5; if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0) return 1.0;\n' +
    ' p.z-=0.0004+0.0012*(1.0-abs(dot(n,L))); float s=0.0; for(int i=0;i<8;i++){ s+=texture(uShadow,vec3(p.xy+P[i]*1.6*uTexel,p.z)); } return s/8.0; }\n' +
    'void main(){\n' +
    ' vec3 n=normalize(vN); vec3 v=normalize(uCam-vW); if(dot(n,v)<0.0) n=-n;\n' +
    ' vec3 base=pow(uColor,vec3(2.2));\n' +
    ' if(uDecalOn>0.5 && vLN.y<-0.9 && vL.y<uYOut+0.06){ vec2 uv=(vec2(vL.x,vL.z)-uDecalBox.xy)/(uDecalBox.zw-uDecalBox.xy); if(uv.x>=0.0&&uv.x<=1.0&&uv.y>=0.0&&uv.y<=1.0){ vec4 d=texture(uDecal,uv); base=mix(base,pow(max(d.rgb/max(d.a,1e-4),vec3(0.0)),vec3(2.2)),d.a); if(uShine>-0.5){ float sb=(uv.x+uv.y)*0.5; base=mix(base,vec3(1.0),0.65*exp(-pow((sb-uShine)*7.0,2.0))); } } }\n' +
    ' float hz=n.z*0.5+0.5;\n' +
    ' vec3 amb=mix(vec3(0.22,0.21,0.21),vec3(0.80,0.85,0.95),hz)*0.47;\n' +
    ' float ao=mix(0.80,1.0,smoothstep(0.0,10.0,vW.z));\n' +
    ' vec3 L=normalize(-uKey); float nl=dot(n,L); float sh=shade(vW,n,L);\n' +
    ' vec3 key=vec3(1.0,0.96,0.90)*max(nl,0.0)*1.05*mix(0.32,1.0,sh);\n' +
    ' vec3 F=normalize(-uFill); vec3 fill=vec3(0.75,0.82,1.0)*max(dot(n,F),0.0)*0.26;\n' +
    ' float shin=mix(70.0,6.0,uRough);\n' +
    ' vec3 h=normalize(L+v); float sp=pow(max(dot(n,h),0.0),shin)*max(nl,0.0)*(1.0-uRough)*0.5*sh;\n' +
    ' float fr=pow(1.0-max(dot(n,v),0.0),5.0)*0.12*(1.0-0.6*uRough);\n' +
    ' vec3 c=base*(amb*ao*mix(0.7,1.0,sh)+key+fill)+vec3(sp+fr);\n' +
    ' c*=mix(0.82,1.0,smoothstep(0.0,0.45,max(dot(n,v),0.0)));\n' +   // bordi visti di taglio un po' piu' scuri
    ' c=c*(2.51*c+0.03)/(c*(2.43*c+0.59)+0.14);\n' +   // ACES (Narkowicz)
    ' vec3 g=pow(clamp(c,0.0,1.0),vec3(1.0/2.2));\n' +
    ' o=uAlpha<1.0 ? vec4(g*uAlpha,uAlpha) : vec4(g,1.0);\n' +   // 0.4: pezzi che svaniscono (alfa premoltiplicato)
    '}';
  // la scena e' una lista di pezzi { mesh: chiave, M: matrice, mat: materiale }, preparata dall'app
  function Viewer(canvas, gl, mats) {
    this.c = canvas; this.gl = gl; this.meshes = {}; this.scene = [];
    this.progMain = compile(gl, VS_MAIN, FS_KB);
    this.progDepth = compile(gl, VS_DEPTH, FS_DEPTH);
    this.progPick = compile(gl, VS_DEPTH, FS_PICK);
    this.progGround = compile(gl, VS_GROUND, FS_GROUND);
    this.materials = {};
    for (var k in mats) this.materials[k] = { col: hex2rgb(mats[k].color), target: null, rough: mats[k].rough != null ? mats[k].rough : 0.5, alpha: 1 };
    this.az = 200 * DEG; this.el = 38 * DEG; this.homeAz = this.az; this.homeEl = this.el; this.elMin = -85 * DEG;   // vista libera: si gira tutto attorno, anche da sotto
    this.fov = 30 * DEG; this.dist = 400; this.distT = 400; this.target = [0, 0, 0]; this.targetT = [0, 0, 0]; this.fitR = 80;
    this.vaz = 0; this.vel = 0; this.dirty = true;
    this.keyDir = norm([0.55, 0.45, -0.7]); this.fillDir = norm([-0.8, 0.5, -0.35]);
    this.anim = null; this.flip = 0; this.flipTo = 0; this.flipT0 = null;
    this.fold = 0; this.foldTo = 0; this.foldT0 = null; this.foldSpec = null;   // libro chiuso (0 aperto .. 1 chiuso)
    this.initShadow(); this.initGround();
    this.dummy = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.dummy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); gl.activeTexture(gl.TEXTURE0);
    this.time = performance.now() / 1000;
  }
  Viewer.prototype.initShadow = function () {
    var gl = this.gl, size = 2048;
    this.shSize = size;
    this.shTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  Viewer.prototype.initGround = function () {
    var gl = this.gl;
    this.gVao = gl.createVertexArray(); gl.bindVertexArray(this.gVao);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  };
  Viewer.prototype.flashMat = function (mat) { this.flash = { mat: mat, t0: this.time }; this.dirty = true; };
  Viewer.prototype.updateDist = function (reset) {
    var asp = this.c.width / Math.max(1, this.c.height);
    var fh = 2 * Math.atan(Math.tan(this.fov / 2) * asp);
    var d = this.fitR / Math.sin(Math.min(this.fov, fh) / 2) * 1.02;
    this.fitDist = d;
    if (reset) this.distT = d;
  };
  Viewer.prototype.setColor = function (mat, hex) {
    var m = this.materials[mat]; if (!m) return;
    m.from = m.col.slice(); m.target = hex2rgb(hex); m.ct0 = this.time; this.dirty = true;
  };
  Viewer.prototype.addMat = function (name, hex, rough) { this.materials[name] = { col: hex2rgb(hex), target: null, rough: rough != null ? rough : 0.45, alpha: 1 }; this.dirty = true; };
  Viewer.prototype.setRough = function (mat, r) { var m = this.materials[mat]; if (m && m.rough !== r) { m.rough = r; this.dirty = true; } };
  // mesh per chiave (una volta sola; la copertina cambia con il numero di pagine)
  Viewer.prototype.setMeshIdx = function (key, P, I) { freeMesh(this.gl, this.meshes[key]); this.meshes[key] = P && I && I.length ? meshFromIndexed(this.gl, P, I) : null; this.dirty = true; };
  Viewer.prototype.setMesh = function (key, tris) { freeMesh(this.gl, this.meshes[key]); this.meshes[key] = tris && tris.length ? meshFromTris(this.gl, tris) : null; this.dirty = true; };
  // nuova scena: i pezzi che restano si spostano piano, quelli nuovi entrano dall'alto
  Viewer.prototype.setScene = function (list, bbox, opt) {
    var old = {}, t = this.time; (this.scene || []).forEach(function (it) { old[it.id] = it; });
    var keep = {}; list.forEach(function (it) { keep[it.id] = 1; });
    // 0.4.1: se escono delle pagine, prima si sfilano e solo dopo il libro si richiude (la copertina non passa in mezzo alle pagine)
    var nGone = (this.scene || []).filter(function (o) { return !keep[o.id] && o.leaveTo; }).length, wait = nGone ? 0.055 * (nGone - 1) + 0.42 : 0;
    list.forEach(function (it, i) {
      var o = old[it.id];
      if (o && o.M) { it.from = o.cur || o.M; it.t0 = t + wait; it.dur = 0.45; }
      else if (it.enterFrom && (this.scene || []).length) { it.from = it.enterFrom; it.t0 = t + (it.delay || 0); it.dur = 0.42; it.fade = true; }   // pagina nuova: entra scorrendo
      else if (opt && opt.drop !== false && (this.scene || []).length) { it.from = mul(T(0, 0, 40), it.M); it.t0 = t + Math.min(0.4, i * 0.03); it.dur = 0.45; it.fade = true; }
    }, this);
    // pezzi tolti che hanno un'uscita (pagine): si sfilano invece di sparire di colpo
    this.leaving = (this.leaving || []).filter(function (lv) { return t < lv.t0 + lv.dur && !keep[lv.id]; });
    var gone = (this.scene || []).filter(function (o) { return !keep[o.id] && o.leaveTo; }).sort(function (a, b) { return (b.page || 0) - (a.page || 0); });
    gone.forEach(function (o, i) { this.leaving.push({ id: o.id, mesh: o.mesh, mat: o.mat, book: o.book, inside: o.inside, from: o.cur || o.M, to: o.leaveTo, t0: t + 0.055 * i, dur: 0.7, decal: o.cardOf ? o.decal : null }); }, this);   // 0.6.4: la foto disegnata svanisce con la sua immagine
    if (this.morph) this.morph.ready = true;
    this.scene = list; this.bbox = bbox;
    // 0.4.1: se escono delle pagine la camera si avvicina solo dopo (le pagine non escono dall'inquadratura)
    if (wait > 0 && !(opt && opt.reset)) this.frameAt = t + wait; else { this.frameAt = null; this.frame(!opt || opt.reset); }
    this.dirty = true;
  };
  Viewer.prototype.frame = function (reset) {
    var b = this.bbox; if (!b) return;
    this.targetT = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2 * 0.6];
    this.fitR = 0.5 * Math.hypot(b[1] - b[0], b[3] - b[2], b[5] - b[4]) * 1.0;
    this.updateDist(reset);
    if (reset) { this.target = this.targetT.slice(); this.dist = this.distT; }
  };
  Viewer.prototype.dims = function () { return null; };
  Viewer.prototype.update = function (t, dt) {
    var active = false;
    for (var k in this.materials) {
      var m = this.materials[k];
      if (m.target) {
        var p = clamp((t - m.ct0) / 0.3, 0, 1);
        m.col = [lerp(m.from[0], m.target[0], p), lerp(m.from[1], m.target[1], p), lerp(m.from[2], m.target[2], p)];
        if (p >= 1) m.target = null; active = true;
      }
    }
    if (this.flipT0 != null) {
      var fp = clamp((t - this.flipT0) / 0.8, 0, 1); this.flip = lerp(this.flipFrom, this.flipTo, easeInOutCubic(fp));
      if (fp >= 1) this.flipT0 = null; active = true;
    }
    if (this.foldT0 != null) {
      var fo = clamp((t - this.foldT0) / 0.9, 0, 1); this.fold = lerp(this.foldFrom, this.foldTo, easeInOutCubic(fo));
      if (fo >= 1) this.foldT0 = null; active = true;
    }
    (this.scene || []).forEach(function (it) { if (it.t0 != null) { if (t < it.t0 + it.dur) active = true; else { it.t0 = null; it.from = null; } } if (it.onAnim || it.drop) active = true; });   // onAnim: ancora un fotogramma per l'ultimo passo
    if (this.leaving && this.leaving.length) { this.leaving = this.leaving.filter(function (lv) { return t < lv.t0 + lv.dur; }); active = true; }
    if (this.morph) active = true;
    if (this.frameAt != null) { active = true; if (t >= this.frameAt) { this.frameAt = null; this.frame(false); this.distT = this.fitDist; } }
    if (this.flash) active = true;
    if (this.intro) {
      var ip = easeOutCubic((t - this.intro.t0) / 1.4);
      if (this.dragging || ip >= 1) this.intro = null;
      else { this.az = lerp(this.intro.a0, this.homeAz, ip); this.dist = this.distT * lerp(this.intro.d0, 1, ip); active = true; }
    }
    if (!this.dragging && (Math.abs(this.vaz) > 1e-4 || Math.abs(this.vel) > 1e-4)) {
      this.az += this.vaz; this.el = clamp(this.el + this.vel, this.elMin != null ? this.elMin : 3 * DEG, this.elMax || 85 * DEG);
      var damp = Math.pow(0.0025, dt); this.vaz *= damp; this.vel *= damp; active = true;
    }
    var kk = 1 - Math.pow(0.0008, dt);
    for (var i = 0; i < 3; i++) if (Math.abs(this.target[i] - this.targetT[i]) > 0.02) { this.target[i] += (this.targetT[i] - this.target[i]) * kk; active = true; }
    if (!this.intro && Math.abs(this.dist - this.distT) > 0.05) { this.dist += (this.distT - this.dist) * kk; active = true; }
    if (active) this.dirty = true;
    return active;
  };
  // matrice "a meta' strada" tra due pose (per le animazioni): si interpolano le colonne (pezzi rigidi, piccole rotazioni)
  function easeInCubic(x) { x = clamp(x, 0, 1); return x * x * x; }
  /* 0.6.4 (ALFI 30/10): la foto scende dall'alto, girata e un po' piu' grande, si appoggia nella tasca con un piccolo
     rimbalzo e poi un riflesso la attraversa. d = { t0, dur, H (altezza di partenza, mm) }; M = posa finale nel mondo. */
  function dropPose(d, q, M) {
    var c = xf3(M, [0, -1.975, 0]), fq = clamp(q / 0.55, 0, 1), e = easeOutCubic(fq), lift = (1 - e) * d.H;
    if (q > 0.55 && q < 0.7) lift += Math.sin(Math.PI * (q - 0.55) / 0.15) * Math.min(2.5, d.H * 0.03);
    var sc = 1 + (1 - e) * 0.15, X = mul(T(c[0], c[1], c[2] + lift), mul(RZ((1 - e) * -18 * DEG), mul(RX((1 - e) * 26 * DEG), mul(S(sc, sc, sc), T(-c[0], -c[1], -c[2])))));
    return { M: mul(X, M), shine: q >= 0.58 ? -0.35 + (q - 0.58) / 0.42 * 1.7 : null };
  }
  function lerpM(A, B, p) { var o = new Float32Array(16); for (var i = 0; i < 16; i++) o[i] = A[i] + (B[i] - A[i]) * p; return o; }
  // girare il libro per vedere la copertina (fuori): mezzo giro attorno all'asse Y, alzandolo un poco durante il giro
  Viewer.prototype.setFlip = function (on) { this.flipFrom = this.flip; this.flipTo = on ? 1 : 0; this.flipT0 = this.time; this.dirty = true; };
  Viewer.prototype.flipM = function () {
    var f = this.flip; if (f <= 0) return null;
    var th = this.coverThick || 3.6, lift = Math.sin(Math.PI * f) * 30 + th * f;
    return mul(T(0, 0, lift), mul(RY(Math.PI * f), T(0, 0, 0)));
  };
  /* chiudere il libro: la copertina si piega sulle due cerniere (assi lungo la larghezza, a meta' spessore):
     il dorso gira di 90 gradi attorno alla cerniera vicino alle pagine, il davanti di altri 90 attorno all'altra.
     Coordinate del file della copertina: x = larghezza, y = spessore (0 = fuori), z = lunghezza. Le pagine si allargano
     tutte uguali fino al davanti (niente spazio vuoto sopra). spec = { a, b, yc, pages: {id: spostamento in y} } */
  Viewer.prototype.setFold = function (on) { this.foldFrom = this.fold; this.foldTo = on ? 1 : 0; this.foldT0 = this.time; this.dirty = true; };
  function hingeRot(yc, zc, ang) {   // rotazione nel piano (y, z) attorno all'asse x che passa per (yc, zc)
    var c = Math.cos(ang), s = Math.sin(ang), M = new Float32Array([1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]);
    M[13] = yc - c * yc - s * zc; M[14] = zc + s * yc - c * zc; return M;
  }
  Viewer.prototype.foldX = function (it) {
    var f = this.fold, sp = this.foldSpec; if (!(f > 0) || !sp || !it.fold) return null;
    var ang = -Math.PI / 2 * f;
    if (it.fold === 'S') return hingeRot(sp.yc, sp.b, ang);
    if (it.fold === 'L') return mul(hingeRot(sp.yc, sp.b, ang), hingeRot(sp.yc, sp.a, ang));
    if (it.fold === 'P') { var dy = (sp.pages && sp.pages[it.id]) || 0; return dy ? T(0, dy * f, 0) : null; }
    return null;
  };
  /* 0.4 (ALFI 22/10): da VERTICAL a HORIZONTAL il libro si gira di un quarto sul tavolo (si alza un poco) e prende
     la forma nuova; la camera resta ferma. Il libro vecchio resta come "fantasma" (mesh staccate) finche' il nuovo e' pronto. */
  Viewer.prototype.startMorph = function (o) {
    if (this.morph) this.endMorph();
    var snap = this.items().map(function (it) { return { mesh: it.mesh, M: it.M, mat: it.mat, decal: null }; }), ghost = {};
    for (var k in this.meshes) if (k.indexOf(o.prefix || 'bh-') === 0) { ghost[k] = this.meshes[k]; delete this.meshes[k]; }
    var ob = o.oldBox, nb = o.newBox, wx = ob[1] - ob[0], wy = ob[3] - ob[2], Wx = nb[1] - nb[0], Wy = nb[3] - nb[2];
    this.morph = { items: snap, meshes: ghost, t0: this.time, dur: o.dur || 0.85, ang: o.ang * DEG, sx: Wx / Math.max(1e-3, wy), sy: Wy / Math.max(1e-3, wx), ready: false };
    this.leaving = []; this.dirty = true;
  };
  Viewer.prototype.endMorph = function () {
    var m = this.morph; if (!m) return; this.morph = null;
    for (var k in m.meshes) freeMesh(this.gl, m.meshes[k]);
    (this.scene || []).forEach(function (it) { it.t0 = null; it.from = null; });
    this.dirty = true;
  };
  Viewer.prototype.morphItems = function () {
    var m = this.morph, p = clamp((this.time - m.t0) / m.dur, 0, 1);
    if (p >= 1 && m.ready) { this.endMorph(); return null; }
    // la forma cambia negli assi del libro (prima la scala, poi il giro): niente libro storto a meta' giro
    var e = easeInOutCubic(p), lift = Math.sin(Math.PI * p) * 14, sx = 1 + (m.sy - 1) * e, sy = 1 + (m.sx - 1) * e;
    var X = mul(T(0, 0, lift), mul(RZ(m.ang * e), S(sx, sy, 1)));
    return m.items.map(function (it) { return { mesh: it.mesh, M: mul(X, it.M), mat: it.mat, decal: null }; });
  };
  Viewer.prototype.items = function () {
    var out = [], self = this, t = this.time, FM = this.flipM();
    if (this.morph) { var mi = this.morphItems(); if (mi) return mi; }
    (this.scene || []).forEach(function (it) {
      var moving = it.t0 != null && it.from, p = moving ? clamp((t - it.t0) / it.dur, 0, 1) : 1, ee = easeOutCubic(p);
      if (it.onAnim) { it.onAnim(moving ? ee : 1); if (!moving) it.onAnim = null; }   // 0.4.1: il dorso si riallunga insieme alla copertina (prima di prendere la mesh)
      var mesh = self.meshes[it.mesh]; if (!mesh) return;
      var M = it.M;
      if (moving) { if (p <= 0 && it.fade) return; M = lerpM(it.from, it.M, ee); }
      it.cur = M;
      var shine = null;
      if (it.drop) {   // 0.6.4: foto che scende nella tasca (prima del suo turno non si vede)
        var dq = (t - it.drop.t0) / it.drop.dur;
        if (dq < 0) return;
        if (dq >= 1) it.drop = null; else { var dr = dropPose(it.drop, dq, M); M = dr.M; shine = dr.shine; }
      }
      var FX = self.foldX(it); if (FX) M = mul(M, FX);
      if (FM && it.book) { if (it.inside && self.flip > 0.5 && self.hideInside !== false) return; M = mul(FM, M); }   // pagine nascoste solo col libro girato E aperto (BOOK HUB 0.3)
      out.push({ mesh: mesh, M: M, mat: it.mat, decal: it.decal || null, shine: shine });
    });
    (this.leaving || []).forEach(function (lv) {   // 0.4: pagine che escono una dopo l'altra: si sfilano dal lato aperto con un arco e svaniscono
      var mesh = self.meshes[lv.mesh]; if (!mesh) return; var p = clamp((t - lv.t0) / lv.dur, 0, 1); if (p >= 1) return;
      // 0.4.1: si sfila di lato dal lato aperto (come entra), senza passare attraverso la copertina; solo quando e' fuori
      // dal libro si alza un poco e svanisce
      var e = easeInOutCubic(p), lift = p > 0.7 ? easeOutCubic((p - 0.7) / 0.3) * 8 : 0, M = mul(T(0, 0, lift), lerpM(lv.from, lv.to, e));
      var a = p < 0.55 ? 1 : 1 - easeInCubic((p - 0.55) / 0.45);
      if (FM && lv.book) { if (lv.inside && self.flip > 0.5 && self.hideInside !== false) return; M = mul(FM, M); }
      out.push({ mesh: mesh, M: M, mat: lv.mat, alpha: a, decal: lv.decal || null });
    });
    return out;
  };
  Viewer.prototype.pick = function (cx, cy, mats) {
    var gl = this.gl, c = this.c; if (!this.lastVP) return null;
    var w = c.width, h = c.height;
    if (!this.pkFbo || this.pkW !== w || this.pkH !== h) {
      if (this.pkFbo) { gl.deleteFramebuffer(this.pkFbo); gl.deleteTexture(this.pkTex); gl.deleteRenderbuffer(this.pkDepth); }
      this.pkTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.pkTex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      this.pkDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.pkDepth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      this.pkFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.pkFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pkTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.pkDepth);
      this.pkW = w; this.pkH = h;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pkFbo); gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    var pp = this.progPick, self = this; gl.useProgram(pp.p); gl.uniformMatrix4fv(pp.u.uVP, false, this.lastVP);
    this.items().forEach(function (it) {
      var m = self.materials[it.mat]; if (m && m.alpha < 1) return;   // il vetro non si tocca
      var id = mats.indexOf(it.mat) + 1;
      gl.uniform4f(pp.u.uId, id / 255, 0, 0, 1); gl.uniformMatrix4fv(pp.u.uModel, false, it.M);
      gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
    });
    var px = new Uint8Array(4), r = c.getBoundingClientRect();
    var x = Math.round(cx * w / r.width), y = Math.round(h - 1 - cy * h / r.height);
    gl.readPixels(clamp(x, 0, w - 1), clamp(y, 0, h - 1), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null);
    this.dirty = true;
    return px[0] ? mats[px[0] - 1] || null : null;
  };
  // disegno: come il motore base, in piu' la mappa delle ombre passata anche ai pezzi
  Viewer.prototype.draw = function () {
    var gl = this.gl, c = this.c;
    var all = this.items(), self0 = this, items = [], glass = [];
    var fading = [];
    all.forEach(function (it) { var m = self0.materials[it.mat]; if (it.alpha != null && it.alpha < 1) { if (it.alpha > 0.01) fading.push(it); return; } (m && m.alpha < 1 ? glass : items).push(it); });
    var KD = this.el < 0 ? [this.keyDir[0], this.keyDir[1], -this.keyDir[2]] : this.keyDir, FD = this.el < 0 ? [this.fillDir[0], this.fillDir[1], -this.fillDir[2]] : this.fillDir;   // camera (vista da sotto: le luci vengono da sotto)
    var ce = Math.cos(this.el), eye = [this.target[0] + this.dist * ce * Math.sin(this.az), this.target[1] + this.dist * ce * Math.cos(this.az), this.target[2] + this.dist * Math.sin(this.el)];
    var V = lookAt(eye, this.target, [0, 0, 1]);
    var P = persp(this.fov, c.width / Math.max(1, c.height), Math.max(5, this.dist * 0.05), this.dist * 6);
    var VP = mul(P, V); this.lastVP = VP; this.lastEye = eye;
    // luce (ortografica attorno alla scena)
    var R = (this.fitR || 150) * 1.35, ctr = [this.targetT[0], this.targetT[1], 0];
    var le = [ctr[0] - KD[0] * R * 3, ctr[1] - KD[1] * R * 3, ctr[2] - KD[2] * R * 3];
    var LV = lookAt(le, ctr, [0, 1, 0]);
    var LVP = mul(ortho(-R, R, -R, R, R * 0.5, R * 6), LV);

    // 1) ombre
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFbo);
    gl.viewport(0, 0, this.shSize, this.shSize);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    var pd = this.progDepth; gl.useProgram(pd.p); gl.uniformMatrix4fv(pd.u.uVP, false, LVP);
    items.concat(fading.filter(function (it) { return it.alpha > 0.45; })).forEach(function (it) {
      if (self0.materials[it.mat] && self0.materials[it.mat].noShadow) return;
      gl.uniformMatrix4fv(pd.u.uModel, false, it.M); gl.bindVertexArray(it.mesh.vao);
      gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // 2) scena
    gl.viewport(0, 0, c.width, c.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    var pm = this.progMain, self = this; gl.useProgram(pm.p);
    var fl = null;
    if (this.flash) { var fp = (this.time - this.flash.t0) / 0.9; if (fp >= 1) this.flash = null; else fl = { mat: this.flash.mat, k: 0.55 * Math.pow(Math.sin(Math.PI * fp * 2), 2) * (1 - fp * 0.5) }; }
    gl.uniformMatrix4fv(pm.u.uVP, false, VP); gl.uniform3fv(pm.u.uCam, eye);
    gl.uniform3fv(pm.u.uKey, KD); gl.uniform3fv(pm.u.uFill, FD);
    gl.uniformMatrix4fv(pm.u.uLVP, false, LVP); gl.uniform1f(pm.u.uTexel, 1 / this.shSize);   // ombre anche sui pezzi
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shTex); gl.uniform1i(pm.u.uShadow, 0);
    if (pm.u.uDecal) gl.uniform1i(pm.u.uDecal, 1); if (pm.u.uYOut) gl.uniform1f(pm.u.uYOut, this.yOut != null ? this.yOut : -2.1);
    items.forEach(function (it) {
      var dc = it.decal && it.decal.tex ? it.decal : null;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dc ? dc.tex : self.dummy); gl.activeTexture(gl.TEXTURE0);
      if (pm.u.uDecalOn) gl.uniform1f(pm.u.uDecalOn, dc ? 1 : 0); if (dc && pm.u.uDecalBox) gl.uniform4fv(pm.u.uDecalBox, dc.box);
      if (pm.u.uShine) gl.uniform1f(pm.u.uShine, it.shine != null ? it.shine : -1);
      var det = it.M[0] * (it.M[5] * it.M[10] - it.M[6] * it.M[9]) - it.M[4] * (it.M[1] * it.M[10] - it.M[2] * it.M[9]) + it.M[8] * (it.M[1] * it.M[6] - it.M[2] * it.M[5]);
      gl.frontFace(det < 0 ? gl.CW : gl.CCW);
      var m = self.materials[it.mat] || { col: [0.7, 0.7, 0.7], rough: 0.5 }, col = m.col;
      if (fl && it.mat === fl.mat) { var fk = fl.k; col = [lerp(col[0], 1, fk), lerp(col[1], 1, fk), lerp(col[2], 1, fk)]; }
      gl.uniformMatrix4fv(pm.u.uModel, false, it.M); gl.uniformMatrix3fv(pm.u.uNM, false, normalMat(it.M));
      gl.uniform3fv(pm.u.uColor, col); gl.uniform1f(pm.u.uRough, m.rough); gl.uniform1f(pm.u.uAlpha, 1);
      gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
    });
    gl.frontFace(gl.CCW);

    // 3) pavimento con ombra morbida (trasparente)
    gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    var pg = this.progGround; gl.useProgram(pg.p);
    gl.uniformMatrix4fv(pg.u.uVP, false, VP); gl.uniformMatrix4fv(pg.u.uLVP, false, LVP);
    gl.uniform3fv(pg.u.uCenter, ctr); gl.uniform1f(pg.u.uSize, R); gl.uniform1f(pg.u.uFade, R * 0.95);
    gl.uniform1f(pg.u.uTexel, 1 / this.shSize);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shTex); gl.uniform1i(pg.u.uShadow, 0);
    gl.bindVertexArray(this.gVao); if (this.el > DEG) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);   // da sotto il piano niente pavimento
    // 3b) pezzi che svaniscono (pagine tolte): alfa premoltiplicato, senza scrivere la profondita'
    if (fading.length) {
      gl.useProgram(pm.p); gl.enable(gl.CULL_FACE); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (pm.u.uDecalOn) gl.uniform1f(pm.u.uDecalOn, 0); if (pm.u.uShine) gl.uniform1f(pm.u.uShine, -1);
      fading.forEach(function (it) {
        var dc2 = it.decal && it.decal.tex ? it.decal : null;   // 0.6.4: la foto disegnata che se ne va resta disegnata
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dc2 ? dc2.tex : self.dummy); gl.activeTexture(gl.TEXTURE0);
        if (pm.u.uDecalOn) gl.uniform1f(pm.u.uDecalOn, dc2 ? 1 : 0); if (dc2 && pm.u.uDecalBox) gl.uniform4fv(pm.u.uDecalBox, dc2.box);
        var m = self.materials[it.mat] || { col: [0.7, 0.7, 0.7], rough: 0.5 };
        var det = it.M[0] * (it.M[5] * it.M[10] - it.M[6] * it.M[9]) - it.M[4] * (it.M[1] * it.M[10] - it.M[2] * it.M[9]) + it.M[8] * (it.M[1] * it.M[6] - it.M[2] * it.M[5]);
        gl.frontFace(det < 0 ? gl.CW : gl.CCW);
        gl.uniformMatrix4fv(pm.u.uModel, false, it.M); gl.uniformMatrix3fv(pm.u.uNM, false, normalMat(it.M));
        gl.uniform3fv(pm.u.uColor, m.col); gl.uniform1f(pm.u.uRough, m.rough); gl.uniform1f(pm.u.uAlpha, it.alpha);
        gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
      });
      gl.frontFace(gl.CCW); gl.disable(gl.CULL_FACE);
      if (pm.u.uDecalOn) gl.uniform1f(pm.u.uDecalOn, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, self.dummy); gl.activeTexture(gl.TEXTURE0);
    }
    // 4) parti trasparenti (toploader), dalla piu' lontana alla piu' vicina
    if (glass.length) {
      glass.forEach(function (it) { var dx = it.M[12] - eye[0], dy = it.M[13] - eye[1], dz = it.M[14] - eye[2]; it.d = dx * dx + dy * dy + dz * dz; });
      glass.sort(function (a, b) { return b.d - a.d; });
      gl.useProgram(pm.p);
      glass.forEach(function (it) {
        var m = self.materials[it.mat];
        gl.uniformMatrix4fv(pm.u.uModel, false, it.M); gl.uniformMatrix3fv(pm.u.uNM, false, normalMat(it.M));
        gl.uniform3fv(pm.u.uColor, m.col); gl.uniform1f(pm.u.uRough, m.rough); gl.uniform1f(pm.u.uAlpha, m.alpha);
        gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
      });
    }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
    this.dirty = false;
  };
  Viewer.prototype.bindInput = function (onFirst) {
    var c = this.c, self = this, pts = {}, last = null, pinch = 0, firstDone = false;
    function first() { if (!firstDone) { firstDone = true; onFirst && onFirst(); } }
    var tap = null, grab = null;
    function magGrab(e) {
      var m = self.boxMag; if (!m || m.fixed || !m.M || self.time < m.t0 + m.dur) return null;
      var r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      var mats = m.opt.magnet.parts.map(function (q) { return q.material; });
      if (!self.pick(x, y, mats)) return null;
      var sc = toScreen(self, [m.M[12], m.M[13], m.M[14]]), cx = sc[0] + r.left, cy = sc[1] + r.top;
      var d = Math.hypot(e.clientX - cx, e.clientY - cy);
      return { cx: cx, cy: cy, last: d > 10 ? Math.atan2(e.clientY - cy, e.clientX - cx) : null };
    }
    c.addEventListener('pointerdown', function (e) {
      tap = Object.keys(pts).length ? null : { x: e.clientX, y: e.clientY, t: performance.now(), d: 0 };
      grab = Object.keys(pts).length ? null : magGrab(e);
      if (grab) tap = null;
      c.setPointerCapture(e.pointerId); pts[e.pointerId] = [e.clientX, e.clientY];
      self.dragging = true; self.vaz = self.vel = 0; self._rv = (self._rv || 0) + 1; last = [e.clientX, e.clientY, performance.now()];
      var ids = Object.keys(pts); if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    c.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      var prev = pts[e.pointerId]; pts[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(pts);
      if (tap) { tap.d = Math.max(tap.d, Math.hypot(e.clientX - tap.x, e.clientY - tap.y)); if (ids.length > 1 || tap.d > 8) tap = null; }
      if (tap) return;   // ancora fermo: potrebbe essere un tocco
      if (grab && ids.length === 1 && self.boxMag) {
        // ruota come una manopola attorno al foro: il punto preso segue il dito/mouse per tutti i 360 gradi
        // (angolo sommato a piccoli passi: niente salti a meta' giro; vicino al centro si aspetta)
        var gx = e.clientX - grab.cx, gy = e.clientY - grab.cy;
        if (Math.hypot(gx, gy) > 10) {
          var an = Math.atan2(gy, gx);
          if (grab.last != null) { var da = an - grab.last; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; self.boxMag.rot = (self.boxMag.rot || 0) - da / DEG; }   // rot che cresce = antiorario sullo schermo, quindi meno
          grab.last = an; self.dirty = true;
        }
        first(); return;
      }
      if (ids.length === 1) {
        var dx = e.clientX - prev[0], dy = e.clientY - prev[1], k = 0.007;
        self.az += dx * k; self.el = clamp(self.el + dy * k, self.elMin != null ? self.elMin : 3 * DEG, self.elMax || 85 * DEG);
        self.vaz = dx * k * 0.9; self.vel = dy * k * 0.9; self.dirty = true; first();
      } else if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) { self.distT = clamp(self.distT * pinch / d, self.fitDist * 0.35, self.fitDist * 2.2); self.dist = self.distT; }
        pinch = d; self.vaz = self.vel = 0; self.dirty = true; first();
      }
    });
    function up(e) {
      delete pts[e.pointerId]; var ids = Object.keys(pts);
      if (tap && ids.length === 0 && e.type === 'pointerup' && performance.now() - tap.t < 500 && self.onTap) {
        var r = c.getBoundingClientRect(); self.onTap(e.clientX - r.left, e.clientY - r.top);
      }
      if (ids.length === 0) { tap = null; grab = null; }
      if (ids.length === 0) self.dragging = false; pinch = 0;
      if (ids.length === 1) { self.vaz = self.vel = 0; }
    }
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', function (e) {
      e.preventDefault(); self.distT = clamp(self.distT * Math.exp(e.deltaY * 0.0012), self.fitDist * 0.35, self.fitDist * 2.2); self.dirty = true; first();
    }, { passive: false });
    c.addEventListener('dblclick', function () { self.resetView(); });
  };
  Viewer.prototype.resetView = function () {
    var self = this, a0 = this.az, e0 = this.el, t0 = performance.now(), id = this._rv = (this._rv || 0) + 1;   // un solo ritorno alla volta
    var a1 = this.homeAz + Math.round((a0 - this.homeAz) / (2 * Math.PI)) * 2 * Math.PI;
    this.vaz = this.vel = 0; this.distT = this.fitDist;
    (function step() {
      var p = easeOutCubic((performance.now() - t0) / 500); if (self._rv !== id) return;   // fermato (nuovo ritorno o trascinamento)
      self.az = lerp(a0, a1, p); self.el = lerp(e0, self.homeEl, p); self.dirty = true;
      if (p < 1) requestAnimationFrame(step);
    })();
  };


  /* ==========================================================================
     STANDARD COMUNE DEI CONFIGURATORI AF (shared/cfg_std.js)
     Incluso uguale in tutti i configuratori (Magnet Maker, KEY BOOK, poi Card Hub), cosi' tasti, gesti e testi
     sono gli stessi dappertutto. Regole decise con ALFI (11/10/2026):
     - immagini e testi si sistemano nel riquadro 2D visto dall'alto: tocco = scegli, trascina = sposta,
       pallino all'angolo = grandezza, pallino in alto = rotazione, due dita = tutte e due;
     - sotto il riquadro sempre la stessa barra: [- Grandezza +] [ruota sx  gradi  ruota dx] [Centra] [Elimina];
       i tasti - e + fanno passi piccoli (1 alla volta) e tenendoli premuti vanno avanti da soli, sempre piu' veloci;
     - la rotazione si aggancia a 0, 90, 180, 270 (entro 6 gradi) e a 45, 135, 225, 315 (entro 4 gradi);
     - nel riquadro le righe di centro (orizzontale e verticale) si vedono sempre leggere; spostando vicino a una riga
       ci si aggancia e la riga diventa colorata;
     - in alto a sinistra Annulla / Ripeti / Salva, in fondo nome del file e Download / Compra;
     - vista 3D libera a 360 gradi (anche da sotto); in alto a destra il tasto del retro e sotto "Reset vista".
     ========================================================================== */
  var STD = (function () {
    var DEG = Math.PI / 180;
    var T = {
      size: 'Kích cỡ', rot: 'Xoay', smaller: 'Thu nhỏ', bigger: 'Phóng to', rotL: 'Xoay trái', rotR: 'Xoay phải',
      center: 'Vào giữa', del: 'Xóa', centerTip: 'Căn vào chính giữa bìa', delTip: 'Xóa chi tiết này',
      hint: 'Chạm vào chữ hoặc ảnh để chọn. Kéo để di chuyển, kéo chấm góc để chỉnh kích cỡ, chấm đỉnh để xoay (hoặc dùng 2 ngón tay). Đường đứt nét thể hiện tâm giữa.',
      badImg: 'Không đọc được ảnh: hãy thử ảnh PNG hoặc JPG.', upload: 'Tải ảnh lên', undo: 'Hoàn tác', redo: 'Làm lại', save: 'Lưu mẫu', back: 'Xem mặt sau', front: 'Xem mặt trước', home: 'Đặt lại góc nhìn'
    };
    var ICO = {
      minus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
      plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
      rotL: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M5.5 9.5A7.5 7.5 0 1 1 6 16.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 4.5v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      rotR: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M18.5 9.5A7.5 7.5 0 1 0 18 16.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 4.5v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      center: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.4 2.2"/><rect x="7.5" y="7.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
      home: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.6l3.8 2.1v4.6L12 16.4l-3.8-2.1V9.7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
      del: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
    function normRot(a) { a = ((a % 360) + 540) % 360 - 180; return a === -180 ? 180 : a; }
    // rotazione con gli scatti standard (mentre si trascina il pallino o si gira con due dita)
    function snapRot(a) {
      a = normRot(a); var s90 = Math.round(a / 90) * 90, s45 = Math.round(a / 45) * 45;
      if (Math.abs(a - s90) <= 6) return normRot(s90);
      if (Math.abs(a - s45) <= 4) return normRot(s45);
      return Math.round(a);
    }
    // tasto che, tenuto premuto, ripete: dopo 0,4 s ogni 70 ms, dopo 1,5 s fa passi da 5
    function holdButton(b, fn) {
      var t0 = null, rep = null, start = 0;
      function stop() { clearTimeout(t0); clearInterval(rep); t0 = rep = null; }
      b.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); stop(); fn(1); start = Date.now();
        t0 = setTimeout(function () { rep = setInterval(function () { fn(Date.now() - start > 1500 ? 5 : 1); }, 70); }, 400);
      });
      ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(function (ev) { b.addEventListener(ev, stop); });
      b.addEventListener('click', function (e) { if (e.detail === 0) fn(1); });   // (tastiera / lettori di schermo)
      return b;
    }
    /* barra standard sotto il riquadro 2D. o = {
         size: { get(), set(v), step, min, max, fmt(v) },   rot: { get(), set(v), step (1) },
         onCenter(), onDelete(), onChange(live) }  -> { el, sync(), enable(bool) }   (onChange dopo ogni tocco) */
    function toolbar(o) {
      var bar = el('div', 'afs-bar');
      bar.innerHTML =
        '<div class="afs-tool afs-tsize"><span class="afs-tlab">' + esc(T.size) + '</span><div class="afs-tbtns"><button type="button" class="afs-b" data-a="s-" aria-label="' + esc(T.smaller) + '">' + ICO.minus + '</button><b class="afs-tval" data-v="s"></b><button type="button" class="afs-b" data-a="s+" aria-label="' + esc(T.bigger) + '">' + ICO.plus + '</button></div></div>' +
        '<div class="afs-tool afs-trot"><span class="afs-tlab">' + esc(T.rot) + '</span><div class="afs-tbtns"><button type="button" class="afs-b" data-a="r-" aria-label="' + esc(T.rotL) + '">' + ICO.rotL + '</button><b class="afs-tval" data-v="r"></b><button type="button" class="afs-b" data-a="r+" aria-label="' + esc(T.rotR) + '">' + ICO.rotR + '</button></div></div>' +
        '<div class="afs-acts"><button type="button" class="afs-act" data-a="c" title="' + esc(T.centerTip) + '">' + ICO.center + '<span>' + esc(T.center) + '</span></button><button type="button" class="afs-act afs-del" data-a="d" title="' + esc(T.delTip) + '">' + ICO.del + '<span>' + esc(T.del) + '</span></button></div>';
      var vs = bar.querySelector('[data-v="s"]'), vr = bar.querySelector('[data-v="r"]'), on = true;
      function sync() {
        vs.textContent = on && o.size ? o.size.fmt(o.size.get()) : '–';
        vr.textContent = on && o.rot ? normRot(Math.round(o.rot.get())) + '°' : '–';
      }
      function act(a, mul) {
        if (!on) return;
        if (a === 's-' || a === 's+') {
          var S = o.size, st = (S.step || 1) * mul, v = S.get() + (a === 's+' ? st : -st);
          v = Math.round(v / (S.step || 1)) * (S.step || 1); S.set(Math.max(S.min, Math.min(S.max, v)));
        } else if (a === 'r-' || a === 'r+') {
          var R = o.rot, rs = (R.step || 1) * mul; R.set(normRot(Math.round(R.get()) + (a === 'r+' ? rs : -rs)));
        }
        sync(); o.onChange && o.onChange(true);
      }
      [].forEach.call(bar.querySelectorAll('.afs-b'), function (b) { holdButton(b, function (mul) { act(b.dataset.a, mul); }); });
      [].forEach.call(bar.querySelectorAll('.afs-act'), function (b) {
        b.addEventListener('click', function () { if (!on) return; if (b.dataset.a === 'c') { o.onCenter && o.onCenter(); } else { o.onDelete && o.onDelete(); } sync(); o.onChange && o.onChange(false); });
      });
      if (!o.size) bar.querySelector('.afs-tsize').hidden = true;
      if (!o.onDelete) bar.querySelector('.afs-del').hidden = true;
      sync();
      return { el: bar, sync: sync, enable: function (v) { on = !!v; bar.classList.toggle('afs-off', !on); [].forEach.call(bar.querySelectorAll('button'), function (b) { b.disabled = !on; }); sync(); },
        showDelete: function (v) { bar.querySelector('.afs-del').hidden = !v; } };
    }
    // aggancio alle righe di centro: v vicino (entro tol) a una delle righe -> la riga (e quale), altrimenti v
    function snapTo(v, lines, tol) {
      var best = null, bd = tol;
      (lines || []).forEach(function (L) { var d = Math.abs(v - L); if (d <= bd) { bd = d; best = L; } });
      return best == null ? { v: v, hit: null } : { v: best, hit: best };
    }
    /* righe di centro nel riquadro (coordinate dello schermo del canvas): sempre leggere, colorate quando agganciate.
       g = canvas 2D, vx = [x...] righe verticali, hy = [y...] orizzontali, area = [x0, y0, x1, y1], hit = {x, y} */
    function drawGuides(g, vx, hy, area, hit, dark, px) {
      px = px || 1; g.save(); g.lineWidth = px;
      function col(on) { return on ? '#ff2d78' : (dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.16)'); }
      (vx || []).forEach(function (x) { var on = hit && hit.x != null && Math.abs(hit.x - x) < 0.5 * px; g.strokeStyle = col(on); g.setLineDash(on ? [4 * px, 3 * px] : [3 * px, 4 * px]); g.beginPath(); g.moveTo(x, area[1]); g.lineTo(x, area[3]); g.stroke(); });
      (hy || []).forEach(function (y) { var on = hit && hit.y != null && Math.abs(hit.y - y) < 0.5 * px; g.strokeStyle = col(on); g.setLineDash(on ? [4 * px, 3 * px] : [3 * px, 4 * px]); g.beginPath(); g.moveTo(area[0], y); g.lineTo(area[2], y); g.stroke(); });
      g.restore();
    }
    // tasto "Reset vista" sulla vista 3D: sempre nello stesso punto (in alto a destra, sotto il tasto del retro)
    function homeButton(onClick) {
      var b = el('button', 'afs-home'); b.type = 'button'; b.title = T.home; b.setAttribute('aria-label', T.home);
      b.innerHTML = ICO.home + '<span>' + esc(T.home) + '</span>'; b.addEventListener('click', onClick); return b;
    }
    /* progetti salvati SOLO sul dispositivo del cliente (IndexedDB), mai sul sito: { where, max, list(slug), get(id), put(meta, state), remove(id) }
       (stesso formato del Magnet Maker: "meta" per la lista, "data" con la configurazione completa) */
    var stores = {};
    function deviceStore(dbName, max) {
      if (stores[dbName]) return stores[dbName];
      var dbp = null;
      function db() {
        if (!dbp) {
          dbp = new Promise(function (ok, ko) {
            try {
              var r = indexedDB.open(dbName, 1);
              r.onupgradeneeded = function () { var d = r.result; if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' }); if (!d.objectStoreNames.contains('data')) d.createObjectStore('data', { keyPath: 'id' }); };
              r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ko(r.error); }; r.onblocked = function () { ko(new Error('blocked')); };
            } catch (e) { ko(e); }
          });
          dbp.catch(function () { dbp = null; });
        }
        return dbp;
      }
      function run(names, mode, fn) {
        return db().then(function (d) {
          return new Promise(function (ok, ko) {
            var t = d.transaction(names, mode), out = {}; fn(t, out);
            t.oncomplete = function () { ok(out.v); }; t.onerror = function () { ko(t.error); }; t.onabort = function () { ko(t.error || new Error('abort')); };
          });
        });
      }
      return (stores[dbName] = { where: 'device', max: max || 30,
        list: function (slug) { return run(['meta'], 'readonly', function (t, o) { var r = t.objectStore('meta').getAll(); r.onsuccess = function () { o.v = r.result; }; }).then(function (a) { return (a || []).filter(function (m) { return !slug || m.slug === slug; }); }); },
        get: function (id) { return run(['meta', 'data'], 'readonly', function (t, o) { o.v = {}; var a = t.objectStore('meta').get(id), b = t.objectStore('data').get(id); a.onsuccess = function () { o.v.meta = a.result; }; b.onsuccess = function () { o.v.state = b.result && b.result.state; }; }); },
        put: function (meta, state) { return run(['meta', 'data'], 'readwrite', function (t) { t.objectStore('meta').put(meta); t.objectStore('data').put({ id: meta.id, state: state }); }); },
        remove: function (id) { return run(['meta', 'data'], 'readwrite', function (t) { t.objectStore('meta').delete(id); t.objectStore('data').delete(id); }); }
      });
    }
    // nome del file scelto dal cliente: via solo i caratteri che non vanno nei nomi dei file
    function cleanName(v, ext) { var s2 = String(v || '').replace(/[\u0000-\u001f<>:"\/\\|?*&]+/g, ' '); if (ext) s2 = s2.replace(new RegExp('\\.' + ext + '$', 'i'), ''); return s2.replace(/\s+/g, ' ').trim().slice(0, 60); }
    function newId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function uniqName(name, L, skipId) {
      var taken = {}; L.forEach(function (m) { if (m.id !== skipId) taken[String(m.name).toLowerCase()] = 1; });
      if (!taken[name.toLowerCase()]) return name;
      var mt = name.match(/^(.*\S)\s+(\d{1,3})$/), base = mt ? mt[1] : name, i0 = mt ? +mt[2] + 1 : 2;
      for (var i = i0; i < 999; i++) { var n = cleanName(base.slice(0, 54) + ' ' + i); if (!taken[n.toLowerCase()]) return n; }
      return name;
    }
    function fmtDate(t) { try { return new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
    return { T: T, ICO: ICO, homeButton: homeButton, deviceStore: deviceStore, cleanName: cleanName, newId: newId, uniqName: uniqName, fmtDate: fmtDate, DEG: DEG, normRot: normRot, snapRot: snapRot, holdButton: holdButton, toolbar: toolbar, snapTo: snapTo, drawGuides: drawGuides };
  })();



  /* ===================================================================== UI */
  var ICON_X = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var ICON_RESET = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 3.5v4.4h4.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_ROT = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 2.5v4.2h-4.2M6 21.5v-4.2h4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_BOOK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>';
  var ICON_FLIP = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3v18" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2.4"/><path d="M9 6L3.5 17.5H9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M15 6l5.5 11.5H15z" fill="currentColor"/></svg>';
  var ICO_T = '<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  var ICO_PEN = '<path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M13.5 7l3.5 3.5" stroke="currentColor" stroke-width="1.9"/>';
  var ICO_IMG = '<rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M5 18l5-5 3 3 2.5-2.5L20 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>';
  var ICO_VERT = '<rect x="6.5" y="3" width="11" height="18" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 3v18" stroke="currentColor" stroke-width="3"/><rect x="9.5" y="6" width="5.5" height="8" rx=".6" fill="currentColor" opacity=".35"/>';
  var ICO_HORZ = '<rect x="3" y="6.5" width="18" height="12" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 6.5h18" stroke="currentColor" stroke-width="3"/><circle cx="8" cy="4" r="1" fill="currentColor"/><circle cx="16" cy="4" r="1" fill="currentColor"/><rect x="9.5" y="9" width="5" height="7.5" rx=".6" fill="currentColor" opacity=".35"/>';
  var ICO_BLANK = '<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>';
  var ICO_PHOTO = '<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="8" y="6.5" width="8" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 1.6"/><path d="M9 16l2.2-2.6 1.6 1.6 1.3-1.3L15.2 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>';
  var ICO_SNAP = '<path d="M4 12h6M14 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 5v3M12 16v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
  var ICO_FIL = '<path d="M4 12h16" stroke="currentColor" stroke-width="1.4" stroke-dasharray="1.6 1.4"/><rect x="5" y="9" width="5" height="6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="9" width="5" height="6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 12h19" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/>';
  var ICO_PIP = '<rect x="2.5" y="8" width="7" height="8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14.5" y="8" width="7" height="8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 12h5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
  var ICO_NAIL = '<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="11" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8.4V5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  var CHEV = '<svg class="afm-chev" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var TM_FONT_P = {};
  function loadFonts(list) {
    var need = list.filter(function (f) { return f && f.google && !TM_FONT_P[f.id]; });
    if (need.length) {
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?' + need.map(function (f) { return 'family=' + f.google; }).join('&') + '&display=swap';
      var linkP = new Promise(function (res) { l.onload = res; l.onerror = res; setTimeout(res, 4000); });
      need.forEach(function (f) {
        TM_FONT_P[f.id] = linkP.then(function () {
          if (!document.fonts) return;
          return Promise.race([document.fonts.load(f.css.replace(/\d+px/, '100px')), new Promise(function (r) { setTimeout(r, 4000); })]);
        }).then(function () {}, function () {});
      });
      document.head.appendChild(l);
    }
    return Promise.all(list.map(function (f) { return (f && TM_FONT_P[f.id]) || Promise.resolve(); }));
  }
  function customSwatch(getHex, onPick) {
    var cb = el('label', 'afc-swatch afc-swatch-custom'); cb.dataset.id = 'custom'; cb.title = 'Màu tùy chọn';
    var inp = el('input'); inp.type = 'color'; inp.setAttribute('aria-label', 'Màu tùy chọn'); inp.value = getHex();
    inp.addEventListener('focus', function () { inp.value = getHex(); });
    var pick = function () { onPick('c:' + inp.value); };
    inp.addEventListener('input', pick); inp.addEventListener('change', pick);
    cb.appendChild(inp); return cb;
  }
  function paintCustom(cb, id) {
    var on = !!id && id.indexOf('c:') === 0; cb.classList.toggle('afc-on', on); cb.classList.toggle('afc-set', on);
    if (on) cb.style.setProperty('--sw', id.slice(2));
  }

  // testi (inglese, come il sito); la config puo' cambiarli con "text": {...}
  var TX = {
    sub: 'Tùy biến album sách ảnh 3D đa màu (Bambu Lab AMS)', hintTouch: 'Vuốt để xoay 3D · Chụm ngón tay để thu phóng', hintMouse: 'Kéo chuột để xoay 3D · Cuộn chuột để thu phóng', loadFail: 'Không thể tải mô hình sách. Vui lòng thử lại.', loading: 'Đang tải dữ liệu 3D…',
    stepDir: 'Hướng mở sách', helpDir: 'Chọn hướng mở sách theo chiều dọc hoặc chiều ngang.', dirV: 'Dọc (Cuốn sách)', dirVs: 'Mở sang bên như quyển sách', dirH: 'Ngang (Sổ tay)', dirHs: 'Mở lật lên trên như sổ tay',
    stepPhoto: 'Khổ ảnh', helpPhoto: 'Chọn khổ ảnh lồng vào album (mỗi trang chứa 1 khung ảnh).',
    stepPages: 'Số trang', helpPages: 'Số lượng trang ruột (mỗi trang chứa 1 khung ảnh).',
    stepCover: 'Kiểu bìa & Bản lề', helpCover: 'Cấu hình bìa trước và cơ chế liên kết bản lề.', frontLabel: 'Bìa trước', frontBlank: 'Bìa trơn', frontBlankS: 'Mặt phẳng trơn, thích hợp khắc chữ', frontPhoto: 'Khung ảnh bìa', frontPhotoS: 'Có thêm 1 khung ảnh ở mặt trước',
    hingeLabel: 'Bản lề', hingePip: 'In liền (Print-in-place)', hingePipS: 'In liền nguyên khối không cần lắp ráp', hingeSnap: 'Khớp cài (Snap-fit)', hingeSnapS: 'In rời, ghép nối bằng tay chắc chắn', hingeFil: 'Chốt sợi nhựa (Filament)', hingeFilS: 'In rời, luồn đoạn sợi nhựa 1.75 mm làm trục xoay',
    hingeNotePip: 'Toàn bộ bìa in liền một lần, sẵn sàng sử dụng ngay.', hingeNote: 'Bìa gồm 3 phần (bìa sau, gáy, bìa trước), in rời và ghép nối dễ dàng.',
    hingeNoteFil: 'Bìa in rời 3 phần: chỉ cần luồn 1 đoạn sợi nhựa 1.75 mm qua bản lề.',
    pipTooBig: 'quá khổ bàn in', pipBigS: 'lớn hơn bàn in 256 mm',
    pipBigNote: 'Bìa mở phẳng {w} × {h} mm, vượt quá khổ 256 mm. Hãy chọn khớp cài (Snap-fit) hoặc chốt sợi nhựa (Filament).', pipTooBigNote: 'Bìa mở phẳng không vừa khổ bàn in 256 mm: tự động chia thành 3 phần.',
    holesLabel: 'Treo tường', holesNo: 'Không đục lỗ', holesNoS: 'để bàn hoặc giá sách', holesYes: 'Có lỗ treo', holesYesS: 'treo bằng 2 đinh nhỏ',
    spineLabel: 'Ảnh trong gáy', spineNo: 'Trơn', spineNoS: 'mặt gáy phẳng', spineYes: 'Gắn ảnh', spineYesS: 'thêm 1 ảnh nhỏ trong gáy sách',
    spineNeed: 'cần tối thiểu {n} trang', spineNever: 'khổ này không vừa ảnh gáy',
    spineNote: 'Một ảnh nhỏ lồng vào trong gáy sách. Phù hợp từ {n} trang trở lên.', sumSpine: 'Ảnh trong gáy', noLabel: 'Không',
    holeSize: 'Cỡ lỗ treo', holeSizeNote: 'Đường kính lỗ vừa đầu đinh: 4 mm phù hợp đa số loại đinh nhỏ.',
    holesNote: 'Hai lỗ ở góc bìa trước để móc đinh treo tường.',
    holesPhotoNote: 'Khi chọn lỗ treo tường, bìa trước sẽ là bìa trơn.', sumHoles: 'Lỗ treo tường', yesLabel: 'Có',
    stepDesign: 'Khắc chữ, vẽ nét & chèn ảnh', helpDesign: 'Tùy chọn: khắc chữ nổi, vẽ nét tay hoặc chèn hình lên bìa.',
    addText: 'Thêm chữ nổi', addDraw: 'Vẽ nét tay', addImg: 'Chèn ảnh', itemsMax: 'Tối đa {n} chi tiết họa tiết.',
    textPh: 'Nội dung chữ nổi', textN: 'Chữ nổi', drawN: 'Hình vẽ tay', imgN: 'Ảnh họa tiết', delItem: 'Xóa', editDraw: 'Sửa hình vẽ',
    edLabel: 'Vị trí trên bìa (nhìn từ bên ngoài)', edHint: STD.T.hint, viewAll: 'Toàn bộ bìa', sides: { back: 'BÌA SAU', spine: 'GÁY SÁCH', front: 'BÌA TRƯỚC' },
    fontLabel: 'Font chữ', moreFonts: 'Thêm font', lessFonts: 'Thu gọn font', textColor: 'Màu chữ', alignLabel: 'Căn lề', alignLeft: 'Trái', alignCenter: 'Giữa', alignRight: 'Phải',
    imgColors: 'Màu sắc ảnh', imgBg: 'Tự động xóa phông', imgTap: 'Bảng màu ảnh (chạm để đổi màu)', isCover: 'trùng màu bìa', invisible: 'Ẩn (bỏ qua)', imgParts: 'Chạm vào chi tiết để đổi màu riêng',
    partTitle: 'Phần này', partUndo: 'Khôi phục màu gốc', partAll: 'Đổi tất cả màu này', layerUp: 'Đưa lên trên', layerDown: 'Đưa xuống dưới',
    copyItem: 'Sao chép', pasteItem: 'Dán', copied: 'Đã sao chép.',
    colTot: 'Màu trên bìa', colTotMax: 'tối đa {max} màu AMS', colTotPages: 'Màu trang ruột', colTotPagesS: 'in riêng trên các đĩa PEI', sumColorsText: 'Bìa: {n} màu ({list}) · Ruột: {p}',
    imgBad: 'Không đọc được ảnh: hãy thử ảnh JPG hoặc PNG.', imgEmpty: 'Không tìm thấy hình nét trong ảnh.',
    imgBig: 'Ảnh quá lớn (tối đa 40 MB).', imgHeic: 'Không hỗ trợ ảnh HEIC: vui lòng chụp màn hình hoặc lưu JPG/PNG.',
    imgBgKept: 'Đã giữ lại nền.',
    offCover: 'Một phần chữ/hình nằm ngoài mép in: hãy kéo lại vào trong bìa.',
    overGap: 'Chi tiết rơi vào rãnh gập của bìa.', tooThin: 'Một số nét chữ quá mảnh (<0.4mm): hãy tăng kích thước để in rõ nét.',
    tooMany: 'Quá nhiều màu ({n} màu, tối đa {max} khay AMS). Hãy giảm bớt màu.',
    stepColors: 'Màu sắc', helpColors: 'Chọn màu cho bìa sách và các khung ảnh ruột.', coverColor: 'Màu bìa', pageColor: 'Màu khung ảnh',
    sumTitle: 'Tổng quan album ảnh', prevStep: 'Quay lại', nextTo: 'Tiếp tục: {s}', reviewHint: 'Kiểm tra thông số, đặt tên file và bấm nút tải về bên dưới.',
    sumDir: 'Hướng mở', sumPhoto: 'Khổ ảnh', sumPages: 'Số trang', sumPagesN: '{n} trang', sumCover: 'Loại bìa', sumHinge: 'Bản lề', sumDesign: 'Họa tiết nổi', sumColors: 'Màu sắc', sumClosed: 'Kích thước gập', sumPieces: 'Chi tiết in', piecesText: '3 mảnh bìa + {n} khung ảnh ruột', piecesTextPip: '1 cụm bìa in liền + {n} khung ảnh ruột', sumPins: 'Chốt bản lề', pinsText: '2 đoạn sợi nhựa 1.75 mm dài khoảng {l} mm', sumPlates: 'Số đĩa in', sumFiles: 'Gói tải về', filesText: '1 file dự án 3MF đa đĩa (Bambu Studio / OrcaSlicer)',
    printHint: 'Các chi tiết đã được sắp xếp sẵn trên từng đĩa in riêng biệt, không va chạm, chuẩn màu AMS.',
    none: 'Chưa có', editLabel: 'Sửa', warnFix: 'Cần sửa',
    closeBook: 'Gập sách', openBook: 'Mở bìa sách', viewOut: 'Xem mặt ngoài', viewIn: 'Xem mặt trong', viewFront: 'Xem mặt trước', viewBack: 'Xem mặt sau',
    drawTitle: 'Vẽ nét tay', drawDone: 'Xong', drawCancel: 'Hủy', drawClear: 'Xóa hết', drawSure: 'Chắc chắn?', drawUndo: 'Hoàn tác', drawPen: 'Bút vẽ', drawEraser: 'Tẩy', drawSize: 'Nét bút', drawEmpty: 'Hãy vẽ gì đó trước.', drawHint: 'Vẽ bằng chuột hoặc ngón tay. Nét dày in sẽ đẹp hơn.',
    drawLine: 'Đường thẳng', drawRect: 'Hình chữ nhật', drawCirc: 'Hình tròn', drawFill: 'Đổ màu', drawRedo: 'Làm lại',
    drawHintFill: 'Chạm vào vùng khép kín để đổ màu.', drawHintShape: 'Kéo chuột để vẽ hình học.',
    drawLeak: 'Hình chưa khép kín nét.',
    preparing: 'Đang tạo file in 3D…', prepFail: 'Không thể tạo file. Vui lòng thử lại.',
    resetSure: 'Bạn có chắc muốn đặt lại từ đầu?', undoLabel: 'Hoàn tác', redoLabel: 'Làm lại',
    fileNameLabel: 'Tên file thiết kế', fileNamePh: 'Ten-album-anh', nameNeeded: 'Nhập tên file', nameNeededNote: 'Vui lòng đặt tên cho file thiết kế của bạn',
    saveLabel: 'Lưu mẫu', savedLabel: 'Đã lưu', saveTitle: 'Lưu thiết kế vào trình duyệt để tiếp tục sau', saveUpd: 'Lưu thay đổi cho “{n}”', saveNew: 'Lưu thành mẫu mới', savedNote: 'Đã lưu vào bộ nhớ trình duyệt', alreadySaved: 'Mẫu này đã được lưu', saveFail: 'Không thể lưu mẫu.', saveFull: 'Đã lưu tối đa {n} mẫu.', openFail: 'Không thể mở mẫu.', openedNote: 'Đã mở “{n}”',
    myTitle: 'Mẫu của tôi', myCount: 'Đã lưu {n}/{max}', myDevice: 'Lưu trên trình duyệt của thiết bị này.', myBtn: 'Mẫu đã lưu', myEmpty: 'Chưa có mẫu nào được lưu.', copyLabel: 'Sao chép', delLabel: 'Xóa', delSure: 'Xác nhận xóa?', copySuffix: ' - bản sao', copiedNote: 'Đã tạo bản sao “{n}”', deletedNote: 'Đã xóa mẫu', backTo: 'Quay lại chỉnh sửa', nowOpen: 'Mở ngay', openLabel: 'Mở'
  };

  var current = null, cfgCache = {}, datCache = {};
  var STORE = 'afbh2:';
  var MAX_ITEMS = 12, MAX_FIL = 8, PRINT_PX = 10, DECAL_PX = 12;   // 0.5.0: disegni sulla copertina 3D a 12 punti per mm (prima 6)
  function decalMax(gl) { if (!decalMax.v) { var m = 2048; try { m = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048); } catch (e) { m = 2048; } decalMax.v = m; } return decalMax.v; }
  function clampN(x, a, b) { return x < a ? a : x > b ? b : x; }

  /* ---- configurazione e stato ------------------------------------------------------------------ */
  function loadConfig(slug, basePath) {
    var k = basePath + slug; if (cfgCache[k]) return Promise.resolve(cfgCache[k]);
    var base = basePath + 'models/' + encodeURIComponent(slug) + '/';
    return fetch(base + 'config.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('config ' + r.status); return r.json(); }).then(function (c) {
      return fetch(base + (c.geometry || 'formats.json') + (c.version ? '?v=' + c.version : '')).then(function (r) { if (!r.ok) throw new Error('geometry ' + r.status); return r.json(); }).then(function (g) { c.geo = g; cfgCache[k] = c; return c; });
    });
  }
  function pal(ctx, id) {
    if (id && String(id).indexOf('c:') === 0) { var h = String(id).slice(2); return { id: id, label: 'Custom ' + h.toUpperCase(), hex: h }; }
    var P = ctx.cfg.palette || []; return P.filter(function (p) { return p.id === id; })[0] || P[0] || { id: id, label: id, hex: '#888888' };
  }
  function fontById(ctx, id) { var F = ctx.cfg.fonts || []; return F.filter(function (f) { return f.id === id; })[0] || F[0] || { id: 'sans', css: '900 100px sans-serif' }; }
  function defaults(cfg) {
    var d = cfg.defaults || {}, C = cfg.colors || {};
    return { v: 2, dir: d.dir || 'V', code: d.code || 'MINI', pages: d.pages || 10, front: d.front || 'blank', hinge: d.hinge || 'snap', holes: false, holeD: 4, spinePhoto: false,
      colors: { cover: (C.cover && C.cover.default) || 'pink', page: (C.page && C.page.default) || 'white' }, items: [], sel: -1, fname: '' };
  }
  // 0.6.3 (ALFI 30/10): PHOTOBOX solo VERTICAL -> nell'altra direzione il formato con la foto piu' simile
  function codeFor(ctx, dir, code) {
    var L = ctx.cfg.geo.formats.filter(function (f) { return f.orient === dir; }); if (!L.length) return code;
    if (L.some(function (f) { return f.code === code; })) return code;
    var cur = ctx.cfg.geo.formats.filter(function (f) { return f.code === code; })[0]; if (!cur || !cur.photo) return L[0].code;
    var s0 = cur.photo.slice().sort(function (a, b) { return a - b; }), best = L[0], bd = 1e9;
    L.forEach(function (f) { if (!f.photo) return; var s1 = f.photo.slice().sort(function (a, b) { return a - b; }), d = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]); if (d < bd) { bd = d; best = f; } });
    return best.code;
  }
  function fmtOf(ctx) { var G = ctx.cfg.geo, id = ctx.st.dir + '-' + ctx.st.code; return G.formats.filter(function (f) { return f.id === id; })[0] || G.formats[0]; }
  function fixState(ctx) {
    var st = ctx.st, P = ctx.cfg.pages || { min: 2, max: 20 };
    if (st.dir !== 'H') st.dir = 'V';
    if (!ctx.cfg.geo.formats.some(function (f) { return f.code === st.code; })) st.code = ctx.cfg.geo.formats[0].code;
    st.code = codeFor(ctx, st.dir, st.code);   // 0.6.3: formato che non c'e' in questa direzione (PHOTOBOX solo VERTICAL)
    st.pages = clampN(Math.round(+st.pages) || 10, P.min, P.max);
    if (st.front !== 'photo') st.front = 'blank'; if (st.hinge !== 'fil' && st.hinge !== 'pip') st.hinge = 'snap';
    st.holeD = [2, 3, 4, 5, 6].indexOf(+st.holeD) >= 0 ? +st.holeD : 4;   // 0.5.6 (ALFI): misura del foro a muro
    st.spinePhoto = st.spinePhoto === true && spineFits(ctx);   // 0.5.9 (ALFI): foto sulla costa interna, solo se ci sta
    st.holes = st.holes === true && st.dir === 'H';   // 0.4.1 (ALFI 22/10 11:49): fori a muro SOLO nell'HORIZONTAL, sulla copertina davanti; 0.4.2 (ALFI 22/10 18:57): anche con la foto
    ctx._lay = null;   // 0.5.4 (ALFI): "Attached" sempre possibile, anche se non sta nel piatto da 256 (stampanti grandi): si avvisa e basta
    if (!Array.isArray(st.items)) st.items = [];
    st.items = st.items.filter(function (it) { return it && (it.type === 'text' || it.type === 'pic' || it.type === 'draw'); }).slice(0, MAX_ITEMS);
    if (!(st.sel >= 0 && st.sel < st.items.length)) st.sel = st.items.length ? st.items.length - 1 : -1;
  }
  function applyState(ctx, init) {
    if (!init || init.v !== 2) return;
    var st = ctx.st;
    ['dir', 'code', 'pages', 'front', 'hinge', 'holes', 'holeD', 'spinePhoto', 'fname'].forEach(function (k) { if (init[k] != null) st[k] = init[k]; });
    if (init.colors) for (var k2 in st.colors) if (init.colors[k2]) st.colors[k2] = init.colors[k2];
    if (Array.isArray(init.items)) st.items = JSON.parse(JSON.stringify(init.items));
    if (init.sel != null) st.sel = init.sel;
  }

  /* ---- geometria: copertina aperta in piano vista da fuori ------------------------------------
     Sistema del disegno (file STL): x verso le pagine, y spessore (faccia esterna y = yOut = -2,1), z lungo la cerniera.
     Asse della cerniera dietro/dorso in (AX, 0); il dorso a n pagine ha gli assi a +-Dn/2 (Dn = PITCH n + 0,102).
     Aperta in piano: dietro x + sh; dorso x + AX - Dn/2; davanti 2 AX - Dn - (x + sh), z -> -z (sh = Dr/2).
     Riquadro 2D (mm, y in giu' come il canvas), u = 0 al centro del dorso:
       VERTICAL:   u = xc - x, v = z            (davanti a destra, dietro a sinistra)
       HORIZONTAL: u = z,      v = x - xc       (dietro in basso, dorso in mezzo, davanti in alto)               */
  function G0(ctx) { return ctx.cfg.geo; }
  function Dn(ctx, n) { return G0(ctx).pitch * n + 0.102; }
  function spineStretch(ctx, n) {   // dal dorso a 2 pagine (file della libreria) al dorso a n pagine: solo la fascia centrale si allunga
    var P = G0(ctx).pitch, D2 = P * 2 + 0.102 - 11.47, Dx = P * n + 0.102 - 11.47, h2 = 3.2 + D2 / 2, hn = 3.2 + Dx / 2;
    return function (x) { return Math.abs(x) <= h2 ? x * hn / h2 : x + (x < 0 ? -1 : 1) * (Dx - D2) / 2; };
  }
  // affini (xs, zs) del file -> (u, v) del riquadro: [a, b, c, d, e, f] come setTransform del canvas
  function partAff(ctx, part) {
    var F = fmtOf(ctx), AX = G0(ctx).axisX, D = Dn(ctx, ctx.st.pages), sh = F.Dr / 2, H = ctx.st.dir === 'H';
    if (!H) {
      if (part === 'back') return [-1, 0, 0, 1, AX - D / 2 - sh, 0];
      if (part === 'spine') return [-1, 0, 0, 1, 0, 0];
      return [1, 0, 0, -1, sh - AX + D / 2, 0];
    }
    if (part === 'back') return [0, 1, 1, 0, 0, sh - AX + D / 2];
    if (part === 'spine') return [0, 1, 1, 0, 0, 0];
    return [0, -1, -1, 0, 0, AX - D / 2 - sh];
  }
  function affApply(A, x, y) { return [A[0] * x + A[2] * y + A[4], A[1] * x + A[3] * y + A[5]]; }
  function affInv(A) { var det = A[0] * A[3] - A[1] * A[2], a = A[3] / det, b = -A[1] / det, c = -A[2] / det, d = A[0] / det; return [a, b, c, d, -(a * A[4] + c * A[5]), -(b * A[4] + d * A[5])]; }
  function affMul(A, B) { return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]]; }
  function partKey(ctx, part) {
    var st = ctx.st, H = st.hinge === 'fil' ? 'F' : 'S', k = part === 'back' ? 'B-' + H : part === 'spine' ? 'S-' + H : 'F-' + H + '-' + (st.holes ? (st.front === 'photo' ? 'Q' : 'K') : st.front === 'photo' ? 'P' : 'B');   // Q = foto + fori (0.4.2)
    if (part === 'front' && st.holes) { var F = fmtOf(ctx); if (!F || !F.geo || !F.geo[k]) k = 'F-' + H + '-' + (st.front === 'photo' ? 'P' : 'B'); }   // formato senza fori: mai bloccarsi
    return k;
  }
  /* 27/10 (ALFI): foto anche sulla costa interna (dorso), quando con quelle pagine ci sta. Tasca come quella della FRONT WITH PHOTO:
     larga foto + 0,4 (di traverso), lunga foto + 0,2 (per lungo, stessi margini della copertina), fondo a 1 mm dalla faccia esterna,
     pareti dritte 0,8 mm e poi labbri a scivolo (1,7 mm verso il centro fino alla faccia interna) sui due lati lunghi; teste dritte.
     Ci sta se tra la tasca e la fine del piano del dorso restano almeno 2,5 mm per parte. */
  var SP_M = 2.5;
  function spinePhotoFit(P, pitch, n) { return P / 2 + SP_M <= 1.5 + pitch * (n - 2) / 2; }
  function spinePhotoMin(P, pitch) { return Math.ceil(2 + (P + 2 * SP_M - 3) / pitch - 1e-9); }
  function carveSpinePocket(V, F, Wc, Lc, earcut) {
    var YT = 0.9, YL = -0.3, YF = -1.1, LIP = 1.7, EPS = 0.03, P = Array.prototype.slice.call(V), T = Array.prototype.slice.call(F), dead = [], t, k;
    var hw = Wc / 2, ht = hw - LIP, hl = Lc / 2, rx0 = -ht - 0.5, rx1 = ht + 0.5, rz0 = -hl - 0.5, rz1 = hl + 0.5;
    function addV(x, y, z) { P.push(x, y, z); return P.length / 3 - 1; }
    function ny(a, b, c) { return (P[c * 3 + 2] - P[a * 3 + 2]) * (P[b * 3] - P[a * 3]) - (P[b * 3 + 2] - P[a * 3 + 2]) * (P[c * 3] - P[a * 3]); }
    function triRect(a, b, c) {   // triangolo (x, z) contro rettangolo: assi separatori
      var xs = [P[a * 3], P[b * 3], P[c * 3]], zs = [P[a * 3 + 2], P[b * 3 + 2], P[c * 3 + 2]], i, j;
      if (Math.max.apply(null, xs) < rx0 || Math.min.apply(null, xs) > rx1 || Math.max.apply(null, zs) < rz0 || Math.min.apply(null, zs) > rz1) return false;
      var R = [[rx0, rz0], [rx1, rz0], [rx1, rz1], [rx0, rz1]];
      for (i = 0; i < 3; i++) {
        j = (i + 1) % 3; var nx = -(zs[j] - zs[i]), nz = xs[j] - xs[i], s0 = nx * xs[i] + nz * zs[i], o = nx * xs[(i + 2) % 3] + nz * zs[(i + 2) % 3], sg = o > s0 ? 1 : -1, all = true;
        for (var q = 0; q < 4; q++) if ((nx * R[q][0] + nz * R[q][1] - s0) * sg >= 0) { all = false; break; }
        if (all) return false;
      }
      return true;
    }
    var sel = [], sg = 0, E = {}, nx2 = {};
    for (t = 0; t < T.length / 3; t++) {
      var a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
      if (Math.abs(P[a * 3 + 1] - YT) > EPS || Math.abs(P[b * 3 + 1] - YT) > EPS || Math.abs(P[c * 3 + 1] - YT) > EPS) continue;
      if (triRect(a, b, c)) sel.push(t);
    }
    if (!sel.length) throw new Error('spine photo: no inner face');
    sel.forEach(function (t2) { var s = ny(T[t2 * 3], T[t2 * 3 + 1], T[t2 * 3 + 2]); if (Math.abs(s) > Math.abs(sg)) sg = s; for (k = 0; k < 3; k++) E[T[t2 * 3 + k] + ',' + T[t2 * 3 + (k + 1) % 3]] = 1; });
    sel.forEach(function (t2) {
      dead[t2] = 1;
      for (k = 0; k < 3; k++) { var a2 = T[t2 * 3 + k], b2 = T[t2 * 3 + (k + 1) % 3]; if (!E[b2 + ',' + a2]) { if (nx2[a2] != null) throw new Error('spine photo: pinched border'); nx2[a2] = b2; } }
    });
    var loops = [], seen = {};
    Object.keys(nx2).forEach(function (s0) {
      if (seen[s0]) return; var L = [], v = +s0;
      while (!seen[v]) { seen[v] = 1; L.push(v); v = nx2[v]; if (v == null) throw new Error('spine photo: open border'); }
      if (v !== +s0) throw new Error('spine photo: bad border');
      loops.push(L);
    });
    var area = function (L) { var s = 0; for (var i = 0, j = L.length - 1; i < L.length; j = i++) s += (P[L[j] * 3] - P[L[i] * 3]) * (P[L[j] * 3 + 2] + P[L[i] * 3 + 2]); return Math.abs(s / 2); };
    loops.sort(function (p, q) { return area(q) - area(p); });
    // (il bordo della zona tolta deve stare fuori dalla tasca intera, labbri compresi: sotto c'e' la cavita')
    loops.forEach(function (L) { L.forEach(function (v2) { if (Math.abs(P[v2 * 3]) < hw + 0.2 && Math.abs(P[v2 * 3 + 2]) < hl + 0.2) { if (Math.abs(P[v2 * 3]) < ht + 0.2) throw new Error('spine photo: border inside the opening'); } }); });
    // vertici della tasca
    var Tc = {}, Lc0 = {}, Fc = {};
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { var key = sx + ',' + sz; Tc[key] = addV(sx * ht, YT, sz * hl); Lc0[key] = addV(sx * hw, YL, sz * hl); Fc[key] = addV(sx * hw, YF, sz * hl); }); });
    var hole = [Tc['-1,-1'], Tc['1,-1'], Tc['1,1'], Tc['-1,1']], ids = [], data = [], hi = [];
    loops.concat([hole]).forEach(function (L, i) { if (i) hi.push(ids.length); L.forEach(function (v2) { ids.push(v2); data.push(P[v2 * 3], P[v2 * 3 + 2]); }); });
    var tr = earcut(data, hi);
    if (!tr || !tr.length) throw new Error('spine photo: triangulation');
    for (k = 0; k < tr.length; k += 3) { var A = ids[tr[k]], B = ids[tr[k + 1]], C = ids[tr[k + 2]]; if ((ny(A, B, C) > 0) !== (sg > 0)) { var tm = B; B = C; C = tm; } T.push(A, B, C); }
    // facce della tasca, girate verso il centro della cavita' (che e' convessa)
    var cy = (YT + YF) / 2;
    var tri = function (a, b, e) {
      var ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[e * 3] - P[a * 3], vy = P[e * 3 + 1] - P[a * 3 + 1], vz = P[e * 3 + 2] - P[a * 3 + 2];
      var n0 = uy * vz - uz * vy, n1 = uz * vx - ux * vz, n2 = ux * vy - uy * vx, mx = (P[a * 3] + P[b * 3] + P[e * 3]) / 3, my = (P[a * 3 + 1] + P[b * 3 + 1] + P[e * 3 + 1]) / 3, mz = (P[a * 3 + 2] + P[b * 3 + 2] + P[e * 3 + 2]) / 3;
      if (n0 * (0 - mx) + n1 * (cy - my) + n2 * (0 - mz) > 0) T.push(a, b, e); else T.push(a, e, b);
    };
    var quad = function (a, b, c2, d) { tri(a, b, c2); tri(a, c2, d); };
    [-1, 1].forEach(function (sx) {
      quad(Tc[sx + ',-1'], Tc[sx + ',1'], Lc0[sx + ',1'], Lc0[sx + ',-1']);   // labbro a scivolo
      quad(Lc0[sx + ',-1'], Lc0[sx + ',1'], Fc[sx + ',1'], Fc[sx + ',-1']);   // parete dritta
    });
    [-1, 1].forEach(function (sz) {   // testa: esagono (convesso), a ventaglio
      var h = [Tc['-1,' + sz], Tc['1,' + sz], Lc0['1,' + sz], Fc['1,' + sz], Fc['-1,' + sz], Lc0['-1,' + sz]];
      for (k = 1; k < 5; k++) tri(h[0], h[k], h[k + 1]);
    });
    quad(Fc['-1,-1'], Fc['1,-1'], Fc['1,1'], Fc['-1,1']);   // fondo
    var keep = []; for (t = 0; t < T.length / 3; t++) if (!dead[t]) keep.push(T[t * 3], T[t * 3 + 1], T[t * 3 + 2]);
    return { V: new Float32Array(P), F: new Uint32Array(keep) };
  }
  function spineFits(ctx) { var F = fmtOf(ctx); return !!(F && F.P && F.photo) && spinePhotoFit(F.P, G0(ctx).pitch, ctx.st.pages); }
  // centri dei fori a muro nel sistema del file della FRONT: centri dei raggi R8 degli angoli (come bh3mf)
  function holeCenters(F) { var cx = 29.3 + F.Dr / 2, cz = F.Lh - 8; return [[cx, cz], [cx, -cz]]; }
  /* 27/10 (ALFI): fori a muro della FRONT (HORIZONTAL) della misura scelta. I chiodini sono gia' nel muro, quindi la testa deve
     passare: foro passante Ø D dal lato muro (2-6 mm) + sede per la testa sul lato interno (Ø max(5, D+1), profonda 1,8 come
     prima). Si parte dalla FRONT senza fori: sulle due facce piane della piastra si tolgono i triangoli vicini al foro e si
     ritriangola la zona col cerchio nuovo (earcut), poi pareti e fondo della sede. Mesh chiusa come prima. */
  function carveWallHoles(V, F, centers, D, earcut) {
    var YI = 0.9, YO = -2.1, SEAT = 1.8, NS = 48, EPS = 0.03;
    var rh = D / 2, rs = Math.max(5, D + 1) / 2, P = Array.prototype.slice.call(V), T = Array.prototype.slice.call(F), dead = [], t, k;
    function addV(x, y, z) { P.push(x, y, z); return P.length / 3 - 1; }
    function ring(cx, cz, r, y) { var o = []; for (var i = 0; i < NS; i++) { var a = 2 * Math.PI * i / NS; o.push(addV(cx + r * Math.cos(a), y, cz + r * Math.sin(a))); } return o; }
    function ny(a, b, c) { return (P[c * 3 + 2] - P[a * 3 + 2]) * (P[b * 3] - P[a * 3]) - (P[b * 3 + 2] - P[a * 3 + 2]) * (P[c * 3] - P[a * 3]); }   // componente y della normale
    function segD(px, pz, ax, az, bx, bz) { var dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, u = L ? ((px - ax) * dx + (pz - az) * dz) / L : 0; u = u < 0 ? 0 : u > 1 ? 1 : u; return Math.hypot(ax + u * dx - px, az + u * dz - pz); }
    function triD(px, pz, a, b, c) {
      var ax = P[a * 3], az = P[a * 3 + 2], bx = P[b * 3], bz = P[b * 3 + 2], cx = P[c * 3], cz = P[c * 3 + 2];
      var d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz), d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz), d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return 0;
      return Math.min(segD(px, pz, ax, az, bx, bz), segD(px, pz, bx, bz, cx, cz), segD(px, pz, cx, cz, ax, az));
    }
    centers.forEach(function (c) {
      var cx = c[0], cz = c[1], R = {};
      [[YI, rs], [YO, rh]].forEach(function (fr) {
        var y0 = fr[0], r = fr[1], sel = [], ys = [];
        for (t = 0; t < T.length / 3; t++) {
          if (dead[t]) continue;
          var a = T[t * 3], b = T[t * 3 + 1], e = T[t * 3 + 2];
          if (Math.abs(P[a * 3 + 1] - y0) > EPS || Math.abs(P[b * 3 + 1] - y0) > EPS || Math.abs(P[e * 3 + 1] - y0) > EPS) continue;
          if (triD(cx, cz, a, b, e) < r + 0.5) { sel.push(t); ys.push(P[a * 3 + 1], P[b * 3 + 1], P[e * 3 + 1]); }
        }
        if (!sel.length) throw new Error('wall hole: no face at y ' + y0);
        ys.sort(function (p, q) { return p - q; });
        var y = ys[ys.length >> 1], sg = 0, E = {}, nx = {};
        sel.forEach(function (t2) { var s = ny(T[t2 * 3], T[t2 * 3 + 1], T[t2 * 3 + 2]); if (Math.abs(s) > Math.abs(sg)) sg = s; for (k = 0; k < 3; k++) E[T[t2 * 3 + k] + ',' + T[t2 * 3 + (k + 1) % 3]] = 1; });
        sel.forEach(function (t2) {
          dead[t2] = 1;
          for (k = 0; k < 3; k++) { var a2 = T[t2 * 3 + k], b2 = T[t2 * 3 + (k + 1) % 3]; if (!E[b2 + ',' + a2]) { if (nx[a2] != null) throw new Error('wall hole: pinched border'); nx[a2] = b2; } }
        });
        var loops = [], seen = {};
        Object.keys(nx).forEach(function (s0) {
          if (seen[s0]) return; var L = [], v = +s0;
          while (!seen[v]) { seen[v] = 1; L.push(v); v = nx[v]; if (v == null) throw new Error('wall hole: open border'); }
          if (v !== +s0) throw new Error('wall hole: bad border');
          loops.push(L);
        });
        var area = function (L) { var s = 0; for (var i = 0, j = L.length - 1; i < L.length; j = i++) s += (P[L[j] * 3] - P[L[i] * 3]) * (P[L[j] * 3 + 2] + P[L[i] * 3 + 2]); return Math.abs(s / 2); };
        loops.sort(function (p, q) { return area(q) - area(p); });
        loops.forEach(function (L) { for (var i = 0; i < L.length; i++) { var a3 = L[i], b3 = L[(i + 1) % L.length]; if (segD(cx, cz, P[a3 * 3], P[a3 * 3 + 2], P[b3 * 3], P[b3 * 3 + 2]) < r + 0.15) throw new Error('wall hole: too close to an edge'); } });
        var hr = ring(cx, cz, r, y), ids = [], data = [], hi = [];
        loops.concat([hr]).forEach(function (L, i) { if (i) hi.push(ids.length); L.forEach(function (v2) { ids.push(v2); data.push(P[v2 * 3], P[v2 * 3 + 2]); }); });
        var tr = earcut(data, hi);
        if (!tr || !tr.length) throw new Error('wall hole: triangulation');
        for (k = 0; k < tr.length; k += 3) { var A = ids[tr[k]], B = ids[tr[k + 1]], C = ids[tr[k + 2]]; if ((ny(A, B, C) > 0) !== (sg > 0)) { var tm = B; B = C; C = tm; } T.push(A, B, C); }
        R[y0] = { ring: hr, y: y };
      });
      var A0 = R[YI].ring, D0 = R[YO].ring, yb = R[YI].y - SEAT, B0 = ring(cx, cz, rs, yb), C0 = ring(cx, cz, rh, yb), up = R[YI].y > R[YO].y ? 1 : -1;
      var push = function (a, b, e, want) {   // want(nx, ny, nz): normale giusta
        var ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[e * 3] - P[a * 3], vy = P[e * 3 + 1] - P[a * 3 + 1], vz = P[e * 3 + 2] - P[a * 3 + 2];
        var n0 = uy * vz - uz * vy, n1 = uz * vx - ux * vz, n2 = ux * vy - uy * vx;
        if (want(n0, n1, n2, (P[a * 3] + P[b * 3] + P[e * 3]) / 3, (P[a * 3 + 2] + P[b * 3 + 2] + P[e * 3 + 2]) / 3)) T.push(a, b, e); else T.push(a, e, b);
      };
      var inward = function (n0, n1, n2, mx, mz) { return n0 * (cx - mx) + n2 * (cz - mz) > 0; };
      [[A0, B0], [C0, D0]].forEach(function (w) { var a = w[0], b = w[1]; for (k = 0; k < NS; k++) { var k1 = (k + 1) % NS; push(a[k], a[k1], b[k1], inward); push(a[k], b[k1], b[k], inward); } });
      for (k = 0; k < NS; k++) { var k1 = (k + 1) % NS; push(B0[k], B0[k1], C0[k1], function (n0, n1) { return n1 * up > 0; }); push(B0[k], C0[k1], C0[k], function (n0, n1) { return n1 * up > 0; }); }
    });
    var keep = []; for (t = 0; t < T.length / 3; t++) if (!dead[t]) keep.push(T[t * 3], T[t * 3 + 1], T[t * 3 + 2]);
    return { V: new Float32Array(P), F: new Uint32Array(keep) };
  }
  // FRONT con i fori della misura scelta, fatta dalla FRONT senza fori (se qualcosa va storto: quella coi fori di prima)
  function frontHoles(ctx, md, F, k) {
    var D = ctx.st.holeD, key = F.id + '|' + k + '|' + D, C = ctx._hm = ctx._hm || {}; if (C[key]) return C[key];
    var base = md[k.replace(/K$/, 'B').replace(/Q$/, 'P')], out = md[k];
    try { if (base) { var r = carveWallHoles(base.P, base.I, holeCenters(F), D, TM.earcut); out = { P: r.V, I: r.F }; } } catch (e) { console.warn('[AFBookHub] wall holes:', e); }
    return (C[key] = out);
  }
  // cerniera montata: la copertina aperta deve stare nel piatto (256 mm, 5 mm di margine per parte)
  function pipFits(ctx) { var b = layout(ctx).box, w = b[2] - b[0], h = b[3] - b[1]; return (w <= 246 && h <= 246) || (w + h) / Math.SQRT2 <= 246; }   // dritta o in diagonale (come bh3mf)
  // contorni di un pezzo nel sistema del file (dorso gia' allungato a n pagine)
  function partRings(ctx, part, which) {
    var F = fmtOf(ctx), g = F.geo[partKey(ctx, part)], rings = g[which || 'face'];
    if (part === 'front' && ctx.st.holes) {   // 0.5.6: i cerchi dei fori (fatti a 2,5 mm) alla misura scelta
      var hc = holeCenters(F), rD = ctx.st.holeD / 2;
      rings = rings.map(function (r) { var c = hc.filter(function (h) { return r.every(function (p) { return Math.hypot(p[0] - h[0], p[1] - h[1]) < 3; }); })[0]; if (!c) return r; return r.map(function (p) { var a = Math.atan2(p[1] - c[1], p[0] - c[0]); return [c[0] + rD * Math.cos(a), c[1] + rD * Math.sin(a)]; }); });
    }
    if (part !== 'spine') return rings;
    var sx = spineStretch(ctx, ctx.st.pages);
    return rings.map(function (r) { return r.map(function (p) { return [sx(p[0]), p[1]]; }); });
  }
  function ringsBox(rings) { var b = [1e9, 1e9, -1e9, -1e9]; rings.forEach(function (r) { r.forEach(function (p) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }); }); return b; }
  var PARTS = ['back', 'spine', 'front'];
  // tutta la geometria del riquadro (cache per formato / pagine / copertina)
  function layout(ctx) {
    var st = ctx.st, key = st.dir + st.code + '|' + st.pages + '|' + st.front + '|' + st.hinge + '|' + (st.holes ? st.holeD : 0);
    if (ctx._lay && ctx._lay.key === key) return ctx._lay;
    var L = { key: key, parts: {}, box: [1e9, 1e9, -1e9, -1e9], guidesU: [0], guidesV: [0] };
    PARTS.forEach(function (p) {
      var A = partAff(ctx, p), face = partRings(ctx, p, 'face').map(function (r) { return r.map(function (q) { return affApply(A, q[0], q[1]); }); });
      var sil = partRings(ctx, p, 'sil').map(function (r) { return r.map(function (q) { return affApply(A, q[0], q[1]); }); });
      var fb = ringsBox(face), sb = ringsBox(sil);
      L.parts[p] = { A: A, Ai: affInv(A), face: face, sil: sil, fbox: fb, sbox: sb, cu: (fb[0] + fb[2]) / 2, cv: (fb[1] + fb[3]) / 2, fileFace: partRings(ctx, p, 'face') };
      L.box = [Math.min(L.box[0], sb[0]), Math.min(L.box[1], sb[1]), Math.max(L.box[2], sb[2]), Math.max(L.box[3], sb[3])];
      if (st.dir === 'H') L.guidesV.push((fb[1] + fb[3]) / 2); else L.guidesU.push((fb[0] + fb[2]) / 2);
    });
    if (st.dir === 'H') L.guidesU = [(L.parts.back.fbox[0] + L.parts.back.fbox[2]) / 2]; else L.guidesV = [(L.parts.back.fbox[1] + L.parts.back.fbox[3]) / 2];
    return (ctx._lay = L);
  }
  // in quale pezzo cade un punto del riquadro (per spostare i disegni quando cambiano le pagine)
  function partAt(ctx, u, v) {
    var L = layout(ctx), H = ctx.st.dir === 'H', s = L.parts.spine.fbox, c = H ? v : u, lo = H ? s[1] : s[0], hi = H ? s[3] : s[2];
    if (c < lo) return H ? 'front' : 'back'; if (c > hi) return H ? 'back' : 'front'; return 'spine';
  }
  // misure del libro chiuso (mm)
  function closedDims(ctx) {
    var F = fmtOf(ctx), st = ctx.st, D = Dn(ctx, st.pages), AX = G0(ctx).axisX, sh = F.Dr / 2;
    var bB = F.geo[partKey(ctx, 'back')].box, bS = F.geo[partKey(ctx, 'spine')].box, bF = F.geo[partKey(ctx, 'front')].box;
    var sx = spineStretch(ctx, st.pages), sx0 = sx(bS[0]), sx1 = sx(bS[3]);
    var x0 = Math.min(bB[0] + sh, bF[0] + sh, bS[1] + AX), x1 = Math.max(bB[3] + sh, bF[3] + sh, bS[4] + AX);
    var y0 = Math.min(bB[1], -bF[4] + D, -sx1 + D / 2), y1 = Math.max(bB[4], -bF[1] + D, -sx0 + D / 2);
    var z0 = Math.min(bB[2], -bF[5], bS[2]), z1 = Math.max(bB[5], -bF[2], bS[5]);
    var w = x1 - x0, h = z1 - z0, t = y1 - y0;
    return st.dir === 'H' ? { w: h, h: w, t: t } : { w: w, h: h, t: t };
  }

  /* ---- modelli protetti (stesso formato del KEY BOOK e del GIFT REVEAL) ---------------------- */
  function unpack(txt) {
    var bin = atob(String(txt).trim()), b = new Uint8Array(bin.length), x = 0x6B3A91C5 | 0, i;
    for (i = 0; i < bin.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; b[i] = bin.charCodeAt(i) ^ (x & 255); }
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (buf) {
      var u = new Uint8Array(buf), dv = new DataView(buf), o = 12, out = {};
      if (String.fromCharCode(u[0], u[1], u[2], u[3]) !== 'AFK2') throw new Error('bad model');
      var n = dv.getUint32(8, true);
      for (var m = 0; m < n; m++) {
        var nl = u[o]; o += 1; var name = ''; for (i = 0; i < nl; i++) name += String.fromCharCode(u[o + i]); o += nl;
        var g = dv.getFloat32(o, true), org = [dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true), dv.getFloat32(o + 12, true)], nv = dv.getUint32(o + 16, true), nt = dv.getUint32(o + 20, true); o += 24;
        var P = new Float32Array(nv * 3), acc;
        for (var c = 0; c < 3; c++) { acc = 0; for (i = 0; i < nv; i++) { acc = (acc + dv.getUint16(o, true)) & 0xFFFF; o += 2; P[i * 3 + c] = org[c] + acc * g; } }
        var I = new Uint32Array(nt * 3), A = new Int32Array(nt), a0 = 0;
        for (i = 0; i < nt; i++) { a0 = (a0 + dv.getUint16(o, true)) & 0xFFFF; o += 2; A[i] = a0; I[i * 3] = a0; }
        for (i = 0; i < nt; i++) { I[i * 3 + 1] = (A[i] + dv.getUint16(o, true)) & 0xFFFF; o += 2; }
        for (i = 0; i < nt; i++) { I[i * 3 + 2] = (A[i] + dv.getUint16(o, true)) & 0xFFFF; o += 2; }
        out[name] = { P: P, I: I };
      }
      return out;
    });
  }
  function loadDat(ctx, F) {
    var url = ctx.basePath + 'models/' + encodeURIComponent(ctx.slug) + '/' + F.dat + (ctx.cfg.version ? '?v=' + ctx.cfg.version : '');
    if (datCache[url]) return datCache[url];
    var p = fetch(url).then(function (r) { if (!r.ok) throw new Error('model ' + r.status); return r.text(); }).then(unpack);
    p.catch(function () { delete datCache[url]; });
    return (datCache[url] = p);
  }

  /* ---- scena 3D ----------------------------------------------------------------------------------
     Mondo (Z in su): (x, y, z) del disegno -> (x, -z, y + 2,1): faccia esterna del dietro sul pavimento, il davanti in alto.
     Piega (0 = copertina aperta in piano, 1 = libro chiuso): dorso -90 gradi attorno all'asse A = (AX, 0),
     davanti altri -90 attorno all'asse B = (AX - Dn, 0) che gira col dorso. Le pagine stanno ferme sul dietro.    */
  var W_BASE = (function () { var m = m4(); m[0] = 1; m[1] = 0; m[2] = 0; m[4] = 0; m[5] = 0; m[6] = 1; m[8] = 0; m[9] = -1; m[10] = 0; m[14] = 2.1; return m; })();
  function rzAt(th, ax, ay) { return mul(T(ax, ay, 0), mul(RZ(th), T(-ax, -ay, 0))); }
  function placeOf(ctx, part, f, k) {
    var F = fmtOf(ctx), AX = G0(ctx).axisX, D = Dn(ctx, ctx.st.pages), sh = F.Dr / 2, th = -Math.PI / 2 * f;
    if (part === 'back') return T(sh, 0, 0);
    if (part === 'spine') return mul(rzAt(th, AX, 0), T(AX - D / 2, 0, 0));
    if (part === 'front') return mul(rzAt(th, AX, 0), mul(rzAt(th, AX - D, 0), mul(T(2 * AX - D - sh, 0, 0), S(-1, 1, -1))));
    return T(F.pageDx, -0.8 + k * G0(ctx).pitch, 0);
  }
  function boxCorners(b) { var o = []; for (var i = 0; i < 8; i++) o.push([i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2]]); return o; }
  function xf3(M, p) { return [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]]; }
  function sceneBox(ctx, f) {
    var F = fmtOf(ctx), n = ctx.st.pages, sx = spineStretch(ctx, n), b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    var add = function (M, bx) { boxCorners(bx).forEach(function (p) { var q = xf3(M, p); for (var i = 0; i < 3; i++) { b[i] = Math.min(b[i], q[i]); b[i + 3] = Math.max(b[i + 3], q[i]); } }); };
    PARTS.forEach(function (p) { var bx = F.geo[partKey(ctx, p)].box.slice(); if (p === 'spine') { bx[0] = sx(bx[0]); bx[3] = sx(bx[3]); } add(mul(W_BASE, placeOf(ctx, p, f)), bx); });
    add(mul(W_BASE, placeOf(ctx, 'page', f, n - 1)), F.pbox['P-F']);
    return b;
  }
  /* 0.4: HORIZONTAL = il libro VERTICAL girato di un quarto sul tavolo (dorso in alto): stessa camera per tutti e due,
     cosi' il cambio di direzione e' solo il libro che gira. */
  function worldOf(ctx, f) {
    var b = sceneBox(ctx, f), W = mul(T(-(b[0] + b[3]) / 2, -(b[1] + b[4]) / 2, 0), W_BASE), bx = [b[0] - (b[0] + b[3]) / 2, b[3] - (b[0] + b[3]) / 2, b[1] - (b[1] + b[4]) / 2, b[4] - (b[1] + b[4]) / 2, b[2], b[5]];
    if (ctx.st.dir === 'H') { W = mul(RZ(-Math.PI / 2), W); bx = [bx[2], bx[3], -bx[1], -bx[0], bx[4], bx[5]]; }
    return { W: W, box: bx };
  }
  // mesh del formato scelto (dorso allungato alle pagine scelte)
  function ensureMeshes(ctx) {
    var F = fmtOf(ctx), st = ctx.st, v = ctx.viewer; if (!v) return Promise.resolve(false);
    return loadDat(ctx, F).then(function (md) {
      if (current !== ctx) return false;
      var keys = [partKey(ctx, 'back'), partKey(ctx, 'spine'), partKey(ctx, 'front')];
      var want = F.id + '|' + keys.join(',') + '|' + st.pages + '|' + (st.holes ? st.holeD : '') + '|' + (st.spinePhoto ? 'SP' : '');
      if (ctx._meshKey === want) return true;
      var M0 = ctx._meshSet || {};
      ['back', 'front'].forEach(function (p, i) {
        var k = keys[p === 'back' ? 0 : 2], hk = p === 'front' && st.holes && /-[KQ]$/.test(k), tag = F.id + k + (hk ? '|' + st.holeD : '');
        if (M0[p] !== tag) { var mm0 = hk ? frontHoles(ctx, md, F, k) : md[k]; v.setMeshIdx('bh-' + p, mm0.P, mm0.I); M0[p] = tag; }
      });
      var stag = F.id + keys[1] + '|' + st.pages + (st.spinePhoto ? '|SP' : '');
      if (M0.spine !== stag) {
        var src = md[keys[1]], P = new Float32Array(src.P), sI = src.I, sx = spineStretch(ctx, st.pages); for (var i = 0; i < P.length; i += 3) P[i] = sx(P[i]);
        if (st.spinePhoto) { try { var spr = carveSpinePocket(P, sI, F.P, F.photo[1] + 0.2, TM.earcut); P = spr.V; sI = spr.F; } catch (e) { console.warn('[AFBookHub] spine photo:', e); } }   // 0.5.9: tasca della foto nella costa
        v.setMeshIdx('bh-spine', P, sI); M0.spine = stag; ctx._spineN = null;
      }
      ['P-N', 'P-F'].forEach(function (k) { var tag = F.id + k; if (M0[k] !== tag) { v.setMeshIdx('bh-' + k, md[k].P, md[k].I); M0[k] = tag; } });
      ctx._meshSet = M0; ctx._meshKey = want; ctx._md = md; ctx._mdKey = keys[1];
      return true;
    });
  }
  // 0.4.1: dorso per un numero di pagine anche non intero (mentre il libro si allarga / stringe)
  function spineAt(ctx, n) {
    var v = ctx.viewer, md = ctx._md, src = md && md[ctx._mdKey]; if (!v || !src) return;
    var key = Math.round(n * 1000); if (ctx._spineN === key) return; ctx._spineN = key;
    var P = new Float32Array(src.P), sx = spineStretch(ctx, n); for (var i = 0; i < P.length; i += 3) P[i] = sx(P[i]); v.setMeshIdx('bh-spine', P, src.I);
  }
  /* 0.6.4 (ALFI 30/10): "non si vede bene dove sta la foto". Con "With photo" una foto disegnata (bordo bianco, cielo,
     sole e colline) sta nella tasca: sul fondo della tasca (y = -1,1 nel file), sotto i labbri, grande come la foto vera.
     Tasca della FRONT: centro x -3,72, z -0,04 in tutti i 17 formati (misurato sulle mesh); costa: centro 0, 0 (carveSpinePocket).
     Solo anteprima: il file da stampare non cambia. Quando si accende scende dall'alto con un riflesso (dropPose). */
  var PH_FRONT_X = -3.72, PH_FRONT_Z = -0.04, PH_Y = -1.06;
  function cardMesh(v, w, h) {
    var key = 'phc-' + w.toFixed(2) + 'x' + h.toFixed(2); if (v.meshes[key]) return key;   // mai liberate (piccole): restano valide anche durante il giro del libro
    var x = w / 2, z = h / 2, y0 = -2.1, y1 = -1.85;
    v.setMeshIdx(key, new Float32Array([-x, y0, -z, x, y0, -z, x, y0, z, -x, y0, z, -x, y1, -z, x, y1, -z, x, y1, z, -x, y1, z]),
      new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]));
    return key;
  }
  function drawPhotoArt(g, W, H, variant) {   // foto stilizzata: bordo bianco, cielo, sole, nuvola, colline
    var m = Math.round(Math.min(W, H) * 0.06), w = W - 2 * m, h = H - 2 * m, PAL = [
      { sky: ['#6EC1F0', '#BFE6FA', '#FFD9A8'], sun: '#FFD45C', far: '#8FD1B0', near: '#3E9E78', near2: '#2F8263' },
      { sky: ['#F7A8C4', '#FFD1B3', '#FFF0C7'], sun: '#FFF3B0', far: '#B7A6E6', near: '#7C6CCB', near2: '#5E50AE' }][variant % 2];
    g.fillStyle = '#FBFAF6'; g.fillRect(0, 0, W, H);
    g.save(); g.beginPath(); g.rect(m, m, w, h); g.clip(); g.translate(m, m);
    var sk = g.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, PAL.sky[0]); sk.addColorStop(0.55, PAL.sky[1]); sk.addColorStop(1, PAL.sky[2]); g.fillStyle = sk; g.fillRect(0, 0, w, h);
    var s0 = Math.min(w, h), sx = w * 0.7, sy = h * 0.34, sr = s0 * 0.12;
    var glow = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 2.6); glow.addColorStop(0, 'rgba(255,240,180,0.85)'); glow.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.fillStyle = PAL.sun; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.92)'; var cx = w * 0.28, cy = h * 0.24, cr = s0 * 0.07;
    g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.arc(cx + cr * 1.1, cy - cr * 0.45, cr * 1.15, 0, Math.PI * 2); g.arc(cx + cr * 2.2, cy, cr * 0.9, 0, Math.PI * 2); g.rect(cx, cy - cr * 0.2, cr * 2.2, cr * 1.1); g.fill();
    function hill(y0, amp, col, ph) { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * y0); for (var i = 0; i <= 24; i++) { var x = w * i / 24; g.lineTo(x, h * y0 - Math.sin(i / 24 * Math.PI * 1.6 + ph) * h * amp - Math.sin(i / 24 * Math.PI * 4.1 + ph * 2) * h * amp * 0.25); } g.lineTo(w, h); g.closePath(); g.fill(); }
    hill(0.66, 0.09, PAL.far, 0.4); hill(0.78, 0.07, PAL.near, 2.2); hill(0.9, 0.05, PAL.near2, 4.0);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = Math.max(1, m * 0.08); g.strokeRect(m, m, w, h);
  }
  function cardTex(ctx, v, w, h, variant, rot) {
    var key = w.toFixed(2) + 'x' + h.toFixed(2) + '|' + variant + '|' + rot, C = ctx._cardTex || (ctx._cardTex = {});
    if (C[key]) return C[key];
    var k = Math.min(10, 1024 / Math.max(w, h)), W = Math.max(64, Math.round(w * k)), H = Math.max(64, Math.round(h * k)), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), sw = rot % 180 ? H : W, sh = rot % 180 ? W : H;   // l'immagine si disegna diritta e poi si gira nel verso della tasca
    g.save(); g.translate(W / 2, H / 2); g.rotate(rot * DEG); g.translate(-sw / 2, -sh / 2); drawPhotoArt(g, sw, sh, variant); g.restore();
    var gl = v.gl, tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    return (C[key] = { tex: tex, box: [-w / 2, -h / 2, w / 2, h / 2], on: true });
  }
  var PH_ROT = { 'V-front': 180, 'V-spine': 0, 'H-front': 270, 'H-spine': 90 };   // verso dell'immagine (gradi) perche' il cielo stia in alto
  function addPhotoCards(ctx, v, list) {
    var st = ctx.st, F = fmtOf(ctx), want = [];
    if (!v.materials.photoCard) v.addMat('photoCard', '#FFFFFF', 0.35);
    if (st.front === 'photo') want.push({ id: 'phF', part: 'front', cx: PH_FRONT_X, cz: PH_FRONT_Z, variant: 0 });
    if (st.spinePhoto) want.push({ id: 'phS', part: 'spine', cx: 0, cz: 0, variant: 1 });
    var old = {}; (v.scene || []).forEach(function (o) { old[o.id] = o; });
    var prev = ctx._cardsPrev, now = {}, delay = ctx._folding || ctx.fold > 0.02 ? 0.85 : 0.2;
    want.forEach(function (c, i) {
      var w = F.photo[0], h = F.photo[1], it = { id: c.id, mesh: cardMesh(v, w, h), mat: 'photoCard', book: true, inside: true, cardOf: c.part,
        cardL: mul(T(c.cx, PH_Y - 2.1, c.cz), S(-1, -1, 1)), decal: cardTex(ctx, v, w, h, c.variant, PH_ROT[st.dir + '-' + c.part] || 0) };
      var o = old[c.id];
      if (o && o.drop) it.drop = o.drop;   // la scena si rifa' mentre scende: continua
      else if (prev && !prev[c.id]) it.drop = { t0: v.time + delay + 0.25 * i, dur: 1.5, H: 45 + Math.max(w, h) * 0.35 };
      now[c.id] = 1; list.push(it);
    });
    ctx._cardsPrev = now;
  }
  function buildScene(ctx, reset) {
    var v = ctx.viewer; if (!v) return;
    var seq = ctx._sceneSeq = (ctx._sceneSeq || 0) + 1;
    if (!ctx._meshKey || ctx._meshKey.indexOf(fmtOf(ctx).id + '|') !== 0) ctx.ui.loading.hidden = false;
    ensureMeshes(ctx).then(function (ok) {
      if (!ok || seq !== ctx._sceneSeq || current !== ctx) return;
      ctx.ui.loading.hidden = true;
      var st = ctx.st, list = [];
      PARTS.forEach(function (p) { list.push({ id: p, mesh: 'bh-' + p, mat: 'cover', book: true, part: p, decal: ctx.decals ? ctx.decals[p] : null }); });
      // pagine: quelle normali hanno un nome per posizione (entrano / escono scorrendo dal lato aperto), la FRONT si sposta
      for (var k = 0; k < st.pages; k++) { var isF = k === st.pages - 1; list.push({ id: isF ? 'pgF' : 'pg' + k, mesh: isF ? 'bh-P-F' : 'bh-P-N', pmesh: isF ? 'bh-P-F' : 'bh-P-N', mat: 'page', book: true, inside: true, page: k }); }
      if (st.hinge === 'fil' && ctx._rods) ['A', 'B'].forEach(function (a) { list.push({ id: 'rod' + a, mesh: 'bh-rod', mat: 'fil', book: true, rod: a }); });
      addPhotoCards(ctx, v, list);   // 0.6.4: foto disegnata nella tasca della copertina e della costa
      ctx.scene = list; poseScene(ctx);
      var wb = worldOf(ctx, ctx.fold), F = fmtOf(ctx), slide = (F.pbox['P-N'][3] - F.pbox['P-N'][0]) * 1.25, nNew = 0;
      var oldIds = {}; (v.scene || []).forEach(function (o) { oldIds[o.id] = 1; });
      list.forEach(function (it) {
        if (it.part || it.rod || it.cardOf || it.id === 'pgF') return;
        var out = mul(wb.W, mul(T(slide, 0, 0), placeOf(ctx, 'page', ctx.fold, it.page)));
        it.enterFrom = out; it.leaveTo = out;
        if (!oldIds[it.id]) { it.delay = 0.06 * nNew; nNew++; }
      });
      // il dorso nuovo (piu' largo / stretto) parte dalla larghezza vecchia e si adatta mentre la copertina si sposta
      var pk = F.id + '|' + st.dir + '|' + partKey(ctx, 'spine');
      if (ctx._prevPages && ctx._prevPk === pk && ctx._prevPages !== st.pages) { var n0 = ctx._prevPages, n1 = st.pages; list.forEach(function (it) { if (it.part === 'spine') it.onAnim = function (e) { spineAt(ctx, n0 + (n1 - n0) * e); }; }); }
      ctx._prevPages = st.pages; ctx._prevPk = pk;
      if (ctx._snapScene) { v.scene = []; v.leaving = []; ctx._snapScene = false; }   // cambio di direzione: il libro nuovo compare al suo posto, senza voli
      if (ctx._flipOnBuild != null) { setFlip(ctx, ctx._flipOnBuild, true); ctx._flipOnBuild = null; }
      v.setScene(list, wb.box, { reset: !!reset, drop: false });
      if (!reset && !ctx._camHold && v.frameAt == null) refit(ctx, false);
      v.coverThick = wb.box[5] - wb.box[4];
      v.yOut = G0(ctx).yOut;
      updateDecals(ctx);
    }).catch(function (e) { console.error('[AFBookHub] model', e); ctx.ui.loading.hidden = false; ctx.ui.loading.textContent = TX.loadFail; });
  }
  function poseScene(ctx) {
    if (!ctx.scene) return;
    var wb = worldOf(ctx, ctx.fold), W = wb.W;
    // le pagine si vedono sempre (anche a libro aperto); solo col libro girato E aperto (disegni visti da fuori) stanno sotto
    var ex = ctx._explode || 0, F = fmtOf(ctx), E = 9 * ex, Ly = 3 * ex;
    var pm0 = {};
    ctx.scene.forEach(function (it) {
      if (it.cardOf) { var pp = pm0[it.cardOf]; it.M = mul(pp ? pp.M : mul(W, placeOf(ctx, it.cardOf, ctx.fold)), it.cardL); it.leaveTo = mul(T(0, 0, 45), it.M); return; }   // 0.6.4
      if (it.rod) { it.M = mul(W, rodPlace(ctx, it.rod, ctx.fold)); return; }
      it.M = mul(W, it.part ? placeOf(ctx, it.part, ctx.fold) : placeOf(ctx, 'page', ctx.fold, it.page));
      if (ex && it.part === 'back') it.M = mul(W, mul(T(E, Ly, 0), placeOf(ctx, 'back', ctx.fold)));
      if (ex && it.part === 'front') it.M = mul(W, mul(T(-E, Ly, 0), placeOf(ctx, 'front', ctx.fold)));
      if (!it.part) it.mesh = it.pmesh;
      if (it.t0 != null && ctx._foldAnim && ctx._folding) { it.t0 = null; it.from = null; }
      if (it.part) pm0[it.part] = it;
    });
    if (ctx.viewer) { ctx.viewer.bbox = wb.box; ctx.viewer.hideInside = ctx.fold < 0.985; ctx.viewer.dirty = true; }
  }
  // aprire / chiudere il libro (animazione della piega) e girarlo (vedere fuori / dentro, davanti / dietro)
  function setFold(ctx, closed, now) {
    ctx.closed = !!closed; var to = closed ? 1 : 0, from = ctx.fold == null ? to : ctx.fold, t0 = performance.now();
    if (now || from === to) { ctx.fold = to; poseScene(ctx); refit(ctx, !!now); paintViewBtns(ctx); return; }
    var id = ctx._foldAnim = (ctx._foldAnim || 0) + 1;
    (function step() {
      if (id !== ctx._foldAnim || current !== ctx) return;
      var p = clampN((performance.now() - t0) / 900, 0, 1); ctx.fold = from + (to - from) * easeInOutCubic(p); ctx._folding = p < 1; poseScene(ctx);
      if (p < 1) requestAnimationFrame(step); else { ctx._folding = false; if (!ctx._camHold) refit(ctx, false); }
    })();
    paintViewBtns(ctx);
  }
  function refit(ctx, now) { var v = ctx.viewer; if (!v) return; v.frame(!!now); v.distT = v.fitDist; v.coverThick = v.bbox ? v.bbox[5] - v.bbox[4] : v.coverThick; v.dirty = true; }
  function setFlip(ctx, on, now) {
    ctx.flipped = !!on; var v = ctx.viewer;
    if (v) { if (now) { v.flip = v.flipTo = on ? 1 : 0; v.flipT0 = null; v.dirty = true; } else { v.setFlip(on); v.resetView(); } }
    paintViewBtns(ctx);
  }
  // vista standard per il passo: libro chiuso dal lato della copertina; per i disegni la copertina aperta vista da fuori
  /* viste (0.3, richieste di ALFI 22/10): VERTICAL libro chiuso visto dal davanti (dorso a sinistra); HORIZONTAL libro appeso:
     dorso in alto, si vede il dietro (la FRONT va contro il muro). Passare da V a H = solo un quarto di giro; il libro nuovo
     compare gia' girato (niente salto in aria). Disegni: copertina aperta vista da fuori. Colori: libro aperto dall'interno
     (pagine e copertina). Copertina / fori / cerniera: la vista va dove si vede la modifica. */
  function homeAz(ctx, flip) { return 180 * DEG; }   // 0.4: il libro HORIZONTAL e' gia' girato nel mondo (worldOf)
  function camTo(ctx, o) {   // o: {fold: 0|1, flip: bool, az, el (gradi), target: [x,y,z] | null, k: distanza (x fitDist)}
    var v = ctx.viewer; if (!v) return;
    var instantFlip = !!o.instantFlip; ctx._camHold = !!o.target;
    if (o.fold != null && (o.fold === 1) !== ctx.closed) setFold(ctx, o.fold === 1);
    if (o.flip != null && !!o.flip !== ctx.flipped) { if (instantFlip) ctx._flipOnBuild = !!o.flip; else { ctx.flipped = !!o.flip; v.setFlip(!!o.flip); paintViewBtns(ctx); } }
    v.homeAz = (o.az != null ? o.az : homeAz(ctx, o.flip != null ? !!o.flip : ctx.flipped) / DEG) * DEG;
    v.homeEl = (o.el != null ? o.el : ((ctx.cfg.camera || {}).elevation || 34)) * DEG;
    v.resetView();
    var k = o.k || 1;
    var apply = function () { if (o.target) v.targetT = o.target.slice(); else v.frame(false); v.distT = v.fitDist * k; v.dirty = true; };
    apply(); clearTimeout(ctx._camT); ctx._camT = setTimeout(apply, 960);   // dopo la piega il riquadro cambia: si rifa' il punto
  }
  /* ---- 0.4 (ALFI 22/10): la cerniera si capisce guardando ---------------------------------------------
     filamento: vista sulla testa del libro (dove si aprono i due fori), entrano due filamenti;
     snap separata: libro aperto, le copertine si staccano dal dorso e si riattaccano;
     attaccata: libro aperto come esce dalla stampante, tutto unito (si piega un poco e si illumina). */
  var ROD_R = 0.85;
  function rodMesh(ctx) {
    var v = ctx.viewer, F = fmtOf(ctx), L = 2 * F.Lh - 1, n = 20, tris = [], i;
    if (ctx._rodLen === L && v.meshes['bh-rod']) return;
    for (i = 0; i < n; i++) {
      var a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n, c0 = Math.cos(a0) * ROD_R, s0 = Math.sin(a0) * ROD_R, c1 = Math.cos(a1) * ROD_R, s1 = Math.sin(a1) * ROD_R;
      tris.push([c0, s0, 0], [c1, s1, 0], [c1, s1, L], [c0, s0, 0], [c1, s1, L], [c0, s0, L]);
      tris.push([0, 0, L], [c0, s0, L], [c1, s1, L], [0, 0, 0], [c1, s1, 0], [c0, s0, 0]);
    }
    v.setMesh('bh-rod', tris); ctx._rodLen = L;
    if (!v.materials.fil) v.addMat('fil', '#FF9F1C', 0.4);
  }
  function rodPlace(ctx, a, f) {   // filamento nel foro dell'asse A (dietro/dorso) o B (dorso/davanti); entra dalla testa (z- del file)
    var F = fmtOf(ctx), AX = G0(ctx).axisX, D = Dn(ctx, ctx.st.pages), th = -Math.PI / 2 * f, L = 2 * F.Lh - 1, z0 = -F.Lh - 2 - (ctx._rodOut || 0) * (L + 12);   // 0.4.1: entra dall'ALTO (z- del file); a fine corsa esce 2 mm dalla testa
    var M = T(AX, 0, z0);
    return a === 'A' ? M : mul(rzAt(th, AX, 0), T(AX - D, 0, z0));
  }
  function runAnim(ctx, dur, fn, done) {   // una sola animazione della cerniera alla volta
    var id = ctx._hAnim = (ctx._hAnim || 0) + 1, t0 = performance.now();
    (function step() {
      if (id !== ctx._hAnim || current !== ctx) return;
      var p = clampN((performance.now() - t0) / dur, 0, 1); fn(p); poseScene(ctx);
      if (p < 1) requestAnimationFrame(step); else if (done) done();
    })();
  }
  function stopHinge(ctx) { ctx._hAnim = (ctx._hAnim || 0) + 1; ctx._explode = 0; if (ctx._rods) { ctx._rods = false; ctx._rodOut = 0; buildScene(ctx, false); } }
  function showHinge(ctx) {
    var st = ctx.st, v = ctx.viewer; if (!v) return;
    ctx._hAnim = (ctx._hAnim || 0) + 1; ctx._explode = 0;
    if (st.hinge === 'fil') {
      rodMesh(ctx); ctx._rods = true; ctx._rodOut = 1; buildScene(ctx, false);
      // 0.4.1: si guarda la testa del libro (dove si aprono i due fori), un poco dal lato del dorso
      var tp = hingePoint(ctx), W = worldOf(ctx, 1).W, dx = -W[8] - 0.45 * W[0], dy = -W[9] - 0.45 * W[1], az = Math.atan2(dx, dy) / DEG;
      camTo(ctx, { fold: 1, flip: false, az: az, el: 32, target: tp, k: 0.62 });
      setTimeout(function () { if (ctx._rods && st.hinge === 'fil') runAnim(ctx, 1500, function (p) { ctx._rodOut = 1 - easeInOutCubic(p); }); }, ctx.closed ? 700 : 1300);
      return;
    }
    if (ctx._rods) { ctx._rods = false; ctx._rodOut = 0; buildScene(ctx, false); }
    camTo(ctx, { fold: 0, flip: false, el: 52 });
    var wait = ctx.closed ? 1150 : 450;
    if (st.hinge === 'snap') {
      setTimeout(function () {
        if (st.hinge !== 'snap') return;
        runAnim(ctx, 1700, function (p) {   // si staccano (0-30%), restano staccate, si riattaccano con uno scatto (75-100%)
          ctx._explode = p < 0.3 ? easeOutCubic(p / 0.3) : p < 0.72 ? 1 : 1 - easeInCubic((p - 0.72) / 0.28);
        }, function () { ctx._explode = 0; poseScene(ctx); });
      }, wait);
    } else {
      setTimeout(function () {
        if (st.hinge !== 'pip') return;
        v.flashMat('cover');
        runAnim(ctx, 1400, function (p) { ctx.fold = 0.32 * Math.sin(Math.PI * p); }, function () { ctx.fold = 0; poseScene(ctx); });
      }, wait);
    }
  }
  // punto della cerniera sulla testa del libro, dove entra il filamento (z- del file), libro chiuso
  function hingePoint(ctx) {
    var wb = worldOf(ctx, 1), F = fmtOf(ctx), AX = G0(ctx).axisX, Lh = F.Lh;
    return xf3(mul(wb.W, placeOf(ctx, 'back', 1)), [AX - F.Dr / 2, Dn(ctx, ctx.st.pages) / 2, -Lh]);   // centro del dorso, sulla testa (z-)
  }
  function viewFor(ctx, step, sub) {
    var v = ctx.viewer; if (!v) return;
    var H = ctx.st.dir === 'H', el0 = (ctx.cfg.camera || {}).elevation || 34;
    if (step === 'design') camTo(ctx, { fold: 0, flip: true, el: 64 });
    else if (step === 'colors') camTo(ctx, { fold: 0, flip: false, el: 58 });
    else if (step === 'cover' && sub === 'front') camTo(ctx, { fold: 0, flip: false, el: 58 });
    else if (step === 'cover' && sub === 'holes') camTo(ctx, { flip: false, el: 62 });   // 0.4.2 (ALFI): i fori si vedono comunque, il libro resta aperto o chiuso com'era
    else if (step === 'cover' && sub === 'hinge') showHinge(ctx);
    else if (step === 'dir') camTo(ctx, { flip: false, el: el0 });   // 0.4.1 (ALFI): cambiando direzione il libro resta aperto o chiuso com'era
    else if (step === 'photo' || step === 'pages' || step === 'cover') camTo(ctx, { fold: 1, flip: false, el: el0 });
    if (!(step === 'cover' && sub === 'hinge')) stopHinge(ctx);
  }
  function paintViewBtns(ctx) {
    var ui = ctx.ui; if (!ui.closeBtn) return;   // 0.3: niente piu' tasto "See back" (si gira a 360 gradi col dito / mouse)
    ui.closeBtn.querySelector('span').textContent = ctx.closed ? TX.openBook : TX.closeBook;
  }

  /* ---- disegni sulla faccia esterna (texture per pezzo, dalle stesse funzioni del riquadro 2D) ---- */
  function updateDecals(ctx) {
    if (ctx._decRaf) return;
    ctx._decRaf = requestAnimationFrame(function () { ctx._decRaf = 0; if (current === ctx) paintDecals(ctx); });
  }
  function paintDecals(ctx) {
    var v = ctx.viewer, gl = v && v.gl; if (!gl || !ctx.scene) return;
    var L = layout(ctx), items = liveItems(ctx);
    ctx.decals = ctx.decals || {};
    PARTS.forEach(function (p) {
      var P = L.parts[p], fb = ringsBox(P.fileFace), pad = 1, x0 = fb[0] - pad, z0 = fb[1] - pad, x1 = fb[2] + pad, z1 = fb[3] + pad;
      var k = Math.min(ctx.ed && ctx.ed.drag ? 6 : DECAL_PX, decalMax(gl) / Math.max(x1 - x0, z1 - z0)), W = Math.max(4, Math.ceil((x1 - x0) * k)), H = Math.max(4, Math.ceil((z1 - z0) * k));
      var d = ctx.decals[p] || (ctx.decals[p] = { cv: document.createElement('canvas'), tex: null, box: [0, 0, 1, 1] });
      if (d.cv.width !== W || d.cv.height !== H) { d.cv.width = W; d.cv.height = H; }
      var g = d.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      if (items.length) {
        // pixel = (file - (x0, z0)) * k ; file = Ai (u, v)
        var M = affMul([k, 0, 0, k, -x0 * k, -z0 * k], P.Ai);
        g.save(); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
        items.forEach(function (it) { drawItem(ctx, g, it, null); });
        g.restore();
      }
      d.box = [x0, z0, x0 + W / k, z0 + H / k];
      if (!d.tex) d.tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, d.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, d.cv);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.activeTexture(gl.TEXTURE0);
      d.on = items.length > 0;
    });
    ctx.scene.forEach(function (it) { if (it.part) it.decal = ctx.decals[it.part] && ctx.decals[it.part].on ? ctx.decals[it.part] : null; });
    v.dirty = true;
  }

  /* ---- disegni del cliente: scritta, disegno a mano libera, immagine a colori --------------------------
     Ogni disegno ha centro (u, v) nel riquadro (mm), rotazione (gradi, senso orario come lo schermo) e grandezza:
     scritta = altezza delle maiuscole, disegno e immagine = lato piu' lungo. Si disegna con drawItem() in due modi:
     a colori (riquadro 2D, 3D) o "maschera" di un colore (bianco = quel colore, nero = altri colori sopra, vuoto = niente),
     che serve per i pezzi colorati da stampare (stesso disegno: quello che si vede e' quello che si stampa). */
  function newId() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function hexOf(ctx, id) { return String(pal(ctx, id).hex || '#888888').toUpperCase(); }
  function sizeRange(it) { return it.type === 'text' ? [3, 60] : [8, 260]; }
  function hasInk(ctx, it) {
    if (!it) return false;
    if (it.type === 'text') return linesOf(it.t).length > 0;
    if (it.type === 'draw') return (it.strokes || []).some(inkQ);
    if (it.type === 'pic') { var q = picQ(ctx, it); return !!(q && !q.empty); }
    return false;
  }
  function liveItems(ctx) { return (ctx.st.items || []).filter(function (it) { return hasInk(ctx, it); }); }
  function linesOf(t) { return String(t || '').replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim(); }).slice(0, 4); }

  /* 0.5.7 (prove a tappeto 27/10): le emoji nelle scritte (❤️ 😀 ⭐) si vedevano colorate, ma si stampano di un colore solo e
     finivano nelle maschere di TUTTI i colori (pezzi sovrapposti nel 3MF). Ora le emoji usano il font "Noto Emoji" in bianco e
     nero: prendono il colore della scritta, come le lettere (quello che si vede e' quello che si stampa). Il selettore U+FE0F
     (emoji colorata) si toglie. Si caricano anche i pezzi del font che servono a QUEL testo (accenti, cirillico, ecc.). */
  var EMO = { id: '_emoji', google: 'Noto+Emoji:wght@700', css: "700 100px 'Noto Emoji'" }, EMO_FB = ", 'Noto Emoji'";
  var RX_EMO = (function () { try { return new RegExp('\\p{Extended_Pictographic}', 'u'); } catch (e) { return /[\u2190-\u2bff\u3030\u303d\u3297\u3299]|[\ud83c-\ud83e][\udc00-\udfff]/; } })();
  // (i cuori colorati, in bianco e nero, sono a righe: si stampano meglio pieni, come il cuore delle carte)
  function txtShow(s) { return String(s || '').replace(/\uFE0F/g, '').replace(/\u2764|\ud83e[\udde1\udd0d\udd0e\ude75-\ude77]|\ud83d[\udc99-\udc9c\udda4]/g, '\u2665'); }
  function textGlyphs(ctx, it) {
    var t = txtShow(it.t); if (!t.trim() || !document.fonts || !document.fonts.load) return;
    var f = fontById(ctx, it.font), key = f.id + '|' + t, D = textGlyphs.done = textGlyphs.done || {}; if (D[key]) return; D[key] = 1;
    var emo = RX_EMO.test(t);
    loadFonts(emo ? [f, EMO] : [f]).then(function () {
      var jobs = [document.fonts.load(f.css.replace(/\d+px/, '100px'), t)]; if (emo) jobs.push(document.fonts.load(EMO.css, t));
      return Promise.race([Promise.all(jobs), new Promise(function (r) { setTimeout(r, 5000); })]);
    }).then(function () { if (current === ctx) { ctx._tl = {}; designChanged(ctx, false); } }, function () {});
  }
  // ---- scritta: misure al font di 100 px (una volta per testo e font)
  var REFPX = 100;
  function textLay(ctx, it) {
    var f = fontById(ctx, it.font), al = it.align === 'left' || it.align === 'right' ? it.align : 'center', key = (it.font || '') + '|' + al + '|' + (it.t || '');
    var C = ctx._tl = ctx._tl || {}; if (C[key]) return C[key];
    textGlyphs(ctx, it);
    var cv = textLay.cv || (textLay.cv = document.createElement('canvas')), g = cv.getContext('2d');
    var css = f.css.replace(/\d+px/, REFPX + 'px') + EMO_FB; g.font = css; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    var mH = g.measureText('H'), cap = mH.actualBoundingBoxAscent || REFPX * 0.7, lh = REFPX * 1.12;
    var L = linesOf(it.t).map(txtShow), n = L.length, box = [1e9, 1e9, -1e9, -1e9];
    // 0.6.2 (ALFI): righe allineate a sinistra / al centro / a destra dentro la riga piu' lunga (larghezza di avanzamento)
    var M = L.map(function (s) { return g.measureText(s); }), wMax = M.reduce(function (a, m) { return Math.max(a, m.width || 0); }, 0);
    var lines = L.map(function (s, i) {
      var m = M[i], y = (i - (n - 1) / 2) * lh + cap / 2, w = m.width || 0, x = al === 'left' ? (w - wMax) / 2 : al === 'right' ? (wMax - w) / 2 : 0;
      var l = m.actualBoundingBoxLeft || m.width / 2, r = m.actualBoundingBoxRight || m.width / 2, a = m.actualBoundingBoxAscent || cap, d = m.actualBoundingBoxDescent || 0;
      box = [Math.min(box[0], x - l), Math.min(box[1], y - a), Math.max(box[2], x + r), Math.max(box[3], y + d)];
      return { s: s, y: y, x: x };
    });
    if (!n) box = [-1, -1, 1, 1];
    return (C[key] = { css: css, cap: cap, lines: lines, box: box });
  }
  // riquadro del disegno nel suo sistema (mm, centro = (u, v), prima della rotazione): [x0, y0, x1, y1]
  function itemBox(ctx, it) {
    if (it.type === 'text') { var T0 = textLay(ctx, it), s = it.mm / T0.cap; return T0.box.map(function (q) { return q * s; }); }
    if (it.type === 'pic') { var q = picQ(ctx, it); if (!q || q.empty) return [-5, -5, 5, 5]; var k = it.mm / Math.max(q.W, q.H); return [-q.W / 2 * k, -q.H / 2 * k, q.W / 2 * k, q.H / 2 * k]; }
    var b = drawBox(it), kk = it.mm / Math.max(b[2] - b[0], b[3] - b[1], 1e-6), w = (b[2] - b[0]) * kk, h = (b[3] - b[1]) * kk;
    return [-w / 2, -h / 2, w / 2, h / 2];
  }
  // disegna il pezzo nel contesto g (trasformazione corrente = mm del riquadro). mask = hex del colore (o null = a colori)
  function drawItem(ctx, g, it, mask) {
    if (!hasInk(ctx, it)) return;
    g.save(); g.translate(it.u, it.v); g.rotate((it.rot || 0) * DEG);
    if (it.type === 'text') {
      var T0 = textLay(ctx, it), s = it.mm / T0.cap, col = hexOf(ctx, it.color);
      g.scale(s, s); g.font = T0.css; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillStyle = mask ? (col === mask ? '#fff' : '#000') : col;
      T0.lines.forEach(function (l) { g.fillText(l.s, l.x || 0, l.y); });
    } else {
      var b = itemBox(ctx, it), V = null;
      if (it.type === 'pic') { try { V = picVec(ctx, it); } catch (e) { console.warn('[AFBookHub] picture vec:', e); V = null; } }
      if (V) { g.translate(b[0], b[1]); g.scale((b[2] - b[0]) / V.W, (b[3] - b[1]) / V.H); paintVec(ctx, g, V, mask); }
      else { var img = it.type === 'pic' ? picCanvas(ctx, it, mask) : drawCanvas(ctx, it, mask); if (img) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, b[0], b[1], b[2] - b[0], b[3] - b[1]); } }
    }
    g.restore();
  }
  // colori usati (hex) dai disegni, senza quello della copertina
  function designHexes(ctx) {
    var out = [], cov = hexOf(ctx, ctx.st.colors.cover);
    function add(h) { h = String(h).toUpperCase(); if (h !== cov && out.indexOf(h) < 0) out.push(h); }
    liveItems(ctx).forEach(function (it) {
      if (it.type === 'text') add(hexOf(ctx, it.color));
      else if (it.type === 'draw') (it.strokes || []).forEach(function (q) { if (inkQ(q)) add(hexOf(ctx, q.c)); });
      else { var q = picQ(ctx, it); if (q && !q.empty) { var E = picEff(ctx, it, q, q), used = {}; for (var i0 = 0; i0 < E.labels.length; i0++) if (E.labels[i0] >= 0) used[E.labels[i0]] = 1; E.cols.forEach(function (id, ci) { if (used[ci] && id && id !== 'none') add(hexOf(ctx, id)); }); } }
    });
    return out;
  }

  // ---- immagine a colori: lo stesso "cervello" del Magnet Maker (MM.cutout toglie lo sfondo, MM.quantize trova pochi
  //      colori, MM.nearestSet sceglie i filamenti piu' vicini). Le parti del colore della copertina restano copertina.
  function imgLoad(src) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('img')); }; im.src = src; }); }
  /* 0.5.7 (prove a tappeto 27/10): le icone SVG si leggevano alla misura scritta nel file (16 x 16 punti per le icone "1em"):
     una casetta diventava una macchia. Ora un SVG si disegna sempre a 1600 punti (dal suo viewBox, in proporzione), e le
     immagini piccole (icone, emoji da 72 punti) si ingrandiscono prima di dividerle in colori (contorni lisci); la pixel art
     (pochi colori netti) si ingrandisce a quadretti netti. Foto fino a 40 MB (prima 15, con un messaggio sbagliato). */
  var PIC_MIN = 1000;
  function svgBig(file) {
    if (!file.text || typeof DOMParser === 'undefined') return Promise.resolve(file);
    return file.text().then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, 'image/svg+xml'), s = doc.documentElement;
      if (!s || String(s.nodeName).toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return file;
      var vb = String(s.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number), hasVb = vb.length === 4 && vb[2] > 0 && vb[3] > 0;
      var num = function (a) { var v = String(s.getAttribute(a) || ''); return /^\s*[\d.]+\s*(px)?\s*$/.test(v) ? parseFloat(v) : 0; };
      var aw = hasVb ? vb[2] : num('width'), ah = hasVb ? vb[3] : num('height');
      if (!(aw > 0 && ah > 0)) return file;
      if (!hasVb) s.setAttribute('viewBox', '0 0 ' + aw + ' ' + ah);
      var k = PIC_SRC / Math.max(aw, ah); s.setAttribute('width', String(Math.round(aw * k))); s.setAttribute('height', String(Math.round(ah * k)));
      return new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' });
    }).catch(function () { return file; });
  }
  function pixelArt(im, w, h) {   // piccolissima (fino a 64 punti), pochi colori netti, trasparenza solo piena o vuota (niente bordi sfumati)
    if (Math.max(w, h) > 64) return false;
    try {
      var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      var d = g.getImageData(0, 0, w, h).data, S = {}, n = 0;
      for (var i = 0; i < d.length; i += 4) { var a = d[i + 3]; if (!a) continue; if (a !== 255) return false; var key = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; if (!S[key]) { S[key] = 1; if (++n > 32) return false; } }
      return n > 0;
    } catch (e) { return false; }
  }
  /* 0.5.8 (prove 28/10): un disegno piccolo in mezzo a tanto bianco (o trasparente) si divideva in colori a pochi punti (un
     gatto disegnato a filo finiva a 95 x 112 punti: a scalini). Ora i bordi vuoti (di un colore solo) si tagliano prima,
     lasciando un margine; le foto e gli sfondi non uniti restano come sono. */
  function trimPic(cv) {
    try {
      var W = cv.width, H = cv.height, g = cv.getContext('2d', { willReadFrequently: true }), d = g.getImageData(0, 0, W, H).data, ring = [], x, y, i;
      for (x = 0; x < W; x++) ring.push(x, (H - 1) * W + x); for (y = 1; y < H - 1; y++) ring.push(y * W, y * W + W - 1);
      var tr = 0, R = [], G = [], B = [];
      ring.forEach(function (k) { if (d[k * 4 + 3] < 16) tr++; else { R.push(d[k * 4]); G.push(d[k * 4 + 1]); B.push(d[k * 4 + 2]); } });
      var useA = tr > ring.length * 0.9, med = function (a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1]; };
      if (!useA && R.length < ring.length * 0.9) return cv;
      var br = useA ? 0 : med(R.slice()), bgc = useA ? 0 : med(G.slice()), bb = useA ? 0 : med(B.slice());
      if (!useA) { var near = 0; for (i = 0; i < R.length; i++) if (Math.max(Math.abs(R[i] - br), Math.abs(G[i] - bgc), Math.abs(B[i] - bb)) <= 24) near++; if (near < R.length * 0.92) return cv; }
      var x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        var p = (y * W + x) * 4; if (d[p + 3] < 16) continue;
        if (!useA && Math.max(Math.abs(d[p] - br), Math.abs(d[p + 1] - bgc), Math.abs(d[p + 2] - bb)) <= 40) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 < 0) return cv;
      var bw = x1 - x0 + 1, bh = y1 - y0 + 1; if (bw * bh > W * H * 0.6) return cv;
      var m = Math.round(Math.max(bw, bh) * 0.04) + 4; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m);
      var c2 = document.createElement('canvas'); c2.width = x1 - x0 + 1; c2.height = y1 - y0 + 1;
      c2.getContext('2d').drawImage(cv, x0, y0, c2.width, c2.height, 0, 0, c2.width, c2.height);
      return c2;
    } catch (e) { return cv; }
  }
  function picFromFile(file) {
    if (file.size > 40 * 1024 * 1024) return Promise.reject(new Error('big'));
    var ty = file.type || '', nm = file.name || '', isSvg = /svg/i.test(ty) || /\.svg$/i.test(nm), heic = /hei[cf]/i.test(ty) || /\.hei[cf]$/i.test(nm);
    var alpha = isSvg || /png|webp|gif|avif/i.test(ty) || /\.(png|webp|gif|avif)$/i.test(nm);
    return (isSvg ? svgBig(file) : Promise.resolve(file)).then(function (srcF) {
      var url = URL.createObjectURL(srcF);
      return imgLoad(url).then(function (im) {
        URL.revokeObjectURL(url);
        var w = im.naturalWidth || 800, h = im.naturalHeight || 800, s0 = Math.min(1, 3000 / Math.max(w, h));
        // (prima alla misura vera, al massimo 3000 punti: si tagliano i bordi vuoti; poi si porta alla misura di lavoro)
        var c0 = document.createElement('canvas'); c0.width = Math.max(1, Math.round(w * s0)); c0.height = Math.max(1, Math.round(h * s0)); var g0 = c0.getContext('2d');
        if (!alpha) { g0.fillStyle = '#fff'; g0.fillRect(0, 0, c0.width, c0.height); }
        g0.imageSmoothingQuality = 'high'; g0.drawImage(im, 0, 0, c0.width, c0.height);
        var c1 = trimPic(c0), w1 = c1.width, h1 = c1.height, m = Math.max(w1, h1);
        var k = Math.min(PIC_SRC / m, Math.max(1, Math.min(8, PIC_MIN / m))), W = Math.max(8, Math.round(w1 * k)), H = Math.max(8, Math.round(h1 * k));
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var g = cv.getContext('2d');
        if (!alpha) { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
        if (k > 1.01) { g.imageSmoothingEnabled = isSvg || !pixelArt(im, w, h); g.imageSmoothingQuality = 'high'; }
        g.drawImage(c1, 0, 0, W, H);
        return alpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
      }, function () { URL.revokeObjectURL(url); throw new Error(heic ? 'heic' : 'img'); });
    });
  }
  function loadPic(ctx, it) {
    var I = ctx.pics = ctx.pics || {}, P = ctx.picLoading = ctx.picLoading || {}; if (I[it.iid] || P[it.iid] || !it.img || String(it.img).indexOf(PIC_REF) === 0) return;
    P[it.iid] = imgLoad(it.img).then(function (im) { delete P[it.iid]; I[it.iid] = { im: im }; if (current === ctx) designChanged(ctx, true); }, function () { delete P[it.iid]; });
  }
  // 0.5.0: immagine lunga divisa a CUT punti; lo sfondo tolto resta quello deciso a 360 (stesso risultato di sempre)
  function picBig(im, c3, CUT, useMask) {
    var big = MM.cutout(im, CUT, false); if (!big || big.empty) return null;
    if (useMask) {
      var bc = big.cv.getContext('2d', { willReadFrequently: true }), BW = big.cv.width, BH = big.cv.height, bd = bc.getImageData(0, 0, BW, BH);
      var SW = c3.cv.width, SH = c3.cv.height, sd = c3.cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, SW, SH).data, kk = c3.sc / big.sc, rmk = new Uint8Array(BW * BH);
      for (var yb = 0; yb < BH; yb++) {
        var sy = Math.floor(((yb + 0.5 + (big.oy || 0) - big.pad) * kk) + c3.pad - (c3.oy || 0));
        for (var xb = 0; xb < BW; xb++) {
          var sx = Math.floor(((xb + 0.5 + (big.ox || 0) - big.pad) * kk) + c3.pad - (c3.ox || 0));
          rmk[yb * BW + xb] = sx < 0 || sy < 0 || sx >= SW || sy >= SH || sd[(sy * SW + sx) * 4 + 3] < 128 ? 1 : 0;
        }
      }
      // 0.5.1: il bordo dello sfondo si rifa' qui, punto per punto (a 360 i quadretti lasciavano striscioline di cielo, poi
      // assorbite dai colori vicini, e mangiavano i bordi dei disegni: contorni a scalini sulla copertina). Solo vicino al
      // bordo deciso a 360 (2 punti): dentro, la decisione resta quella di sempre (es. un prato azzurro resta).
      var DD = bd.data, NB = BW * BH, band = new Uint8Array(NB), ib, xx2, yy2;
      for (yb = 0; yb < BH; yb++) for (xb = 0; xb < BW; xb++) {
        ib = yb * BW + xb; var vb = rmk[ib], df = 0;
        for (yy2 = Math.max(0, yb - 2); yy2 <= Math.min(BH - 1, yb + 2) && !df; yy2++) for (xx2 = Math.max(0, xb - 2); xx2 <= Math.min(BW - 1, xb + 2); xx2++) if (rmk[yy2 * BW + xx2] !== vb) { df = 1; break; }
        band[ib] = df;
      }
      var Lb = []; for (ib = 0; ib < NB; ib += 3) if (rmk[ib] && !band[ib] && DD[ib * 4 + 3] >= 128 && Lb.length < 30000) Lb.push(labOf(DD[ib * 4], DD[ib * 4 + 1], DD[ib * 4 + 2]));
      if (Lb.length > 50) {
        var mdn = function (a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1]; };
        var bgc = [mdn(Lb.map(function (l) { return l[0]; })), mdn(Lb.map(function (l) { return l[1]; })), mdn(Lb.map(function (l) { return l[2]; }))];
        var dn = mdn(Lb.map(function (l) { return Math.sqrt((l[0] - bgc[0]) * (l[0] - bgc[0]) + (l[1] - bgc[1]) * (l[1] - bgc[1]) + (l[2] - bgc[2]) * (l[2] - bgc[2])); }));
        var Tb = Math.max(3.5, Math.min(12, 2 * dn + 2.5)), Tb2 = Tb * Tb, Tk2 = 4 * Tb2;
        for (ib = 0; ib < NB; ib++) {
          if (!band[ib] || DD[ib * 4 + 3] < 128) continue;
          var lb = labOf(DD[ib * 4], DD[ib * 4 + 1], DD[ib * 4 + 2]), eb2 = (lb[0] - bgc[0]) * (lb[0] - bgc[0]) + (lb[1] - bgc[1]) * (lb[1] - bgc[1]) + (lb[2] - bgc[2]) * (lb[2] - bgc[2]);
          if (eb2 <= Tb2) rmk[ib] = 1; else if (eb2 > Tk2) rmk[ib] = 0;
        }
      }
      for (ib = 0; ib < NB; ib++) if (rmk[ib]) DD[ib * 4 + 3] = 0;
      bc.putImageData(bd, 0, 0);
    }
    big.busy = c3.busy; return big;
  }
  function picPal(ctx) { return (ctx.cfg.palette || []).filter(function (p) { return p.hex && !p.hidden; }); }
  function picQ(ctx, it) {
    var R = (ctx.pics || {})[it.iid]; if (!R) { loadPic(ctx, it); return null; }
    var key = (it.bg !== false ? 'b' : 'n') + '|' + (it.n || 4); if (R.key === key) return R.q;
    R.key = key; R.q = { empty: true }; R.cv = {};
    try {
      // 0.5.0: immagini lunghe divise in colori con piu' punti (stessi punti totali di un'immagine quadrata a 360): righe e dettagli sottili non si perdono
      var iw = R.im.naturalWidth || R.im.width || 1, ih = R.im.naturalHeight || R.im.height || 1, asp = Math.max(iw, ih) / Math.max(1, Math.min(iw, ih)), CUT = asp > 1.5 ? Math.min(900, Math.round(360 * Math.sqrt(asp))) : 360;
      var cut = MM.cutout(R.im, 360, it.bg !== false), busy = false;
      if (cut && cut.busy && it.bg !== false) { busy = true; cut = MM.cutout(R.im, 360, false); }
      // 0.5.8 (prove 28/10): se a 360 le righe sottili sono state ingrossate, la versione lunga a piu' punti (che non le ingrossa)
      // le perdeva tutte (righe nere su crema: restava solo il crema). Allora si resta a 360.
      if (cut && !cut.empty && CUT !== 360 && !cut.thick) cut = picBig(R.im, cut, CUT, it.bg !== false && !busy) || cut;
      if (!cut || cut.empty) return R.q;
      var Pp = MM.prepare({ cv: cut.cv, fixed: null, letterPx: 0 }); if (Pp.empty) return R.q;
      var Q = MM.quantize(Pp, Math.max(1, it.n || 4), [], null), W = Pp.W, H = Pp.H, fgN = 0, i;
      for (i = 0; i < W * H; i++) fgN += Pp.fg[i];
      var auto = Q.nImg ? MM.nearestSet(picPal(ctx), Q.centers.slice(0, Q.nImg), Q.area, {}, Math.max(4, fgN * 0.002)) : [];
      // ritaglio ai pixel pieni
      var x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (Q.labels[y * W + x] >= 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return R.q;
      var w = x1 - x0 + 1, h = y1 - y0 + 1, lab = new Int16Array(w * h);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) lab[y * w + x] = Q.labels[(y + y0) * W + x + x0];
      R.q = { W: w, H: h, labels: lab, area: Q.area, nImg: Q.nImg, auto: auto, busy: busy, centers: Q.centers.slice(0, Q.nImg), cx: x0 + (cut.ox || 0), cy: y0 + (cut.oy || 0), sc: cut.sc, pad: cut.pad, cut: CUT };
    } catch (e) { console.warn('[AFBookHub] picture:', e); }
    return R.q;
  }
  /* 0.5.1: i colori scelti si ricordano insieme al colore vero di ogni gruppo (colsLab). Se la divisione in colori cambia
     (altro numero di colori, versione nuova), ogni gruppo nuovo riprende il colore scelto per il gruppo vecchio piu' simile;
     se non si sa, si riparte dai colori automatici (mai colori scambiati). */
  function picCols(ctx, it, q) {
    var C = q.centers || [], key = q.cut || 360, i, j, ok = !!(it.cols && it.cols.length === q.nImg && (it.cutPx || 360) === key);
    var d2 = function (a, b) { return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]); };
    if (ok && it.colsLab) { if (it.colsLab.length !== q.nImg) ok = false; else for (i = 0; i < q.nImg; i++) if (!it.colsLab[i] || !C[i] || d2(it.colsLab[i], C[i]) > 36) { ok = false; break; } }
    else if (ok && key !== 360) ok = false;
    if (ok && it.colsLab) return it.cols;
    if (!ok) {
      var old = it.cols, oldL = it.colsLab; it.cols = q.auto.slice();
      if (old && oldL && oldL.length === old.length) for (i = 0; i < q.nImg; i++) { var bj = -1, bd = 400; for (j = 0; j < oldL.length; j++) { var e = oldL[j] && C[i] ? d2(C[i], oldL[j]) : 1e9; if (e < bd) { bd = e; bj = j; } } if (bj >= 0 && old[bj]) it.cols[i] = old[bj]; }
      if (key !== 360) it.cutPx = key; else delete it.cutPx;
    }
    it.colsLab = C.map(function (c) { return [Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10, Math.round(c[2] * 10) / 10]; });
    return it.cols;
  }
  // immagine pronta da disegnare: a colori o maschera di un colore (cache per colori scelti)
  /* 0.4.3 (27/10, ALFI: immagine grande "sgranata"): l'immagine si divide in colori a 360 px (come nel Magnet Maker), quindi
     su un'immagine lunga come tutta la copertina ogni quadretto era di 0,7 mm e si vedeva, anche nella stampa. Ora i gruppi di
     colore si ingrandiscono con i contorni morbidi (maschere appena sfumate, poi ingrandite: vince il colore piu' forte):
     circa 0,12 mm per punto, contorni lisci, stessi colori e stesse forme di prima. */
  function picUp(q, f) {
    var W = q.W, H = q.H, L = q.labels, K = q.nImg + 1, W2 = W * f, H2 = H * f, out = new Int16Array(W2 * H2), B = [], tmp = new Float32Array(W * H), a = 0.138, b = 0.724, c, x, y, i;
    for (c = 0; c < K; c++) {   // classe 0 = trasparente (-1), classe c = colore c - 1
      var M = new Float32Array(W * H), lc = c - 1;
      for (i = 0; i < W * H; i++) M[i] = L[i] === lc ? 1 : 0;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) { i = y * W + x; tmp[i] = b * M[i] + a * (M[x > 0 ? i - 1 : i] + M[x < W - 1 ? i + 1 : i]); }
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) { i = y * W + x; M[i] = b * tmp[i] + a * (tmp[y > 0 ? i - W : i] + tmp[y < H - 1 ? i + W : i]); }
      B.push(M);
    }
    for (var Y = 0; Y < H2; Y++) {
      var sy = (Y + 0.5) / f - 0.5, y0 = Math.floor(sy), ty = sy - y0, y1 = Math.min(H - 1, y0 + 1); y0 = Math.max(0, y0);
      for (var X = 0; X < W2; X++) {
        var sx = (X + 0.5) / f - 0.5, x0 = Math.floor(sx), tx = sx - x0, x1 = Math.min(W - 1, x0 + 1); x0 = Math.max(0, x0);
        var i00 = y0 * W + x0, i01 = y0 * W + x1, i10 = y1 * W + x0, i11 = y1 * W + x1, l0 = L[i00];
        if (L[i01] === l0 && L[i10] === l0 && L[i11] === l0) { out[Y * W2 + X] = l0; continue; }
        var best = l0, bv = -1, cand = [l0, L[i01], L[i10], L[i11]];
        for (var k = 0; k < 4; k++) { var Bk = B[cand[k] + 1], v = (Bk[i00] * (1 - tx) + Bk[i01] * tx) * (1 - ty) + (Bk[i10] * (1 - tx) + Bk[i11] * tx) * ty; if (v > bv) { bv = v; best = cand[k]; } }
        out[Y * W2 + X] = best;
      }
    }
    return { W: W2, H: H2, labels: out };
  }
  /* 0.4.5 (27/10, ALFI: immagine lunga su tutta la copertina ancora "sgranata"): i colori si scelgono sempre a 360 px (stessi
     colori di prima), ma i contorni si rifanno sull'immagine vera a risoluzione piena (circa 0,18 mm per punto): ogni punto fine
     prende, tra i colori che ha intorno nella versione a 360 px, quello piu' vicino al suo colore vero (lo sfondo tolto conta
     come un colore). Poi via i puntini e le righe larghe 1 punto (non si stampano). */
  var PIC_SRC = 1600;
  function labOf(r, g, b) {
    var lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }, f3 = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    var R = lin(r), G = lin(g), B = lin(b), fx = f3((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), fy = f3(0.2126 * R + 0.7152 * G + 0.0722 * B), fz = f3((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function picHi(ctx, it, q, R) {
    if (!q.sc || !q.centers || !R.im) return null;
    var w = q.W, h = q.H, mmpp = (+it.mm || 40) / Math.max(w, h);
    var F = Math.min(6, Math.ceil(mmpp / 0.08), Math.max(1, Math.round(2 / q.sc)), Math.floor(Math.sqrt(1.2e6 / (w * h))));   // 0.5.0: contorni fini gia' da 0,08 mm (prima 0,18)
    if (!(F > 1)) return null;
    if (R.hi && R.hi.q === q && R.hi.F === F) return R.hi.v;
    var W2 = w * F, H2 = h * F, cv = document.createElement('canvas'); cv.width = W2; cv.height = H2;
    var g = cv.getContext('2d', { willReadFrequently: true }), k2 = F * q.sc, nw = R.im.naturalWidth || R.im.width, nh = R.im.naturalHeight || R.im.height;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(R.im, -(q.cx - q.pad) / q.sc * k2, -(q.cy - q.pad) / q.sc * k2, nw * k2, nh * k2);
    var d = g.getImageData(0, 0, W2, H2).data, L = q.labels, C = q.centers, out = new Int16Array(W2 * H2), x, y, k, i;
    var nb = new Int8Array(w * h * 9), nc = new Uint8Array(w * h);   // colori presenti attorno a ogni punto a 360 px
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var o = (y * w + x) * 9, c0 = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var xx = x + dx, yy = y + dy, l = xx < 0 || yy < 0 || xx >= w || yy >= h ? -1 : L[yy * w + xx], seen = false; for (k = 0; k < c0; k++) if (nb[o + k] === l) { seen = true; break; } if (!seen) nb[o + c0++] = l; }
      nc[y * w + x] = c0;
    }
    var bs = [0, 0, 0], bn = 0, bt = 0, bgs = [];   // colore dello sfondo tolto (dove intorno e' tutto sfondo)
    for (i = 0; i < W2 * H2; i += 7) { var li0 = (((i / W2) | 0) / F | 0) * w + ((i % W2) / F | 0); if (nc[li0] === 1 && nb[li0 * 9] === -1) { if (d[i * 4 + 3] < 128) { bt++; continue; } var cb = labOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); bs[0] += cb[0]; bs[1] += cb[1]; bs[2] += cb[2]; bn++; if (bgs.length < 20000) bgs.push(cb); } }
    // 0.5.7 (prove 27/10): se lo sfondo e' trasparente davvero (PNG, SVG) non c'e' un colore dello sfondo: prima i pochi punti del
    // bordo della figura (piu' larga di un soffio a piena risoluzione) facevano da "sfondo" col colore della figura, che spariva tutta
    var bgL = bn > 20 && bn > bt ? [bs[0] / bn, bs[1] / bn, bs[2] / bn] : null;
    // 0.5.0: colori dell'immagine quasi uguali allo sfondo tolto (es. bianco su bianco, azzurro come il cielo)
    // (tolleranza come quella del Magnet Maker quando toglie lo sfondo: dal "rumore" dello sfondo, tra 3,5 e 12)
    var TOLf2 = 144, TS2 = 144; if (bgL) { var evs = bgs.map(function (cb) { return Math.sqrt((cb[0] - bgL[0]) * (cb[0] - bgL[0]) + (cb[1] - bgL[1]) * (cb[1] - bgL[1]) + (cb[2] - bgL[2]) * (cb[2] - bgL[2])); }).sort(function (a, b) { return a - b; }); var TOLf = Math.max(3.5, Math.min(12, 2 * (evs[evs.length >> 1] || 0) + 2.5)); TOLf2 = TOLf * TOLf; TS2 = (1.5 * TOLf + 2) * (1.5 * TOLf + 2); }
    var simL = [], anyS = false;
    if (bgL) for (k = 0; k < q.nImg; k++) { var cs = C[k], es = (cs[0] - bgL[0]) * (cs[0] - bgL[0]) + (cs[1] - bgL[1]) * (cs[1] - bgL[1]) + (cs[2] - bgL[2]) * (cs[2] - bgL[2]); simL[k] = es < 225; if (simL[k]) anyS = true; }
    for (y = 0; y < H2; y++) {
      var ly = (y / F) | 0;
      for (x = 0; x < W2; x++) {
        var li = ly * w + ((x / F) | 0), p = y * W2 + x, n0 = nc[li], ob = li * 9;
        if (n0 === 1) { out[p] = nb[ob]; continue; }
        if (d[p * 4 + 3] < 128) { out[p] = -1; continue; }
        var c = labOf(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]), best = L[li], bd = 1e18;
        for (k = 0; k < n0; k++) { var lk = nb[ob + k], t = lk >= 0 ? C[lk] : bgL; if (!t) continue; var e = (c[0] - t[0]) * (c[0] - t[0]) + (c[1] - t[1]) * (c[1] - t[1]) + (c[2] - t[2]) * (c[2] - t[2]); if (e < bd) { bd = e; best = lk; } }
        if (bgL) {   // 0.5.0: tra lo sfondo e un colore quasi uguale non decide il colore (sarebbe a caso) ma la divisione a 360 px
          var eb = (c[0] - bgL[0]) * (c[0] - bgL[0]) + (c[1] - bgL[1]) * (c[1] - bgL[1]) + (c[2] - bgL[2]) * (c[2] - bgL[2]), lL = L[li];
          if (eb < TS2 && (best === -1 || (best >= 0 && simL[best]))) { if (lL === -1 || (lL >= 0 && simL[lL])) best = lL; else { for (k = 0; k < n0; k++) if (nb[ob + k] === -1) { best = -1; break; } } }
        }
        out[p] = best;
      }
    }
    /* 0.5.0: lo sfondo tolto si decide anche sui punti fini, come a 360 px: e' sfondo cio' che e' collegato allo sfondo vero.
       Cosi' i bianchi tra una lettera e l'altra e i bordini bianchi attorno ai disegni diventano sfondo, mentre i bianchi
       chiusi (dentro la A) restano bianchi. I passaggi stretti meno di 3 punti non contano (niente "fughe" dentro i disegni). */
    if (bgL && anyS) {
      var N2 = W2 * H2, grp = new Uint8Array(N2), core = new Uint8Array(N2), seen = new Uint8Array(N2), tmp = new Uint8Array(N2), stk = new Int32Array(N2), sp = 0, x3, y3, ok3;
      // via le striscioline color sfondo larghe meno di 5 punti attaccate allo sfondo (bordi sfumati tra un disegno e il cielo)
      var sm = new Uint8Array(N2), sk = new Uint8Array(N2);
      for (i = 0; i < N2; i++) sm[i] = out[i] >= 0 && simL[out[i]] ? 1 : 0;
      for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) { i = y * W2 + x; ok3 = sm[i]; if (ok3) for (x3 = Math.max(0, x - 2); x3 <= Math.min(W2 - 1, x + 2); x3++) if (!sm[y * W2 + x3]) { ok3 = 0; break; } tmp[i] = ok3; }
      for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) { i = y * W2 + x; ok3 = tmp[i]; if (ok3) for (y3 = Math.max(0, y - 2); y3 <= Math.min(H2 - 1, y + 2); y3++) if (!tmp[y3 * W2 + x]) { ok3 = 0; break; } sk[i] = ok3; }
      for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) { i = y * W2 + x; ok3 = 0; for (x3 = Math.max(0, x - 2); x3 <= Math.min(W2 - 1, x + 2); x3++) if (sk[y * W2 + x3]) { ok3 = 1; break; } tmp[i] = ok3; }
      for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) {
        i = y * W2 + x; if (!sm[i]) continue;
        var keep = false; for (y3 = Math.max(0, y - 2); y3 <= Math.min(H2 - 1, y + 2); y3++) if (tmp[y3 * W2 + x]) { keep = true; break; }
        if (keep) continue;
        var nearBg = false; for (y3 = Math.max(0, y - 2); y3 <= Math.min(H2 - 1, y + 2) && !nearBg; y3++) for (x3 = Math.max(0, x - 2); x3 <= Math.min(W2 - 1, x + 2); x3++) if (out[y3 * W2 + x3] === -1) { nearBg = true; break; }
        if (nearBg) seen[i] = 2;   // (segnato, si cambia dopo: cosi' non si allarga a catena)
      }
      for (i = 0; i < N2; i++) if (seen[i] === 2) { out[i] = -1; seen[i] = 0; }
      for (i = 0; i < N2; i++) {   // (solo i punti che hanno davvero il colore dello sfondo: un prato azzurro scuro o un gatto crema non sono sfondo)
        var lo = out[i]; if (lo === -1) { grp[i] = 1; continue; } if (lo < 0 || !simL[lo]) continue;
        var cg = labOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]), eg = (cg[0] - bgL[0]) * (cg[0] - bgL[0]) + (cg[1] - bgL[1]) * (cg[1] - bgL[1]) + (cg[2] - bgL[2]) * (cg[2] - bgL[2]);
        grp[i] = eg < TOLf2 ? 1 : 0;
      }
      // passaggi larghi almeno 5 punti (i buchini dei contorni disegnati a mano non fanno entrare lo sfondo)
      for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) { i = y * W2 + x; ok3 = 1; for (x3 = Math.max(0, x - 2); x3 <= Math.min(W2 - 1, x + 2); x3++) if (!grp[y * W2 + x3]) { ok3 = 0; break; } tmp[i] = ok3; }
      for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) { i = y * W2 + x; if (!tmp[i]) continue; ok3 = 1; for (y3 = Math.max(0, y - 2); y3 <= Math.min(H2 - 1, y + 2); y3++) if (!tmp[y3 * W2 + x]) { ok3 = 0; break; } core[i] = ok3; }
      for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) {   // semi: il bordo (fuori c'e' solo sfondo tolto) e lo sfondo sicuro a 360 px
        i = y * W2 + x; if (!core[i]) continue;
        var ls = ((y / F) | 0) * w + ((x / F) | 0);
        if (x === 0 || y === 0 || x === W2 - 1 || y === H2 - 1 || (nc[ls] === 1 && nb[ls * 9] === -1)) { seen[i] = 1; stk[sp++] = i; }
      }
      while (sp) {
        var p0 = stk[--sp], x0f = p0 % W2, pn;
        if (x0f > 0) { pn = p0 - 1; if (core[pn] && !seen[pn]) { seen[pn] = 1; stk[sp++] = pn; } }
        if (x0f < W2 - 1) { pn = p0 + 1; if (core[pn] && !seen[pn]) { seen[pn] = 1; stk[sp++] = pn; } }
        if (p0 >= W2) { pn = p0 - W2; if (core[pn] && !seen[pn]) { seen[pn] = 1; stk[sp++] = pn; } }
        if (p0 < N2 - W2) { pn = p0 + W2; if (core[pn] && !seen[pn]) { seen[pn] = 1; stk[sp++] = pn; } }
      }
      // si riallarga di 2 punti (dentro i punti color sfondo): cosi' arriva fino ai bordi dei disegni, bordini bianchi compresi
      for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) { i = y * W2 + x; ok3 = 0; for (x3 = Math.max(0, x - 2); x3 <= Math.min(W2 - 1, x + 2); x3++) if (seen[y * W2 + x3]) { ok3 = 1; break; } tmp[i] = ok3; }
      for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) {
        i = y * W2 + x; if (!grp[i]) continue;
        var isBg = false; for (y3 = Math.max(0, y - 2); y3 <= Math.min(H2 - 1, y + 2); y3++) if (tmp[y3 * W2 + x]) { isBg = true; break; }
        if (isBg) out[i] = -1;
        else if (out[i] === -1 && d[i * 4 + 3] >= 128 && L[((y / F) | 0) * w + ((x / F) | 0)] >= 0) {   // color sfondo ma chiuso dentro il disegno (es. dentro la A, gia' chiaro a 360 px): il colore chiaro piu' vicino
          var cl = labOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]), bbk = -1, bbe = 1e18;
          for (k = 0; k < q.nImg; k++) if (simL[k]) { var tk = C[k], ek = (cl[0] - tk[0]) * (cl[0] - tk[0]) + (cl[1] - tk[1]) * (cl[1] - tk[1]) + (cl[2] - tk[2]) * (cl[2] - tk[2]); if (ek < bbe) { bbe = ek; bbk = k; } }
          if (bbk >= 0) out[i] = bbk;
        }
      }
    }
    var o2 = out.slice(), cnt = {};   // via i punti soli e le righe larghe 1 punto
    for (y = 1; y < H2 - 1; y++) for (x = 1; x < W2 - 1; x++) {
      var q0 = y * W2 + x, l0 = out[q0], nbs = [out[q0 - W2 - 1], out[q0 - W2], out[q0 - W2 + 1], out[q0 - 1], out[q0 + 1], out[q0 + W2 - 1], out[q0 + W2], out[q0 + W2 + 1]], same = 0;
      for (k = 0; k < 8; k++) if (nbs[k] === l0) same++;
      if (same > 2) continue;
      cnt = {}; var bestL = l0, bestN = 0; for (k = 0; k < 8; k++) { var lv = nbs[k]; cnt[lv] = (cnt[lv] || 0) + 1; if (cnt[lv] > bestN) { bestN = cnt[lv]; bestL = lv; } }
      o2[q0] = bestL;
    }
    var v = { W: W2, H: H2, labels: o2, nImg: q.nImg, F: F };
    R.hi = { q: q, F: F, v: v };
    return v;
  }
  /* 0.5.0 (27/10, richieste di ALFI, come nel Magnet Maker):
     - un colore dell'immagine si puo' rendere invisibile ('none'): si toglie e si vede la copertina;
     - tocco su una parte dell'immagine (anteprima nel pannello): cambia il colore SOLO di quella parte (it.regs, ritrovate
       ogni volta dal punto toccato e dal colore che aveva, come nel Magnet Maker);
     - l'immagine si disegna come contorni (non piu' a quadretti): nitida a qualsiasi ingrandimento, sulla copertina 3D,
       nell'editor e nel file da stampare. */
  function picRegs(ctx, it, q) {
    var R = (ctx.pics || {})[it.iid]; if (!R || !it.regs || !it.regs.length) return [];
    var key = it.regs.map(function (r) { return r.x + ',' + r.y + ',' + r.id + ',' + (r.lab || []).join(','); }).join(';');
    if (R.rq && R.rq.q === q && R.rq.key === key) return R.rq.list;
    var list = [], w = q.W, h = q.H;
    it.regs.forEach(function (r) {
      if (!r.id || r.W !== w || r.H !== h || !r.lab) return;
      var ci = -1, bd = 1e18;
      for (var i = 0; i < q.nImg; i++) { if (!(q.area[i] > 0)) continue; var c = q.centers[i], d = (c[0] - r.lab[0]) * (c[0] - r.lab[0]) + (c[1] - r.lab[1]) * (c[1] - r.lab[1]) + (c[2] - r.lab[2]) * (c[2] - r.lab[2]); if (d < bd) { bd = d; ci = i; } }
      if (ci < 0) return;
      var G = MM.region({ W: w, H: h }, { labels: q.labels }, r.x, r.y, ci); if (!G || !G.n) return;
      var dm = new Uint8Array(w * h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (G.mask[y * w + x]) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) dm[yy * w + xx] = 1; }
      list.push({ reg: r, ci: ci, mask: G.mask, dm: dm });
    });
    R.rq = { q: q, key: key, list: list };
    return list;
  }
  // mappa effettiva: i colori dell'immagine + una "parte" in piu' per ogni parte separata (base = versione a 360 px o fine)
  function picEff(ctx, it, q, base) {
    var cols = picCols(ctx, it, q).slice(), regs = picRegs(ctx, it, q), nI = q.nImg;
    if (!regs.length) return { W: base.W, H: base.H, labels: base.labels, cols: cols };
    var F = base === q ? 1 : (base.F || 1), L = base.labels.slice(), W = base.W, H = base.H, w = q.W;
    regs.forEach(function (r, j) {
      var dm = r.dm, ci = r.ci, li = nI + j;
      for (var y = 0; y < H; y++) { var ro = ((y / F) | 0) * w; for (var x = 0; x < W; x++) { var p = y * W + x; if (L[p] === ci && dm[ro + ((x / F) | 0)]) L[p] = li; } }
    });
    return { W: W, H: H, labels: L, cols: cols.concat(regs.map(function (r) { return r.reg.id; })) };
  }
  // contorni per filamento: campo appena sfumato -> curve di livello 0,5 -> Path2D (coordinate: punti della mappa)
  function picVec(ctx, it) {
    var q = picQ(ctx, it), R = (ctx.pics || {})[it.iid]; if (!q || q.empty || !R) return null;
    var Hq = null; try { Hq = picHi(ctx, it, q, R); } catch (e) { Hq = null; }
    var base = Hq || q, E = picEff(ctx, it, q, base);
    var key = (Hq ? Hq.F : 0) + '|' + E.cols.join(',') + '|' + (it.regs || []).map(function (r) { return r.x + ',' + r.y + ',' + r.id; }).join(';');
    if (R.vec && R.vec.key === key && R.vec.base === base) return R.vec.v;
    var W = E.W, H = E.H, L = E.labels, PD = 2, W2 = W + 2 * PD, H2 = H + 2 * PD, ids = [], groups = [], A = new Float32Array(W2 * H2), T = new Float32Array(W2 * H2), TL = TM.lib;
    E.cols.forEach(function (id) { if (id && id !== 'none' && ids.indexOf(id) < 0) ids.push(id); });
    ids.forEach(function (id) {
      var inG = E.cols.map(function (c) { return c === id; }), area = 0, x, y, i;
      A.fill(0);
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) { var l = L[y * W + x]; if (l >= 0 && inG[l]) { A[(y + PD) * W2 + x + PD] = 1; area++; } }
      if (!area) return;
      for (y = 0; y < H2; y++) for (x = 1; x < W2 - 1; x++) { i = y * W2 + x; T[i] = 0.25 * A[i - 1] + 0.5 * A[i] + 0.25 * A[i + 1]; }
      for (y = 1; y < H2 - 1; y++) for (x = 0; x < W2; x++) { i = y * W2 + x; A[i] = 0.25 * T[i - W2] + 0.5 * T[i] + 0.25 * T[i + W2]; }
      for (x = 0; x < W2; x++) { A[x] = 0; A[(H2 - 1) * W2 + x] = 0; } for (y = 0; y < H2; y++) { A[y * W2] = 0; A[y * W2 + W2 - 1] = 0; }
      var path = new Path2D(), nr = 0;
      TL.contours(A, W2, H2).forEach(function (rg) {
        var r2 = TL.simplify(rg, 0.22); if (r2.length < 3) return;
        path.moveTo(r2[0][0] - PD + 0.5, r2[0][1] - PD + 0.5);
        for (var k = 1; k < r2.length; k++) path.lineTo(r2[k][0] - PD + 0.5, r2[k][1] - PD + 0.5);
        path.closePath(); nr++;
      });
      if (nr) groups.push({ id: id, path: path, area: area });
    });
    groups.sort(function (a, b) { return b.area - a.area; });
    var v = { W: W, H: H, groups: groups };
    R.vec = { key: key, base: base, v: v };
    return v;
  }
  // disegna i contorni nel contesto g (trasformazione = punti della mappa). mask: bianco quel colore, nero gli altri
  function paintVec(ctx, g, V, mask) {
    g.lineJoin = 'round'; g.lineWidth = 0.9;
    V.groups.forEach(function (G) { var hx = hexOf(ctx, G.id), c = mask ? (hx === mask ? '#fff' : '#000') : hx; g.fillStyle = c; g.strokeStyle = c; g.fill(G.path, 'evenodd'); g.stroke(G.path); });
  }
  function closePicPart(ctx) { if (ctx.picPart) { ctx.picPart.remove(); ctx.picPart = null; } }
  // anteprima nel pannello: si tocca una parte per cambiarle colore
  function paintPicPrev(ctx, it, q) {
    var P = ctx.p, cv = P && P.picPrev; if (!cv) return; closePicPart(ctx);
    var V = null; try { V = picVec(ctx, it); } catch (e) { V = null; }
    var ww = Math.max(120, (P.picPrevW.clientWidth || 300) - 4), ar = q.H / q.W, cw = ww, ch = cw * ar;
    if (ch > 900) { ch = 900; cw = ch / ar; }
    var dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(1, Math.round(cw * dpr)); cv.height = Math.max(1, Math.round(ch * dpr)); cv.style.width = Math.round(cw) + 'px'; cv.style.height = Math.round(ch) + 'px';
    var g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    if (V) { g.save(); g.scale(cv.width / V.W, cv.height / V.H); paintVec(ctx, g, V, null); g.restore(); }
    else { var img = picCanvas(ctx, it, null); if (img) { g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, cv.width, cv.height); } }
  }
  function picTap(ctx, it, e) {
    var q = picQ(ctx, it), P = ctx.p; if (!q || q.empty) return;
    var r = P.picPrev.getBoundingClientRect(); if (!r.width || !r.height) return;
    var x = Math.floor((e.clientX - r.left) / r.width * q.W), y = Math.floor((e.clientY - r.top) / r.height * q.H);
    if (x < 0 || y < 0 || x >= q.W || y >= q.H) return;
    var E = picEff(ctx, it, q, q), li = E.labels[y * q.W + x];
    if (li < 0) {   // tocco sul bordo: il punto colorato piu' vicino
      var bd = 1e9; for (var yy = Math.max(0, y - 3); yy <= Math.min(q.H - 1, y + 3); yy++) for (var xx = Math.max(0, x - 3); xx <= Math.min(q.W - 1, x + 3); xx++) { var l2 = E.labels[yy * q.W + xx], d = (xx - x) * (xx - x) + (yy - y) * (yy - y); if (l2 >= 0 && d < bd) { bd = d; li = l2; x = xx; y = yy; } }
    }
    if (li < 0) return;
    var reg, mask, ci;
    if (li >= q.nImg) { var rg = picRegs(ctx, it, q)[li - q.nImg]; if (!rg) return; reg = rg.reg; mask = rg.mask; ci = rg.ci; }
    else {
      ci = li; var G = MM.region({ W: q.W, H: q.H }, { labels: q.labels }, x, y, ci); if (!G || !G.n) return; mask = G.mask;
      reg = { x: x, y: y, lab: q.centers[ci].map(function (v) { return Math.round(v * 10) / 10; }), W: q.W, H: q.H, id: null };
    }
    openPicPart(ctx, it, q, e, reg, mask, ci);
  }
  function openPicPart(ctx, it, q, e, reg, mask, ci) {
    var P = ctx.p, cfg = ctx.cfg; closePicPart(ctx);
    // la parte toccata si colora di blu nell'anteprima
    var cv = P.picPrev, g = cv.getContext('2d'), off = document.createElement('canvas'); off.width = q.W; off.height = q.H;
    var oc = off.getContext('2d'), im = oc.createImageData(q.W, q.H);
    for (var i = 0; i < q.W * q.H; i++) if (mask[i]) { im.data[i * 4 + 1] = 113; im.data[i * 4 + 2] = 227; im.data[i * 4 + 3] = 190; }
    oc.putImageData(im, 0, 0); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(off, 0, 0, cv.width, cv.height); g.restore();
    var cols = picCols(ctx, it, q), cur = reg.id || cols[ci];
    var box = el('div', 'afbh-part'); box.style.cssText = 'position:absolute;z-index:6;width:min(380px,calc(100% - 8px));background:#fff;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.22);padding:10px 12px 12px;text-align:left';
    var head = el('div', '', '<b style="font-size:.9rem">' + esc(TX.partTitle) + '</b>'); head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
    var xb = el('button', '', '×'); xb.type = 'button'; xb.setAttribute('aria-label', 'Close'); xb.style.cssText = 'border:0;background:#f2f2f5;border-radius:50%;width:28px;height:28px;font-size:18px;line-height:1;cursor:pointer';
    xb.addEventListener('click', function () { closePicPart(ctx); paintPicPrev(ctx, it, q); }); head.appendChild(xb); box.appendChild(head);
    function pick(id) {
      closePicPart(ctx);
      if (reg.id == null && id === cols[ci]) { paintPicPrev(ctx, it, q); return; }   // stesso colore: niente da separare
      if (!it.regs) it.regs = [];
      if (it.regs.indexOf(reg) < 0) it.regs.push(reg);
      reg.id = id; designChanged(ctx, true);
    }
    var row = el('div', 'afc-swatches afm-sw');
    var nb = el('button', 'afc-swatch afc-im-none'); nb.type = 'button'; nb.dataset.id = 'none'; nb.title = TX.invisible; nb.setAttribute('aria-label', TX.invisible); if (cur === 'none') nb.classList.add('afc-on');
    nb.addEventListener('click', function () { pick('none'); }); row.appendChild(nb);
    (cfg.palette || []).filter(function (p) { return !p.hidden; }).forEach(function (p) {
      var b = el('button', 'afc-swatch'); b.type = 'button'; b.dataset.id = p.id; b.style.setProperty('--sw', p.hex); b.title = p.label; b.setAttribute('aria-label', p.label);
      if (p.id === cur) b.classList.add('afc-on');
      b.addEventListener('click', function () { pick(p.id); }); row.appendChild(b);
    });
    box.appendChild(row);
    var lb = el('button', '', esc(reg.id != null ? TX.partUndo : TX.partAll)); lb.type = 'button'; lb.style.cssText = 'margin-top:8px;border:0;background:none;color:var(--accent-blue,#0071e3);font-family:inherit;font-weight:700;font-size:.85rem;cursor:pointer;padding:4px 0';
    lb.addEventListener('click', function () {
      closePicPart(ctx);
      if (reg.id != null) { it.regs = (it.regs || []).filter(function (r2) { return r2 !== reg; }); designChanged(ctx, true); }
      else { ctx.picSel = ci; refreshPanel(ctx); try { P.picCols.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e2) { } }
    });
    box.appendChild(lb);
    P.picBox.appendChild(box); ctx.picPart = box;
    var br = P.picBox.getBoundingClientRect(), bw = box.offsetWidth || 300;
    box.style.left = Math.max(4, Math.min(br.width - bw - 4, e.clientX - br.left - bw / 2)) + 'px';
    box.style.top = Math.max(0, e.clientY - br.top + 14) + 'px';
    try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e2) { }
  }
  function picCanvas(ctx, it, mask) {
    var q = picQ(ctx, it), R = (ctx.pics || {})[it.iid]; if (!q || q.empty || !R) return null;
    var Hq = null; try { Hq = picHi(ctx, it, q, R); } catch (e) { console.warn('[AFBookHub] picture hi:', e); }
    var base = Hq || q, f = Hq ? 1 : Math.max(1, Math.min(6, Math.ceil((+it.mm || 40) / Math.max(q.W, q.H) / 0.12)));   // 0.4.3: ingrandimento morbido (se non c'e' la versione fine)
    var fk = (Hq ? Hq.F : 0) + 'x' + f; if (R.cvF !== fk) { R.cv = {}; R.cvF = fk; }
    var cols = picCols(ctx, it, q), key = (mask || 'C') + '|' + cols.map(function (id) { return hexOf(ctx, id); }).join(','), C = R.cv || (R.cv = {});
    if (C[key]) return C[key];
    var U = f > 1 ? (R.up && R.up.f === f && R.up.b === base ? R.up : (R.up = { f: f, b: base, u: picUp(base, f) })).u : base;
    var W = U.W, H = U.H, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), im = g.createImageData(W, H), hx = cols.map(function (id) { return hexOf(ctx, id); }), rgb = hx.map(hexRgb);
    for (var i = 0; i < W * H; i++) {
      var l = U.labels[i]; if (l < 0 || cols[l] === 'none') continue;
      var c = mask ? (hx[l] === mask ? [255, 255, 255] : [0, 0, 0]) : rgb[l];
      im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    if (Object.keys(C).length > 12) R.cv = C = {};
    return (C[key] = cv);
  }
  function hexRgb(h) { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lum(h) { var c = hexRgb(h); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }

  // ---- disegno a mano libera: tratti nel foglio quadrato 0..1 { c: colore, w: spessore (frazione), p: [[x, y]...], e: gomma }
  // 0.5.5: s = tratto dritto (linea, rettangolo, cerchio); f = riempimento (secchiello): anelli [x0, y0, x1, y1, ...] nel foglio
  function inkQ(q) { return !!q && !q.e && ((q.p && q.p.length > 0) || (q.f && q.f.length > 0)); }
  function drawBox(it) {
    var b = [1e9, 1e9, -1e9, -1e9];
    (it.strokes || []).forEach(function (q) {
      if (q.e) return;
      if (q.f) { q.f.forEach(function (r) { for (var i = 0; i + 1 < r.length; i += 2) { b[0] = Math.min(b[0], r[i]); b[1] = Math.min(b[1], r[i + 1]); b[2] = Math.max(b[2], r[i]); b[3] = Math.max(b[3], r[i + 1]); } }); return; }
      if (!q.p) return; var rr = (q.w || 0.03) / 2; q.p.forEach(function (p) { b[0] = Math.min(b[0], p[0] - rr); b[1] = Math.min(b[1], p[1] - rr); b[2] = Math.max(b[2], p[0] + rr); b[3] = Math.max(b[3], p[1] + rr); });
    });
    if (b[0] > b[2]) return [0, 0, 1, 1];
    return b;
  }
  function strokePath(g, p, straight) {
    g.beginPath();
    if (p.length === 1) { g.moveTo(p[0][0], p[0][1]); g.lineTo(p[0][0] + 1e-4, p[0][1]); return; }
    g.moveTo(p[0][0], p[0][1]);
    if (straight) { for (var j = 1; j < p.length; j++) g.lineTo(p[j][0], p[j][1]); return; }
    for (var i = 1; i < p.length - 1; i++) { var mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; g.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
    g.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
  }
  var FILLP = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function fillPath(q) {
    var P0 = FILLP && FILLP.get(q); if (P0) return P0;
    var pa = new Path2D();
    q.f.forEach(function (r) { if (r.length < 6) return; pa.moveTo(r[0], r[1]); for (var i = 2; i + 1 < r.length; i += 2) pa.lineTo(r[i], r[i + 1]); pa.closePath(); });
    if (FILLP) FILLP.set(q, pa);
    return pa;
  }
  // tratti nel contesto g (trasformazione: unita' del foglio). mask: bianco il colore, nero gli altri; la gomma cancella solo il disegno
  function renderStrokes(ctx, g, strokes, mask) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    strokes.forEach(function (q) {
      var col = q.e ? '#000' : mask ? (hexOf(ctx, q.c) === mask ? '#fff' : '#000') : hexOf(ctx, q.c);
      if (q.f) { if (!q.f.length) return; g.globalCompositeOperation = 'source-over'; g.fillStyle = col; g.fill(fillPath(q), 'evenodd'); return; }
      if (!q.p || !q.p.length) return;
      g.globalCompositeOperation = q.e ? 'destination-out' : 'source-over';
      g.strokeStyle = col;
      g.lineWidth = q.w || 0.03; strokePath(g, q.p, q.s); g.stroke();
    });
    g.globalCompositeOperation = 'source-over';
  }
  function drawCanvas(ctx, it, mask, px) {
    var b = drawBox(it), bw = b[2] - b[0], bh = b[3] - b[1], N = px || 1024, k = N / Math.max(bw, bh);
    var key = (mask || 'C') + '|' + N + '|' + JSON.stringify(it.strokes).length + '|' + (it.strokes || []).length + '|' + (it._rev || 0) + '|' + (mask ? '' : (it.strokes || []).map(function (q) { return q.c; }).join(','));
    var C = ctx._dc = ctx._dc || {}, E = C[it.iid]; if (E && E.key === key) return E.cv;
    var cv = (E && E.cv && !px) ? E.cv : document.createElement('canvas'); cv.width = Math.max(2, Math.ceil(bw * k)); cv.height = Math.max(2, Math.ceil(bh * k));
    var g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, -b[0] * k, -b[1] * k); g.clearRect(b[0], b[1], bw, bh);
    renderStrokes(ctx, g, it.strokes || [], mask);
    if (!px) C[it.iid] = { key: key, cv: cv };
    return cv;
  }
  /* 0.5.5 (ALFI: "volevo riempire uno spazio e non potevo"): secchiello. Si guarda il disegno a 1024 punti per lato, si prende
     la zona chiusa toccata (stesso colore, o vuota) e la si salva come contorno, allargato di 2 punti per non lasciare fessure
     sotto le righe. Se la zona vuota tocca il bordo del foglio vuol dire che non era chiusa (leak). */
  var FILL_R = 1024;
  function fillRegion(ctx, strokes, x, y) {
    var R = FILL_R, cv = fillRegion.cv || (fillRegion.cv = document.createElement('canvas')); cv.width = R; cv.height = R;
    var g = cv.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, R, R);
    g.setTransform(R, 0, 0, R, 0, 0); renderStrokes(ctx, g, strokes, null); g.setTransform(1, 0, 0, 1, 0, 0);
    var d = g.getImageData(0, 0, R, R).data, N = R * R, sx = clampN(Math.floor(x * R), 0, R - 1), sy = clampN(Math.floor(y * R), 0, R - 1), si = (sy * R + sx) * 4;
    var bgSeed = d[si + 3] < 128, r0 = d[si], g0 = d[si + 1], b0 = d[si + 2], A = new Uint8Array(N), i, j;
    for (i = 0, j = 0; i < N; i++, j += 4) A[i] = bgSeed ? (d[j + 3] < 128 ? 1 : 0) : (d[j + 3] >= 128 && Math.abs(d[j] - r0) + Math.abs(d[j + 1] - g0) + Math.abs(d[j + 2] - b0) < 90 ? 1 : 0);
    var M = new Uint8Array(N), S = [sx, sy], edge = false, x0 = R, x1 = -1, y0 = R, y1 = -1, cnt = 0;
    while (S.length) {
      var yy = S.pop(), xx = S.pop(), row = yy * R;
      if (M[row + xx] || !A[row + xx]) continue;
      var xl = xx, xr = xx;
      while (xl > 0 && !M[row + xl - 1] && A[row + xl - 1]) xl--;
      while (xr < R - 1 && !M[row + xr + 1] && A[row + xr + 1]) xr++;
      for (var k = xl; k <= xr; k++) M[row + k] = 1;
      cnt += xr - xl + 1;
      if (xl === 0 || xr === R - 1 || yy === 0 || yy === R - 1) edge = true;
      if (xl < x0) x0 = xl; if (xr > x1) x1 = xr; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      for (var dy = -1; dy <= 1; dy += 2) {
        var ny = yy + dy; if (ny < 0 || ny >= R) continue;
        var nr = ny * R, open = false;
        for (k = xl; k <= xr; k++) { var ok = !M[nr + k] && A[nr + k]; if (ok && !open) { S.push(k, ny); open = true; } else if (!ok) open = false; }
      }
    }
    if (!cnt) return null;
    // allargato di 2 punti (sotto il bordo sfumato delle righe) e passato a contorno come le immagini
    var PD = 3, ox = x0 - PD, oy = y0 - PD, W = x1 - x0 + 1 + 2 * PD, H = y1 - y0 + 1 + 2 * PD, F = new Float32Array(W * H), T = new Float32Array(W * H), xi, yi, ii;
    for (yi = y0; yi <= y1; yi++) for (xi = x0; xi <= x1; xi++) {
      if (!M[yi * R + xi]) continue;
      for (var ey = -2; ey <= 2; ey++) for (var ex = -2; ex <= 2; ex++) if (ex * ex + ey * ey <= 5) F[(yi + ey - oy) * W + (xi + ex - ox)] = 1;
    }
    for (yi = 0; yi < H; yi++) for (xi = 1; xi < W - 1; xi++) { ii = yi * W + xi; T[ii] = 0.25 * F[ii - 1] + 0.5 * F[ii] + 0.25 * F[ii + 1]; }
    for (yi = 1; yi < H - 1; yi++) for (xi = 0; xi < W; xi++) { ii = yi * W + xi; F[ii] = 0.25 * T[ii - W] + 0.5 * T[ii] + 0.25 * T[ii + W]; }
    for (xi = 0; xi < W; xi++) { F[xi] = 0; F[(H - 1) * W + xi] = 0; } for (yi = 0; yi < H; yi++) { F[yi * W] = 0; F[yi * W + W - 1] = 0; }
    var TL = TM.lib, rings = [];
    TL.contours(F, W, H).forEach(function (rg) {
      var r2 = TL.simplify(rg, 0.4); if (r2.length < 3 || Math.abs(TL.ringArea(r2)) < 6) return;
      var flat = []; r2.forEach(function (p) { flat.push(Math.round(clampN((p[0] + ox + 0.5) / R, 0, 1) * 1e4) / 1e4, Math.round(clampN((p[1] + oy + 0.5) / R, 0, 1) * 1e4) / 1e4); });
      rings.push(flat);
    });
    if (!rings.length) return null;
    return { f: rings, leak: bgSeed && edge };
  }

  // ---- foglio da disegno (si apre sopra il configuratore): penna con i colori dei filamenti, 3 spessori, gomma, annulla;
  // 0.5.5: linea, rettangolo, cerchio, secchiello (riempi), rifai
  var DRAW_W = [0.014, 0.028, 0.05];
  var ICO_LINE = '<path d="M5 19L19 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
  var ICO_RECT = '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/>';
  var ICO_CIRC = '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/>';
  var ICO_FILL = '<path d="M4.6 11.4l6.3-6.3 7.4 7.4-6 6a1.6 1.6 0 0 1-2.3 0l-5.4-5.4a1.2 1.2 0 0 1 0-1.7z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M5 12.5h13" stroke="currentColor" stroke-width="1.9"/><path class="afbh-drop" d="M20.2 14.6s1.8 2.2 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-1.2 1.8-3.4 1.8-3.4z" fill="currentColor" stroke="currentColor" stroke-width=".8"/>';
  var ICO_ERASE = '<path d="M4 16.5l8.5-8.5 6 6-5 5H8.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 19.5h11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>';
  function shapePts(k, a, b, sq) {
    var x0 = a[0], y0 = a[1], x1 = b[0], y1 = b[1];
    if (sq && k !== 'line') { var s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x1 = clampN(x0 + (x1 >= x0 ? s : -s), 0, 1); y1 = clampN(y0 + (y1 >= y0 ? s : -s), 0, 1); }
    if (k === 'line') return [[x0, y0], [x1, y1]];
    if (k === 'rect') return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2, out = [];
    for (var i = 0; i <= 96; i++) { var t = i / 96 * Math.PI * 2; out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
    return out;
  }
  function openBoard(ctx, it, onDone) {
    var ui = ctx.ui, cfg = ctx.cfg, strokes = JSON.parse(JSON.stringify((it && it.strokes) || [])), hist = [], fut = [], tool = 'pen';
    var pens = (cfg.drawColors || ['black', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white', 'brown']).filter(function (id) { return (cfg.palette || []).some(function (p) { return p.id === id; }); });
    var pen = (it && it.pen) || pens[0] || 'black', wi = (it && it.wi != null) ? it.wi : 1;
    var bd = el('div', 'afbh-board'); bd.innerHTML =
      '<div class="afbh-board-in"><div class="afbh-bhead"><b></b><button type="button" class="afbh-bx" aria-label="Close">' + ICON_X + '</button></div>' +
      '<div class="afbh-bsheet"><canvas></canvas></div><p class="afbh-bhint"></p>' +
      '<div class="afbh-btools"><div class="afbh-bpens"></div><div class="afbh-brow afbh-btl"></div><div class="afbh-brow"><div class="afbh-bw"></div><button type="button" class="afbh-btool" data-t="undo"></button><button type="button" class="afbh-btool" data-t="redo"></button><button type="button" class="afbh-btool" data-t="clear"></button></div></div>' +
      '<div class="afbh-bfoot"><button type="button" class="afbh-bcancel"></button><button type="button" class="afbh-bdone"></button></div></div>';
    ui.modal.appendChild(bd);
    var q = function (s) { return bd.querySelector(s); }, cv = q('canvas'), sheet = q('.afbh-bsheet'), hintEl = q('.afbh-bhint');
    q('.afbh-bhead b').textContent = it ? TX.editDraw : TX.drawTitle; q('.afbh-bcancel').textContent = TX.drawCancel; q('.afbh-bdone').textContent = TX.drawDone;
    var bU = q('[data-t="undo"]'), bR = q('[data-t="redo"]'), bC = q('[data-t="clear"]'), tlEl = q('.afbh-btl'), tBtn = {};
    var svg = function (s) { return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' + s + '</svg>'; };
    [['pen', ICO_PEN, TX.drawPen], ['line', ICO_LINE, TX.drawLine], ['rect', ICO_RECT, TX.drawRect], ['circ', ICO_CIRC, TX.drawCirc], ['fill', ICO_FILL, TX.drawFill], ['erase', ICO_ERASE, TX.drawEraser]].forEach(function (t) {
      var b = el('button', 'afbh-btool', svg(t[1]) + '<span>' + esc(t[2]) + '</span>'); b.type = 'button'; b.dataset.t = t[0]; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { tool = (t[0] === 'erase' && tool === 'erase') ? 'pen' : t[0]; paintTools(); });
      b.style.padding = '0 9px'; tlEl.appendChild(b); tBtn[t[0]] = b;
    });
    bU.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg><span>' + esc(TX.drawUndo) + '</span>';
    bR.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg><span>' + esc(TX.drawRedo) + '</span>';
    bC.innerHTML = '<span>' + esc(TX.drawClear) + '</span>';
    var pensEl = q('.afbh-bpens');
    pens.forEach(function (id) { var p = pal(ctx, id), b = el('button', 'afc-swatch'); b.type = 'button'; b.dataset.id = id; b.style.setProperty('--sw', p.hex); b.title = p.label; b.setAttribute('aria-label', p.label); b.addEventListener('click', function () { pen = id; if (tool === 'erase') tool = 'pen'; paintTools(); }); pensEl.appendChild(b); });
    pensEl.appendChild(customSwatch(function () { return pal(ctx, pen).hex; }, function (id) { pen = id; if (tool === 'erase') tool = 'pen'; paintTools(); }));   // 0.6.0 (ALFI): colore a scelta, tavolozza con tutti i colori
    var wEl = q('.afbh-bw');
    DRAW_W.forEach(function (w, i) { var b = el('button', 'afbh-bwb', '<i style="width:' + (5 + i * 5) + 'px;height:' + (5 + i * 5) + 'px"></i>'); b.type = 'button'; b.dataset.i = i; b.setAttribute('aria-label', TX.drawSize + ' ' + (i + 1)); b.addEventListener('click', function () { wi = i; if (tool === 'fill') tool = 'pen'; paintTools(); }); wEl.appendChild(b); });
    var noteT = 0;
    function hintOf() { return tool === 'fill' ? TX.drawHintFill : (tool === 'line' || tool === 'rect' || tool === 'circ') ? TX.drawHintShape : TX.drawHint; }
    function boardNote(t) { clearTimeout(noteT); hintEl.textContent = t; hintEl.style.color = '#d70015'; hintEl.style.fontWeight = '700'; noteT = setTimeout(function () { hintEl.style.color = ''; hintEl.style.fontWeight = ''; hintEl.textContent = hintOf(); }, 5000); }
    function paintTools() {
      var hx = pal(ctx, pen).hex;
      [].forEach.call(pensEl.children, function (b) { if (b.dataset.id === 'custom') paintCustom(b, tool !== 'erase' && String(pen).indexOf('c:') === 0 ? pen : ''); else b.classList.toggle('afc-on', tool !== 'erase' && b.dataset.id === pen); });
      [].forEach.call(wEl.children, function (b) { b.classList.toggle('afc-on', tool !== 'fill' && +b.dataset.i === wi); b.querySelector('i').style.background = tool === 'erase' ? '#fff' : hx; });
      Object.keys(tBtn).forEach(function (k) { tBtn[k].classList.toggle('afc-on', tool === k); tBtn[k].setAttribute('aria-pressed', tool === k ? 'true' : 'false'); });
      var dr = tBtn.fill.querySelector('.afbh-drop'); if (dr) { dr.setAttribute('fill', hx); dr.setAttribute('stroke', lum(hx) > 225 ? '#86868b' : hx); }
      bU.disabled = !hist.length; bR.disabled = !fut.length;
      if (hintEl.style.color === '') hintEl.textContent = hintOf();
      cv.style.cursor = tool === 'fill' ? 'cell' : 'crosshair';
    }
    var S = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    function size() { var w = Math.min(sheet.clientWidth || 300, (window.innerHeight || 700) - 340); w = Math.max(220, w); cv.style.width = cv.style.height = w + 'px'; S = w; cv.width = cv.height = Math.round(w * dpr); paint(); }
    function paint() {
      var g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      var bg = pal(ctx, ctx.st.colors.cover).hex; g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
      var off = paint.off || (paint.off = document.createElement('canvas')); off.width = cv.width; off.height = cv.height;
      var og = off.getContext('2d'); og.setTransform(cv.width, 0, 0, cv.height, 0, 0); og.clearRect(0, 0, 1, 1); renderStrokes(ctx, og, strokes, null);
      g.drawImage(off, 0, 0);
    }
    function save() { hist.push(JSON.stringify(strokes)); if (hist.length > 80) hist.shift(); fut = []; }
    var cur = null, org = null, shp = null;
    function pt(e) { var r = cv.getBoundingClientRect(); return [clampN((e.clientX - r.left) / r.width, 0, 1), clampN((e.clientY - r.top) / r.height, 0, 1)]; }
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault(); if (cur) return; var p0 = pt(e);
      if (tool === 'fill') {
        var F = null; try { F = fillRegion(ctx, strokes, p0[0], p0[1]); } catch (er) { console.warn('[AFBookHub] fill:', er); }
        if (!F) return; save(); strokes.push({ c: pen, f: F.f }); paint(); paintTools();
        if (F.leak) boardNote(TX.drawLeak);
        return;
      }
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      save(); cur = { c: pen, w: DRAW_W[wi] * (tool === 'erase' ? 1.6 : 1), p: [p0] }; if (tool === 'erase') cur.e = 1;
      shp = (tool === 'line' || tool === 'rect' || tool === 'circ') ? tool : null; org = p0;
      if (shp) { cur.s = 1; cur.p = shapePts(shp, org, p0, e.shiftKey); }
      strokes.push(cur); paint(); paintTools();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!cur) return; e.preventDefault(); var p = pt(e);
      if (shp) { cur.p = shapePts(shp, org, p, e.shiftKey); paint(); return; }
      var l = cur.p[cur.p.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.003) { cur.p.push(p); paint(); }
    });
    function up() {
      if (!cur) return;
      if (shp) { var a = cur.p[0], ext = 0; cur.p.forEach(function (p) { ext = Math.max(ext, Math.abs(p[0] - a[0]), Math.abs(p[1] - a[1])); }); if (ext < 0.006) strokes = JSON.parse(hist.pop()); }
      cur.p = cur.p.map(function (p) { return [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]; }); cur = null; shp = null; paint(); paintTools();
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    function undo() { if (!hist.length || cur) return; fut.push(JSON.stringify(strokes)); strokes = JSON.parse(hist.pop()); paint(); paintTools(); }
    function redo() { if (!fut.length || cur) return; hist.push(JSON.stringify(strokes)); strokes = JSON.parse(fut.pop()); paint(); paintTools(); }
    bU.addEventListener('click', undo); bR.addEventListener('click', redo);
    function onKey(e) {
      if (!(e.ctrlKey || e.metaKey) || String(e.key).toLowerCase() !== 'z' && String(e.key).toLowerCase() !== 'y') return;
      var tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
      e.preventDefault(); if (String(e.key).toLowerCase() === 'y' || e.shiftKey) redo(); else undo();
    }
    window.addEventListener('keydown', onKey);
    var clrAt = 0;
    bC.addEventListener('click', function () { var now = Date.now(); if (now - clrAt > 3000) { clrAt = now; bC.querySelector('span').textContent = TX.drawSure; setTimeout(function () { bC.querySelector('span').textContent = TX.drawClear; }, 3000); return; } clrAt = 0; save(); strokes = []; bC.querySelector('span').textContent = TX.drawClear; paint(); paintTools(); });
    function close(ok) {
      if (ok && !strokes.some(inkQ)) { boardNote(TX.drawEmpty); flashNote(ctx, TX.drawEmpty); return; }
      bd.remove(); ctx._board = null; window.removeEventListener('resize', size); window.removeEventListener('keydown', onKey); clearTimeout(noteT);
      if (ok) onDone(strokes, { pen: pen, wi: wi });
    }
    q('.afbh-bx').addEventListener('click', function () { close(false); }); q('.afbh-bcancel').addEventListener('click', function () { close(false); }); q('.afbh-bdone').addEventListener('click', function () { close(true); });
    ctx._board = { close: close };
    window.addEventListener('resize', size);
    requestAnimationFrame(function () { size(); paintTools(); });
  }
  /* 0.5.5 (ALFI: "se lo confermo e poi voglio modificarlo, come faccio?"): riapre il foglio col disegno di prima (matita nella
     lista, tasto "Edit drawing" subito sotto la lista, doppio tocco sul disegno nel riquadro). Le parti gia' fatte restano
     della stessa grandezza e nello stesso punto anche se si aggiunge qualcosa fuori. */
  function editDraw(ctx, it) {
    if (!it || it.type !== 'draw' || ctx._board) return;
    openBoard(ctx, it, function (strokes, o) {
      var b0 = drawBox(it), s = it.mm / Math.max(b0[2] - b0[0], b0[3] - b0[1], 1e-6), c0 = [(b0[0] + b0[2]) / 2, (b0[1] + b0[3]) / 2];
      it.strokes = strokes; it.pen = o.pen; it.wi = o.wi; it._rev = (it._rev || 0) + 1;
      var b1 = drawBox(it), dx = ((b1[0] + b1[2]) / 2 - c0[0]) * s, dy = ((b1[1] + b1[3]) / 2 - c0[1]) * s, a = (it.rot || 0) * DEG;
      it.mm = s * Math.max(b1[2] - b1[0], b1[3] - b1[1], 1e-6);
      it.u += dx * Math.cos(a) - dy * Math.sin(a); it.v += dx * Math.sin(a) + dy * Math.cos(a);
      clampItem(ctx, it);
      renderItems(ctx); designChanged(ctx, true);
    });
  }

  /* ---- riquadro 2D: la copertina aperta in piano vista da fuori (standard dei configuratori AF: tocco = scegli,
     trascina = sposta, pallino nell'angolo = grandezza, pallino sopra = rotazione, due dita = tutte e due, righe di centro
     di ogni pezzo che si colorano quando ci si aggancia). Si puo' ingrandire un pezzo solo (davanti, dorso, dietro). */
  function edGeo(ctx) {
    var cv = ctx.p.edCv, L = layout(ctx), view = ctx.edView || 'all';
    var b = view === 'all' ? L.box : L.parts[view].sbox, padMM = view === 'all' ? 2 : 5;
    var b0 = b[0] - padMM, b1 = b[1] - padMM, bw = b[2] - b[0] + 2 * padMM, bh = b[3] - b[1] + 2 * padMM;
    var css = cv.parentNode.clientWidth || 300, pad = 10, maxH = Math.max(260, Math.min(560, (window.innerHeight || 800) * 0.62));
    var k = (css - 2 * pad) / bw; if (bh * k + 2 * pad > maxH) k = (maxH - 2 * pad) / bh;
    var W = css, H = Math.round(bh * k + 2 * pad), ox = (W - bw * k) / 2, oy = pad;
    return { k: k, W: W, H: H, L: L,
      toS: function (u, v) { return [ox + (u - b0) * k, oy + (v - b1) * k]; },
      toL: function (x, y) { return [b0 + (x - ox) / k, b1 + (y - oy) / k]; },
      M: [k, 0, 0, k, ox - b0 * k, oy - b1 * k] };
  }
  function itemCorners(ctx, it) {
    var b = itemBox(ctx, it), a = (it.rot || 0) * DEG, c = Math.cos(a), s = Math.sin(a);
    var P = function (x, y) { return [it.u + x * c - y * s, it.v + x * s + y * c]; };
    return { b: b, a: a, P: P, pts: [P(b[0], b[1]), P(b[2], b[1]), P(b[2], b[3]), P(b[0], b[3])] };
  }
  function edBox(ctx, G, it) {
    var C = itemCorners(ctx, it), S = function (q) { return G.toS(q[0], q[1]); }, b = C.b;
    var pts = C.pts.map(S), top = S(C.P((b[0] + b[2]) / 2, b[1])), up = [Math.sin(C.a), -Math.cos(C.a)], m = 11;
    var g = { pts: pts, a: C.a, c: S([it.u, it.v]), rs: pts[2], top: top, rt: [top[0] + up[0] * 26, top[1] + up[1] * 26] };
    var cl = function (q) { return [clampN(q[0], m, G.W - m), clampN(q[1], m, G.H - m)]; };
    g.rs = cl(g.rs); g.rt = cl(g.rt); if (Math.hypot(g.rs[0] - g.rt[0], g.rs[1] - g.rt[1]) < 30) g.rt = cl([g.rs[0] - 34, g.rs[1]]);
    return g;
  }
  function drawEditor(ctx) {
    var P = ctx.p; if (!P || !P.edCv || ctx._edPend) return; ctx._edPend = true;
    requestAnimationFrame(function () { ctx._edPend = false; if (current === ctx && P.edCv.offsetParent !== null) paintEditor(ctx); });
  }
  function ringsPath(c, rings) { rings.forEach(function (r) { r.forEach(function (q, j) { if (j) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); }); }
  function paintEditor(ctx) {
    var P = ctx.p, st = ctx.st, cv = P.edCv, G = edGeo(ctx), L = G.L, dpr = Math.min(2, window.devicePixelRatio || 1), E = ctx.ed || {};
    cv.style.height = G.H + 'px'; cv.width = Math.round(G.W * dpr); cv.height = Math.round(G.H * dpr);
    var c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    var colC = pal(ctx, st.colors.cover).hex, dark = lum(colC) < 110, M = G.M;
    var setL = function () { c.setTransform(dpr * M[0], 0, 0, dpr * M[3], dpr * M[4], dpr * M[5]); };
    // pezzi: sagoma (cerniere comprese) piu' chiara, faccia esterna piena (li' si stampano i disegni)
    setL();
    c.save(); c.shadowColor = 'rgba(0,0,0,.16)'; c.shadowBlur = 6 * dpr; c.shadowOffsetY = 1.5 * dpr;
    PARTS.forEach(function (p) { c.beginPath(); ringsPath(c, L.parts[p].sil); c.fillStyle = colC; c.fill('evenodd'); });
    c.restore();
    PARTS.forEach(function (p) { c.beginPath(); ringsPath(c, L.parts[p].sil); c.fillStyle = dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.10)'; c.fill('evenodd'); c.beginPath(); ringsPath(c, L.parts[p].face); c.fillStyle = colC; c.fill('evenodd'); });
    // disegni: interi un po' trasparenti (si vede cosa esce), poi pieni solo dove si stampano (sulle facce)
    var items = liveItems(ctx);
    if (items.length) {
      c.save(); c.globalAlpha = 0.28; items.forEach(function (it) { drawItem(ctx, c, it, null); }); c.restore();
      c.save(); c.beginPath(); PARTS.forEach(function (p) { ringsPath(c, L.parts[p].face); }); c.clip('evenodd'); items.forEach(function (it) { drawItem(ctx, c, it, null); }); c.restore();
    }
    // nomi dei pezzi
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.38)'; c.font = '700 ' + clampN(2.4 * G.k, 8, 11) + 'px system-ui, -apple-system, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
    PARTS.forEach(function (p) {
      var fb = L.parts[p].fbox, isSp = p === 'spine', H = st.dir === 'H';
      if (isSp && !H) { var q = G.toS((fb[0] + fb[2]) / 2, fb[3] - 2); c.save(); c.translate(q[0], q[1]); c.rotate(-Math.PI / 2); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(TX.sides[p], 0, 0); c.restore(); return; }
      var q2 = G.toS((fb[0] + fb[2]) / 2, fb[3] - (isSp ? 0.6 : 1.2)); c.fillText(TX.sides[p], q2[0], q2[1]);
    });
    // righe di centro (davanti, dorso, dietro, meta' altezza)
    var hit = E.snap ? { x: E.snap.u != null ? G.toS(E.snap.u, 0)[0] : null, y: E.snap.v != null ? G.toS(0, E.snap.v)[1] : null } : null;
    STD.drawGuides(c, L.guidesU.map(function (u) { return G.toS(u, 0)[0]; }), L.guidesV.map(function (v) { return G.toS(0, v)[1]; }), [0, 0, G.W, G.H], hit, dark, 1);
    // riquadri dei disegni, maniglie di quello scelto
    var selG = null;
    st.items.forEach(function (it, i) {
      if (!hasInk(ctx, it)) return; var g = edBox(ctx, G, it), on = i === st.sel;
      c.beginPath(); g.pts.forEach(function (q, j) { if (j) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath();
      c.setLineDash(on ? [] : [4, 3]); c.lineWidth = on ? 2 : 1; c.strokeStyle = on ? '#0071e3' : (dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.35)'); c.stroke(); c.setLineDash([]);
      if (on) selG = g;
    });
    if (selG) {
      var g = selG, R = 9;
      c.strokeStyle = '#0071e3'; c.lineWidth = 2; c.beginPath(); c.moveTo(g.top[0], g.top[1]); c.lineTo(g.rt[0], g.rt[1]); c.stroke();
      [[g.rs, 's'], [g.rt, 'r']].forEach(function (h) {
        c.beginPath(); c.arc(h[0][0], h[0][1], R, 0, 2 * Math.PI); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#0071e3'; c.stroke();
        c.save(); c.translate(h[0][0], h[0][1]); c.lineWidth = 1.6; c.beginPath();
        if (h[1] === 'r') c.arc(0, 0, R * 0.48, -2.4, 1.2); else { c.rotate(g.a); c.moveTo(-R * .45, -R * .45); c.lineTo(R * .45, R * .45); c.moveTo(R * .45, R * .05); c.lineTo(R * .45, R * .45); c.lineTo(R * .05, R * .45); }
        c.stroke(); c.restore();
      });
      if (E.drag && E.drag.mode !== 'move') {
        var it0 = st.items[st.sel], txt = E.drag.mode === 'r' ? STD.normRot(it0.rot || 0) + '°' : E.drag.mode === 's' ? fmtMM(it0.mm) : fmtMM(it0.mm) + ' · ' + STD.normRot(it0.rot || 0) + '°';
        c.font = '700 12px system-ui, -apple-system, sans-serif'; var tw = c.measureText(txt).width + 14, lx = clampN(g.c[0] - tw / 2, 4, G.W - tw - 4), ly = 4;
        c.fillStyle = 'rgba(0,0,0,.75)'; c.beginPath(); if (c.roundRect) c.roundRect(lx, ly, tw, 20, 6); else c.rect(lx, ly, tw, 20); c.fill();
        c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, lx + 7, ly + 10.5);
      }
    }
    ctx._edPt = function (u, v) { var r = cv.getBoundingClientRect(), q = G.toS(u, v); return [r.left + q[0], r.top + q[1]]; };   // (per le prove automatiche)
    ctx._edHandles = selG ? function () { var r = cv.getBoundingClientRect(); return { size: [r.left + selG.rs[0], r.top + selG.rs[1]], rot: [r.left + selG.rt[0], r.top + selG.rt[1]] }; } : null;
  }
  function fmtMM(v) { return String(Math.round(v * 2) / 2).replace('.', ',') + ' mm'; }
  function clampItem(ctx, it) {
    var L = layout(ctx), r = sizeRange(it); it.mm = Math.round(clampN(+it.mm || 10, r[0], r[1]) * 10) / 10;
    it.u = clampN(it.u, L.box[0], L.box[2]); it.v = clampN(it.v, L.box[1], L.box[3]);
  }
  function editorBind(ctx) {
    var P = ctx.p, cv = P.edCv, st = ctx.st, pts = {};
    function E() { return (ctx.ed = ctx.ed || {}); }
    function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function hitItem(G, p) {
      var q = G.toL(p[0], p[1]), pad = 7 / G.k;
      for (var i = st.items.length - 1; i >= 0; i--) {
        var it = st.items[i]; if (!hasInk(ctx, it)) continue;
        var b = itemBox(ctx, it), a = -(it.rot || 0) * DEG, dx = q[0] - it.u, dy = q[1] - it.v, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
        if (lx >= b[0] - pad && lx <= b[2] + pad && ly >= b[1] - pad && ly <= b[3] + pad) return i;
      }
      return -1;
    }
    function handleAt(G, p) {
      var it = st.items[st.sel]; if (!it || !hasInk(ctx, it)) return null; var g = edBox(ctx, G, it);
      if (Math.hypot(p[0] - g.rt[0], p[1] - g.rt[1]) <= 20) return 'r';
      if (Math.hypot(p[0] - g.rs[0], p[1] - g.rs[1]) <= 20) return 's';
      return null;
    }
    function snapPos(it, G) {
      var L = layout(ctx), tol = 6 / G.k, s = {};
      var a = STD.snapTo(it.u, L.guidesU, tol), b = STD.snapTo(it.v, L.guidesV, tol);
      if (a.hit != null) { it.u = a.v; s.u = a.hit; } if (b.hit != null) { it.v = b.v; s.v = b.hit; }
      return s.u != null || s.v != null ? s : null;
    }
    function pickPinch() {
      var ids = Object.keys(pts), it = st.items[st.sel]; if (ids.length < 2 || !it || !hasInk(ctx, it)) return null; var a = pts[ids[0]], b = pts[ids[1]];
      return { mode: 'pinch', it: it, d0: Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, a0: Math.atan2(b[1] - a[1], b[0] - a[0]), mm0: it.mm, rot0: it.rot || 0 };
    }
    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return; var G = edGeo(ctx), p = pos(e);
      pts[e.pointerId] = [e.clientX, e.clientY]; try { cv.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); cv.focus({ preventScroll: true });
      if (Object.keys(pts).length >= 2) { E().drag = pickPinch(); drawEditor(ctx); return; }
      var hm = handleAt(G, p), it = st.items[st.sel];
      if (hm) { var g = edBox(ctx, G, it); E().drag = { mode: hm, it: it, c: g.c, d0: Math.hypot(p[0] - g.c[0], p[1] - g.c[1]) || 1, a0: Math.atan2(p[1] - g.c[1], p[0] - g.c[0]), mm0: it.mm, rot0: it.rot || 0 }; drawEditor(ctx); return; }
      var i = hitItem(G, p); if (i < 0) { E().drag = null; return; }
      if (st.sel !== i) { st.sel = i; refreshPanel(ctx); }
      it = st.items[i]; E().drag = { mode: 'move', it: it, p0: p, u0: it.u, v0: it.v, moved: false };
      cv.style.cursor = 'grabbing'; drawEditor(ctx);
    });
    cv.addEventListener('pointermove', function (e) {
      if (pts[e.pointerId]) pts[e.pointerId] = [e.clientX, e.clientY];
      var D = E().drag, G = edGeo(ctx), p = pos(e);
      if (!D) { if (e.pointerType === 'mouse') { var h = handleAt(G, p); cv.style.cursor = h === 's' ? 'nwse-resize' : h === 'r' ? 'alias' : hitItem(G, p) >= 0 ? 'grab' : ''; } return; }
      e.preventDefault(); var it = D.it;
      if (D.mode === 'move') {
        var dx = p[0] - D.p0[0], dy = p[1] - D.p0[1]; if (!D.moved && Math.hypot(dx, dy) < 3) return; D.moved = true;
        it.u = D.u0 + dx / G.k; it.v = D.v0 + dy / G.k; E().snap = snapPos(it, G); clampItem(ctx, it);
      } else if (D.mode === 'pinch') {
        var ids = Object.keys(pts); if (ids.length < 2) return; var a = pts[ids[0]], b = pts[ids[1]];
        it.mm = D.mm0 * Math.hypot(b[0] - a[0], b[1] - a[1]) / D.d0; it.auto = false; it.rot = STD.snapRot(D.rot0 + (Math.atan2(b[1] - a[1], b[0] - a[0]) - D.a0) / DEG); clampItem(ctx, it); D.moved = true;
      } else if (D.mode === 's') { it.mm = D.mm0 * Math.hypot(p[0] - D.c[0], p[1] - D.c[1]) / D.d0; it.auto = false; clampItem(ctx, it); D.moved = true; }
      else { it.rot = STD.snapRot(D.rot0 + (Math.atan2(p[1] - D.c[1], p[0] - D.c[0]) - D.a0) / DEG); D.moved = true; }
      designChanged(ctx, false);
    });
    function end(e) {
      delete pts[e.pointerId]; var D = E().drag; if (!D) return;
      if (D.mode === 'pinch' && Object.keys(pts).length) return;
      E().drag = null; E().snap = null; cv.style.cursor = ''; if (D.moved) designChanged(ctx, true); else drawEditor(ctx);
      if (D.mode === 'move' && !D.moved && D.it && D.it.type === 'draw') {   // 0.5.5: doppio tocco = modifica il disegno
        var now = Date.now(), T0 = E().tap; if (T0 && T0.it === D.it && now - T0.t < 450) { E().tap = null; editDraw(ctx, D.it); } else E().tap = { it: D.it, t: now };
      } else E().tap = null;
    }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('keydown', function (e) {
      var it = st.items[st.sel]; if (!it || !hasInk(ctx, it)) return; var s2 = e.shiftKey ? 2 : 0.5, k2 = e.key, used = true;
      if (k2 === 'ArrowLeft') it.u -= s2; else if (k2 === 'ArrowRight') it.u += s2; else if (k2 === 'ArrowUp') it.v -= s2; else if (k2 === 'ArrowDown') it.v += s2;
      else if (k2 === '+' || k2 === '=') { it.mm += 1; it.auto = false; } else if (k2 === '-') { it.mm -= 1; it.auto = false; }
      else if (k2 === ']' || k2 === '[') it.rot = STD.normRot((it.rot || 0) + (k2 === ']' ? 1 : -1) * (e.shiftKey ? 15 : 1));
      else if (k2 === 'Delete' || k2 === 'Backspace') { removeItem(ctx, st.sel); e.preventDefault(); return; }
      else used = false;
      if (used) { e.preventDefault(); clampItem(ctx, it); designChanged(ctx, false); clearTimeout(ctx._kT); ctx._kT = setTimeout(function () { designChanged(ctx, true); }, 300); }
    });
    if (window.ResizeObserver) { var w0 = 0; new ResizeObserver(function () { var w = P.ed.clientWidth; if (w && w !== w0) { w0 = w; drawEditor(ctx); } }).observe(P.ed); }
  }
  // un disegno cambiato: riquadro subito, 3D al prossimo fotogramma; full = anche pannello, prezzo, salvataggio
  function designChanged(ctx, full) {
    drawEditor(ctx); updateDecals(ctx); if (ctx.p && ctx.p.bar) ctx.p.bar.sync();
    if (full) { refreshPanel(ctx); updateBuy(ctx); }
  }
  // dove mettere un disegno nuovo: al centro della copertina che si vede (davanti per i VERTICAL, dietro per gli HORIZONTAL)
  function newSpot(ctx) {
    var L = layout(ctx), p = ctx.edView && ctx.edView !== 'all' ? ctx.edView : 'front', P = L.parts[p];
    var n = ctx.st.items.filter(function (it) { return Math.abs(it.u - P.cu) < 1 && Math.abs(it.v - P.cv) < 30; }).length;
    return [P.cu, P.cv + (n % 4) * 9 - (n ? 0 : 0)];
  }
  function partWidth(ctx, p) { var b = layout(ctx).parts[p].fbox; return [b[2] - b[0], b[3] - b[1]]; }
  function addItem(ctx, it) {
    var st = ctx.st; if (st.items.length >= MAX_ITEMS) { flashNote(ctx, TX.itemsMax.replace('{n}', MAX_ITEMS)); return null; }
    ctx.warnErr = null;   // 0.5.7: un vecchio errore (immagine non letta) non resta in fondo mentre si fa altro
    var sp = newSpot(ctx); it.id = it.id || newId(); if (it.u == null) { it.u = sp[0]; it.v = sp[1]; } it.rot = it.rot || 0;
    st.items.push(it); st.sel = st.items.length - 1; clampItem(ctx, it);
    renderItems(ctx); designChanged(ctx, true); return it;
  }
  function removeItem(ctx, i) {
    var st = ctx.st; if (i < 0 || i >= st.items.length) return;
    st.items.splice(i, 1); st.sel = Math.min(st.sel, st.items.length - 1);
    renderItems(ctx); designChanged(ctx, true);
  }
  /* 0.5.5 (ALFI: "copiare e incollare un testo o un disegno"): Copy prende quello scelto (testo, disegno o immagine), Paste ne
     mette uno uguale un po' spostato (ogni volta un po' piu' in la'); anche Ctrl/Cmd+C, Ctrl/Cmd+V e Ctrl/Cmd+D (duplica).
     Resta copiato finche' la pagina e' aperta, anche passando a un altro libro. */
  var CLIP = null;
  function copyItem(ctx) {
    var it = ctx.st.items[ctx.st.sel]; if (!it || !hasInk(ctx, it)) return false;
    var o = {}; for (var k in it) if (k !== 'part' && k !== '_rev' && k !== 'mm0') o[k] = it[k];
    CLIP = { it: JSON.parse(JSON.stringify(o)), n: 0, im: it.type === 'pic' && ctx.pics && ctx.pics[it.iid] ? ctx.pics[it.iid].im : null };
    return true;
  }
  function pasteItem(ctx) {
    if (!CLIP) return null; var st = ctx.st;
    if (st.items.length >= MAX_ITEMS) { flashNote(ctx, TX.itemsMax.replace('{n}', MAX_ITEMS)); return null; }
    var it = JSON.parse(JSON.stringify(CLIP.it)); CLIP.n++;
    delete it.id; if (it.iid) it.iid = newId();
    var d = 6 * ((CLIP.n - 1) % 8 + 1); it.u = (+it.u || 0) + d; it.v = (+it.v || 0) + d;
    if (it.type === 'pic' && CLIP.im) { ctx.pics = ctx.pics || {}; ctx.pics[it.iid] = { im: CLIP.im }; }
    return addItem(ctx, it);
  }
  function moveItem(ctx, i, d) {   // 0.5.0: avanti (+1) / indietro (-1)
    var st = ctx.st, j = i + d; if (i < 0 || j < 0 || i >= st.items.length || j >= st.items.length) return;
    var t = st.items[i]; st.items[i] = st.items[j]; st.items[j] = t; st.sel = j;
    renderItems(ctx); designChanged(ctx, true);
  }
  // pagine o formato cambiati: i disegni restano sul loro pezzo (il davanti si sposta col dorso)
  function keepItems(ctx, before) {
    var after = layout(ctx); if (!before || before.key === after.key) return;
    ctx.st.items.forEach(function (it) {
      var p = it.part || 'front', B = before.parts[p], A = after.parts[p]; if (!B || !A) return;
      // stessa posizione rispetto al centro della faccia del pezzo, scalata se il pezzo e' piu' piccolo
      it.u = A.cu + (it.u - B.cu); it.v = A.cv + (it.v - B.cv);
      clampItem(ctx, it);
    });
  }
  function tagParts(ctx) { ctx.st.items.forEach(function (it) { it.part = partAt(ctx, it.u, it.v); }); }

  /* ---- pannello a passi (standard del Magnet Maker): ogni passo si apre e si chiude, in fondo "Next: ..." ---------- */
  function flashNote(ctx, text) { var n = ctx.ui.note; if (!n) return; n.textContent = text; n.hidden = false; clearTimeout(ctx._noteT); ctx._noteT = setTimeout(function () { n.hidden = true; }, 3200); }
  function chipRow(list, onPick, cls) {
    var row = el('div', 'afc-chips afm-chips ' + (cls || ''));
    list.forEach(function (it) {
      var b = el('button', 'afc-chip'); b.type = 'button'; b.dataset.id = String(it.id);
      b.innerHTML = (it.icon ? '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="afm-ico">' + it.icon + '</svg>' : '') + '<b>' + esc(it.label) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '');
      b.setAttribute('aria-label', it.label + (it.sub ? ', ' + it.sub : ''));
      b.addEventListener('click', function () { if (!b.disabled) onPick(it.id); });
      row.appendChild(b);
    });
    row.style.gridTemplateColumns = 'repeat(' + Math.min(list.length, +((cls || '').match(/afm-c(\d+)/) || [0, 4])[1]) + ', 1fr)';
    return row;
  }
  function sel(row, id) { [].forEach.call(row.querySelectorAll('.afc-chip'), function (b) { var on = b.dataset.id === String(id); b.classList.toggle('afc-on', on); b.setAttribute('aria-pressed', on); }); }
  function swatchList(ctx, ids, getId, onPick) {
    var row = el('div', 'afc-swatches afm-sw');
    ids.forEach(function (id) {
      var p = pal(ctx, id), b = el('button', 'afc-swatch'); b.type = 'button'; b.dataset.id = id; b.style.setProperty('--sw', p.hex); b.title = p.label; b.setAttribute('aria-label', p.label);
      b.addEventListener('click', function () { onPick(id); }); row.appendChild(b);
    });
    row.appendChild(customSwatch(function () { return pal(ctx, getId()).hex; }, function (id) { onPick(id); }));
    row.paint = function () {
      var cur = getId() || '', inList = ids.indexOf(cur) >= 0;
      [].forEach.call(row.children, function (b) { if (b.dataset.id === 'custom') paintCustom(b, inList ? '' : (cur.indexOf('c:') === 0 ? cur : 'c:' + pal(ctx, cur).hex)); else b.classList.toggle('afc-on', b.dataset.id === cur); });
    };
    return row;
  }
  function paletteIds(ctx, key) { var C = (ctx.cfg.colors || {})[key] || {}; return (C.swatches || ['white', 'black']).filter(function (id) { return (ctx.cfg.palette || []).some(function (p) { return p.id === id; }); }); }
  function colorRow(ctx, body, key, label) {
    var st = ctx.st, lab = el('div', 'afc-slabel afm-mt', esc(label)); body.appendChild(lab);
    var row = swatchList(ctx, paletteIds(ctx, key), function () { return st.colors[key]; }, function (id) { st.colors[key] = id; row.paint(); paintMats(ctx); designChanged(ctx, true); });
    body.appendChild(row); return row;
  }
  function paintMats(ctx) { var v = ctx.viewer, st = ctx.st; if (!v) return; v.setColor('cover', pal(ctx, st.colors.cover).hex); v.setColor('page', pal(ctx, st.colors.page).hex); }
  function group(wrap, id, title, help) {
    var g = el('div', 'afc-group afm-sect'); g.dataset.group = id;
    var h = el('button', 'afc-glabel afm-ghead', '<span class="afc-num"></span><span class="afm-gtxt"><span class="afc-gtitle">' + esc(title) + '</span><span class="afc-gval"></span></span>' + CHEV);
    h.type = 'button'; h.setAttribute('aria-expanded', 'false'); g.appendChild(h);
    var body = el('div', 'afm-gbody'); g.appendChild(body);
    if (help) body.appendChild(el('div', 'afc-ghelp', esc(help)));
    wrap.appendChild(g); return body;
  }
  function hingeLab(st) { return st.hinge === 'fil' ? TX.hingeFil : st.hinge === 'pip' ? TX.hingePip : TX.hingeSnap; }
  function steps(ctx) { return [].filter.call(ctx.ui.groups.querySelectorAll('.afm-sect'), function (g) { return !g.hidden; }); }
  function openStep(ctx, id, opt) {
    opt = opt || {};
    if (ctx.openId === id && opt.toggle) id = null;
    ctx.openId = id; ctx.seen = ctx.seen || {};
    [].forEach.call(ctx.ui.groups.querySelectorAll('.afm-sect'), function (g) {
      var on = g.dataset.group === id; g.classList.toggle('afm-open', on);
      g.querySelector('.afm-ghead').setAttribute('aria-expanded', on);
      if (on) ctx.seen[g.dataset.group] = true;
      g.classList.toggle('afm-seen', !on && !!ctx.seen[g.dataset.group]);
    });
    if (id === 'design') drawEditor(ctx);
    if (id && opt.view !== false) viewFor(ctx, id);
    var g = id && ctx.ui.groups.querySelector('[data-group="' + id + '"]');
    if (g && opt.scroll !== false) {
      var pn = ctx.ui.groups.parentNode;
      requestAnimationFrame(function () { var top = Math.max(0, pn.scrollTop + g.getBoundingClientRect().top - pn.getBoundingClientRect().top - 10); if (pn.scrollTo && !opt.instant) pn.scrollTo({ top: top, behavior: 'smooth' }); else pn.scrollTop = top; });
    }
  }
  function placeFname(ctx) {
    var lab = ctx.ui.fname && ctx.ui.fname.parentNode; if (!lab || !ctx.revBody) return;
    var phone = window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
    var dest = phone ? ctx.revBody : ctx.ui.buy.parentNode;
    if (phone) { var nx = dest.querySelector('.afm-gnext'); if (lab.nextSibling !== nx || lab.parentNode !== dest) dest.insertBefore(lab, nx); } else if (lab.parentNode !== dest) dest.insertBefore(lab, ctx.ui.buy);
    lab.classList.toggle('afm-fname-in', phone);
  }
  function prevStep(ctx, id) { var L = steps(ctx), i = L.map(function (g) { return g.dataset.group; }).indexOf(id); if (i > 0) openStep(ctx, L[i - 1].dataset.group); }
  function nextStep(ctx, id) { var L = steps(ctx), i = L.map(function (g) { return g.dataset.group; }).indexOf(id); if (i >= 0 && L[i + 1]) openStep(ctx, L[i + 1].dataset.group); }
  function photoIco(w, h) { var k = 18 / Math.max(w, h), a = w * k, b = h * k; return '<rect x="' + (12 - a / 2).toFixed(1) + '" y="' + (12 - b / 2).toFixed(1) + '" width="' + a.toFixed(1) + '" height="' + b.toFixed(1) + '" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M' + (12 - a / 2 + 2).toFixed(1) + ' ' + (12 + b / 2 - 2.5).toFixed(1) + 'l3.5-4 2.5 2.5 2-2 3 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'; }
  function photoDims(ctx, F) { return ctx.st.dir === 'H' ? [F.photo[1], F.photo[0]] : [F.photo[0], F.photo[1]]; }
  function r1(v2) { return String(Math.round(v2 * 10) / 10).replace('.', ','); }
  function formatsOf(ctx, dir) { return ctx.cfg.geo.formats.filter(function (f) { return f.orient === dir; }); }
  // cambio di formato / pagine / direzione: i disegni restano sul loro pezzo
  function geoChange(ctx, fn) {
    var before = layout(ctx); tagParts(ctx); fn(); fixState(ctx); ctx._lay = null; keepItems(ctx, before);
    refreshPanel(ctx); buildScene(ctx, false); designChanged(ctx, true);
  }
  function buildPanel(ctx) {
    var cfg = ctx.cfg, st = ctx.st, P = {}, wrap = ctx.ui.groups, PG = cfg.pages || { min: 2, max: 20 }; wrap.innerHTML = ''; ctx.p = P;
    // 1) direzione
    var g1 = group(wrap, 'dir', TX.stepDir, TX.helpDir);
    P.dir = chipRow([{ id: 'V', label: TX.dirV, sub: TX.dirVs, icon: ICO_VERT }, { id: 'H', label: TX.dirH, sub: TX.dirHs, icon: ICO_HORZ }], function (id) {
      if (st.dir === id) return;
      // 0.4: il libro chiuso si gira di un quarto sul tavolo e prende la forma nuova (la camera resta ferma)
      var v = ctx.viewer;
      if (v && v.morph && v.morph.ready) v.endMorph();   // cambio di nuovo mentre gira: riparte dal libro gia' girato
      // 0.4.1 (ALFI): il libro si gira e si trasforma sia chiuso sia APERTO (resta com'era)
      if (v && !ctx.flipped && !ctx._folding && (ctx.fold === 0 || ctx.fold === 1) && v.scene && v.scene.length && !v.morph) {
        var d0 = st.dir, h0 = st.holes, c0 = st.code, fo = ctx.fold, ob = worldOf(ctx, fo).box, nb = null;
        try { st.dir = id; st.code = codeFor(ctx, id, c0); if (id !== 'H') st.holes = false; ctx._lay = null; nb = worldOf(ctx, fo).box; } catch (e) { nb = null; } finally { st.dir = d0; st.holes = h0; st.code = c0; ctx._lay = null; }
        if (nb) { v.startMorph({ ang: id === 'H' ? -90 : 90, oldBox: ob, newBox: nb }); ctx._meshSet = {}; ctx._meshKey = null; }
      }
      ctx._snapScene = true;
      geoChange(ctx, function () { st.dir = id; if (id !== 'H') st.holes = false; });
      paintPhotos(ctx); paintViews(ctx); viewFor(ctx, 'dir');
    }, 'afm-c2 afbh-dir');
    g1.appendChild(P.dir);
    // 2) formato della foto
    var g2 = group(wrap, 'photo', TX.stepPhoto, TX.helpPhoto);
    P.photoBox = el('div'); g2.appendChild(P.photoBox); paintPhotos(ctx);
    // 3) pagine
    var g3 = group(wrap, 'pages', TX.stepPages, TX.helpPages), pl = [];
    for (var n = PG.min; n <= PG.max; n++) pl.push({ id: n, label: String(n) });
    P.pages = chipRow(pl, function (id) { if (st.pages === +id) return; geoChange(ctx, function () { st.pages = +id; }); }, 'afm-c7 afm-small afbh-pages');
    g3.appendChild(P.pages);
    // 4) copertina: davanti e cerniere
    var g4 = group(wrap, 'cover', TX.stepCover, TX.helpCover);
    g4.appendChild(el('div', 'afc-slabel', esc(TX.frontLabel)));
    P.front = chipRow([{ id: 'blank', label: TX.frontBlank, sub: TX.frontBlankS, icon: ICO_BLANK }, { id: 'photo', label: TX.frontPhoto, sub: TX.frontPhotoS, icon: ICO_PHOTO }], function (id) {
      if (st.front !== id) geoChange(ctx, function () { st.front = id; });   // 0.4.2: la foto non toglie piu' i fori
      viewFor(ctx, 'cover', 'front');   // si apre il libro: si vede la copertina davanti (con o senza foto)
    }, 'afm-c2 afbh-front');
    g4.appendChild(P.front);
    P.frontNote = el('div', 'afc-ghint afbh-fnote'); g4.appendChild(P.frontNote);
    // 0.5.9 (ALFI): foto anche dentro la costa, quando con quelle pagine ci sta
    P.spineLabel = el('div', 'afc-slabel afm-mt', esc(TX.spineLabel)); g4.appendChild(P.spineLabel);
    P.spine = chipRow([{ id: 'no', label: TX.spineNo, sub: TX.spineNoS, icon: ICO_BLANK }, { id: 'yes', label: TX.spineYes, sub: TX.spineYesS, icon: ICO_PHOTO }], function (id) {
      var on = id === 'yes'; if (on && !spineFits(ctx)) return;
      if (!!st.spinePhoto !== on) geoChange(ctx, function () { st.spinePhoto = on; });
      viewFor(ctx, 'cover', 'front');   // copertina aperta vista da dentro: si vede la costa
    }, 'afm-c2 afbh-spine');
    g4.appendChild(P.spine);
    P.spineNote = el('div', 'afc-ghint'); g4.appendChild(P.spineNote);
    P.holesLabel = el('div', 'afc-slabel afm-mt', esc(TX.holesLabel)); g4.appendChild(P.holesLabel);
    P.holes = chipRow([{ id: 'no', label: TX.holesNo, sub: TX.holesNoS, icon: ICO_BLANK }, { id: 'yes', label: TX.holesYes, sub: TX.holesYesS, icon: ICO_NAIL }], function (id) {
      var on = id === 'yes';
      if (st.holes !== on) geoChange(ctx, function () { st.holes = on; });   // 0.4.2 (ALFI): fori anche con la foto
      viewFor(ctx, 'cover', 'holes');   // libro chiuso visto dal davanti: si vedono i fori a chiave
    }, 'afm-c2 afbh-holes');
    g4.appendChild(P.holes);
    // 0.5.6 (ALFI): misura del foro, perche' la testa del chiodino gia' nel muro deve passare
    P.holeDLabel = el('div', 'afc-slabel afm-mt', esc(TX.holeSize)); g4.appendChild(P.holeDLabel);
    P.holeD = chipRow([2, 3, 4, 5, 6].map(function (d) { return { id: d, label: d + ' mm' }; }), function (id) {
      var d = +id; if (st.holeD !== d) geoChange(ctx, function () { st.holeD = d; });
      viewFor(ctx, 'cover', 'holes');
    }, 'afm-c5 afm-small afbh-holed');
    g4.appendChild(P.holeD);
    P.holesNote = el('div', 'afc-ghint'); g4.appendChild(P.holesNote);
    g4.appendChild(el('div', 'afc-slabel afm-mt', esc(TX.hingeLabel)));
    P.hinge = chipRow([{ id: 'pip', label: TX.hingePip, sub: TX.hingePipS, icon: ICO_PIP }, { id: 'snap', label: TX.hingeSnap, sub: TX.hingeSnapS, icon: ICO_SNAP }, { id: 'fil', label: TX.hingeFil, sub: TX.hingeFilS, icon: ICO_FIL }], function (id) {
      if (st.hinge !== id) geoChange(ctx, function () { st.hinge = id; });
      viewFor(ctx, 'cover', 'hinge');   // la vista va sulla cerniera (di lato, un po' dall'alto): foro o dentini
    }, 'afm-c3 afbh-hinge');
    g4.appendChild(P.hinge);
    P.hingeNote = el('div', 'afc-ghint'); g4.appendChild(P.hingeNote);
    // 5) disegni
    var g5 = group(wrap, 'design', TX.stepDesign, TX.helpDesign);
    var addRow = el('div', 'afbh-addrow'); g5.appendChild(addRow);
    [['text', TX.addText, ICO_T], ['draw', TX.addDraw, ICO_PEN], ['pic', TX.addImg, ICO_IMG]].forEach(function (a) {
      var b = el('button', 'afbh-add', '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' + a[2] + '</svg><span>+ ' + esc(a[1]) + '</span>'); b.type = 'button'; b.dataset.k = a[0]; addRow.appendChild(b);
      b.addEventListener('click', function () {
        if (st.items.length >= MAX_ITEMS) { flashNote(ctx, TX.itemsMax.replace('{n}', MAX_ITEMS)); return; }
        if (a[0] === 'text') { var last = st.items.filter(function (x) { return x.type === 'text'; }).pop(); var w = partWidth(ctx, 'front'); addItem(ctx, { type: 'text', t: '', font: last ? last.font : ((cfg.lettering || {}).defaultFont || 'round'), color: last ? last.color : ((cfg.lettering || {}).defaultColor || 'white'), mm: Math.round(clampN(Math.min(w[0], w[1]) * 0.12, 5, 14)), auto: true }); var ta = P.list.querySelector('[data-i="' + st.sel + '"] textarea'); if (ta) ta.focus(); }
        else if (a[0] === 'draw') openBoard(ctx, null, function (strokes, o) { var w2 = partWidth(ctx, 'front'); addItem(ctx, { type: 'draw', strokes: strokes, iid: newId(), pen: o.pen, wi: o.wi, mm: Math.round(Math.min(w2[0], w2[1]) * 0.6) }); });
        else P.pfile.click();
      });
    });
    P.pfile = el('input'); P.pfile.type = 'file'; P.pfile.accept = 'image/*'; P.pfile.hidden = true; g5.appendChild(P.pfile);
    P.pfile.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
      picFromFile(f).then(function (img) {
        return imgLoad(img).then(function (im) {
          var it = { type: 'pic', img: img, iid: newId(), n: (cfg.image || {}).defaultColors || 4, bg: true, cols: null, mm: 40 };
          ctx.pics = ctx.pics || {}; ctx.pics[it.iid] = { im: im };
          var q = picQ(ctx, it), kept = false;
          if ((!q || q.empty) && it.bg) { it.bg = false; q = picQ(ctx, it); kept = !!(q && !q.empty); }   // 0.5.7: tolto lo sfondo non restava niente (es. tutta bianca): si tiene lo sfondo
          if (!q || q.empty) throw new Error('empty');
          var w = partWidth(ctx, 'front'), s0 = Math.min(w[0] * 0.7 / q.W, w[1] * 0.6 / q.H);   // 70% della larghezza, 60% dell'altezza
          it.mm = Math.round(clampN(s0 * Math.max(q.W, q.H), 15, 200));
          setWarnErr(ctx, null); addItem(ctx, it); if (kept) flashNote(ctx, TX.imgBgKept);
        });
      }).catch(function (err) { console.warn('[AFBookHub] picture:', err); var em = err && err.message; setWarnErr(ctx, em === 'empty' ? TX.imgEmpty : em === 'big' ? TX.imgBig : em === 'heic' ? TX.imgHeic : TX.imgBad, 'design'); });
    });
    P.list = el('div', 'afbh-items'); P.list.style.flexDirection = 'column-reverse'; g5.appendChild(P.list);   // 0.5.1: in alto quello che sta davanti (come i livelli)
    P.edWrap = el('div', 'afbh-edwrap'); g5.appendChild(P.edWrap);
    P.edWrap.appendChild(el('div', 'afc-slabel afm-mt', esc(TX.edLabel)));
    P.viewsBox = el('div'); P.edWrap.appendChild(P.viewsBox); paintViews(ctx);
    P.ed = el('div', 'afkb-ed afbh-ed', '<canvas tabindex="0"></canvas>'); P.edCv = P.ed.querySelector('canvas'); P.edCv.setAttribute('aria-label', TX.edLabel); P.edWrap.appendChild(P.ed);
    P.edWrap.appendChild(el('div', 'afc-ghint afkb-edhint', esc(TX.edHint)));
    function selIt() { var it = st.items[st.sel]; return it && hasInk(ctx, it) ? it : null; }
    P.bar = STD.toolbar({
      size: { get: function () { var it = selIt(); return it ? Math.round(it.mm * 2) / 2 : 0; }, set: function (v) { var it = selIt(); if (!it) return; it.mm = v; it.auto = false; clampItem(ctx, it); }, step: 1, min: 3, max: 260, fmt: fmtMM },
      rot: { get: function () { var it = selIt(); return it ? (it.rot || 0) : 0; }, set: function (v) { var it = selIt(); if (!it) return; it.rot = STD.normRot(v); } },
      onCenter: function () { var it = selIt(); if (!it) return; var p = partAt(ctx, it.u, it.v), Pp = layout(ctx).parts[p]; it.u = Pp.cu; it.v = Pp.cv; },
      onDelete: function () { removeItem(ctx, st.sel); },
      onChange: function () { designChanged(ctx, true); }
    });
    P.edWrap.appendChild(P.bar.el);
    // 0.5.0: avanti / indietro rispetto agli altri disegni (l'ultimo della lista sta sopra a tutti); 0.5.1: subito sotto la lista (ALFI)
    P.layer = el('div', 'afbh-layer'); P.layer.style.cssText = 'display:flex;gap:8px;margin-top:8px';
    P.layDn = el('button', 'afbh-drawedit', '<span>\u2193 ' + esc(TX.layerDown) + '</span>'); P.layDn.type = 'button'; P.layDn.style.cssText = 'flex:1;margin-top:0;height:40px;font-size:.82rem';
    P.layUp = el('button', 'afbh-drawedit', '<span>\u2191 ' + esc(TX.layerUp) + '</span>'); P.layUp.type = 'button'; P.layUp.style.cssText = 'flex:1;margin-top:0;height:40px;font-size:.82rem';
    P.layDn.addEventListener('click', function () { moveItem(ctx, st.sel, -1); }); P.layUp.addEventListener('click', function () { moveItem(ctx, st.sel, 1); });
    P.layer.appendChild(P.layDn); P.layer.appendChild(P.layUp); g5.insertBefore(P.layer, P.edWrap);
    // 0.5.5: copia / incolla quello scelto (ALFI)
    P.clipRow = el('div', 'afbh-cliprow'); P.clipRow.style.cssText = 'display:flex;gap:8px;margin-top:8px';
    P.copyB = el('button', 'afbh-drawedit', '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.9"/></svg><span>' + esc(TX.copyItem) + '</span>'); P.copyB.type = 'button'; P.copyB.style.cssText = 'flex:1;margin-top:0;height:40px;font-size:.82rem';
    P.pasteB = el('button', 'afbh-drawedit', '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="5" y="4.5" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="9" y="3" width="6" height="3.5" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.7"/></svg><span>' + esc(TX.pasteItem) + '</span>'); P.pasteB.type = 'button'; P.pasteB.style.cssText = 'flex:1;margin-top:0;height:40px;font-size:.82rem';
    P.copyB.addEventListener('click', function () { if (copyItem(ctx)) { flashNote(ctx, TX.copied); refreshPanel(ctx); } }); P.pasteB.addEventListener('click', function () { pasteItem(ctx); });
    P.clipRow.appendChild(P.copyB); P.clipRow.appendChild(P.pasteB); g5.insertBefore(P.clipRow, P.layer);
    // 0.5.2: quanti colori ha il libro, vicino alla lista (ALFI); 0.6.0 (ALFI): conta solo la copertina (quelli da mettere
    // nella stampante per stamparla), le pagine si stampano da sole e il loro colore e' scritto sotto, a parte
    P.colTot = el('div', 'afbh-coltot'); P.colTot.style.cssText = 'margin-top:10px;padding:10px 12px;border:1.5px solid var(--bg-gray-2,#d2d2d7);border-radius:12px';
    P.colTot.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span style="font-weight:700;font-size:.85rem">' + esc(TX.colTot) + '</span><b class="afbh-coltot-n" style="font-size:1.05rem"></b></div>' +
      '<div class="afbh-coltot-sw" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div><div class="afbh-coltot-h" style="margin-top:6px;font-size:.75rem;line-height:1.35;color:var(--text-gray,#6e6e73)"></div>' +
      '<div class="afbh-coltot-p" style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--bg-gray-2,#d2d2d7);font-size:.75rem;line-height:1.35;color:var(--text-gray,#6e6e73)"></div>';   // 0.6.0: le pagine a parte
    g5.insertBefore(P.colTot, P.edWrap);
    // scritta scelta: font e colore
    P.textBox = el('div', 'afbh-textopts'); P.edWrap.appendChild(P.textBox);
    P.fontLab = el('div', 'afc-slabel afm-mt', esc(TX.fontLabel)); P.textBox.appendChild(P.fontLab);
    P.fonts = el('div', 'afc-tm-fonts afkb-fonts'); var nVis = cfg.fontsVisible || 9;
    (cfg.fonts || []).forEach(function (f, i) {
      var b = el('button', 'afc-tm-font', esc(f.label)); b.type = 'button'; b.dataset.id = f.id; b.style.font = f.css.replace(/\d+px/, '15px'); if (i >= nVis) b.dataset.extra = '1';
      b.addEventListener('click', function () { var it = st.items[st.sel]; if (!it || it.type !== 'text') return; it.font = f.id; loadFonts([f]).then(function () { ctx._tl = {}; if (it.auto) autoFit(ctx, it); designChanged(ctx, true); }); if (it.auto) autoFit(ctx, it); refreshPanel(ctx); designChanged(ctx, true); });
      P.fonts.appendChild(b);
    });
    P.textBox.appendChild(P.fonts);
    if ((cfg.fonts || []).length > nVis) { P.fmore = el('button', 'afm-fmorebtn', esc(TX.moreFonts)); P.fmore.type = 'button'; P.fmore.addEventListener('click', function () { ctx.allFonts = !ctx.allFonts; refreshPanel(ctx); }); P.textBox.appendChild(P.fmore); }
    loadFonts((cfg.fonts || []).slice(0, nVis)).then(function () { if (current === ctx) { ctx._tl = {}; designChanged(ctx, false); } });
    // 0.6.2 (ALFI): allineamento delle righe della scritta
    P.textBox.appendChild(el('div', 'afc-slabel afm-mt', esc(TX.alignLabel)));
    var ICO_AL = function (a) { var x = a === 'left' ? [4, 4] : a === 'right' ? [10, 10] : [7, 7]; return '<path d="M4 6h16M' + x[0] + ' 10h10M4 14h16M' + x[1] + ' 18h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'; };
    P.align = chipRow([{ id: 'left', label: TX.alignLeft, icon: ICO_AL('left') }, { id: 'center', label: TX.alignCenter, icon: ICO_AL('center') }, { id: 'right', label: TX.alignRight, icon: ICO_AL('right') }], function (id) {
      var it = st.items[st.sel]; if (!it || it.type !== 'text') return; it.align = id; sel(P.align, id); designChanged(ctx, true);
    }, 'afbh-align');
    P.textBox.appendChild(P.align);
    P.textBox.appendChild(el('div', 'afc-slabel afm-mt', esc(TX.textColor)));
    P.tcol = swatchList(ctx, paletteIds(ctx, 'text'), function () { var it = st.items[st.sel]; return it && it.type === 'text' ? it.color : 'white'; }, function (id) { var it = st.items[st.sel]; if (!it || it.type !== 'text') return; it.color = id; P.tcol.paint(); designChanged(ctx, true); });
    P.textBox.appendChild(P.tcol);
    // immagine scelta: quanti colori, sfondo, colore di ogni parte
    P.picBox = el('div', 'afbh-picbox'); P.edWrap.appendChild(P.picBox);
    P.picBox.appendChild(el('div', 'afc-slabel afm-mt', esc(TX.imgColors)));
    var mx = (cfg.image || {}).maxColors || 6, cl = []; for (var ci = 1; ci <= mx; ci++) cl.push({ id: ci, label: String(ci) });
    P.picN = chipRow(cl, function (id) { var it = st.items[st.sel]; if (!it || it.type !== 'pic') return; it.n = +id; it.cols = null; ctx.picSel = 0; designChanged(ctx, true); }, 'afm-c6 afm-small afbh-picn');
    P.picBox.appendChild(P.picN);
    P.picBgL = el('label', 'afbh-bg', '<input type="checkbox"><span>' + esc(TX.imgBg) + '</span>'); P.picBg = P.picBgL.querySelector('input'); P.picBox.appendChild(P.picBgL);
    P.picBg.addEventListener('change', function () { var it = st.items[st.sel]; if (!it || it.type !== 'pic') return; it.bg = P.picBg.checked; it.cols = null; designChanged(ctx, true); });
    P.picBox.appendChild(el('div', 'afc-slabel afm-mt', esc(TX.imgTap)));
    P.picCols = el('div', 'afbh-pcols'); P.picBox.appendChild(P.picCols);
    P.picSw = swatchList(ctx, (cfg.palette || []).filter(function (p) { return !p.hidden; }).map(function (p) { return p.id; }), function () { var it = st.items[st.sel]; return it && it.cols ? it.cols[ctx.picSel || 0] || 'white' : 'white'; }, function (id) {
      var it = st.items[st.sel]; if (!it || it.type !== 'pic' || !it.cols) return; var old = it.cols[ctx.picSel || 0];
      it.cols = it.cols.map(function (c2) { return c2 === old ? id : c2; }); designChanged(ctx, true);
    });
    P.picBox.appendChild(P.picSw);
    // 0.5.0: colore invisibile (si toglie) e anteprima: tocco su una parte = colore solo di quella parte
    P.picNone = el('button', 'afc-swatch afc-im-none'); P.picNone.type = 'button'; P.picNone.dataset.id = 'none'; P.picNone.title = TX.invisible; P.picNone.setAttribute('aria-label', TX.invisible);
    P.picNone.addEventListener('click', function () { var it = st.items[st.sel]; if (!it || it.type !== 'pic' || !it.cols) return; var old = it.cols[ctx.picSel || 0]; it.cols = it.cols.map(function (c2) { return c2 === old ? 'none' : c2; }); designChanged(ctx, true); });
    P.picSw.insertBefore(P.picNone, P.picSw.firstChild);
    var swPaint0 = P.picSw.paint; P.picSw.paint = function () { swPaint0(); var it = st.items[st.sel], cur = it && it.cols ? it.cols[ctx.picSel || 0] : ''; if (cur === 'none') [].forEach.call(P.picSw.children, function (b) { if (b.dataset.id === 'custom') paintCustom(b, ''); }); };
    P.picBox.style.position = 'relative';
    P.picBox.appendChild(el('div', 'afc-slabel afm-mt', esc(TX.imgParts)));
    P.picPrevW = el('div', 'afbh-picprev'); P.picPrevW.style.cssText = 'max-height:380px;overflow:auto;border-radius:12px;border:1.5px solid var(--bg-gray-2,#d2d2d7);background:repeating-conic-gradient(#e6e6eb 0% 25%,#fff 0% 50%) 50%/14px 14px;padding:2px';
    P.picPrev = document.createElement('canvas'); P.picPrev.style.cssText = 'display:block;margin:0 auto;cursor:pointer;touch-action:manipulation'; P.picPrevW.appendChild(P.picPrev); P.picBox.appendChild(P.picPrevW);
    P.picPrev.addEventListener('click', function (e) { var it = st.items[st.sel]; if (!it || it.type !== 'pic') return; picTap(ctx, it, e); });
    P.picPrevW.addEventListener('scroll', function () { closePicPart(ctx); });
    // disegno scelto: modificalo
    P.drawBox = el('div', 'afbh-drawopts'); g5.insertBefore(P.drawBox, P.colTot || P.edWrap);   // 0.5.5: subito sotto la lista (ALFI)
    P.drawEdit = el('button', 'afbh-drawedit', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' + ICO_PEN + '</svg><span>' + esc(TX.editDraw) + '</span>'); P.drawEdit.type = 'button'; P.drawBox.appendChild(P.drawEdit);
    P.drawEdit.addEventListener('click', function () { editDraw(ctx, st.items[st.sel]); });
    editorBind(ctx);
    // 6) colori
    var g6 = group(wrap, 'colors', TX.stepColors, TX.helpColors);
    P.cCover = colorRow(ctx, g6, 'cover', TX.coverColor);
    P.cPage = colorRow(ctx, g6, 'page', TX.pageColor);
    wrap.insertBefore(g6.parentNode, g4.parentNode);   // 0.4.2 (ALFI 22/10): i colori subito dopo le pagine, prima di copertina e disegni (si disegna sapendo il colore del libro)
    // 7) riepilogo
    var g7 = group(wrap, 'review', TX.sumTitle, null);
    var sm = el('div', 'afc-summary'); sm.innerHTML = '<ul class="afc-sum-list"></ul><div class="afc-ghint">' + esc(TX.printHint) + '</div><div class="afm-revhint">' + esc(TX.reviewHint) + '</div>'; g7.appendChild(sm);
    P.sum = sm.querySelector('ul');
    [].forEach.call(wrap.querySelectorAll('.afm-sect'), function (g) {
      var id = g.dataset.group;
      g.querySelector('.afm-ghead').addEventListener('click', function () { openStep(ctx, id, { toggle: true }); });
      var nx = el('div', 'afm-gnext'), pb = el('button', 'afm-prev', '<span aria-hidden="true">←</span> ' + esc(TX.prevStep)), nb = el('button', 'afm-next'); pb.type = nb.type = 'button';
      nx.appendChild(pb); nx.appendChild(nb); g.querySelector('.afm-gbody').appendChild(nx);
      nb.addEventListener('click', function () { nextStep(ctx, id); });
      pb.addEventListener('click', function () { prevStep(ctx, id); });
    });
    ctx.revBody = g7;
    placeFname(ctx);
    renderItems(ctx);
    refreshPanel(ctx);
    openStep(ctx, ctx.openId && wrap.querySelector('[data-group="' + ctx.openId + '"]') ? ctx.openId : 'dir', { instant: true, scroll: false, view: false });
  }
  function paintViews(ctx) {
    var P = ctx.p; if (!P || !P.viewsBox) return;
    var order = ctx.st.dir === 'H' ? ['front', 'spine', 'back'] : ['back', 'spine', 'front'];
    P.viewsBox.innerHTML = '';
    P.views = chipRow([{ id: 'all', label: TX.viewAll }].concat(order.map(function (id) { return { id: id, label: cap1(TX.sides[id]) }; })), function (id) { ctx.edView = id; sel(P.views, id); drawEditor(ctx); }, 'afm-c4 afm-small afbh-views');
    P.viewsBox.appendChild(P.views); sel(P.views, ctx.edView || 'all');
  }
  // scritta nuova (finche' non la si ingrandisce a mano): grande al massimo l'85% della larghezza del pezzo dove sta
  function autoFit(ctx, it) {
    if (it.type !== 'text' || !linesOf(it.t).length) return;
    var p = partAt(ctx, it.u, it.v), fb = layout(ctx).parts[p === 'spine' ? 'front' : p].fbox;
    var a = (it.rot || 0) * DEG, maxW = 0.85 * (Math.abs(Math.cos(a)) > 0.5 ? fb[2] - fb[0] : fb[3] - fb[1]);
    var mm0 = it.mm0 || (it.mm0 = it.mm), save = it.mm; it.mm = mm0; var b = itemBox(ctx, it), w = b[2] - b[0];
    it.mm = w > maxW ? Math.max(4, Math.floor(mm0 * maxW / w * 2) / 2) : mm0; if (!isFinite(it.mm)) it.mm = save;
  }
  function cap1(s) { s = String(s).toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function paintPhotos(ctx) {
    var P = ctx.p, st = ctx.st; if (!P || !P.photoBox) return;
    P.photoBox.innerHTML = '';
    P.photo = chipRow(formatsOf(ctx, st.dir).map(function (F) { var d = photoDims(ctx, F); return { id: F.code, label: F.label, sub: Math.round(d[0]) + ' × ' + Math.round(d[1]) + ' mm' + (F.sub ? ' · ' + F.sub : ''), icon: photoIco(d[0], d[1]) }; }), function (id) { if (st.code === id) return; geoChange(ctx, function () { st.code = id; }); }, 'afm-c2 afbh-photos');
    P.photoBox.appendChild(P.photo); sel(P.photo, st.code);
  }
  // elenco dei disegni (una riga ciascuno; quello scelto e' blu)
  function renderItems(ctx) {
    var P = ctx.p, st = ctx.st; if (!P || !P.list) return;
    P.list.innerHTML = '';
    st.items.forEach(function (it, i) {
      var row = el('div', 'afkb-trow afbh-row'); row.dataset.i = i;
      if (it.type === 'text') {
        var ta = el('textarea', 'afc-tm-in afkb-tin'); ta.rows = 1; ta.maxLength = (ctx.cfg.lettering || {}).maxLen || 60; ta.placeholder = TX.textPh; ta.autocomplete = 'off'; ta.spellcheck = false; ta.value = it.t || '';
        ta.setAttribute('aria-label', TX.textN + ' ' + (i + 1));
        ta.addEventListener('focus', function () { if (st.sel !== i) { st.sel = i; refreshPanel(ctx); drawEditor(ctx); } });
        ta.addEventListener('input', function () {
          var v2 = ta.value.split('\n'); if (v2.length > 4) ta.value = v2.slice(0, 4).join('\n');
          ta.rows = Math.min(4, ta.value.split('\n').length); it.t = ta.value; st.sel = i; if (it.auto) autoFit(ctx, it);
          designChanged(ctx, false); clearTimeout(ctx._txT); ctx._txT = setTimeout(function () { designChanged(ctx, true); }, 450);
        });
        ta.rows = Math.max(1, Math.min(4, (it.t || '').split('\n').length));
        row.appendChild(ta);
      } else {
        var src = it.type === 'pic' ? it.img : (function () { try { var c0 = drawCanvas(ctx, it, null); return c0.toDataURL(); } catch (e) { return ''; } })();
        var ib = el('button', 'afkb-ibtn afbh-pbtn', '<img alt="" src="' + src + '"><span>' + esc(it.type === 'pic' ? TX.imgN : TX.drawN) + '</span>'); ib.type = 'button';
        ib.addEventListener('click', function () { st.sel = i; refreshPanel(ctx); drawEditor(ctx); }); row.appendChild(ib);
        if (it.type === 'draw') {   // 0.5.5: matita = modifica il disegno
          var ed = el('button', 'afkb-tdel afbh-tedit', '<svg viewBox="0 0 24 24" style="width:18px;height:18px" aria-hidden="true">' + ICO_PEN + '</svg>'); ed.type = 'button'; ed.title = TX.editDraw; ed.setAttribute('aria-label', TX.editDraw);
          ed.addEventListener('click', function () { st.sel = i; refreshPanel(ctx); drawEditor(ctx); editDraw(ctx, it); }); row.appendChild(ed);
        }
      }
      var del = el('button', 'afkb-tdel', ICON_X); del.type = 'button'; del.setAttribute('aria-label', TX.delItem);
      del.addEventListener('click', function () { removeItem(ctx, i); });
      row.appendChild(del);
      P.list.appendChild(row);
    });
  }
  function itemsSum(ctx) {
    var L = liveItems(ctx), nt = L.filter(function (i) { return i.type === 'text'; }).length, nd = L.filter(function (i) { return i.type === 'draw'; }).length, np = L.filter(function (i) { return i.type === 'pic'; }).length, o = [];
    if (nt) o.push(nt + ' chữ nổi'); if (nd) o.push(nd + ' nét vẽ tay'); if (np) o.push(np + ' hình ảnh');
    return o.join(' · ') || TX.none;
  }
  // disegni con righe sotto 0,8 mm (due linee di stampa) o scritte con le maiuscole sotto 4 mm: si stampano male
  function thinItems(ctx) {
    return liveItems(ctx).some(function (it) {
      if (it.type === 'text') return it.mm < 4;
      if (it.type !== 'draw') return false;
      var b = drawBox(it), k = it.mm / Math.max(b[2] - b[0], b[3] - b[1], 1e-6);
      return (it.strokes || []).some(function (q) { return !q.f && inkQ(q) && (q.w || 0.03) * k < 0.8; });
    });
  }
  /* 0.5.4 (ALFI: "le misure sempre uguali, come negli altri configuratori"): righe con la misura in nero di fianco al libro,
     come nel KEY BOOK. Libro chiuso: lunghezza sotto, larghezza a sinistra, spessore a destra; aperto: lunghezza e larghezza.
     Si nascondono mentre il libro si apre, si chiude o si gira. */
  function r1mm(v2) { return String(Math.round(v2 * 10) / 10).replace('.', ',') + ' mm'; }
  function dimsOf(ctx) {
    var v = ctx.viewer; if (!v || !v.lastVP || !ctx.scene || ctx._folding || ctx._explode || v.flipT0 != null || !(ctx.fold === 0 || ctx.fold === 1)) return [];
    var b = worldOf(ctx, ctx.fold).box, g = 7, FM = v.flipM(), out = [];
    var P = function (p) { return toScreen(v, FM ? xf3(FM, p) : p); };
    var x0 = b[0], x1 = b[1], y0 = b[2], y1 = b[3], z0 = b[4], z1 = b[5];
    out.push({ a: P([x0, y0 - g, z0]), b: P([x1, y0 - g, z0]), text: r1mm(x1 - x0), below: true });
    out.push({ a: P([x0 - g, y0, z0]), b: P([x0 - g, y1, z0]), text: r1mm(y1 - y0) });   // larghezza a sinistra
    out.push(ctx.fold === 1 ? { a: P([x1 + g, y0, z0]), b: P([x1 + g, y0, z1]), text: r1mm(z1 - z0) } : null);   // spessore a destra (chiuso)
    return out;
  }
  function placeDims(ctx) {
    var ui = ctx.ui; if (!ui || !ui.hint) return;
    if (!ui.dimEls) { ui.dimEls = []; for (var i = 0; i < 3; i++) { var de0 = el('div', 'afc-dim', '<span></span>'); de0.hidden = true; ui.hint.parentNode.insertBefore(de0, ui.hint); ui.dimEls.push(de0); } }
    var dm = dimsOf(ctx);
    ui.dimEls.forEach(function (de, j) {
      var d = dm[j];
      if (!d) { if (!de.hidden) de.hidden = true; return; }
      var dx = d.b[0] - d.a[0], dy = d.b[1] - d.a[1], len = Math.hypot(dx, dy), an = Math.atan2(dy, dx);
      if (len < 18) { de.hidden = true; return; }
      de.classList.toggle('afc-dim-below', !!d.below);
      de.hidden = false; de.style.left = d.a[0] + 'px'; de.style.top = d.a[1] + 'px'; de.style.width = len + 'px'; de.style.transform = 'rotate(' + an + 'rad)';
      var sp = de.querySelector('span'); if (de.dataset.t !== d.text) { de.dataset.t = d.text; sp.textContent = d.text; }
      sp.style.transform = 'translateX(-50%) rotate(' + (-an) + 'rad)';
    });
  }
  function coverCols(ctx) {   // 0.6.0: i colori della copertina (quelli da caricare nella stampante per stamparla), coi nomi
    var H = [hexOf(ctx, ctx.st.colors.cover)], L = [pal(ctx, ctx.st.colors.cover).label];
    designHexes(ctx).forEach(function (h) { if (H.indexOf(h) >= 0) return; var pp = (ctx.cfg.palette || []).filter(function (q2) { return String(q2.hex).toUpperCase() === h; })[0]; H.push(h); L.push(pp ? pp.label : h); });
    return { hex: H, label: L };
  }
  function filCount(ctx) { var c = [hexOf(ctx, ctx.st.colors.cover)], p = hexOf(ctx, ctx.st.colors.page); if (c.indexOf(p) < 0) c.push(p); designHexes(ctx).forEach(function (h) { if (c.indexOf(h) < 0) c.push(h); }); return c.length; }
  function refreshPanel(ctx) {
    var P = ctx.p, st = ctx.st; if (!P) return;
    var F = fmtOf(ctx), it0 = st.items[st.sel], has = !!(it0 && hasInk(ctx, it0));
    sel(P.dir, st.dir); if (P.photo) sel(P.photo, st.code); sel(P.pages, st.pages); sel(P.front, st.front); sel(P.hinge, st.hinge); sel(P.holes, st.holes ? 'yes' : 'no'); sel(P.views, ctx.edView || 'all');
    var fits = pipFits(ctx), pb = P.hinge.querySelector('[data-id="pip"]');
    if (pb) { pb.disabled = false; pb.classList.remove('afm-off'); pb.querySelector('small').textContent = fits ? TX.hingePipS : TX.pipBigS; }
    var lb0 = layout(ctx).box;
    P.hingeNote.textContent = st.hinge === 'pip' ? (fits ? TX.hingeNotePip : TX.pipBigNote.replace('{w}', Math.round(lb0[2] - lb0[0])).replace('{h}', Math.round(lb0[3] - lb0[1]))) : st.hinge === 'fil' ? TX.hingeNoteFil : TX.hingeNote; ctx.pipBumped = false;
    P.holesNote.textContent = st.holes ? TX.holesNote + ' ' + TX.holeSizeNote : ''; P.holesNote.hidden = !st.holes;
    if (P.holeD) { sel(P.holeD, st.holeD); var hdOn = !!st.holes && st.dir === 'H'; P.holeD.style.display = hdOn ? '' : 'none'; P.holeDLabel.style.display = hdOn ? '' : 'none'; }
    P.holes.hidden = P.holesLabel.hidden = st.dir !== 'H';   // 0.4.1: fori a muro solo nel libro HORIZONTAL
    P.frontNote.textContent = ''; P.frontNote.hidden = true;
    if (P.spine) {   // 0.5.9: "With photo" si puo' scegliere solo se la foto ci sta nella costa
      var spF = fmtOf(ctx), spMin = spinePhotoMin(spF.P, G0(ctx).pitch), spOk = spineFits(ctx), spB = P.spine.querySelector('[data-id="yes"]');
      sel(P.spine, st.spinePhoto ? 'yes' : 'no');
      if (spB) { spB.disabled = !spOk; spB.classList.toggle('afm-off', !spOk); spB.querySelector('small').textContent = spOk ? TX.spineYesS : spMin > ((ctx.cfg.pages || {}).max || 20) ? TX.spineNever : TX.spineNeed.replace('{n}', spMin); }
      P.spineNote.textContent = spOk || spMin <= ((ctx.cfg.pages || {}).max || 20) ? TX.spineNote.replace('{n}', spMin) : ''; P.spineNote.hidden = !P.spineNote.textContent;
    }   // 0.4.2: foto e fori insieme, niente piu' avviso
    P.cCover.paint(); P.cPage.paint();
    [].forEach.call(P.list.children, function (row, i) { row.classList.toggle('afc-on', i === st.sel); var ta = row.querySelector('textarea'); if (ta && document.activeElement !== ta && st.items[i] && ta.value !== (st.items[i].t || '')) ta.value = st.items[i].t || ''; });
    P.edWrap.hidden = !st.items.length;
    P.bar.enable(has);
    if (P.colTot) {   // 0.5.2: totale dei colori
      var cC = coverCols(ctx), cH = cC.hex, cL = cC.label, pH = hexOf(ctx, st.colors.page);
      var cN = P.colTot.querySelector('.afbh-coltot-n'); cN.textContent = String(cH.length); cN.style.color = filCount(ctx) > MAX_FIL ? '#d70015' : '';
      P.colTot.querySelector('.afbh-coltot-sw').innerHTML = cH.map(function (h, i) { return '<span title="' + esc(cL[i]) + '" aria-label="' + esc(cL[i]) + '" style="display:inline-block;width:22px;height:22px;border-radius:50%;background:' + h + ';box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)"></span>'; }).join('');
      P.colTot.querySelector('.afbh-coltot-h').textContent = cL.join(', ') + ' · ' + TX.colTotMax.replace('{max}', MAX_FIL);
      P.colTot.querySelector('.afbh-coltot-p').innerHTML = '<span aria-hidden="true" style="flex:none;display:inline-block;width:16px;height:16px;border-radius:50%;background:' + pH + ';box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)"></span><span><b style="color:var(--text-dark,#1d1d1f)">' + esc(TX.colTotPages) + ':</b> ' + esc(pal(ctx, st.colors.page).label) + ' · ' + esc(TX.colTotPagesS) + '</span>';
    }
    if (P.layer) { var upOff = !it0 || st.sel >= st.items.length - 1, dnOff = !it0 || st.sel <= 0; P.layUp.disabled = upOff; P.layDn.disabled = dnOff; P.layUp.style.opacity = upOff ? 0.4 : 1; P.layDn.style.opacity = dnOff ? 0.4 : 1; P.layer.hidden = st.items.length < 2; P.layer.style.display = st.items.length < 2 ? 'none' : 'flex'; }
    if (P.clipRow) { P.copyB.disabled = !has; P.copyB.style.opacity = has ? 1 : 0.4; P.pasteB.disabled = !CLIP; P.pasteB.style.opacity = CLIP ? 1 : 0.4; P.clipRow.style.display = st.items.length || CLIP ? 'flex' : 'none'; }
    P.textBox.hidden = !(it0 && it0.type === 'text');
    if (it0 && it0.type === 'text') {
      [].forEach.call(P.fonts.children, function (b) { b.classList.toggle('afc-on', b.dataset.id === it0.font); b.hidden = !!b.dataset.extra && !ctx.allFonts && b.dataset.id !== it0.font; });
      if (P.fmore) { P.fmore.textContent = ctx.allFonts ? TX.lessFonts : TX.moreFonts; if (ctx.allFonts) loadFonts(ctx.cfg.fonts).then(function () { ctx._tl = {}; drawEditor(ctx); }); }
      P.tcol.paint();
      sel(P.align, it0.align === 'left' || it0.align === 'right' ? it0.align : 'center');   // 0.6.2
    }
    P.picBox.hidden = !(it0 && it0.type === 'pic' && has);
    if (it0 && it0.type === 'pic' && has) {
      sel(P.picN, it0.n || 4); P.picBg.checked = it0.bg !== false;
      var q = picQ(ctx, it0); P.picCols.innerHTML = '';
      if (q && !q.empty) {
        var cols = picCols(ctx, it0, q), seen = [], cov = st.colors.cover; if (ctx.picSel == null || ctx.picSel >= cols.length) ctx.picSel = 0;
        cols.forEach(function (id, ci) {
          if (q.area[ci] <= 0 || seen.indexOf(id) >= 0) return; seen.push(id);
          var none = id === 'none', p = none ? null : pal(ctx, id), b = el('button', 'afbh-pcol' + (cols[ctx.picSel] === id ? ' afc-on' : ''), (none ? '<i class="afc-im-none"></i><span>' + esc(TX.invisible) : '<i style="--sw:' + p.hex + '"></i><span>' + esc(p.label) + (hexOf(ctx, id) === hexOf(ctx, cov) ? ' · ' + esc(TX.isCover) : '')) + '</span>'); b.type = 'button';
          b.addEventListener('click', function () { ctx.picSel = ci; refreshPanel(ctx); }); P.picCols.appendChild(b);
        });
        P.picSw.paint();
        paintPicPrev(ctx, it0, q);
      }
    }
    P.drawBox.hidden = !(it0 && it0.type === 'draw');
    if (P.bar.el) P.bar.sync();
    // valori sui titoli, numeri, "Next: ..."
    var gv = function (id, t) { var e = ctx.ui.groups.querySelector('[data-group="' + id + '"] .afm-ghead .afc-gval'); if (e) e.textContent = t; };
    var d = photoDims(ctx, F), nf = filCount(ctx), dims = closedDims(ctx);
    gv('dir', st.dir === 'H' ? TX.dirH : TX.dirV); gv('photo', F.label + ' · ' + Math.round(d[0]) + ' × ' + Math.round(d[1]) + ' mm'); gv('pages', TX.sumPagesN.replace('{n}', st.pages));
    gv('cover', (st.front === 'photo' ? TX.frontPhoto : TX.frontBlank) + (st.holes ? ' · ' + TX.holesYes + ' ' + st.holeD + ' mm' : '') + (st.spinePhoto ? ' · ' + TX.sumSpine : '') + ' · ' + hingeLab(st)); gv('design', itemsSum(ctx));
    gv('colors', pal(ctx, st.colors.cover).label + ' · ' + pal(ctx, st.colors.page).label); gv('review', '');
    var n = 0, L = steps(ctx); L.forEach(function (gg) { var num = gg.querySelector('.afc-num'); if (num) num.textContent = ++n; });
    L.forEach(function (gg, i) { var b = gg.querySelector('.afm-next'); if (!b) return; var nx = L[i + 1]; b.hidden = !nx; b.parentNode.querySelector('.afm-prev').hidden = i === 0; if (nx) b.innerHTML = esc(TX.nextTo.replace('{s}', nx.querySelector('.afc-gtitle').textContent)) + ' <span aria-hidden="true">→</span>'; });
    // riepilogo (con "Edit" che apre il passo)
    var cC2 = coverCols(ctx);   // 0.6.0: copertina e pagine separate
    var rows = [[TX.sumDir, st.dir === 'H' ? TX.dirH : TX.dirV, 'dir'], [TX.sumPhoto, F.label + ' · ' + Math.round(d[0]) + ' × ' + Math.round(d[1]) + ' mm', 'photo'], [TX.sumPages, TX.sumPagesN.replace('{n}', st.pages), 'pages'],
      [TX.sumColors, TX.sumColorsText.replace('{n}', cC2.hex.length).replace('{list}', cC2.label.join(', ')).replace('{p}', pal(ctx, st.colors.page).label), 'colors'],
      [TX.sumCover, (st.front === 'photo' ? TX.frontPhoto : TX.frontBlank), 'cover'], [TX.sumHoles, st.holes ? TX.yesLabel + ' · ' + st.holeD + ' mm' : TX.holesNo, 'cover'], [TX.sumSpine, st.spinePhoto ? TX.yesLabel : TX.noLabel, 'cover'], [TX.sumHinge, hingeLab(st), 'cover'], [TX.sumDesign, itemsSum(ctx), 'design'],
      [TX.sumClosed, r1(dims.w) + ' × ' + r1(dims.h) + ' × ' + r1(dims.t) + ' mm', null], [TX.sumPieces, (st.hinge === 'pip' ? TX.piecesTextPip : TX.piecesText).replace('{n}', st.pages), null]];
    rows = rows.filter(function (r) { return r[0] !== TX.sumSpine || st.spinePhoto || spineFits(ctx); });   // 0.5.9: la costa con la foto solo dove si puo'
    if (st.hinge === 'fil') rows.push([TX.sumPins, TX.pinsText.replace('{l}', Math.round(2 * F.Lh - 2)), null]);
    rows.push([TX.sumFiles, TX.filesText, null]);
    P.sum.innerHTML = rows.map(function (r) { return '<li' + (r[2] ? ' data-go="' + r[2] + '"' : '') + '><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b>' + (r[2] ? '<button type="button" class="afm-edit">' + esc(TX.editLabel) + '</button>' : '') + '</li>'; }).join('');
    [].forEach.call(P.sum.querySelectorAll('.afm-edit'), function (b) { b.addEventListener('click', function () { openStep(ctx, b.parentNode.dataset.go); }); });
    ctx.tooMany = nf > MAX_FIL ? nf : 0; ctx.thin = thinItems(ctx); ctx.offCover = outsideItem(ctx); showWarn(ctx);
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('basa3d:book-config-change', {
          detail: {
            state: st,
            format: F,
            itemsCount: liveItems(ctx).length
          }
        }));
      }
    } catch (e) {}
  }
  /* 0.5.7 (prove a tappeto 27/10): un pezzo di scritta, disegno o immagine fuori dalla copertina (o nella fessura tra due
     pezzi) non si stampa, ma nessuno lo diceva (es. una scritta lunga che esce dai lati). Ogni disegno si fa da solo a 3 punti
     per mm, si tolgono le facce dei pezzi e si conta cosa resta: oltre 3 mm2 e oltre il 3% del disegno, si avvisa. */
  function outsideItem(ctx) {
    var items = ctx.st.items, L = layout(ctx);
    var sig = L.key + '#' + items.map(function (it) { return [it.id, it.type, it.u, it.v, it.mm, it.rot, it.t, it.font, it.n, it.bg, (it.cols || []).join(','), (it.strokes || []).length, hasInk(ctx, it) ? 1 : 0].join('|'); }).join(';');
    if (ctx._offSig === sig) return ctx._offIdx;
    var res = -1;
    try {
      for (var i = 0; i < items.length && res < 0; i++) {
        var it = items[i]; if (!hasInk(ctx, it)) continue;
        var b = [1e9, 1e9, -1e9, -1e9]; itemCorners(ctx, it).pts.forEach(function (q) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); });
        var k = Math.min(3, 600 / Math.max(1, b[2] - b[0], b[3] - b[1])), W = Math.ceil((b[2] - b[0]) * k) + 4, H = Math.ceil((b[3] - b[1]) * k) + 4;
        var cv = outsideItem.cv || (outsideItem.cv = document.createElement('canvas')); cv.width = W; cv.height = H;
        var g = cv.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
        g.setTransform(k, 0, 0, k, 2 - b[0] * k, 2 - b[1] * k); drawItem(ctx, g, it, null);
        var d = g.getImageData(0, 0, W, H).data, n0 = 0, n1 = 0, j; for (j = 3; j < d.length; j += 4) if (d[j] >= 128) n0++;
        if (!n0) continue;
        g.globalCompositeOperation = 'destination-out'; g.beginPath(); PARTS.forEach(function (p) { ringsPath(g, L.parts[p].face); }); g.fillStyle = '#000'; g.fill('evenodd'); g.globalCompositeOperation = 'source-over';
        d = g.getImageData(0, 0, W, H).data; for (j = 3; j < d.length; j += 4) if (d[j] >= 128) n1++;
        if (n1 / (k * k) > 3 && n1 > n0 * 0.03) res = i;
      }
    } catch (e) { console.warn('[AFBookHub] off cover:', e); res = -1; }
    ctx._offSig = sig; ctx._offIdx = res; return res;
  }
  /* avvisi (standard): in fondo sopra il nome del file, con "Fix it" che porta al punto da sistemare */
  function warnEl(ctx) {
    var P = ctx.p; if (!P) return null;
    if (!P.warn) {
      P.warn = el('button', 'afc-im-warn afm-warn'); P.warn.type = 'button'; P.warn.hidden = true;
      var foot = ctx.ui.buy.closest('.afc-foot'); foot.insertBefore(P.warn, foot.firstChild);
      P.warn.addEventListener('click', function () { var e2 = ctx.warnErr, go = e2 ? e2.go || 'design' : 'design'; if (e2) { ctx.warnErr = null; showWarn(ctx); } else if (!ctx.tooMany && ctx.offCover >= 0 && ctx.st.items[ctx.offCover]) { ctx.st.sel = ctx.offCover; refreshPanel(ctx); } openStep(ctx, go); });
    }
    return P.warn;
  }
  function setWarnErr(ctx, text, go) { ctx.warnErr = text ? { text: text, go: go } : null; showWarn(ctx); }
  function showWarn(ctx) {
    var w = warnEl(ctx); if (!w) return;
    var t = ctx.warnErr ? ctx.warnErr.text : ctx.tooMany ? TX.tooMany.replace('{n}', ctx.tooMany).replace('{max}', MAX_FIL) : ctx.offCover >= 0 ? TX.offCover : ctx.thin ? TX.tooThin : '';
    w.hidden = !t; if (t && w.dataset.t !== t) { w.dataset.t = t; w.innerHTML = '<span>' + esc(t) + '</span><b>' + esc(TX.warnFix) + ' →</b>'; }
  }

  /* ---- pezzi colorati da stampare: per ogni pezzo e colore la "maschera" a 10 px/mm (stesso disegno del riquadro),
     tagliata sulla faccia esterna, contorni -> prisma da y = yOut - 0,05 a yOut + 0,8 nel sistema del file STL ---------- */
  function b64(buf) { var b = new Uint8Array(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength), s2 = '', i; for (i = 0; i < b.length; i += 0x8000) s2 += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s2); }
  function itemsBoxL(ctx, items) {
    var b = [1e9, 1e9, -1e9, -1e9];
    items.forEach(function (it) { itemCorners(ctx, it).pts.forEach(function (q) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); }); });
    return b;
  }
  function buildDesign(ctx) {
    var L = layout(ctx), items = liveItems(ctx), hexes = designHexes(ctx), out = [], yo = G0(ctx).yOut, depth = (ctx.cfg.lettering || {}).depth || 0.8;
    if (!items.length || !hexes.length) return Promise.resolve(out);
    var ib = itemsBoxL(ctx, items), jobs = [];
    PARTS.forEach(function (p) { hexes.forEach(function (h) { jobs.push([p, h]); }); });
    return new Promise(function (resolve, reject) {
      var j = 0;
      (function next() {
        if (current !== ctx) { reject(new Error('closed')); return; }
        try {
          var t0 = performance.now();
          while (j < jobs.length && performance.now() - t0 < 40) {
            var p = jobs[j][0], hex = jobs[j][1]; j++;
            var P = L.parts[p], fb = P.sbox, r = [Math.max(fb[0], ib[0]) - 0.5, Math.max(fb[1], ib[1]) - 0.5, Math.min(fb[2], ib[2]) + 0.5, Math.min(fb[3], ib[3]) + 0.5];
            if (r[2] <= r[0] || r[3] <= r[1]) continue;
            var k = Math.min(PRINT_PX, 2400 / Math.max(r[2] - r[0], r[3] - r[1])), W = Math.ceil((r[2] - r[0]) * k) + 4, H = Math.ceil((r[3] - r[1]) * k) + 4;
            var cv = buildDesign.cv || (buildDesign.cv = document.createElement('canvas')); cv.width = W; cv.height = H;
            var g = cv.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
            var M = [k, 0, 0, k, 2 - r[0] * k, 2 - r[1] * k];
            g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
            items.forEach(function (it) { drawItem(ctx, g, it, hex); });
            // 0.6.1 (ALFI): ritaglio sulla SAGOMA del pezzo (sil) e non sulla faccia piatta: il modificatore colora solo dove c'e' il pezzo,
            // cosi' anche i cilindri della cerniera e i bordi arrotondati hanno il colore del disegno nei primi 0,8 mm (prima solo il 1o strato)
            g.globalCompositeOperation = 'destination-in'; g.beginPath(); ringsPath(g, P.sil); g.fillStyle = '#fff'; g.fill('evenodd'); g.globalCompositeOperation = 'source-over';
            var d = g.getImageData(0, 0, W, H).data, fld = new Float32Array(W * H), any = false;
            for (var i = 0; i < W * H; i++) { var a = d[i * 4 + 3] / 255, v = d[i * 4] / 255 * a; fld[i] = v; if (v >= 0.5) any = true; }
            for (var x = 0; x < W; x++) { fld[x] = 0; fld[(H - 1) * W + x] = 0; } for (var y = 0; y < H; y++) { fld[y * W] = 0; fld[y * W + W - 1] = 0; }
            if (!any) continue;
            var Mi = affInv(M), Ai = P.Ai, TL = TM.lib;
            var rings = TL.contours(fld, W, H).map(function (rr) { return TL.simplify(rr, 0.35).map(function (q) { var l = affApply(Mi, q[0], q[1]); return affApply(Ai, l[0], l[1]); }); })
              .filter(function (rr) { return rr.length >= 3 && Math.abs(TL.ringArea(rr)) > 0.2; });
            if (!rings.length) continue;
            var tris = [];
            TL.polygons(rings).forEach(function (poly) { TL.prism(poly, yo - 0.05, yo + depth, tris); });
            // (x', y', z') del prisma = (x, z, y) del file: si scambiano y e z e si gira l'ordine dei vertici (stessa faccia fuori)
            var idx = {}, V = [], Fi = [];
            var vid = function (q) { var key = Math.round(q[0] * 1e4) + ',' + Math.round(q[1] * 1e4) + ',' + Math.round(q[2] * 1e4), id = idx[key]; if (id == null) { id = idx[key] = V.length / 3; V.push(q[0], q[2], q[1]); } return id; };
            for (var t = 0; t < tris.length; t += 3) { var a0 = vid(tris[t]), b0 = vid(tris[t + 1]), c0 = vid(tris[t + 2]); if (a0 !== b0 && b0 !== c0 && a0 !== c0) Fi.push(a0, c0, b0); }
            if (Fi.length) out.push({ part: p, hex: hex, v: b64(new Float32Array(V)), f: b64(new Uint32Array(Fi)), tris: Fi.length / 3 });
          }
        } catch (e) { reject(e); return; }
        if (j < jobs.length) setTimeout(next, 0); else resolve(out);
      })();
    });
  }
  // la scelta per il server (choice.print.build) e per la pagina (codice, descrizione, stato da salvare)
  function choiceBase(ctx) {
    var st = ctx.st, F = fmtOf(ctx), cfg = ctx.cfg;
    var code = ['BH', F.id, 'P' + st.pages, st.front === 'photo' ? 'PH' : 'BL', st.holes ? 'WALL' + st.holeD : '', st.spinePhoto ? 'SPH' : '', st.hinge === 'fil' ? 'FIL' : st.hinge === 'pip' ? 'PIP' : 'SNAP', liveItems(ctx).length ? 'D' + liveItems(ctx).length : ''].filter(Boolean).join('-');
    var label = (cfg.title || 'Photo Book Studio') + ' ' + (st.dir === 'H' ? 'ngang' : 'dọc') + ' ' + F.label + ' · ' + st.pages + ' trang · ' + (st.front === 'photo' ? 'bìa có ảnh' : 'bìa trơn') + (st.holes ? ' · lỗ treo ' + st.holeD + ' mm' : '') + (st.spinePhoto ? ' · ảnh gáy' : '') + ' · ' + (st.hinge === 'fil' ? 'chốt filament' : st.hinge === 'pip' ? 'in liền' : 'khớp cài') + (liveItems(ctx).length ? ' · có họa tiết' : '');
    return { slug: ctx.slug, code: code, label: label, fileName: STD.cleanName(st.fname, '3mf'), state: stateObj(ctx),
      colors: { cover: { id: st.colors.cover, label: pal(ctx, st.colors.cover).label, hex: hexOf(ctx, st.colors.cover) }, page: { id: st.colors.page, label: pal(ctx, st.colors.page).label, hex: hexOf(ctx, st.colors.page) } } };
  }
  function choiceOf(ctx) {
    var st = ctx.st, F = fmtOf(ctx), ch = choiceBase(ctx);
    // 0.5.7: prima del file si aspettano i font ancora in arrivo (emoji, accenti), cosi' si stampa quello che si vede
    var fr = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 3000); })]) : Promise.resolve();
    return fr.then(function () { ctx._tl = {}; return buildDesign(ctx); }).then(function (design) {
      ch.print = { version: 2, build: { v: 2, fmt: F.id, pages: st.pages, hinge: st.hinge, front: st.front, holes: !!st.holes, holeD: st.holeD, spinePhoto: !!st.spinePhoto, cover: hexOf(ctx, st.colors.cover), page: hexOf(ctx, st.colors.page),
        design: design.map(function (d) { return { part: d.part, hex: d.hex, v: d.v, f: d.f }; }) } };
      ch.designTris = design.reduce(function (s, d) { return s + d.tris; }, 0);
      return ch;
    });
  }
  function stateObj(ctx) {
    var st = ctx.st;
    return { v: 2, slug: ctx.slug, fname: STD.cleanName(st.fname, '3mf'), dir: st.dir, code: st.code, pages: st.pages, front: st.front, hinge: st.hinge, holes: !!st.holes, holeD: st.holeD, spinePhoto: !!st.spinePhoto, colors: Object.assign({}, st.colors), sel: st.sel,
      items: st.items.map(function (it) { var o = {}; for (var k in it) if (k !== 'part' && k !== '_rev' && k !== 'mm0') o[k] = it[k]; return o; }) };
  }
  /* 0.5.7 (prove a tappeto 27/10): la memoria della pagina (sessionStorage) tiene circa 5 MB: con immagini grandi (PNG) non ci
     stavano e si perdevano TUTTE ricaricando la pagina o tornando dall'accesso. Ora le immagini grandi vanno nel database del
     dispositivo (IndexedDB) e nella memoria della pagina resta solo il riferimento; riaprendo si rimettono a posto. */
  var PIC_REF = 'idb:';
  function picStore() { return STD.deviceStore('af-book-hub-session', 999); }
  function persist(ctx) {
    var s0 = stateObj(ctx), key = STORE + ctx.slug;
    if (!ctx._noIdb && typeof indexedDB !== 'undefined') s0.items.forEach(function (it) {
      var img = it.img; if (it.type !== 'pic' || !img || img.length < 150000 || img.indexOf(PIC_REF) === 0) return;
      var iid = it.iid, sv = ctx._picIdb = ctx._picIdb || {};
      if (!sv[iid]) { sv[iid] = 1; Promise.resolve().then(function () { return picStore().put({ id: 'p' + iid, slug: '_pic', t: Date.now() }, img); }).catch(function () { delete sv[iid]; if (!ctx._noIdb) { ctx._noIdb = true; persist(ctx); } }); }
      it.img = PIC_REF + iid;
    });
    try { sessionStorage.setItem(key, JSON.stringify(s0)); } catch (e) { try { s0.items = s0.items.filter(function (i) { return i.type !== 'pic' || String(i.img || '').indexOf(PIC_REF) === 0; }); sessionStorage.setItem(key, JSON.stringify(s0)); } catch (e2) {} }
    histLater(ctx); saveBtn(ctx);
  }
  function picRefs(ctx) {   // riaprendo: le immagini salvate nel database del dispositivo tornano al loro posto
    var all = ctx.st.items || [], need = all.filter(function (it) { return it.type === 'pic' && String(it.img || '').indexOf(PIC_REF) === 0; }), keep = {};
    all.forEach(function (it) { if (it.iid) keep['p' + it.iid] = 1; });
    var S = picStore();
    Promise.all(need.map(function (it) {
      return Promise.resolve().then(function () { return S.get('p' + it.iid); }).then(function (r) { if (r && typeof r.state === 'string' && r.state.indexOf('data:') === 0) { it.img = r.state; (ctx._picIdb = ctx._picIdb || {})[it.iid] = 1; } else it.img = ''; }, function () { it.img = ''; });
    })).then(function () {
      if (current !== ctx || !ctx.st) return;
      if (need.length) {
        ctx.st.items = ctx.st.items.filter(function (it) { return it.type !== 'pic' || (it.img && String(it.img).indexOf(PIC_REF) !== 0); });
        if (ctx.st.sel >= ctx.st.items.length) ctx.st.sel = ctx.st.items.length - 1;
        renderItems(ctx); designChanged(ctx, true);
      }
      return Promise.resolve().then(function () { return S.list('_pic'); }).then(function (Lm) { (Lm || []).forEach(function (m) { if (!keep[m.id] && Date.now() - (m.t || 0) > 3600e3) S.remove(m.id); }); });
    }).catch(function () {});
  }
  /* ---- Annulla / Ripeti (standard): una "foto" della configurazione dopo ogni modifica */
  var HMAX = 40;
  function histSnap(ctx) { var s = stateObj(ctx), I = ctx.imgStore = ctx.imgStore || {}; delete s.sel; delete s.fname; s.items.forEach(function (it) { if (it.img) { I[it.iid] = it.img; it.img = '@' + it.iid; } }); return JSON.stringify(s); }
  function histLater(ctx) { clearTimeout(ctx._hT); ctx._hT = setTimeout(function () { histRecord(ctx); }, 500); }
  function histRecord(ctx) {
    if (current !== ctx || !ctx.st) return;
    if (ctx.ed && ctx.ed.drag) { histLater(ctx); return; }
    var H = ctx.hist = ctx.hist || [], sn = histSnap(ctx), cur = H[ctx.hpos];
    if (cur === sn) { ctx._undoing = false; return; }
    if (ctx._undoing && cur != null) { H[ctx.hpos] = sn; ctx._undoing = false; }
    else { H.length = ctx.hpos == null ? 0 : ctx.hpos + 1; H.push(sn); if (H.length > HMAX) H.shift(); ctx.hpos = H.length - 1; }
    histButtons(ctx);
  }
  function histButtons(ctx) {
    var ui = ctx.ui, H = ctx.hist || []; if (!ui.hist) return; ui.hist.hidden = false;
    ui.undo.disabled = !(ctx.hpos > 0); ui.redo.disabled = !(ctx.hpos < H.length - 1);
    ui.undo.querySelector('span').textContent = TX.undoLabel; ui.undo.title = TX.undoLabel + ' (Ctrl+Z)'; ui.redo.title = TX.redoLabel;
    ui.undo.setAttribute('aria-label', TX.undoLabel); ui.redo.setAttribute('aria-label', TX.redoLabel);
  }
  function restoreState(ctx, s) {
    var st = ctx.st, keep = { fname: st.fname, sel: st.sel }, before = layout(ctx);
    Object.keys(st).forEach(function (k) { delete st[k]; }); Object.assign(st, defaults(ctx.cfg)); applyState(ctx, Object.assign({ v: 2 }, s));
    if (s.fname == null) st.fname = keep.fname; if (s.sel == null) st.sel = keep.sel;
    fixState(ctx); ctx._lay = null; if (ctx.ed) { ctx.ed.drag = null; ctx.ed.snap = null; }
    paintPhotos(ctx); renderItems(ctx); refreshPanel(ctx); buildScene(ctx, false); paintMats(ctx); designChanged(ctx, true);
    var fl = liveItems(ctx).filter(function (it) { return it.type === 'text'; }).map(function (it) { return fontById(ctx, it.font); });
    if (fl.length) loadFonts(fl).then(function () { if (current === ctx) { ctx._tl = {}; designChanged(ctx, false); } });
  }
  function histGo(ctx, d) {
    var H = ctx.hist || [], i = (ctx.hpos || 0) + d; if (!ctx.st || i < 0 || i >= H.length) return;
    clearTimeout(ctx._hT); clearTimeout(ctx._txT);
    var s = JSON.parse(H[i]), I = ctx.imgStore || {}; (s.items || []).forEach(function (it) { if (it.img && it.img.charAt(0) === '@') it.img = I[it.img.slice(1)] || ''; });
    ctx.hpos = i; ctx._undoing = true; restoreState(ctx, s); histButtons(ctx);
  }
  /* ---- nome del file (standard: obbligatorio, in fondo sopra il tasto) */
  function fnameField(ctx) {
    var fi = ctx.ui.fname; if (!fi) return;
    if (!fi._on) {
      fi._on = true; ctx.ui.fnameL.textContent = TX.fileNameLabel; fi.placeholder = TX.fileNamePh; fi.setAttribute('aria-label', TX.fileNameLabel);
      fi.addEventListener('input', function () { ctx.st.fname = fi.value; persist(ctx); if (STD.cleanName(fi.value, '3mf')) { fi.parentNode.classList.remove('afm-need'); fi.placeholder = TX.fileNamePh; } });
      fi.addEventListener('change', function () { var c = STD.cleanName(fi.value, '3mf'); fi.value = c; ctx.st.fname = c; persist(ctx); });
      fi.addEventListener('keydown', function (e) { if (e.key === 'Enter') fi.blur(); });
    }
    if (document.activeElement !== fi) fi.value = ctx.st.fname || '';
  }
  function needName(ctx) {
    var fi = ctx.ui.fname, lab = fi && fi.parentNode;
    if (STD.cleanName(ctx.st.fname, '3mf')) return true;
    if (lab) { lab.classList.remove('afm-need'); void lab.offsetWidth; lab.classList.add('afm-need'); fi.placeholder = TX.nameNeeded; }
    flashNote(ctx, TX.nameNeededNote);
    setTimeout(function () { try { fi.focus({ preventScroll: false }); lab.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 300);
    return false;
  }
  /* ---- Salva / My designs (standard: solo sul dispositivo del cliente, mai sul sito) */
  function dstore() { return STD.deviceStore('af-book-hub-designs', 30); }
  function dlist(ctx) { return Promise.resolve().then(function () { return dstore().list(ctx.slug); }).then(function (L) { return (L || []).slice().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }); }); }
  function designSnap(ctx) { var s = stateObj(ctx); delete s.sel; return JSON.stringify(s); }
  function isSaved(ctx) { return !!(ctx.designId && ctx.saved && ctx.saved.j === designSnap(ctx)); }
  function setDesignSession(ctx) { try { if (ctx.designId) sessionStorage.setItem(STORE + ctx.slug + ':design', JSON.stringify({ id: ctx.designId, j: ctx.saved && ctx.saved.j })); else sessionStorage.removeItem(STORE + ctx.slug + ':design'); } catch (e) {} }
  function unlinkDesign(ctx) { ctx.designId = null; ctx.saved = null; setDesignSession(ctx); saveBtn(ctx); }
  function saveBtn(ctx) {
    var b = ctx.ui.save; if (!b || !ctx.st) return;
    var ok = isSaved(ctx), sp = b.querySelector('span'), t = ok ? TX.savedLabel : TX.saveLabel;
    b.classList.toggle('afm-saved', ok); if (sp.textContent !== t) sp.textContent = t;
    b.title = TX.saveTitle; b.setAttribute('aria-label', TX.saveTitle);
    ctx.ui.mineBtn.title = TX.myBtn; ctx.ui.mineBtn.setAttribute('aria-label', TX.myBtn); ctx.ui.mineBtn.querySelector('span').textContent = TX.myBtn;
  }
  function hideSaveMenu(ctx) { if (ctx.ui.smenu) ctx.ui.smenu.hidden = true; }
  function saveClick(ctx) {
    if (!ctx.st || !ctx.viewer) return;
    if (!ctx.ui.smenu.hidden) { hideSaveMenu(ctx); return; }
    if (isSaved(ctx)) { flashNote(ctx, TX.alreadySaved); return; }
    if (ctx.designId) {
      var m = ctx.ui.smenu, nm = STD.cleanName(ctx.st.fname, '3mf') || TX.myTitle;
      m.querySelector('[data-a="upd"]').textContent = TX.saveUpd.replace('{n}', nm.length > 26 ? nm.slice(0, 25) + '…' : nm);
      m.querySelector('[data-a="new"]').textContent = TX.saveNew; m.hidden = false; return;
    }
    doSave(ctx, true);
  }
  function thumbOf(ctx) {
    try {
      var v = ctx.viewer, c = ctx.ui.canvas; if (!v || !c.width) return '';
      var keep = { az: v.az, el: v.el, dist: v.dist, intro: v.intro, target: v.target.slice() };
      for (var k in v.materials) { var mt = v.materials[k]; if (mt.target) { mt.col = mt.target.slice(); mt.target = null; } }
      v.intro = null; v.az = v.homeAz; v.el = v.homeEl; v.dist = (v.fitDist || v.distT) * 0.9; v.target = v.targetT.slice(); v.draw();
      var w = c.width, h = c.height, s2 = Math.min(w, h) * 0.98, T0 = 240, cv = document.createElement('canvas'); cv.width = cv.height = T0;
      var g = cv.getContext('2d'); g.fillStyle = '#f2f2f5'; g.fillRect(0, 0, T0, T0); g.drawImage(c, (w - s2) / 2, (h - s2) / 2, s2, s2, 0, 0, T0, T0);
      v.az = keep.az; v.el = keep.el; v.dist = keep.dist; v.intro = keep.intro; v.target = keep.target; v.dirty = true;
      return cv.toDataURL('image/jpeg', 0.82);
    } catch (e) { return ''; }
  }
  function doSave(ctx, asNew) {
    var st = ctx.st; if (!st || ctx._saving) return;
    ctx._saving = true; hideSaveMenu(ctx);
    var S = dstore();
    dlist(ctx).then(function (L) {
      if (current !== ctx) return;
      var old = !asNew && L.filter(function (m) { return m.id === ctx.designId; })[0];
      if (!old) asNew = true;
      if (asNew && L.length >= S.max) { ctx._saving = false; flashNote(ctx, TX.saveFull.replace('{n}', S.max)); return; }
      var name = STD.cleanName(st.fname, '3mf'); if (!name) name = (ctx.cfg.title || 'Album ảnh BaSa3D') + ' ' + (L.length + 1);
      name = STD.uniqName(name, L, asNew ? null : ctx.designId);
      if (name !== st.fname) { st.fname = name; var fi = ctx.ui.fname; if (fi) { fi.value = name; fi.parentNode.classList.remove('afm-need'); fi.placeholder = TX.fileNamePh; } persist(ctx); }
      var now = Date.now(), state = stateObj(ctx), F = fmtOf(ctx);
      var meta = { id: asNew ? STD.newId() : ctx.designId, slug: ctx.slug, name: name, info: F.label + ' · ' + st.pages + ' trang', thumb: thumbOf(ctx), created: old ? old.created || now : now, updated: now };
      return Promise.resolve(S.put(meta, state)).then(function () {
        ctx._saving = false; if (current !== ctx) return;
        ctx.designId = meta.id; ctx.saved = { j: designSnap(ctx) }; setDesignSession(ctx); saveBtn(ctx);
        ctx.ui.save.classList.remove('afm-pop'); void ctx.ui.save.offsetWidth; ctx.ui.save.classList.add('afm-pop');
        flashNote(ctx, TX.savedNote);
      });
    }).catch(function (e) { ctx._saving = false; console.warn('[AFBookHub] save:', e); flashNote(ctx, TX.saveFail); });
  }
  function showMine(ctx, on) {
    var ui = ctx.ui; ui.start.hidden = !on; ui.modal.classList.toggle('afm-starting', !!on);
    if (on) { ui.modal.style.setProperty('--afm-headh', (ui.head.offsetHeight || 64) + 'px'); ui.startBack.textContent = '← ' + TX.backTo; ui.start.scrollTop = 0; renderMine(ctx); }
  }
  function mineMsg(ctx, text) { var m = ctx.ui.mine.querySelector('.afm-mine-msg'); m.textContent = text; m.hidden = !text; clearTimeout(ctx._mmT); if (text) ctx._mmT = setTimeout(function () { m.hidden = true; }, 4000); }
  function renderMine(ctx, hi) {
    var box = ctx.ui.mine, S = dstore(), seq = ctx._mineSeq = (ctx._mineSeq || 0) + 1;
    dlist(ctx).then(function (L) {
      if (seq !== ctx._mineSeq || current !== ctx) return;
      box.querySelector('.afm-mine-h b').textContent = TX.myTitle;
      box.querySelector('.afm-mine-h small').textContent = TX.myCount.replace('{n}', L.length).replace('{max}', S.max);
      box.querySelector('.afm-mine-w').textContent = TX.myDevice;
      var em = box.querySelector('.afkb-mine-empty'); em.hidden = !!L.length; em.textContent = TX.myEmpty;
      var list = box.querySelector('.afm-mine-list'); list.innerHTML = '';
      L.forEach(function (m) {
        var cur = m.id === ctx.designId, d = el('div', 'afm-dz' + (cur ? ' afm-dz-cur' : '') + (m.id === hi ? ' afm-dz-new' : '')); d.dataset.id = m.id;
        d.innerHTML = '<button type="button" class="afm-dz-open" aria-label="' + esc(TX.openLabel + ' ' + m.name) + '"><span class="afm-dz-img">' + (m.thumb ? '<img alt="" src="' + esc(m.thumb) + '">' : '') + (cur ? '<em>' + esc(TX.nowOpen) + '</em>' : '') + '</span><span class="afm-dz-tx"><b></b><small></small></span></button>' +
          '<div class="afm-dz-btns"><button type="button" class="afm-dz-copy"></button><button type="button" class="afm-dz-del"></button></div>';
        d.querySelector('b').textContent = m.name; d.querySelector('small').textContent = (m.info ? m.info + ' · ' : '') + STD.fmtDate(m.updated);
        var cp = d.querySelector('.afm-dz-copy'), del = d.querySelector('.afm-dz-del'); cp.textContent = TX.copyLabel; del.textContent = TX.delLabel;
        d.querySelector('.afm-dz-open').addEventListener('click', function () { openDesign(ctx, m.id); });
        cp.addEventListener('click', function () { copyDesign(ctx, m.id); });
        var delAt = 0, delT = null;
        del.addEventListener('click', function () {
          var now = Date.now();
          if (now - delAt > 4000) { delAt = now; del.classList.add('afm-sure'); del.textContent = TX.delSure; clearTimeout(delT); delT = setTimeout(function () { delAt = 0; del.classList.remove('afm-sure'); del.textContent = TX.delLabel; }, 3500); return; }
          clearTimeout(delT); deleteDesign(ctx, m.id);
        });
        list.appendChild(d);
      });
    }, function (e) { console.warn('[AFBookHub] designs:', e); mineMsg(ctx, TX.saveFail); });
  }
  function openDesign(ctx, id) {
    Promise.resolve().then(function () { return dstore().get(id); }).then(function (r) {
      if (current !== ctx) return;
      var s2 = r && r.state; if (!s2 || s2.v !== 2 || (s2.slug && s2.slug !== ctx.slug)) { mineMsg(ctx, TX.openFail); return; }
      ctx.pics = {}; ctx.picLoading = {}; ctx._dc = {}; ctx._tl = {}; ctx.hist = []; ctx.hpos = null;
      restoreState(ctx, s2);
      ctx.designId = id; ctx.saved = { j: designSnap(ctx) }; setDesignSession(ctx);
      showMine(ctx, false); updateBuy(ctx); saveBtn(ctx); histRecord(ctx);
      flashNote(ctx, TX.openedNote.replace('{n}', (r.meta && r.meta.name) || s2.fname || ''));
    }).catch(function (e) { console.warn('[AFBookHub] open design:', e); mineMsg(ctx, TX.openFail); });
  }
  function copyDesign(ctx, id) {
    var S = dstore();
    dlist(ctx).then(function (L) {
      if (L.length >= S.max) { mineMsg(ctx, TX.saveFull.replace('{n}', S.max)); return; }
      return Promise.resolve(S.get(id)).then(function (r) {
        if (!r || !r.meta || !r.state) { mineMsg(ctx, TX.openFail); return; }
        var now = Date.now(), m = Object.assign({}, r.meta, { id: STD.newId(), created: now, updated: now });
        m.name = STD.uniqName(STD.cleanName(String(r.meta.name).slice(0, 60 - TX.copySuffix.length) + TX.copySuffix), L);
        return Promise.resolve(S.put(m, Object.assign({}, r.state, { fname: m.name }))).then(function () { renderMine(ctx, m.id); mineMsg(ctx, TX.copiedNote.replace('{n}', m.name)); });
      });
    }).catch(function (e) { console.warn('[AFBookHub] copy design:', e); mineMsg(ctx, TX.saveFail); });
  }
  function deleteDesign(ctx, id) {
    Promise.resolve().then(function () { return dstore().remove(id); }).then(function () {
      if (id === ctx.designId) unlinkDesign(ctx);
      renderMine(ctx); mineMsg(ctx, TX.deletedNote);
    }).catch(function (e) { console.warn('[AFBookHub] delete design:', e); mineMsg(ctx, TX.saveFail); });
  }
  /* ---- tasto in fondo: Compra / Accedi / Download (lo decide la pagina) */
  function stateName(s) { return s === 'login' ? 'login' : (s === 'owned' || s === 'unlocked' || s === 'free') ? 'owned' : 'buy'; }
  function withChoice(ctx, fn) {
    if (ctx._busy) return; if (!needName(ctx)) return;
    if (ctx.tooMany) { showWarn(ctx); flashNote(ctx, TX.tooMany.replace('{n}', ctx.tooMany).replace('{max}', MAX_FIL)); return; }
    ctx._busy = true; flashNote(ctx, TX.preparing); ctx.ui.buy.classList.add('afc-busy');
    choiceOf(ctx).then(function (ch) { ctx._busy = false; ctx.ui.buy.classList.remove('afc-busy'); ctx.ui.note.hidden = true; fn(ch); }, function (e) { ctx._busy = false; ctx.ui.buy.classList.remove('afc-busy'); console.error('[AFBookHub] choice', e); flashNote(ctx, TX.prepFail); });
  }
  function updateAdmin(ctx) {
    var b = ctx.ui.adminDl; if (!b) return;
    if (!ctx.opts.admin || !ctx.opts.onAdminDownload) { b.hidden = true; return; }
    b.hidden = false; b.innerHTML = 'Quản trị · <b>Tải file 3MF ngay</b>';
    b.onclick = function () { withChoice(ctx, function (ch) { console.log('[AFBookHub] choice', ch.code, ch.label, 'design triangles', ch.designTris); ctx.opts.onAdminDownload(ch); }); };
  }
  function updateBuy(ctx) {
    updateAdmin(ctx); persist(ctx);
    var o = ctx.opts, b = ctx.ui.buy, st = stateName(o.state), bt = o.buttonText || {};
    var pr = o.price || (o.priceLabel ? { now: o.priceLabel } : null);
    var ph = pr && pr.now ? (pr.was ? '<s class="afc-was">' + esc(pr.was) + '</s> ' : '') + '<b>' + esc(pr.now) + '</b>' : '';
    if (st === 'owned') b.innerHTML = bt.owned ? esc(bt.owned) : 'Tải file 3MF · <b>Album của bạn</b>';
    else if (st === 'login') b.innerHTML = esc(bt.login || 'Đăng nhập để tải về') + (ph ? ' · ' + ph : '');
    else b.innerHTML = esc(bt.buy || 'Tải file 3MF · Album của bạn') + (ph ? ' · ' + ph : '');
    var fine = [];
    if (st !== 'owned' && o.points) fine.push('<span class="afc-points">' + esc(o.points) + '</span>');
    fine.push('<span class="afc-forever">' + esc(o.foreverText || 'Đa đĩa in AMS · Chuẩn xưởng BaSa3D') + '</span>');
    var lic = st !== 'owned' ? '<div class="afc-license">' + esc(o.licenseText || 'Sử dụng cá nhân. Liên hệ xưởng BaSa3D nếu cần gia công in 3D số lượng lớn.') + '</div>' : '';
    if (ctx.ui.fine) ctx.ui.fine.innerHTML = '<div>' + fine.join(' · ') + '</div>' + lic;
    fnameField(ctx);
    b.onclick = function () {
      if (st === 'owned') withChoice(ctx, function (ch) { o.onDownload && o.onDownload(ch); });
      else if (st === 'login') { if (!needName(ctx)) return; (o.onLogin || o.onBuy) && (o.onLogin || o.onBuy)(choiceBase(ctx)); }
      else { if (!needName(ctx)) return; o.onBuy && o.onBuy(choiceBase(ctx)); }
    };
  }
  function update(o) { var ctx = current; if (!ctx || !o) return; Object.assign(ctx.opts, o); if (ctx.cfg) updateBuy(ctx); }

  /* ---- apertura ------------------------------------------------------------------------------------------- */
  function resize(ctx) {
    var c = ctx.ui.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    if (ctx.viewer) { ctx.viewer.updateDist(true); ctx.viewer.dirty = true; }
  }
  function open(opts) {
    opts = opts || {};
    if (current) close();
    var basePath = opts.basePath || '/configurator/', slug = opts.slug || 'book-hub';
    var isTouch = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
    var ov = el('div', 'afc-overlay afm afkb afbh'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    var modal = el('div', 'afc-modal'); ov.appendChild(modal);
    modal.innerHTML =
      '<header class="afc-head"><div class="afc-head-txt"><div class="afc-title"></div><div class="afc-sub"></div></div>' +
      '<div class="afc-head-btns"><button type="button" class="afc-reset" aria-label="Đặt lại">' + ICON_RESET + '<span>Đặt lại</span></button>' +
      '<button type="button" class="afc-close" aria-label="Đóng">' + ICON_X + '</button></div></header>' +
      '<div class="afc-body"><div class="afc-stage"><canvas class="afc-canvas"></canvas>' +
      '<div class="afc-loading"><span class="afc-spin"></span><span class="afbh-ltxt"></span></div>' +
      '<button type="button" class="afm-flip" hidden>' + ICON_FLIP + '<span></span></button>' +
      '<div class="afm-hist" hidden><button type="button" class="afm-hundo" disabled><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg><span></span></button><button type="button" class="afm-hredo" disabled><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg></button><button type="button" class="afm-hsave"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h11.2L20 6.8V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3"/><path d="M7.5 21v-6.5h9V21"/></svg><span></span></button><button type="button" class="afm-hmine"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span></span></button></div>' +
      '<div class="afm-smenu" hidden><button type="button" data-a="upd"></button><button type="button" data-a="new"></button></div>' +
      '<div class="afc-note" hidden></div><div class="afc-hint">' + ICON_ROT + '<span></span></div></div>' +
      '<div class="afc-panel"><div class="afc-groups"></div></div></div>' +
      '<div class="afm-start afkb-mine" hidden><div class="afm-start-in"><button type="button" class="afm-start-back"></button><div class="afm-mine"><div class="afm-mine-h"><b></b><small></small></div><p class="afm-mine-w"></p><div class="afm-mine-msg" hidden></div><p class="afkb-mine-empty" hidden></p><div class="afm-mine-list"></div></div></div></div>' +
      '<footer class="afc-foot"><button type="button" class="afc-admin-dl" hidden></button><div class="afc-buybox"><label class="afm-fname"><span class="afm-fname-l"></span><input type="text" maxlength="60" autocomplete="off" spellcheck="false"><span class="afm-fname-x">.3mf</span></label><button type="button" class="afc-buy"></button><div class="afc-fine"></div></div></footer>';
    document.body.appendChild(ov);
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(function () { ov.classList.add('afc-in'); });
    var q = function (s) { return modal.querySelector(s); };
    var side = el('div', 'afm-side'); q('.afc-body').appendChild(side); side.appendChild(q('.afc-panel')); side.appendChild(q('.afc-foot'));
    var ui = { ov: ov, modal: modal, canvas: q('.afc-canvas'), loading: q('.afc-loading'), hint: q('.afc-hint'), groups: q('.afc-groups'), buy: q('.afc-buy'), adminDl: q('.afc-admin-dl'), fine: q('.afc-fine'), title: q('.afc-title'), sub: q('.afc-sub'), head: q('.afc-head'), flip: q('.afm-flip'), note: q('.afc-note'), save: q('.afm-hsave'), mineBtn: q('.afm-hmine'), smenu: q('.afm-smenu'), start: q('.afm-start'), startBack: q('.afm-start-back'), mine: q('.afm-mine'), fname: q('.afm-fname input'), fnameL: q('.afm-fname-l'), hist: q('.afm-hist'), undo: q('.afm-hundo'), redo: q('.afm-hredo') };
    q('.afbh-ltxt').textContent = TX.loading;
    var ctx = { opts: opts, ui: ui, viewer: null, raf: 0, cfg: null, st: null, prevOverflow: prevOverflow, basePath: basePath, slug: slug, fold: 1, closed: true, flipped: false };
    current = ctx;
    q('.afc-close').addEventListener('click', function () { close(); });
    var rb = q('.afc-reset'), rbT = null, rbAt = 0;
    function rbOff() { clearTimeout(rbT); rb.classList.remove('afm-sure'); rb.querySelector('span').textContent = 'Đặt lại'; }
    rb.addEventListener('click', function () {
      var now = Date.now();
      if (now - rbAt > 4000) { rbAt = now; rb.classList.add('afm-sure'); rb.querySelector('span').textContent = TX.resetSure; clearTimeout(rbT); rbT = setTimeout(rbOff, 3500); return; }
      rbAt = 0; rbOff(); unlinkDesign(ctx); ctx.pics = {}; ctx.picLoading = {}; ctx._dc = {}; ctx._tl = {}; ctx.ed = null; ctx.openId = null; ctx.seen = {}; ctx.edView = 'all';
      var s0 = defaults(ctx.cfg); s0.fname = ''; restoreState(ctx, s0); openStep(ctx, 'dir');
    });
    var ovDown = false; ov.addEventListener('pointerdown', function (e) { ovDown = e.target === ov; }, true);
    ov.addEventListener('click', function (e) {
      if (opts.fullscreen) return;
      if (e.target === ov && ovDown) close();
      ovDown = false;
    });
    var pnl = q('.afc-panel');
    pnl.addEventListener('scroll', function () {
      if (!(window.matchMedia && window.matchMedia('(max-width: 899px)').matches)) return;
      var y = pnl.scrollTop;
      if (y > 60 && !modal.classList.contains('afm-mini')) modal.classList.add('afm-mini');
      else if (y <= 2 && modal.classList.contains('afm-mini')) modal.classList.remove('afm-mini');
    }, { passive: true });
    q('.afc-stage').addEventListener('click', function () { if (modal.classList.contains('afm-mini')) modal.classList.remove('afm-mini'); });
    ctx.onKey = function (e) {
      if (e.key === 'Escape') {
        if (ctx._board) { ctx._board.close(false); return; }
        if (!ui.start.hidden) { showMine(ctx, false); return; }
        // Fullscreen studio workbench: unselect item or cancel pending mode, DO NOT destroy workbench UI
        if (ctx.st && ctx.st.sel >= 0) {
          ctx.st.sel = -1;
          refreshPanel(ctx);
          return;
        }
        if (!opts.fullscreen) {
          close();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && ctx.viewer && ui.start.hidden) { e.preventDefault(); saveClick(ctx); return; }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !ctx._board && ctx.viewer && ui.start.hidden) {   // 0.5.5: copia / incolla / duplica
        var tg0 = e.target, k0 = String(e.key).toLowerCase(), typing0 = tg0 && (tg0.tagName === 'INPUT' || tg0.tagName === 'TEXTAREA' || tg0.isContentEditable);
        if (!typing0 && !(window.getSelection && String(window.getSelection()))) {
          if (k0 === 'c') { if (copyItem(ctx)) { e.preventDefault(); flashNote(ctx, TX.copied); refreshPanel(ctx); } return; }
          if (k0 === 'v') { if (CLIP) { e.preventDefault(); pasteItem(ctx); } return; }
          if (k0 === 'd') { if (copyItem(ctx)) { e.preventDefault(); pasteItem(ctx); } return; }
        }
      }
      var tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && !typing && !ctx._board && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) { e.preventDefault(); histGo(ctx, e.key === 'y' || e.shiftKey ? 1 : -1); }
    };
    ui.undo.addEventListener('click', function () { histGo(ctx, -1); }); ui.redo.addEventListener('click', function () { histGo(ctx, 1); });
    ui.save.addEventListener('click', function (e) { e.stopPropagation(); saveClick(ctx); });
    ui.mineBtn.addEventListener('click', function () { hideSaveMenu(ctx); showMine(ctx, true); });
    ui.smenu.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; e.stopPropagation(); hideSaveMenu(ctx); doSave(ctx, b.dataset.a === 'new'); });
    modal.addEventListener('pointerdown', function (e) { if (!ui.smenu.hidden && !ui.smenu.contains(e.target) && !ui.save.contains(e.target)) hideSaveMenu(ctx); }, true);
    ui.startBack.addEventListener('click', function () { showMine(ctx, false); });
    document.addEventListener('keydown', ctx.onKey);

    loadConfig(slug, basePath).then(function (cfg) {
      if (current !== ctx) return;
      ctx.cfg = cfg; ctx.slug = cfg.slug || slug;
      if (cfg.text) for (var k in cfg.text) TX[k] = cfg.text[k];
      ui.title.textContent = cfg.title || 'Photo Book Studio · BaSa3D'; ui.sub.textContent = TX.sub;
      ui.hint.querySelector('span').textContent = isTouch ? TX.hintTouch : TX.hintMouse;
      var init = opts.initialChoice ? (opts.initialChoice.state || opts.initialChoice) : null;
      if (!init) { try { init = JSON.parse(sessionStorage.getItem(STORE + ctx.slug) || 'null'); } catch (e) { init = null; } }
      ctx.st = defaults(cfg); applyState(ctx, init); picRefs(ctx);
      try { var ds0 = JSON.parse(sessionStorage.getItem(STORE + ctx.slug + ':design') || 'null'); if (ds0 && ds0.id) { ctx.designId = ds0.id; ctx.saved = { j: ds0.j }; } } catch (e) {}
      fixState(ctx); ctx.edView = 'all';
      var gl = ui.canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      if (!gl) { ui.loading.textContent = 'Trình duyệt của bạn không hỗ trợ WebGL 3D.'; return; }
      var mats = {}; for (var mk in cfg.materials) mats[mk] = cfg.materials[mk];
      var v = ctx.viewer = new Viewer(ui.canvas, gl, mats);
      v.az = v.homeAz = homeAz(ctx, false); v.el = v.homeEl = ((cfg.camera || {}).elevation || 34) * DEG; if ((cfg.camera || {}).fov) v.fov = cfg.camera.fov * DEG;
      resize(ctx);
      v.bindInput(function () { ui.hint.classList.add('afc-hide'); });
      ui.flip.hidden = true;   // 0.3 (ALFI 22/10): niente "See back", il libro si gira a 360 gradi
      ui.closeBtn = el('button', 'afs-home afkb-close', ICON_BOOK + '<span></span>'); ui.closeBtn.type = 'button';
      // 0.3: chiudere = libro chiuso nella sua vista di casa (VERTICAL davanti, HORIZONTAL appeso: si vede il dietro);
      // aprire = copertina aperta vista da dentro, con le pagine
      ui.closeBtn.addEventListener('click', function () { if (ctx.closed) camTo(ctx, { fold: 0, flip: false, el: 52 }); else camTo(ctx, { fold: 1, flip: false }); }); ui.flip.parentNode.insertBefore(ui.closeBtn, ui.flip.nextSibling);
      ctx.fold = 1; ctx.closed = true; setFlip(ctx, false, true);
      buildPanel(ctx); paintMats(ctx); updateBuy(ctx);
      ctx.ro = new ResizeObserver(function () { resize(ctx); placeFname(ctx); }); ctx.ro.observe(ui.canvas);
      buildScene(ctx, true);
      var fl = liveItems(ctx).filter(function (it) { return it.type === 'text'; }).map(function (it) { return fontById(ctx, it.font); });
      if (fl.length) loadFonts(fl).then(function () { if (current === ctx) { ctx._tl = {}; designChanged(ctx, false); } });
      v.intro = { t0: v.time, a0: v.homeAz - 0.5, d0: 1.3 };
      var last = performance.now(), simT = v.time;
      (function loop(now) {
        if (current !== ctx) return;
        var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; simT += dt; v.time = simT;
        v.update(v.time, dt);
        if (v.dirty) v.draw();
        placeDims(ctx);   // 0.5.4: misure come negli altri configuratori
        ctx.raf = requestAnimationFrame(loop);
      })(performance.now());
      histRecord(ctx);
    }).catch(function (err) {
      console.error('[AFBookHub]', err);
      ui.loading.hidden = false; ui.loading.textContent = TX.loadFail;
    });
    return ctx;
  }
  function close() {
    var ctx = current; if (!ctx) return;
    current = null; cancelAnimationFrame(ctx.raf);
    if (ctx.ro) ctx.ro.disconnect();
    document.removeEventListener('keydown', ctx.onKey);
    document.documentElement.style.overflow = ctx.prevOverflow || '';
    var gl = ctx.viewer && ctx.viewer.gl;
    ctx.ui.ov.classList.remove('afc-in');
    setTimeout(function () { if (gl) { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } ctx.ui.ov.remove(); }, 220);
    ctx.opts.onClose && ctx.opts.onClose();
  }
  window.AFBookHub = {
    version: '0.6.4',
    open: open,
    update: update,
    close: close,
    getState: function () { return current ? current.st : null; },
    getChoiceBase: function () { return current ? choiceBase(current) : null; },
    getCurrent: function () { return current; },
    _debug: function () { return current; },
    _fix: function (c) { fixState(c); },
    _choice: function (c) { return choiceOf(c); }
  };

})();
