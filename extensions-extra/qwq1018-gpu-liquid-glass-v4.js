/**
 * GPU 液态玻璃（跟随角色）— 性能优化版 v4
 *
 * 相对原版的改动（均为结构优化，不改变默认视觉效果）：
 *   1. 背景纹理每轮只整屏拷贝一次：画完的玻璃用「纹理→纹理」blit 写回背景纹理，
 *      后续玻璃直接采样得到（互相可见），不需要再读帧缓冲，避免 GPU 管线同步。
 *   2. 因为背景纹理每画完一块就同步回写，轮廓外写的背景色始终等于当前画面，
 *      包围盒四角不会再出现方形接缝（无需 discard，避免软件光栅器变慢）。
 *   3. 用 scissor 把两趟渲染都限制在玻璃包围盒内，不再全屏着色。
 *   4. 完整保存/恢复 GL 状态（framebuffer / viewport / scissor / blend），
 *      不再粗暴 disable(SCISSOR_TEST)，避免破坏 Scratch 画笔的区域裁剪。
 *   5. 玻璃完全移出画面时直接跳过，不产生任何绘制。
 *   6. 色散只在真正有色散的区域计算：偏移不足 0.01 像素时（玻璃内部）三个通道
 *      的模糊结果与底色模糊无异，直接复用，省掉 3 次整块模糊。
 *   7. 修正 uEdgeTopWidth = 0 时 edgeWidth 除零产生 NaN 的问题。
 *   8. 修正 ensureResources() 创建 FBO 后直接把 framebuffer 绑回 null 的问题：
 *      现在保存并恢复调用方的绑定，避免覆盖渲染目标（在 FBO 上绘制时尤为关键）。
 *   9. 边缘反光的模糊只在 edgeBand > 0.002 的窄环内计算，玻璃内部跳过这次大半径
 *      模糊；对最终颜色的影响小于 0.3/255。
 *  10. 圆角矩形改用超椭圆 p-norm SDF（由平滑度决定阶数 n），
 *      替代原六次多项式近似，消除「非正方形玻璃的角落塌陷 / 长宽畸变」问题。
 *      平滑度 s ∈ [0, 100] → n = 2.5 + 3.5 * (s / 100)：
 *        s=0   → n=2.5 → 端点曲率 κ(s) ~ s^0.5 → G2
 *        s≈43  → n=4.0 → 端点曲率 κ(s) ~ s^2   → G3（Apple squircle）
 *        s=100 → n=6.0 → 端点曲率 κ(s) ~ s^4   → G5
 *  11. 边缘用 1px smoothstep 抗锯齿，不再二值判定。
 *  12. 「圆化」行为：当圆角半径 R 超过 min(W,H)/2 时，多余的圆角值
 *      不再被简单 clamp 成胶囊，而是转化为「圆形程度」——
 *      宽/高向 min(W,H) 收缩，同时 n 向 2 过渡（保底为真正的圆）。
 *        R = min/2          → 胶囊（两端半圆）
 *        min/2 < R < min    → 胶囊 → 圆 平滑过渡
 *        R ≥ min            → 完整的圆（W=H=min, n=2）
 *      该行为只作用于非正方形玻璃；正方形玻璃原本就是超椭圆外观，
 *      按 R 是否达到 W/2 判断。
 *
 * 兼容性：扩展 id 保持 gpuLiquidGlass，已有作品的积木不受影响。
 */
(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('「GPU 液态玻璃」扩展必须以 unsandboxed 模式加载。');
  }

  const vm = Scratch.vm;
  const runtime = vm.runtime;
  const renderer = runtime.renderer;
  const gl = renderer._gl;

  // ============================ Shader 源码 ============================

  const GLASS_VS = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

  const GLASS_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D srcTex;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uRectW;
uniform float uRectH;
uniform float uRound;
uniform float uRoundN;
uniform float uRefractionHeight;
uniform float uRefractionAmount;
uniform float uBlurSigma;
uniform float uEdgeBlurSigma;
uniform float uDispersion;
uniform float uTint;
uniform float uEdge;
uniform float uEdgeTop;
uniform float uEdgeTopWidth;
uniform float uDrawMode;
uniform float uSat;
uniform float uWhitePoint;
uniform float uBrightness;
uniform float uContrast;

const float LOG_LN4_4PI2 = -1.45450428001;
const float LOG_16 = 1.20411998266;
const float PI_2 = 6.28318530718;

