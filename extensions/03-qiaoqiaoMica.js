// ============================================================
// 独立造型模糊扩展 - QWQ 的云母片（稳定优化版·无防抖）
// 加载方式：保存为 .js 文件，拖入 TurboWarp
// 改进：任务序列化、错误边界、内存管理、渲染节流
// 移除防抖延时，每次调用立即入队，队列串行执行
// ============================================================

(function(Scratch) {
    'use strict';

    const vm = Scratch.vm;
    const runtime = vm.runtime;
    const renderer = runtime.renderer;

    const originalCostumeMap = new Map();

    let maxCacheSize = 1;
    let downsamplingLevel = 0;
    let enableAutoPreload = false;

    // 任务队列控制
    let isGenerating = false;
    const generateQueue = [];

    // 渲染节流
    let renderPending = false;

    // 最大图像尺寸（像素），防止内存溢出
    const MAX_IMAGE_PIXELS = 4096 * 4096;

    class BlurExtension {
        constructor() {}

        getInfo() {
            return {
                id: 'qiaoqiaoMica',
                name: 'QWQ 的云母片',
                color1: '#668cff',
                color2: '#3d6dff',
                blocks: [
                    {
                        opcode: 'setBlur',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '设置模糊 [BLUR]',
                        arguments: {
                            BLUR: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 10,
                                min: 0,
                                max: 50
                            }
                        }
                    },
                    {
                        opcode: 'clearBlur',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '清除全局模糊',
                        arguments: {}
                    },
                    {
                        opcode: 'setCacheSize',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '设置缓存容量 [SIZE]',
                        arguments: {
                            SIZE: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1,
                                min: 0,
                                max: 100
                            }
                        }
                    },
                    {
                        opcode: 'setDownsamplingLevel',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '设置动态降采样级别 [LEVEL]',
                        arguments: {
                            LEVEL: {
                                type: Scratch.ArgumentType.STRING,
                                menu: 'levelMenu',
                                defaultValue: '无'
                            }
                        }
                    },
                    {
                        opcode: 'setAutoPreload',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '启用自动预加载 [STATE]',
                        arguments: {
                            STATE: {
                                type: Scratch.ArgumentType.STRING,
                                menu: 'stateMenu',
                                defaultValue: '关闭'
                            }
                        }
                    }
                ],
                menus: {
                    levelMenu: {
                        acceptReporters: true,
                        items: ['无', '轻度', '中度', '强度']
                    },
                    stateMenu: {
                        acceptReporters: true,
                        items: ['开启', '关闭']
                    }
                }
            };
        }

        // ============================================================
        // 积木一：设置当前造型模糊（立即入队，无防抖）
        // ============================================================
        setBlur(args, util) {
            try {
                const blur = Math.max(0, Number(args.BLUR));
                const drawableId = util.target.drawableID;
                const target = util.target;

                // 直接入队，无延迟
                this._doSetBlur(blur, drawableId, target).catch(e => {
                    console.error('setBlur 执行错误:', e);
                });
            } catch (e) {
                console.error('setBlur 调用错误:', e);
            }
        }

        // ============================================================
        // 实际执行模糊（入队）
        // ============================================================
        async _doSetBlur(blur, drawableId, target) {
            return new Promise((resolve, reject) => {
                generateQueue.push({ blur, drawableId, target, resolve, reject });
                this._processQueue();
            });
        }

        // ============================================================
        // 队列处理器（串行）
        // ============================================================
        async _processQueue() {
            if (isGenerating || generateQueue.length === 0) return;
            isGenerating = true;

            const task = generateQueue.shift();
            try {
                await this._executeBlur(task.blur, task.drawableId, task.target);
                task.resolve();
            } catch (e) {
                console.error('执行模糊任务失败:', e);
                task.reject(e);
            } finally {
                isGenerating = false;
                this._processQueue();
            }
        }

        // ============================================================
        // 核心模糊执行
        // ============================================================
        async _executeBlur(blur, drawableId, target) {
            const currentCostumeIndex = target.currentCostume;
            const costume = target.sprite.costumes[currentCostumeIndex];
            if (!costume) return;

            let info = originalCostumeMap.get(drawableId);
            const isNewDrawable = !info;
            const isCostumeChanged = info && info.costumeIndex !== currentCostumeIndex;

            if (isNewDrawable || isCostumeChanged) {
                const newInfo = {
                    costumeIndex: currentCostumeIndex,
                    originalSkinId: costume.skinId,
                    bitmapResolution: costume.bitmapResolution || 1,
                    cache: new Map(),
                    cacheOrder: []
                };
                originalCostumeMap.set(drawableId, newInfo);
                info = newInfo;
            }

            if (blur === 0) {
                this._safeUpdateSkin(drawableId, info.originalSkinId);
                this._scheduleRender();
                return;
            }

            if (maxCacheSize === 0) {
                const newSkinId = await this._createBlurredSkinSafe(costume, blur, info.bitmapResolution);
                if (newSkinId !== null) {
                    this._safeUpdateSkin(drawableId, newSkinId);
                    this._scheduleRender();
                }
                return;
            }

            let cachedSkinId = info.cache.get(blur);
            if (cachedSkinId !== undefined) {
                this._safeUpdateSkin(drawableId, cachedSkinId);
                this._scheduleRender();
                return;
            }

            const newSkinId = await this._createBlurredSkinSafe(costume, blur, info.bitmapResolution);
            if (newSkinId === null) return;

            info.cache.set(blur, newSkinId);
            info.cacheOrder.push(blur);
            this._trimCache(info);

            this._safeUpdateSkin(drawableId, newSkinId);
            this._scheduleRender();

            if (enableAutoPreload && maxCacheSize >= 5 && info.cache.size < maxCacheSize) {
                const candidates = [blur - 1, blur + 1];
                for (let val of candidates) {
                    if (val < 0 || val > 50) continue;
                    if (info.cache.has(val)) continue;
                    if (info.cache.size >= maxCacheSize) break;
                    try {
                        const skinId = await this._createBlurredSkinSafe(costume, val, info.bitmapResolution);
                        if (skinId !== null) {
                            info.cache.set(val, skinId);
                            info.cacheOrder.push(val);
                            this._trimCache(info);
                        }
                    } catch (e) {
                        console.warn('预加载失败:', val, e);
                    }
                }
            }
        }

        // ============================================================
        // 安全更新皮肤
        // ============================================================
        _safeUpdateSkin(drawableId, skinId) {
            try {
                renderer.updateDrawableSkinId(drawableId, skinId);
            } catch (e) {
                console.warn('更新皮肤失败 (drawableId:', drawableId, ')', e);
            }
        }

        // ============================================================
        // 渲染节流
        // ============================================================
        _scheduleRender() {
            if (renderPending) return;
            renderPending = true;
            requestAnimationFrame(() => {
                renderPending = false;
                try {
                    renderer.render();
                } catch (e) {
                    console.warn('渲染调用失败:', e);
                }
            });
        }

        // ============================================================
        // 积木二：清除全局模糊
        // ============================================================
        clearBlur(args, util) {
            try {
                // 清空队列，防止旧任务残留
                generateQueue.length = 0;

                for (const [drawableId, info] of originalCostumeMap) {
                    this._safeUpdateSkin(drawableId, info.originalSkinId);
                    for (const [blurValue, skinId] of info.cache) {
                        try { renderer.destroySkin(skinId); } catch (e) {}
                    }
                    info.cache.clear();
                    info.cacheOrder = [];
                }
                originalCostumeMap.clear();
                this._scheduleRender();
            } catch (e) {
                console.error('clearBlur 错误:', e);
            }
        }

        // ============================================================
        // 积木三：设置缓存容量
        // ============================================================
        setCacheSize(args, util) {
            try {
                const size = Math.max(0, Math.floor(Number(args.SIZE)));
                maxCacheSize = size;
                for (const [drawableId, info] of originalCostumeMap) {
                    this._trimCache(info);
                }
            } catch (e) {
                console.error('setCacheSize 错误:', e);
            }
        }

        // ============================================================
        // 积木四：设置动态降采样级别
        // ============================================================
        setDownsamplingLevel(args, util) {
            try {
                const levelStr = args.LEVEL;
                let newLevel = 0;
                if (levelStr === '轻度') newLevel = 1;
                else if (levelStr === '中度') newLevel = 2;
                else if (levelStr === '强度') newLevel = 3;
                else newLevel = 0;

                if (newLevel !== downsamplingLevel) {
                    for (const [drawableId, info] of originalCostumeMap) {
                        for (const [blurValue, skinId] of info.cache) {
                            try { renderer.destroySkin(skinId); } catch (e) {}
                        }
                        info.cache.clear();
                        info.cacheOrder = [];
                    }
                    downsamplingLevel = newLevel;
                }
            } catch (e) {
                console.error('setDownsamplingLevel 错误:', e);
            }
        }

        // ============================================================
        // 积木五：启用/禁用自动预加载
        // ============================================================
        setAutoPreload(args, util) {
            try {
                enableAutoPreload = (args.STATE === '开启');
            } catch (e) {
                console.error('setAutoPreload 错误:', e);
            }
        }

        // ============================================================
        // 辅助：裁剪缓存
        // ============================================================
        _trimCache(info) {
            if (maxCacheSize <= 0) {
                for (const [blurValue, skinId] of info.cache) {
                    try { renderer.destroySkin(skinId); } catch (e) {}
                }
                info.cache.clear();
                info.cacheOrder = [];
                return;
            }

            while (info.cacheOrder.length > maxCacheSize) {
                const oldest = info.cacheOrder.shift();
                const oldSkinId = info.cache.get(oldest);
                if (oldSkinId !== undefined) {
                    try { renderer.destroySkin(oldSkinId); } catch (e) {}
                    info.cache.delete(oldest);
                }
            }
        }

        // ============================================================
        // 安全创建模糊纹理（带尺寸限制和错误捕获）
        // ============================================================
        async _createBlurredSkinSafe(costume, blur, bitmapResolution) {
            try {
                const srcData = costume.asset.encodeDataURI();
                const img = new Image();
                img.src = srcData;
                await img.decode();

                let origWidth = img.width;
                let origHeight = img.height;

                // 硬限制最大像素数
                const totalPixels = origWidth * origHeight;
                if (totalPixels > MAX_IMAGE_PIXELS) {
                    const scale = Math.sqrt(MAX_IMAGE_PIXELS / totalPixels);
                    origWidth = Math.round(origWidth * scale);
                    origHeight = Math.round(origHeight * scale);
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = origWidth;
                    tempCanvas.height = origHeight;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(img, 0, 0, origWidth, origHeight);
                    const newImg = new Image();
                    newImg.src = tempCanvas.toDataURL();
                    await newImg.decode();
                    img.src = newImg.src;
                    await img.decode();
                    origWidth = img.width;
                    origHeight = img.height;
                }

                let scale = 1;
                if (downsamplingLevel === 1) {
                    scale = Math.max(0.25, 1 / (1 + blur * 0.04));
                } else if (downsamplingLevel === 2) {
                    scale = Math.max(0.2, 1 / (1 + blur * 0.08));
                } else if (downsamplingLevel === 3) {
                    scale = Math.max(0.15, 1 / (1 + blur * 0.12));
                } else {
                    scale = 1;
                }

                const renderWidth = origWidth * scale;
                const renderHeight = origHeight * scale;
                const effectiveBlur = blur * scale;

                const renderCanvas = document.createElement('canvas');
                renderCanvas.width = renderWidth;
                renderCanvas.height = renderHeight;
                const renderCtx = renderCanvas.getContext('2d');

                renderCtx.clearRect(0, 0, renderWidth, renderHeight);
                renderCtx.filter = `blur(${effectiveBlur}px)`;
                renderCtx.drawImage(img, 0, 0, renderWidth, renderHeight);

                let finalCanvas = renderCanvas;
                if (scale !== 1) {
                    finalCanvas = document.createElement('canvas');
                    finalCanvas.width = origWidth;
                    finalCanvas.height = origHeight;
                    const finalCtx = finalCanvas.getContext('2d');
                    finalCtx.clearRect(0, 0, origWidth, origHeight);
                    finalCtx.imageSmoothingEnabled = true;
                    finalCtx.imageSmoothingQuality = 'high';
                    finalCtx.drawImage(renderCanvas, 0, 0, origWidth, origHeight);
                }

                const originalSkin = renderer._allSkins[costume.skinId];
                const rotationCenter = originalSkin ? originalSkin.rotationCenter : [origWidth/2, origHeight/2];

                return renderer.createBitmapSkin(
                    finalCanvas,
                    bitmapResolution,
                    rotationCenter
                );
            } catch (e) {
                console.error('创建模糊纹理失败:', e);
                return null;
            }
        }
    }

    Scratch.extensions.register(new BlurExtension());
})(Scratch);