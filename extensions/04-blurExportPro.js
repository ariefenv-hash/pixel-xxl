// 模糊导出（强度+步长）TurboWrap专用
(function(sc) {
    let vm = sc.vm;
    let runtime = vm.runtime;
    let renderer = runtime.renderer;

    class BlurExportPro {
        getInfo() {
            return {
                id: "blurExportPro",
                name: "模糊导出Pro",
                color1: "#4CAF50",
                color2: "#388E3C",
                blocks: [
                    {
                        opcode: "exportBlurWithStep",
                        blockType: "reporter",
                        text: "模糊当前造型 强度[BLUR] 步长[STEP] 导出URL",
                        arguments: {
                            BLUR: { type: "number", defaultValue: 5 },
                            STEP: { type: "number", defaultValue: 1 }
                        }
                    }
                ]
            };
        }

        async exportBlurWithStep(args, util) {
            const target = util.target;
            const costume = target.sprite.costumes[target.currentCostume];
            const skin = renderer._allSkins[costume.skinId];
            
            let blur = Number(args.BLUR) || 0;
            let step = Number(args.STEP) || 1;
            if (blur < 0) blur = 0;
            if (step < 0.1) step = 0.1;

            // 用步长计算最终有效模糊（模拟渐变步进）
            const finalBlur = Math.round(blur / step) * step;

            try {
                // SVG 模糊
                if (skin._svgImage) {
                    const svgSrc = skin._svgImage.src;
                    const svgCode = decodeURIComponent(svgSrc.slice('data:image/svg+xml;utf8,'.length));
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgCode, "image/svg+xml");
                    const svg = doc.querySelector("svg");

                    let defs = svg.querySelector("defs") || svg.insertBefore(doc.createElementNS("http://www.w3.org/2000/svg", "defs"), svg.firstChild);
                    let filter = defs.querySelector("#blurStep") || defs.appendChild(doc.createElementNS("http://www.w3.org/2000/svg", "filter"));
                    filter.id = "blurStep";
                    
                    let feBlur = filter.querySelector("feGaussianBlur") || filter.appendChild(doc.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur"));
                    feBlur.setAttribute("stdDeviation", finalBlur);
                    feBlur.setAttribute("edgeMode", "duplicate");

                    Array.from(svg.children).forEach(el => {
                        if (el.tagName !== "defs") el.setAttribute("filter", "url(#blurStep)");
                    });

                    return "data:image/svg+xml;utf8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
                }

                // 位图模糊（带步长计算）
                const img = new Image();
                img.src = costume.asset.encodeDataURI();
                await img.decode();

                const margin = Math.ceil(finalBlur * 3);
                const canvas = document.createElement("canvas");
                canvas.width = img.width + margin * 2;
                canvas.height = img.height + margin * 2;
                const ctx = canvas.getContext("2d");
                
                ctx.filter = `blur(${finalBlur}px)`;
                ctx.drawImage(img, margin, margin);

                return canvas.toDataURL("image/png");
            } catch (e) {
                return "导出失败";
            }
        }
    }

    sc.extensions.register(new BlurExportPro());
})(Scratch);