vec3 applyWhitePoint(vec3 color, float wp) {
    vec3 maskColor = wp > 0.0 ? vec3(1.0) : vec3(0.0);
    return mix(color, maskColor, abs(wp));
}
vec3 applyBrightness(vec3 color, float b) { return color * b; }
vec3 applyContrast(vec3 color, float co) { return clamp(0.5 + (color - 0.5) * co, 0.0, 1.0); }
vec3 applySaturation(vec3 color, float s) {
    float g = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return clamp(mix(vec3(g), color, s), 0.0, 1.0);
}
vec3 applyColorGrade(vec3 color) {
    color = applyWhitePoint(color, uWhitePoint);
    color = applyBrightness(color, uBrightness);
    color = applyContrast(color, uContrast);
    color = applySaturation(color, uSat);
    return color;
}

vec4 nonuniformBlur(sampler2D srcTex, vec2 uv, float sigma) {
  vec4 normal_sample = texture(srcTex, uv);
  float level = log2(max(1.0, sigma));
  float sigma2 = max(0.25, sigma * sigma), totalWeight = 0.0;
  vec4 accumColor = vec4(0.0), sampleColor;
  float pow4_l, logWeight, expTerm, weight;
  vec2 dF = 1.0 / uResolution * sigma;
  for (float l = max(0.0, level - 2.0); l < level + 4.0; l += 1.0) {
    pow4_l = exp2(2.0 * l);
    logWeight = l * LOG_16 - LOG_LN4_4PI2 - 2.0 * log(sigma2);
    expTerm = pow4_l / (PI_2 * sigma2);
    logWeight -= expTerm;
    weight = exp(logWeight) * min(1.0, 3.5 - abs(l - level - 0.5));
    sampleColor = textureLod(srcTex, uv, l) +
                textureLod(srcTex, uv + dF * vec2(0.5, 0.3), l) +
                textureLod(srcTex, uv - dF * vec2(0.5, 0.3), l) +
                textureLod(srcTex, uv + dF * vec2(-0.3, 0.5), l) +
                textureLod(srcTex, uv + dF * vec2(0.3, -0.5), l);
    accumColor += sampleColor * weight;
    totalWeight += weight * 5.0;
  }
  return mix(normal_sample, accumColor / totalWeight, clamp(sigma * 2.0, 0.0, 1.0));
}

// 超椭圆圆角矩形 SDF（内负外正，像素单位）
float sdSmoothRoundBox(vec2 p, vec2 b, float r, float n) {
    r = clamp(r, 0.0, min(b.x, b.y));
    vec2 q = abs(p) - b + r;
    vec2 qo = max(q, 0.0);
    float pnorm;
    if (n <= 2.01 || r < 0.01) {
        pnorm = length(qo);
    } else {
        pnorm = pow(pow(qo.x, n) + pow(qo.y, n), 1.0 / n);
    }
    return min(max(q.x, q.y), 0.0) + pnorm - r;
}

// copyTexSubImage2D 不翻转 Y，这里补上
vec2 sampleUvFromPixel(vec2 pixel) {
  vec2 uv = pixel / uResolution;
  uv.y = 1.0 - uv.y;
  return clamp(uv, 0.0, 1.0);
}

