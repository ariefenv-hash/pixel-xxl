class SVGConvertExtension {
    getInfo() {
        return {
            id: 'svgconvert',
            name: 'SVG转换',
            color1: '#9966ff',
            color2: '#7744cc',
            blocks: [
                {
                    opcode: 'toDataUrl',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'SVG文本转dataURL [svgText]',
                    arguments: {
                        svgText: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect fill="#2266bb" width="32" height="32"/></svg>'
                        }
                    }
                }
            ]
        };
    }

    toDataUrl(args) {
        const raw = args.svgText;
        const encoded = encodeURIComponent(raw);
        return "data:image/svg+xml," + encoded;
    }
}

Scratch.extensions.register(new SVGConvertExtension());