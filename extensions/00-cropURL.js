(function (Scratch) {
  'use strict';

  const vm = Scratch.vm;

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('圖片載入失敗：' + url));
      img.src = String(url);
    });
  }

  function fmtToMime(fmt) {
    const f = String(fmt || 'png').toLowerCase();
    if (f === 'jpeg' || f === 'jpg') return 'image/jpeg';
    if (f === 'webp') return 'image/webp';
    return 'image/png';
  }

  function toNum(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  // 高质量缩放函数
  function highQualityScale(image, targetWidth, targetHeight) {
    // 创建离屏canvas进行高质量缩放
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 设置canvas尺寸为目标尺寸
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // 禁用图像平滑以保持锐利边缘
    ctx.imageSmoothingEnabled = false;
    
    // 分步缩放策略：如果缩放比例过大，分步缩放
    const scaleX = targetWidth / image.width;
    const scaleY = targetHeight / image.height;
    
    if (scaleX > 2 || scaleY > 2) {
      // 分步缩放：先缩放到中间尺寸
      const intermediateWidth = Math.max(targetWidth / 2, image.width);
      const intermediateHeight = Math.max(targetHeight / 2, image.height);
      
      const intermediateCanvas = document.createElement('canvas');
      const intermediateCtx = intermediateCanvas.getContext('2d');
      intermediateCanvas.width = intermediateWidth;
      intermediateCanvas.height = intermediateHeight;
      intermediateCtx.imageSmoothingEnabled = false;
      intermediateCtx.drawImage(image, 0, 0, intermediateWidth, intermediateHeight);
      
      // 最终缩放
      ctx.drawImage(intermediateCanvas, 0, 0, intermediateWidth, intermediateHeight, 0, 0, targetWidth, targetHeight);
    } else {
      // 直接缩放
      ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, targetWidth, targetHeight);
    }
    
    return canvas;
  }

  class CropURL {
    getInfo() {
      return {
        id: 'cropURL',
        name: '裁切URL - 高質量',
        color1: '#2f80ed',
        color2: '#1c6dd0',
        color3: '#185fb6',
        blocks: [
          {
            opcode: 'crop',
            blockType: Scratch.BlockType.REPORTER,
            text: '裁切URL [URL] x [X] y [Y] 寬 [W] 高 [H] 單位 [UNIT] 圓角 [R] 格式 [FMT] 品質 [Q]',
            arguments: {
              URL: { type: Scratch.ArgumentType.STRING, defaultValue: 'https://extensions.turbowarp.org/dango.png' },
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              UNIT: { type: Scratch.ArgumentType.STRING, menu: 'units', defaultValue: 'px' },
              R: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              FMT: { type: Scratch.ArgumentType.STRING, menu: 'fmts', defaultValue: 'png' },
              Q: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.92 }
            }
          },
          {
            opcode: 'circleCrop',
            blockType: Scratch.BlockType.REPORTER,
            text: '圓形裁切URL [URL] 中心x [CX] y [CY] 半徑 [RAD] 單位 [UNIT] 格式 [FMT] 品質 [Q]',
            arguments: {
              URL: { type: Scratch.ArgumentType.STRING, defaultValue: 'https://extensions.turbowarp.org/dango.png' },
              CX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 50 },
              CY: { type: Scratch.ArgumentType.NUMBER, defaultValue: 50 },
              RAD: { type: Scratch.ArgumentType.NUMBER, defaultValue: 50 },
              UNIT: { type: Scratch.ArgumentType.STRING, menu: 'units', defaultValue: '%' },
              FMT: { type: Scratch.ArgumentType.STRING, menu: 'fmts', defaultValue: 'png' },
              Q: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.92 }
            }
          },
          {
            opcode: 'highQualityCrop',
            blockType: Scratch.BlockType.REPORTER,
            text: '高質量裁切URL [URL] x [X] y [Y] 寬 [W] 高 [H] 單位 [UNIT] 圓角 [R] 格式 [FMT] 品質 [Q] 放大倍數 [SCALE]',
            arguments: {
              URL: { type: Scratch.ArgumentType.STRING, defaultValue: 'https://extensions.turbowarp.org/dango.png' },
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              UNIT: { type: Scratch.ArgumentType.STRING, menu: 'units', defaultValue: 'px' },
              R: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              FMT: { type: Scratch.ArgumentType.STRING, menu: 'fmts', defaultValue: 'png' },
              Q: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.92 },
              SCALE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 2 }
            }
          }
        ],
        menus: {
          units: {
            acceptReporters: true,
            items: [
              { text: '像素(px)', value: 'px' },
              { text: '百分比(%)', value: '%' }
            ]
          },
          fmts: {
            acceptReporters: true,
            items: [
              { text: 'PNG', value: 'png' },
              { text: 'JPEG', value: 'jpeg' },
              { text: 'WebP', value: 'webp' }
            ]
          }
        }
      };
    }

    async crop(args) {
      const url = String(args.URL || '');
      const X = toNum(args.X, 0);
      const Y = toNum(args.Y, 0);
      const W = Math.max(1, toNum(args.W, 1));
      const H = Math.max(1, toNum(args.H, 1));
      const unit = String(args.UNIT || 'px').toLowerCase();
      const R = Math.max(0, toNum(args.R, 0));
      const fmt = fmtToMime(args.FMT);
      const q = Math.max(0, Math.min(1, toNum(args.Q, 0.92)));
      try {
        const img = await loadImage(url);
        let sx = X, sy = Y, sw = W, sh = H;
        if (unit === '%') {
          sx = img.width * (X / 100);
          sy = img.height * (Y / 100);
          sw = img.width * (W / 100);
          sh = img.height * (H / 100);
        }

        sx = Math.max(0, Math.min(img.width, sx));
        sy = Math.max(0, Math.min(img.height, sy));
        sw = Math.max(1, Math.min(img.width - sx, sw));
        sh = Math.max(1, Math.min(img.height - sy, sh));

        // 创建原始尺寸的canvas
        const originalCanvas = document.createElement('canvas');
        originalCanvas.width = sw;
        originalCanvas.height = sh;
        const originalCtx = originalCanvas.getContext('2d');

        // 使用高质量设置
        originalCtx.imageSmoothingEnabled = false;
        originalCtx.globalCompositeOperation = 'copy';

        if (R > 0) {
          originalCtx.beginPath();
          originalCtx.moveTo(R, 0);
          originalCtx.lineTo(sw - R, 0);
          originalCtx.quadraticCurveTo(sw, 0, sw, R);
          originalCtx.lineTo(sw, sh - R);
          originalCtx.quadraticCurveTo(sw, sh, sw - R, sh);
          originalCtx.lineTo(R, sh);
          originalCtx.quadraticCurveTo(0, sh, 0, sh - R);
          originalCtx.lineTo(0, R);
          originalCtx.quadraticCurveTo(0, 0, R, 0);
          originalCtx.closePath();
          originalCtx.clip();
        }

        originalCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        // 使用高质量缩放
        const scaledCanvas = highQualityScale(originalCanvas, sw * 2, sh * 2);

        return (fmt === 'image/png')
          ? scaledCanvas.toDataURL(fmt)
          : scaledCanvas.toDataURL(fmt, q);
      } catch (e) {
        return '' + e.message;
      }
    }

    async circleCrop(args) {
      const url = String(args.URL || '');
      let CX = toNum(args.CX, 50);
      let CY = toNum(args.CY, 50);
      let RAD = Math.max(1, toNum(args.RAD, 50));
      const unit = String(args.UNIT || '%').toLowerCase();
      const fmt = fmtToMime(args.FMT);
      const q = Math.max(0, Math.min(1, toNum(args.Q, 0.92)));

      try {
        const img = await loadImage(url);
        if (unit === '%') {
          CX = img.width * (CX / 100);
          CY = img.height * (CY / 100);
          RAD = Math.min(img.width, img.height) * (RAD / 100);
        }

        // 创建原始尺寸的canvas
        const originalCanvas = document.createElement('canvas');
        originalCanvas.width = RAD * 2;
        originalCanvas.height = RAD * 2;
        const originalCtx = originalCanvas.getContext('2d');

        // 使用高质量设置
        originalCtx.imageSmoothingEnabled = false;
        originalCtx.globalCompositeOperation = 'copy';

        originalCtx.beginPath();
        originalCtx.arc(RAD, RAD, RAD, 0, Math.PI * 2);
        originalCtx.closePath();
        originalCtx.clip();

        originalCtx.drawImage(img, CX - RAD, CY - RAD, RAD * 2, RAD * 2, 0, 0, RAD * 2, RAD * 2);

        // 使用高质量缩放
        const scaledCanvas = highQualityScale(originalCanvas, RAD * 4, RAD * 4);

        return (fmt === 'image/png')
          ? scaledCanvas.toDataURL(fmt)
          : scaledCanvas.toDataURL(fmt, q);
      } catch (e) {
        return '' + e.message;
      }
    }

    async highQualityCrop(args) {
      const url = String(args.URL || '');
      const X = toNum(args.X, 0);
      const Y = toNum(args.Y, 0);
      const W = Math.max(1, toNum(args.W, 1));
      const H = Math.max(1, toNum(args.H, 1));
      const unit = String(args.UNIT || 'px').toLowerCase();
      const R = Math.max(0, toNum(args.R, 0));
      const fmt = fmtToMime(args.FMT);
      const q = Math.max(0, Math.min(1, toNum(args.Q, 0.92)));
      const SCALE = Math.max(1, toNum(args.SCALE, 2));
      
      try {
        const img = await loadImage(url);
        let sx = X, sy = Y, sw = W, sh = H;
        if (unit === '%') {
          sx = img.width * (X / 100);
          sy = img.height * (Y / 100);
          sw = img.width * (W / 100);
          sh = img.height * (H / 100);
        }

        sx = Math.max(0, Math.min(img.width, sx));
        sy = Math.max(0, Math.min(img.height, sy));
        sw = Math.max(1, Math.min(img.width - sx, sw));
        sh = Math.max(1, Math.min(img.height - sy, sh));

        // 创建高质量裁剪canvas
        const canvas = document.createElement('canvas');
        canvas.width = sw * SCALE;
        canvas.height = sh * SCALE;
        const ctx = canvas.getContext('2d');

        // 最高质量设置
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = 'copy';

        // 直接在高质量画布上绘制
        if (R > 0) {
          const scaledR = R * SCALE;
          ctx.beginPath();
          ctx.moveTo(scaledR, 0);
          ctx.lineTo(canvas.width - scaledR, 0);
          ctx.quadraticCurveTo(canvas.width, 0, canvas.width, scaledR);
          ctx.lineTo(canvas.width, canvas.height - scaledR);
          ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - scaledR, canvas.height);
          ctx.lineTo(scaledR, canvas.height);
          ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - scaledR);
          ctx.lineTo(0, scaledR);
          ctx.quadraticCurveTo(0, 0, scaledR, 0);
          ctx.closePath();
          ctx.clip();
        }

        // 直接绘制到目标尺寸，避免中间缩放步骤
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * SCALE, sh * SCALE);

        return (fmt === 'image/png')
          ? canvas.toDataURL(fmt)
          : canvas.toDataURL(fmt, q);
      } catch (e) {
        return '' + e.message;
      }
    }
  }

  Scratch.extensions.register(new CropURL());
})(Scratch);