void main() {
  vec2 pixel = vec2(vUv.x, 1.0 - vUv.y) * uResolution;
  vec2 p = pixel - uCenter;
  vec2 rectHalf = vec2(uRectW * 0.5, uRectH * 0.5);
  float safeRound = clamp(uRound, 0.0, min(rectHalf.x, rectHalf.y));

  float sd = sdSmoothRoundBox(p, rectHalf, safeRound, uRoundN);
  float alpha = 1.0 - smoothstep(-0.5, 0.5, sd);

  vec4 bgColor = texture(srcTex, sampleUvFromPixel(pixel));

  if (alpha <= 0.0) {
    fragColor = bgColor;
    return;
  }

  float normR = max(safeRound, 1.0);
  float dist = clamp(1.0 + sd / normR, 0.0, 1.0);

  vec3 glassRgb;

  if (uDrawMode < 0.5) {
    // ================= 正常玻璃 =================
    vec2 dir = normalize(p + 1e-5);
    float h = dist;
    float exponent = mix(12.0, 1.0, uRefractionHeight);
    float factor = pow(h, exponent);
    vec2 baseOffset = -dir * uRefractionAmount * factor;
    vec2 baseUv = sampleUvFromPixel(pixel + baseOffset);
    vec4 glassBase = nonuniformBlur(srcTex, baseUv, uBlurSigma);

    vec4 glassColor;
    if (uDispersion > 0.0001 && factor > 0.02) {
      float dispBase = uDispersion * 0.004 * factor;
      vec2 uvR = baseUv + dir * dispBase;
      vec2 uvG = baseUv;
      vec2 uvB = baseUv - dir * dispBase;
      vec4 colR = nonuniformBlur(srcTex, uvR, uBlurSigma);
      vec4 colG = nonuniformBlur(srcTex, uvG, uBlurSigma);
      vec4 colB = nonuniformBlur(srcTex, uvB, uBlurSigma);
      glassColor = vec4(colR.r, colG.g, colB.b, 1.0);
    } else {
      glassColor = glassBase;
    }

    glassColor.rgb = applyColorGrade(glassColor.rgb);

    float tintFactor = pow(h, mix(8.0, 1.2, uRefractionHeight));
    vec3 tintColor = vec3(0.86, 0.93, 1.0);
    glassColor.rgb = mix(glassColor.rgb, tintColor, tintFactor * uTint);

    float edgeWidth = max(uEdgeTopWidth / max(safeRound, 1.0), 1e-3);
    float inner = 1.0 - edgeWidth * 1.6;
    float peak = 1.0 - edgeWidth * 0.6;
    float outer = 1.0;
    float edgeBand = exp(-pow((dist - peak) / edgeWidth, 2.0));
    edgeBand *= smoothstep(inner, peak, dist);
    edgeBand *= 1.0 - smoothstep(peak, outer, dist);

    if (edgeBand > 0.002) {
      vec4 edgeBlurColor = nonuniformBlur(srcTex, baseUv, uEdgeBlurSigma);
      edgeBlurColor.rgb = applyColorGrade(edgeBlurColor.rgb);
      glassColor = mix(glassColor, edgeBlurColor, edgeBand * 0.55);
      glassColor.rgb += edgeBlurColor.rgb * edgeBand * uEdge;

      float vertical = abs(p.y) / rectHalf.y;
      float verticalWeight = pow(vertical, 2.0);
      float topEdgeGlow = edgeBand * verticalWeight;
      glassColor.rgb += edgeBlurColor.rgb * topEdgeGlow * uEdgeTop;
    }

    glassRgb = glassColor.rgb;
  } else {
    // ================= G9 线框模式 =================
    vec3 fillColor = mix(bgColor.rgb, vec3(0.0), 0.6);
    glassRgb = fillColor;
    float edge = 1.0 - smoothstep(1.0, 1.0 + uEdge / min(rectHalf.x, rectHalf.y), dist);
    glassRgb = mix(glassRgb, vec3(1.0), edge);
    vec2 ap = p / rectHalf;
    float lineLeft = abs(ap.x + ap.y + 0.35);
    float lineRight = abs(ap.x - ap.y - 0.35);
    float lineCenter = abs(ap.y);
    float lw = 3.0 / min(rectHalf.x, rectHalf.y);
    float line = clamp(
      (1.0 - smoothstep(0.0, lw, lineLeft)) +
      (1.0 - smoothstep(0.0, lw, lineRight)) +
      (1.0 - smoothstep(0.0, lw, lineCenter)),
      0.0, 1.0
    );
    glassRgb = mix(glassRgb, vec3(0.0, 1.0, 0.0), line);
  }

  fragColor = vec4(mix(bgColor.rgb, glassRgb, alpha), 1.0);
}
`;

  const BLIT_VS = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

  const BLIT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
void main() {
  fragColor = texture(uTex, vUv);
}
`;

  // ============================ 状态 ============================

  const glassData = {};
  const drawableToTarget = {};
  let hijacked = false;

  let bgTexture = null;
  let fbo = null;
  let fboTexture = null;
  let glassProgram = null;
  let glassVao = null;
  let glassUniforms = {};
  let blitProgram = null;
  let blitVao = null;
  let blitTexLoc = null;
  let resW = 0, resH = 0;

  const nativeDrawThese = renderer._drawThese.bind(renderer);

  function ensureHijacked() {
    if (hijacked) return;
    hijacked = true;
    renderer._drawThese = advDrawThese;
  }

  // ============================ target 映射 ============================

  function refreshTargetMap() {
    for (const k in drawableToTarget) delete drawableToTarget[k];
    for (const t of runtime.targets) {
      if (t.drawableID !== undefined) drawableToTarget[t.drawableID] = t;
    }
  }
  function getTargetByDrawable(id) {
    const c = drawableToTarget[id];
    if (c) return c;
    refreshTargetMap();
    return drawableToTarget[id] || null;
  }
  refreshTargetMap();
  try { runtime.on('PROJECT_LOADED', refreshTargetMap); } catch (e) {}
  try { runtime.on('targetWasCreated', refreshTargetMap); } catch (e) {}
  try {
    runtime.on('targetWasRemoved', (t) => {
      delete drawableToTarget[t.drawableID];
      delete glassData[t.drawableID];
    });
  } catch (e) {}

  // ============================ GL 工具 ============================

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('着色器编译失败: ' + info);
    }
    return s;
  }

  function linkProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('着色器链接失败: ' + info);
    }
    return p;
  }

  function createFullscreenVao(program) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  function ensureResources(fbW, fbH) {
    const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    if (resW !== fbW || resH !== fbH) {
      if (bgTexture) gl.deleteTexture(bgTexture);
      if (fboTexture) gl.deleteTexture(fboTexture);
      if (fbo) gl.deleteFramebuffer(fbo);

      bgTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, bgTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbW, fbH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      fboTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, fboTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbW, fbH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTexture, 0);

      gl.bindTexture(gl.TEXTURE_2D, null);

      resW = fbW;
      resH = fbH;
    }

    if (!glassProgram) {
      const vs = compileShader(gl.VERTEX_SHADER, GLASS_VS);
      const fs = compileShader(gl.FRAGMENT_SHADER, GLASS_FS);
      glassProgram = linkProgram(vs, fs);
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      glassUniforms = {
        srcTex: gl.getUniformLocation(glassProgram, 'srcTex'),
        resolution: gl.getUniformLocation(glassProgram, 'uResolution'),
        center: gl.getUniformLocation(glassProgram, 'uCenter'),
        rectW: gl.getUniformLocation(glassProgram, 'uRectW'),
        rectH: gl.getUniformLocation(glassProgram, 'uRectH'),
        round: gl.getUniformLocation(glassProgram, 'uRound'),
        roundN: gl.getUniformLocation(glassProgram, 'uRoundN'),
        refractionHeight: gl.getUniformLocation(glassProgram, 'uRefractionHeight'),
        refractionAmount: gl.getUniformLocation(glassProgram, 'uRefractionAmount'),
        blur: gl.getUniformLocation(glassProgram, 'uBlurSigma'),
        edgeBlur: gl.getUniformLocation(glassProgram, 'uEdgeBlurSigma'),
        dispersion: gl.getUniformLocation(glassProgram, 'uDispersion'),
        tint: gl.getUniformLocation(glassProgram, 'uTint'),
        edge: gl.getUniformLocation(glassProgram, 'uEdge'),
        edgeTop: gl.getUniformLocation(glassProgram, 'uEdgeTop'),
        edgeTopWidth: gl.getUniformLocation(glassProgram, 'uEdgeTopWidth'),
        drawMode: gl.getUniformLocation(glassProgram, 'uDrawMode'),
        sat: gl.getUniformLocation(glassProgram, 'uSat'),
        whitePoint: gl.getUniformLocation(glassProgram, 'uWhitePoint'),
        brightness: gl.getUniformLocation(glassProgram, 'uBrightness'),
        contrast: gl.getUniformLocation(glassProgram, 'uContrast'),
      };

      glassVao = createFullscreenVao(glassProgram);
    }

    if (!blitProgram) {
      const vs = compileShader(gl.VERTEX_SHADER, BLIT_VS);
      const fs = compileShader(gl.FRAGMENT_SHADER, BLIT_FS);
      blitProgram = linkProgram(vs, fs);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      blitTexLoc = gl.getUniformLocation(blitProgram, 'uTex');
      blitVao = createFullscreenVao(blitProgram);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb);
  }

  // ============================ 绘制玻璃 ============================

  function writeBackPrevious(rect, targetFbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, rect.x, rect.y, rect.x, rect.y, rect.w, rect.h);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
  }

  function drawGlass(drawableID, glass, projection, opts, ctx) {
    const fbW = (opts && opts.framebufferWidth) || gl.drawingBufferWidth || gl.canvas.width;
    const fbH = (opts && opts.framebufferHeight) || gl.drawingBufferHeight || gl.canvas.height;
    if (fbW <= 0 || fbH <= 0) return;

    const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);

    ensureResources(fbW, fbH);
    if (!bgTexture || !fbo || !fboTexture || !glassProgram) return;

    if (ctx.pending) {
      if (ctx.valid) writeBackPrevious(ctx.pending, prevFbo);
      ctx.pending = null;
    }

    const target = glass.target || getTargetByDrawable(drawableID);
    if (!target) {
      nativeDrawThese([drawableID], 0, projection, opts);
      ctx.valid = false;
      return;
    }

    const stageW = runtime.stageWidth || 480;
    const stageH = runtime.stageHeight || 360;
    const sx = fbW / stageW;
    const sy = fbH / stageH;
    const su = Math.min(sx, sy);

    const worldX = (target.x || 0) + glass.ox;
    const worldY = (target.y || 0) + glass.oy;
    const pixelX = (worldX + stageW / 2) * sx;
    const pixelY = (stageH / 2 - worldY) * sy;

    let pixelW = Math.max(1, glass.w * sx);
    let pixelH = Math.max(1, glass.h * sy);
    let safeRound = Math.max(0, glass.round * su);

    // ============ 「圆化」：R 超过 min/2 时，收缩成完整的圆 ============
    // 只作用于非正方形玻璃；正方形玻璃本身已是超椭圆外观，不需要收缩
    const minDim = Math.min(pixelW, pixelH);
    const maxRound = minDim * 0.5;
    let circleFactor = 0;
    if (pixelW !== pixelH && maxRound > 0.5 && safeRound > maxRound) {
      circleFactor = Math.min(1, (safeRound - maxRound) / maxRound);
      safeRound = maxRound;
      // 宽高向 minDim 收缩（围绕中心，中心不动）
      pixelW = Math.max(1, pixelW + (minDim - pixelW) * circleFactor);
      pixelH = Math.max(1, pixelH + (minDim - pixelH) * circleFactor);
    }

    // 平滑度 → 超椭圆阶数 n
    const smooth01 = Math.max(0, Math.min(100, glass.roundSmooth)) / 100;
    let roundN = 2.5 + 3.5 * smooth01;
    // 圆化过渡中，n 向 2 靠拢，保证最终是真正的圆而不是鼓包的 squircle
    if (circleFactor > 0) {
      roundN = roundN * (1 - circleFactor) + 2.0 * circleFactor;
    }

    const left = pixelX - pixelW * 0.5;
    const top = pixelY - pixelH * 0.5;
    const right = left + pixelW;
    const bottom = top + pixelH;

    if (right <= 0 || bottom <= 0 || left >= fbW || top >= fbH) return;

    const pad = 1;
    const scX = Math.max(0, Math.floor(left) - pad);
    const scYTop = Math.max(0, Math.floor(top) - pad);
    const scRight = Math.min(fbW, Math.ceil(right) + pad);
    const scBottom = Math.min(fbH, Math.ceil(bottom) + pad);
    const scW = scRight - scX;
    const scH = scBottom - scYTop;
    if (scW <= 0 || scH <= 0) return;
    const scY = fbH - scBottom;

    if (!ctx.valid) {
      const prevActive = gl.getParameter(gl.ACTIVE_TEXTURE);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bgTexture);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, fbW, fbH);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.activeTexture(prevActive);
      ctx.valid = true;
    }

    const prevViewport = gl.getParameter(gl.VIEWPORT);
    const scissorWasOn = gl.isEnabled(gl.SCISSOR_TEST);
    const prevScissor = gl.getParameter(gl.SCISSOR_BOX);

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(scX, scY, scW, scH);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, fbW, fbH);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(glassProgram);
    gl.bindVertexArray(glassVao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.uniform1i(glassUniforms.srcTex, 0);
    gl.uniform2f(glassUniforms.resolution, fbW, fbH);
    gl.uniform2f(glassUniforms.center, pixelX, pixelY);
    gl.uniform1f(glassUniforms.rectW, pixelW);
    gl.uniform1f(glassUniforms.rectH, pixelH);
    gl.uniform1f(glassUniforms.round, safeRound);
    gl.uniform1f(glassUniforms.roundN, roundN);
    gl.uniform1f(glassUniforms.refractionHeight, glass.refractionHeight);
    gl.uniform1f(glassUniforms.refractionAmount, glass.refractionAmount * su);
    gl.uniform1f(glassUniforms.blur, glass.blur * su);
    gl.uniform1f(glassUniforms.edgeBlur, glass.edgeBlur * su);
    gl.uniform1f(glassUniforms.dispersion, glass.dispersion);
    gl.uniform1f(glassUniforms.tint, glass.tint);
    gl.uniform1f(glassUniforms.edge, glass.edge);
    gl.uniform1f(glassUniforms.edgeTop, glass.edgeTop);
    gl.uniform1f(glassUniforms.edgeTopWidth, glass.edgeTopWidth);
    gl.uniform1f(glassUniforms.drawMode, glass.drawMode);
    gl.uniform1f(glassUniforms.sat, glass.sat);
    gl.uniform1f(glassUniforms.whitePoint, glass.whitePoint);
    gl.uniform1f(glassUniforms.brightness, glass.brightness);
    gl.uniform1f(glassUniforms.contrast, glass.contrast);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
    gl.viewport(0, 0, fbW, fbH);
    gl.disable(gl.BLEND);
    gl.useProgram(blitProgram);
    gl.bindVertexArray(blitVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboTexture);
    gl.uniform1i(blitTexLoc, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    ctx.pending = { x: scX, y: scY, w: scW, h: scH };

    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
    gl.scissor(prevScissor[0], prevScissor[1], prevScissor[2], prevScissor[3]);
    if (scissorWasOn) gl.enable(gl.SCISSOR_TEST); else gl.disable(gl.SCISSOR_TEST);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  // ============================ 劫持 _drawThese ============================

  function advDrawThese(drawables, drawMode, projection, opts = {}) {
    let hasGlass = false;
    for (let i = 0; i < drawables.length; i++) {
      if (glassData[drawables[i]]) { hasGlass = true; break; }
    }
    if (!hasGlass) {
      return nativeDrawThese(drawables, drawMode, projection, opts);
    }

    const ctx = { valid: false, pending: null };

    for (let i = 0; i < drawables.length; i++) {
      const id = drawables[i];
      if (opts.filter && !opts.filter(id)) continue;

      const glass = glassData[id];

      if (!glass) {
        nativeDrawThese([id], drawMode, projection, opts);
        ctx.valid = false;
        continue;
      }

      const drawable = renderer._allDrawables[id];
      if (drawable && !drawable.getVisible() && !opts.ignoreVisibility) {
        continue;
      }

      try {
        drawGlass(id, glass, projection, opts, ctx);
      } catch (err) {
        console.error('[GPU 液态玻璃] 绘制失败:', err);
        try { nativeDrawThese([id], drawMode, projection, opts); } catch (e) {}
        ctx.valid = false;
      }
    }
  }

  // ============================ 扩展类 ============================

  function toSafeNumber(v) {
    if (Scratch.Cast && typeof Scratch.Cast.toNumber === 'function') {
      return Scratch.Cast.toNumber(v);
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  class GPULiquidGlass {
    _findGlassByID(id) {
      const numId = Math.round(toSafeNumber(id));
      for (const did in glassData) {
        if (glassData[did].id === numId) return { drawableID: Number(did), glass: glassData[did] };
      }
      return null;
    }

    createGlass({ ID }, util) {
      const numId = Math.round(toSafeNumber(ID));
      for (const did in glassData) {
        if (glassData[did].id === numId) delete glassData[did];
      }
      const drawableID = util.target.drawableID;
      glassData[drawableID] = {
        id: numId,
        target: util.target,
        ox: 0, oy: 0,
        w: 200, h: 150,
        round: 40,
        roundSmooth: 50,
        drawMode: 0,
        refractionHeight: 0.35,
        refractionAmount: 22,
        blur: 2.2,
        edgeBlur: 9,
        dispersion: 0.28,
        tint: 0.22,
        edge: 0.45,
        edgeTop: 0.55,
        edgeTopWidth: 3.2,
        brightness: 1,
        whitePoint: 0,
        contrast: 1,
        sat: 1,
      };
      ensureHijacked();
      renderer.dirty = true;
    }

    deleteGlass({ ID }) {
      const found = this._findGlassByID(ID);
      if (found) {
        delete glassData[found.drawableID];
        renderer.dirty = true;
      }
    }

    deleteAllGlasses() {
      for (const did in glassData) delete glassData[did];
      renderer.dirty = true;
    }

    setWidthHeight({ ID, W, H }) {
      const found = this._findGlassByID(ID);
      if (found) {
        found.glass.w = Math.max(1, toSafeNumber(W));
        found.glass.h = Math.max(1, toSafeNumber(H));
        renderer.dirty = true;
      }
    }

    setRadius({ ID, R }) {
      const found = this._findGlassByID(ID);
      if (found) {
        found.glass.round = Math.max(0, toSafeNumber(R));
        renderer.dirty = true;
      }
    }

    setOffset({ ID, X, Y }) {
      const found = this._findGlassByID(ID);
      if (found) {
        found.glass.ox = toSafeNumber(X);
        found.glass.oy = toSafeNumber(Y);
        renderer.dirty = true;
      }
    }

    setGlassParam({ ID, PARAM, V }) {
      const found = this._findGlassByID(ID);
      if (!found) return;
      const g = found.glass;
      const v = toSafeNumber(V);
      switch (String(PARAM)) {
        case '折射高度': g.refractionHeight = v; break;
        case '折射量': g.refractionAmount = v; break;
        case '玻璃模糊': g.blur = v; break;
        case '边缘模糊': g.edgeBlur = v; break;
        case '色散': g.dispersion = v; break;
        case '着色强度': g.tint = v; break;
        case '边缘反光': g.edge = v; break;
        case '上下反光': g.edgeTop = v; break;
        case '反光粗细': g.edgeTopWidth = v; break;
        case '亮度': g.brightness = v; break;
        case '白点': g.whitePoint = v; break;
        case '对比度': g.contrast = v; break;
        case '饱和度': g.sat = v; break;
        case '圆角平滑度': g.roundSmooth = Math.max(0, Math.min(100, v)); break;
      }
      renderer.dirty = true;
    }

    setDrawMode({ ID, MODE }) {
      const found = this._findGlassByID(ID);
      if (found) {
        found.glass.drawMode = String(MODE) === 'G9线框模式' ? 1 : 0;
        renderer.dirty = true;
      }
    }

    getInfo() {
      return {
        id: 'gpuLiquidGlass',
        name: 'GPU 液态玻璃 (跟随角色)',
        color1: '#4FC3F7',
        color2: '#0288D1',
        color3: '#01579B',
        blocks: [
          {
            opcode: 'createGlass',
            blockType: Scratch.BlockType.COMMAND,
            text: '在 [ID] 号位置创建液体玻璃（绑定当前角色）',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'deleteGlass',
            blockType: Scratch.BlockType.COMMAND,
            text: '删除液体玻璃 [ID]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'deleteAllGlasses',
            blockType: Scratch.BlockType.COMMAND,
            text: '删除全部液体玻璃'
          },
          '---',
          {
            opcode: 'setWidthHeight',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 宽度设为 [W] 高度设为 [H]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 200 },
              H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 150 }
            }
          },
          {
            opcode: 'setRadius',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 圆角半径设为 [R]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              R: { type: Scratch.ArgumentType.NUMBER, defaultValue: 40 }
            }
          },
          {
            opcode: 'setOffset',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 偏移设为 x:[X] y:[Y]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          '---',
          {
            opcode: 'setGlassParam',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置液体玻璃 [ID] 的 [PARAM] 为 [V]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              PARAM: { type: Scratch.ArgumentType.STRING, menu: 'paramMenu' },
              V: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          '---',
          {
            opcode: 'setDrawMode',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 的绘制模式设为 [MODE]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              MODE: { type: Scratch.ArgumentType.STRING, menu: 'modeMenu' }
            }
          }
        ],
        menus: {
          paramMenu: {
            items: [
              '折射高度', '折射量', '玻璃模糊', '边缘模糊', '色散',
              '着色强度', '边缘反光', '上下反光', '反光粗细',
              '亮度', '白点', '对比度', '饱和度', '圆角平滑度'
            ]
          },
          modeMenu: {
            items: ['正常玻璃', 'G9线框模式']
          }
        }
      };
    }
  }

  Scratch.extensions.register(new GPULiquidGlass());
})(Scratch);