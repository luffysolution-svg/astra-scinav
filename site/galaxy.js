/* Astra 背景引擎（WebGL2）
 * 1. 黑洞层：史瓦西测地线光线步进，渲染引力透镜、吸积盘（多普勒增亮）与被扭曲的银河星空；
 *    低分辨率离屏渲染后放大，帧率偏低时自动降分辨率
 * 2. 合成层：mipmap 泛光、色差、暗角与胶片颗粒
 * 3. 粒子层：朝镜头流动的太空尘埃（带运动拖尾）、闪烁亮星、被吸积盘照亮的星球
 * 镜头以第一人称缓慢绕黑洞飞行：鼠标轻微转头，滚动时向黑洞俯冲，点击触发跃迁
 */
(() => {
  const canvas = document.getElementById('galaxy');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { document.documentElement.classList.add('no-webgl'); window.astraPulse = () => {}; return; }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 760px)').matches;

  /* ---------- 着色器 ---------- */
  const QUAD_VS = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

  const NOISE = `
  float h31(vec3 p){ p = fract(p*vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y)*p.z); }
  vec3 h33(vec3 p){ p = fract(p*vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx)*p.zyx); }
  float n3(vec3 p){
    vec3 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
    return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p, int oct){
    float v = 0., a = .5;
    for (int i = 0; i < 5; i++){ if (i >= oct) break; v += a*n3(p); p = p*2.03 + 17.1; a *= .5; }
    return v;
  }`;

  // 单位制 rs = 1；光子加速度 a = -1.5 h² r̂ / r⁴ 即史瓦西度规下的光线弯曲
  const BH_FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime; uniform vec3 uCam; uniform mat3 uRot;
  uniform vec2 uShift; uniform float uFocal; uniform int uSteps;
  out vec4 o;
  ${NOISE}

  // 恒星：每个格子至多一颗，投影回球面后按角距离着色
  vec3 stars(vec3 d, float k, float keep){
    vec3 p = d*k, c = floor(p), h = h33(c);
    if (h.x > keep) return vec3(0.);
    vec3 s = normalize(c + .25 + .5*h33(c + 7.1))*k;
    float w = .0011*k;
    return exp(-dot(p - s, p - s)/(w*w)) * pow(h.y, 2.) * 2.4 * mix(vec3(1., .82, .62), vec3(.72, .82, 1.), h.z);
  }
  // 银河：斜穿天球的光带 + 暗尘带
  vec3 sky(vec3 d){
    float lat = dot(d, normalize(vec3(.32, 1., -.2)));
    float band = exp(-lat*lat*10.);
    float n = fbm(d*3.2, 4);
    float lanes = smoothstep(.42, .7, fbm(d*7. + 3., 3));
    vec3 col = vec3(.018, .022, .036)*n;
    col += mix(vec3(.28, .30, .40), vec3(.55, .45, .36), n) * band * n*n * .55;
    col *= 1. - lanes*band*.85;
    // 天球星点保持稀疏：清晰的星点由全分辨率粒子层提供，这里主要用来展示透镜扭曲
    return col + stars(d, 90., .1)*.7 + stars(d, 45., .06)*1.4;
  }
  // 黑体色：暗红 → 橙 → 金白 → 蓝白
  vec3 temp(float T){
    vec3 c = mix(vec3(.75, .16, .03), vec3(1., .5, .16), smoothstep(.15, .55, T));
    c = mix(c, vec3(1., .86, .64), smoothstep(.55, 1., T));
    return mix(c, vec3(.86, .92, 1.), smoothstep(1.15, 1.7, T));
  }
  // 吸积盘：开普勒较差自转的湍流纹理，多普勒效应使迎面一侧更亮更蓝
  const float RIN = 2.6, ROUT = 12.;
  vec4 disk(vec3 p, vec3 v){
    float r = length(p.xz);
    if (r < RIN || r > ROUT) return vec4(0.);
    float w = .32*pow(RIN/r, 1.5);
    float a = uTime*w, ca = cos(a), sa = sin(a);
    vec2 q = mat2(ca, -sa, sa, ca)*p.xz/r;
    float lr = log(r);
    float n = fbm(vec3(q*2.6, lr*7.), 4);
    float streak = fbm(vec3(q*1.1, lr*26.), 2);
    float dens = smoothstep(RIN, RIN + .9, r) * smoothstep(ROUT, ROUT*.55, r) * pow(RIN/r, 1.25);
    dens *= .35 + 1.25*n*n + .5*streak;
    vec3 gas = normalize(vec3(-p.z, 0., p.x));
    float beta = .5/sqrt(r);
    float D = 1./(1. - beta*dot(gas, -normalize(v)));
    float boost = pow(D, 2.6);
    float T = pow(RIN/r, .75)*1.05*mix(1., D, .7);
    return vec4(temp(T)*dens*boost*2.1, clamp(dens*1.6, 0., 1.));
  }

  void main(){
    vec2 uv = (gl_FragCoord.xy - .5*uRes)/uRes.y - uShift;
    vec3 v = normalize(uRot*vec3(uv, uFocal));
    vec3 p = uCam;
    vec3 L = cross(p, v); float h2 = dot(L, L);
    vec3 col = vec3(0.); float alpha = 0., rmin = 1e3;
    bool esc = false;
    for (int i = 0; i < 160; i++){
      if (i >= uSteps) break;
      float r = length(p);
      rmin = min(rmin, r);
      if (r < 1.) break;
      if (r > 60.){ esc = true; break; }
      float dt = clamp(.085*r*r/(r + 2.), .04, 2.2);
      vec3 pn = p + v*dt;
      v += -1.5*h2*pn/pow(dot(pn, pn), 2.5)*dt;
      v = normalize(v);
      if (sign(pn.y) != sign(p.y)){
        vec3 x = mix(p, pn, p.y/(p.y - pn.y));
        vec4 d = disk(x, v);
        col += (1. - alpha)*d.rgb; alpha += (1. - alpha)*d.a;
        if (alpha > .985) break;
      }
      p = pn;
    }
    if (esc) col += (1. - alpha)*sky(v);
    // 光子环：擦过光子球（r≈1.5）的光线留下一圈细亮环
    col += vec3(1., .72, .42) * exp(-pow((rmin - 1.55)*5.5, 2.)) * .22 * (1. - alpha);
    col = 1. - exp(-col*1.25);
    o = vec4(col, 1.);
  }`;

  // 合成：泛光（mipmap 近似）+ 径向色差 + 暗角 + 颗粒
  const POST_FS = `#version 300 es
  precision highp float;
  uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime;
  out vec4 o;
  float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
  void main(){
    vec2 uv = gl_FragCoord.xy/uRes, c = uv - .5;
    vec2 ca = c*.0035;
    vec3 col = vec3(texture(uTex, uv + ca).r, texture(uTex, uv).g, texture(uTex, uv - ca).b);
    vec3 bloom = textureLod(uTex, uv, 3.).rgb*.55 + textureLod(uTex, uv, 5.).rgb*.45;
    col += bloom*bloom*.55;
    col *= 1. - .55*dot(c*vec2(1., .85), c*vec2(1., .85))*1.6;
    col += (hash(gl_FragCoord.xy + fract(uTime*7.)) - .5)*.022;
    o = vec4(col, 1.);
  }`;

  // 粒子：a = (x, y, 相位/深度, 尺寸)  b = (种子, 类型) 类型 0 尘埃 1 星点 2 亮星 3~5 星球
  const PT_VS = `#version 300 es
  precision highp float;
  in vec4 a; in vec2 b;
  uniform vec2 uRes; uniform float uTime; uniform float uTravel; uniform float uSpeed; uniform float uDpr;
  uniform vec2 uFlow; uniform vec2 uPar; uniform vec2 uMouse; uniform float uScroll; uniform vec2 uHole; uniform float uMaxPt;
  out vec3 vCol; out float vA; out vec2 vDir; out float vLen; out float vRad; flat out float vKind; out float vSeed; out vec2 vLight;

  vec2 proj(vec2 xy, float z, float f){ return uFlow + xy/z*f; }

  void main(){
    float seed = b.x, kind = b.y;
    float m = min(uRes.x, uRes.y);
    vec2 s; float size = 1., alpha = 1.;
    vDir = vec2(1., 0.); vLen = 0.; vRad = .5; vLight = vec2(0.); vSeed = seed; vKind = kind;

    if (kind < .5){
      // 尘埃：在镜头空间沿 z 循环，越近越大越快，并拉出指向来处的运动拖尾
      float z = mix(.07, 1.6, fract(a.z - uTravel));
      float f = m*.5;
      s = proj(a.xy, z, f);
      vec2 tail = proj(a.xy, z + .01 + uSpeed*.045, f) - s;
      // 鼠标附近尘埃绕指针打旋
      vec2 md = s - uMouse; float dm = length(md);
      s += vec2(-md.y, md.x)/(dm + 1.) * exp(-dm*dm/(2.*pow(170.*uDpr, 2.))) * 36.*uDpr;
      float w = a.w*uDpr*(.3 + .8/z)*.5;
      float L = length(tail);
      size = min(2.*L + 4.*w + 2., 96.*uDpr);
      vDir = L > .01 ? tail/L : vec2(1., 0.);
      vLen = min(L, size*.5 - 2.*w)/size;
      vRad = w/size;
      alpha = smoothstep(1.6, 1.15, z) * smoothstep(.07, .17, z) * (.3 + .7*seed) * min(w/1.2, 1.);
      alpha *= w/(w + L*.35);
      vCol = mix(vec3(.74, .82, 1.), vec3(1., .76, .5), step(.8, seed));
    } else if (kind < 2.5){
      // 远景星点 / 亮星：缓慢视差漂移与闪烁
      vec2 p = a.xy + uPar*.03*a.z + vec2(uTime*.002*a.z, uScroll*.04*a.z);
      p = fract(p*.5 + .5)*2. - 1.;
      s = (p*.5 + .5)*uRes;
      float tw = sin(uTime*(.7 + seed*2.3) + seed*50.)*.5 + .5;
      if (kind < 1.5){ size = a.w*uDpr*2.4; alpha = (.25 + .75*a.z)*(.4 + .6*tw); }
      else { size = a.w*uDpr; alpha = .5 + .5*pow(tw, 3.); }
      vCol = mix(vec3(.78, .85, 1.), vec3(1., .86, .7), step(.6, seed));
    } else {
      // 星球：固定构图位置 + 轻微视差，受光方向指向黑洞
      s = a.xy*uRes + uPar*vec2(-1., 1.)*m*.025*(1. + seed) + vec2(0., uScroll*uRes.y*.1*(1. + seed));
      size = min(a.w*m, uMaxPt);
      vLight = normalize(uHole - s);
    }
    gl_Position = vec4(s/uRes*2. - 1., 0., 1.);
    gl_PointSize = size;
    vA = alpha;
  }`;

  // 输出为预乘 alpha：尘埃与星光纯叠加（a=0），星球暗面会遮挡背后的星空
  const PT_FS = `#version 300 es
  precision highp float;
  in vec3 vCol; in float vA; in vec2 vDir; in float vLen; in float vRad; flat in float vKind; in float vSeed; in vec2 vLight;
  uniform float uTime;
  out vec4 o;
  ${NOISE}
  void main(){
    vec2 c = (gl_PointCoord - .5)*vec2(1., -1.);
    if (vKind < .5){
      // 胶囊形拖尾：到线段的距离
      float t = clamp(dot(c, vDir)/max(vLen, 1e-4), 0., 1.)*step(1e-4, vLen);
      vec2 d = c - vDir*vLen*t;
      float i = exp(-dot(d, d)/(vRad*vRad))*(1. - .6*t);
      o = vec4(vCol*i*vA, 0.); return;
    }
    if (vKind < 1.5){
      float d = dot(c, c)*4.;
      o = vec4(vCol*exp(-d*9.)*vA, 0.); return;
    }
    if (vKind < 2.5){
      // 亮星：核心 + 十字衍射星芒
      vec2 q = abs(c)*2.;
      float core = exp(-dot(q, q)*60.);
      float spike = (exp(-q.y*90.)*(1. - q.x) + exp(-q.x*90.)*(1. - q.y))*.55;
      float halo = exp(-dot(q, q)*9.)*.25;
      o = vec4(vCol*(core*1.6 + max(spike, 0.) + halo)*vA, 0.); return;
    }
    // 星球：3 冰蓝水世界 4 带环气态巨行星 5 岩石星
    vec2 q = c*2.;
    float R = vKind > 3.5 && vKind < 4.5 ? .42 : .62;
    float r = length(q)/R;
    vec3 base = vKind < 3.5 ? vec3(.35, .56, .78) : vKind < 4.5 ? vec3(.78, .64, .48) : vec3(.52, .47, .44);
    vec3 atm = vKind < 3.5 ? vec3(.45, .72, 1.) : vKind < 4.5 ? vec3(1., .78, .52) : vec3(.9, .7, .55);
    vec3 L = normalize(vec3(vLight, .35));
    float pulse = .85 + .15*sin(uTime*.8 + vSeed*20.);
    vec4 col = vec4(0.);
    if (r < 1.){
      vec3 n = vec3(q/R, sqrt(1. - r*r));
      float rot = uTime*.01*(1. + vSeed);
      vec3 tp = vec3(n.x*cos(rot) - n.z*sin(rot), n.y, n.x*sin(rot) + n.z*cos(rot));
      float tex = vKind > 3.5 && vKind < 4.5
        ? .75 + .25*sin(tp.y*22. + fbm(tp*3., 3)*5.)
        : .6 + .55*fbm(tp*(vKind < 3.5 ? 2.5 : 4.5) + vSeed*9., 4);
      float lam = max(dot(n, L), 0.);
      float term = smoothstep(-.05, .25, dot(n, L));
      vec3 surf = base*tex*(lam*1.15 + .015) * term;
      surf += atm*pow(1. - n.z, 3.)*(.2 + 1.1*lam)*.9;
      float aa = smoothstep(1., .97, r);
      col = vec4(surf*aa, aa);
    }
    // 大气辉光
    float glow = exp(-pow(max(r - 1., 0.)*5., 1.3))*step(1., r)*(.25 + .75*max(dot(normalize(q), L.xy), 0.))*.45*pulse;
    col.rgb += atm*glow*(1. - col.a);
    if (vKind > 3.5 && vKind < 4.5){
      // 行星环：倾斜椭圆，环的后半部分被星体遮挡
      vec2 rq = mat2(.94, .34, -.34, .94)*q;
      float e = length(rq*vec2(1., 3.6))/R;
      float band = smoothstep(1.35, 1.42, e)*smoothstep(2.15, 2.05, e)*(.55 + .45*sin(e*38.))*(1. - smoothstep(1.7, 1.78, e)*.6*smoothstep(1.86, 1.8, e));
      bool behind = rq.y > 0. && r < 1.;
      float ra = behind ? 0. : band*.8;
      vec3 rc = vec3(.95, .82, .64)*(.25 + .75*max(dot(normalize(vec3(rq, 0.)), L), .15));
      col = vec4(rc*ra + col.rgb*(1. - ra), ra + col.a*(1. - ra));
    }
    o = col;
  }`;

  function program(vs, fs){
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]){
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++){ const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }
  const bh = program(QUAD_VS, BH_FS);
  const post = program(QUAD_VS, POST_FS);
  const pt = program(PT_VS, PT_FS);

  /* ---------- 粒子生成 ---------- */
  const N_DUST = mobile ? 1300 : 2600, N_STAR = mobile ? 500 : 1000, N_FLARE = mobile ? 8 : 16, N_PLANET = 3;
  const N = N_STAR + N_FLARE + N_PLANET + N_DUST; // 星点在前、星球居中、尘埃最后，保证绘制层次
  const A = new Float32Array(N*4), B = new Float32Array(N*2);
  let k = 0;
  const put = (a, b) => { A.set(a, k*4); B.set(b, k*2); k++; };
  for (let i = 0; i < N_STAR; i++) put([Math.random()*2 - 1, Math.random()*2 - 1, Math.random(), .6 + Math.random()*Math.random()*1.6], [Math.random(), 1]);
  for (let i = 0; i < N_FLARE; i++) put([Math.random()*2 - 1, Math.random()*2 - 1, Math.random(), 18 + Math.random()*26], [Math.random(), 2]);
  const PLANET_AT = k;
  for (let i = 0; i < N_PLANET; i++) put([0, 0, 0, 0], [i*.37, 3 + i]);
  for (let i = 0; i < N_DUST; i++){
    // 圆盘内均匀分布，避开正中心以免在消失点堆积
    const ang = Math.random()*Math.PI*2, rad = .06 + Math.sqrt(Math.random())*1.1;
    put([Math.cos(ang)*rad, Math.sin(ang)*rad*.8, Math.random(), .8 + Math.random()*1.6], [Math.random(), 0]);
  }

  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const ptVao = gl.createVertexArray();
  gl.bindVertexArray(ptVao);
  const bufA = gl.createBuffer();
  for (const [name, data, n, buf] of [['a', A, 4, bufA], ['b', B, 2, gl.createBuffer()]]){
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pt.p, name);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
  }
  const MAX_PT = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];

  // 星球构图：横屏放在标题与黑洞之外的留白处，竖屏围绕顶部黑洞
  function layoutPlanets(land){
    const P = land
      ? [[.43, .80, .085], [.88, .20, .20], [.10, .13, .038]]   // 冰蓝星 / 带环巨行星 / 岩石小星
      : [[.84, .56, .09], [.16, .90, .16], [.86, .95, .045]];
    P.forEach(([x, y, s], i) => A.set([x, y, 0, s], (PLANET_AT + i)*4));
    gl.bindBuffer(gl.ARRAY_BUFFER, bufA);
    gl.bufferSubData(gl.ARRAY_BUFFER, PLANET_AT*16, A.subarray(PLANET_AT*4, (PLANET_AT + N_PLANET)*4));
  }
  /* ---------- 离屏缓冲：黑洞层低分辨率渲染，帧率不足时自动降档 ---------- */
  const DPR = Math.min(devicePixelRatio || 1, 1.5);
  let scale = mobile ? .42 : .55;
  const fbo = gl.createFramebuffer(), tex = gl.createTexture();
  let fw = 2, fh = 2;
  function alloc(){
    const px = innerWidth*innerHeight*scale*scale, cap = mobile ? 3.5e5 : 8e5;
    const s = px > cap ? scale*Math.sqrt(cap/px) : scale;
    fw = Math.max(2, Math.round(innerWidth*s)); fh = Math.max(2, Math.round(innerHeight*s));
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ---------- 构图与镜头 ---------- */
  const V = {
    add: (a, b) => a.map((x, i) => x + b[i]), mul: (a, s) => a.map(x => x*s),
    dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2],
    cross: (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]],
    norm: a => { const l = Math.hypot(...a); return a.map(x => x/l); },
  };
  let shift = [0, 0], focal = 1.3;
  function layout(){
    const asp = innerWidth/innerHeight, land = asp > 1;
    // 横屏：黑洞偏右，给左侧标题留出暗区；竖屏：黑洞居上，文字在下方
    shift = land ? [asp*.24, .04] : [0, .29];
    focal = 1.05*Math.min(Math.max(asp, .6), 1);
    layoutPlanets(land);
  }
  function camera(t){
    const dist = 24 - sScroll*6;                          // 滚动时向黑洞俯冲
    const el = .1 + .025*Math.sin(t*.07) + sScroll*.03; // 略高于盘面，近乎侧视
    const az = .6 + t*.012;                               // 缓慢绕行
    const cam = [dist*Math.cos(el)*Math.cos(az), dist*Math.sin(el), dist*Math.cos(el)*Math.sin(az)];
    const f0 = V.norm(V.mul(cam, -1)), up = [0, 1, 0];
    let r = V.norm(V.cross(f0, up)), u = V.cross(r, f0);
    // 舱内手持感的微晃 + 鼠标转头
    const yaw = par.x*.07 + Math.sin(t*.23)*.006 + Math.sin(t*.61)*.003;
    const pitch = -par.y*.05 + Math.sin(t*.19 + 1)*.005;
    const f = V.norm(V.add(f0, V.add(V.mul(r, yaw), V.mul(u, pitch))));
    r = V.norm(V.cross(f, up)); u = V.cross(r, f);
    const roll = .1 + Math.sin(t*.05)*.03 + par.x*.03, cr = Math.cos(roll), sr = Math.sin(roll);
    const R = V.add(V.mul(r, cr), V.mul(u, sr)), U = V.add(V.mul(u, cr), V.mul(r, -sr));
    // 黑洞中心在屏幕上的像素位置（供尘埃消失点与星球受光使用）
    const lz = V.dot(f0, f);
    const hx = V.dot(f0, R)/lz*focal + shift[0], hy = V.dot(f0, U)/lz*focal + shift[1];
    return { cam, rot: [...R, ...U, ...f], hole: [canvas.width/2 + hx*canvas.height, canvas.height/2 + hy*canvas.height] };
  }

  /* ---------- 交互状态 ---------- */
  const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  let scroll = 0, sScroll = 0, lastY = scrollY, boost = 0, travel = 0;

  function resize(){
    canvas.width = Math.round(innerWidth*DPR); canvas.height = Math.round(innerHeight*DPR);
    alloc(); layout();
    // 暂停时改尺寸会清空画布，补画一帧静态画面
    if (paused) draw(performance.now());
  }
  // UI 调用：卡片悬停、提交搜索时给飞船一次小加速；点击触发跃迁
  window.astraPulse = (x, y, s = 1) => { if (!reduced) boost = Math.min(2.2, boost + s*.35); };

  addEventListener('resize', resize);
  addEventListener('pointermove', e => {
    mouse.x = e.clientX*DPR; mouse.y = (innerHeight - e.clientY)*DPR;
    if (mouse.sx < -999){ mouse.sx = mouse.x; mouse.sy = mouse.y; }
    par.tx = e.clientX/innerWidth - .5; par.ty = e.clientY/innerHeight - .5;
  }, { passive: true });
  addEventListener('pointerdown', () => { if (!reduced) boost = Math.min(2.2, boost + 1.1); }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.x = mouse.y = mouse.sx = mouse.sy = -9999; });
  addEventListener('scroll', () => {
    scroll = Math.min(scrollY/innerHeight, 2.5);
    if (!reduced) boost = Math.min(2, boost + Math.abs(scrollY - lastY)/innerHeight*1.2);
    lastY = scrollY;
  }, { passive: true });
  /* ---------- 渲染循环 ---------- */
  // 页面不可见或用户暂停（UI 调用 astraMotion(false)）时停止循环；暂停时保留最后一帧
  let paused = false, raf = 0, last = 0, acc = 0, frames = 0, sim = 0;
  const t0 = performance.now();
  function sync(){
    const run = !paused && !document.hidden;
    if (run && !raf){ last = 0; raf = requestAnimationFrame(frame); }
    else if (!run && raf){ cancelAnimationFrame(raf); raf = 0; }
  }
  document.addEventListener('visibilitychange', sync);
  window.astraMotion = on => { paused = !on; sync(); if (paused) draw(performance.now()); };

  function frame(now){
    raf = requestAnimationFrame(frame);
    // 高刷屏限到约 60–72 帧，省下的 GPU 留给页面滚动
    if (last && now - last < 10) return;
    draw(now);
  }
  function draw(now){
    const dt = last ? Math.min((now - last)/1000, .1) : 1/60;
    last = now;

    // 自适应画质：持续低于约 45 帧就降低黑洞层分辨率（只降不升，避免来回抖动）
    if ((now - t0) > 2500){
      acc += dt; frames++;
      if (frames === 60){
        if (acc/frames > 1/45 && scale > .26){ scale *= .8; alloc(); }
        acc = frames = 0;
      }
    }

    const speed = reduced ? .2 : 1;
    sim += dt*speed;
    boost *= Math.exp(-dt*1.6);
    travel += dt*speed*(.028 + boost*.16);
    mouse.sx += (mouse.x - mouse.sx)*.12; mouse.sy += (mouse.y - mouse.sy)*.12;
    if (mouse.x < -999) mouse.sx = mouse.sy = -9999;
    par.x += (par.tx - par.x)*.035; par.y += (par.ty - par.y)*.035;
    sScroll += (scroll - sScroll)*.06;
    const { cam, rot, hole } = camera(sim);

    // 1. 黑洞 → 离屏
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, fw, fh);
    gl.disable(gl.BLEND);
    gl.useProgram(bh.p); gl.bindVertexArray(quadVao);
    gl.uniform2f(bh.u.uRes, fw, fh);
    gl.uniform1f(bh.u.uTime, sim);
    gl.uniform3fv(bh.u.uCam, cam);
    gl.uniformMatrix3fv(bh.u.uRot, false, rot);
    gl.uniform2fv(bh.u.uShift, shift);
    gl.uniform1f(bh.u.uFocal, focal);
    gl.uniform1i(bh.u.uSteps, mobile ? 90 : 130);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. 合成到屏幕
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.useProgram(post.p);
    gl.uniform1i(post.u.uTex, 0);
    gl.uniform2f(post.u.uRes, canvas.width, canvas.height);
    gl.uniform1f(post.u.uTime, sim);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3. 粒子（预乘 alpha 混合）
    const flow = [canvas.width*.5 + (hole[0] - canvas.width*.5)*.55, canvas.height*.5 + (hole[1] - canvas.height*.5)*.55];
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(pt.p); gl.bindVertexArray(ptVao);
    gl.uniform2f(pt.u.uRes, canvas.width, canvas.height);
    gl.uniform1f(pt.u.uTime, sim);
    gl.uniform1f(pt.u.uTravel, travel);
    gl.uniform1f(pt.u.uSpeed, boost);
    gl.uniform1f(pt.u.uDpr, DPR);
    gl.uniform2fv(pt.u.uFlow, flow);
    gl.uniform2f(pt.u.uPar, par.x, par.y);
    gl.uniform2f(pt.u.uMouse, mouse.sx, mouse.sy);
    gl.uniform1f(pt.u.uScroll, sScroll);
    gl.uniform2fv(pt.u.uHole, hole);
    gl.uniform1f(pt.u.uMaxPt, MAX_PT);
    gl.drawArrays(gl.POINTS, 0, N);
  }
  resize();
  if (!paused) sync();
})();
