class MaterialPalettePro {
    getInfo() {
        return {
            id: 'materialPalettePro',
            name: 'Material色阶Pro',
            blocks: [
                {
                    opcode: 'generate',
                    blockType: Scratch.BlockType.REPORTER,
                    text: '从[data]生成主题 算法[algo]',
                    arguments: {
                        data: { type: Scratch.ArgumentType.STRING },
                        algo: {
                            type: Scratch.ArgumentType.STRING,
                            menu: 'algorithms'
                        }
                    }
                }
            ],
            menus: {
                algorithms: {
                    acceptReporters: true,
                    items: ['average', 'median', 'kmeans']
                }
            }
        };
    }

    async generate(args) {
        const img = new Image();
        img.src = args.data;
        await new Promise(r => img.onload = r);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let base = this.averageColor(data);

        const light = this.makeScale(base, false);
        const dark = this.makeScale(base, true);

        return JSON.stringify({
            primary: this.rgbToHex(base),
            light,
            dark
        });
    }

    averageColor(data) {
        let r=0,g=0,b=0,c=0;
        for (let i=0;i<data.length;i+=4){
            r+=data[i]; g+=data[i+1]; b+=data[i+2]; c++;
        }
        return [r/c,g/c,b/c];
    }

    makeScale(rgb, darkMode) {
        const hsl = this.rgbToHsl(...rgb);

        const steps = darkMode
            ? [90,80,70,60,50,40,30,25,20,15] // 暗色反转
            : [95,90,80,70,60,50,40,30,20,10];

        const keys = [50,100,200,300,400,500,600,700,800,900];

        const result = {};

        for (let i=0;i<keys.length;i++){
            let l = steps[i];

            // Material风格调整
            let s = hsl[1];

            // 降低极端饱和度
            if (l > 80 || l < 20) s *= 0.8;

            const rgb = this.hslToRgb(hsl[0], s, l);
            result[keys[i]] = this.rgbToHex(rgb);
        }

        return result;
    }

    rgbToHsl(r,g,b){
        r/=255;g/=255;b/=255;
        const max=Math.max(r,g,b),min=Math.min(r,g,b);
        let h,s,l=(max+min)/2;

        if(max===min){h=s=0;}
        else{
            const d=max-min;
            s=l>0.5?d/(2-max-min):d/(max+min);
            switch(max){
                case r:h=(g-b)/d+(g<b?6:0);break;
                case g:h=(b-r)/d+2;break;
                case b:h=(r-g)/d+4;break;
            }
            h/=6;
        }
        return [h*360,s,l*100];
    }

    hslToRgb(h,s,l){
        h/=360;l/=100;
        const a=s*Math.min(l,1-l);

        const f=n=>{
            const k=(n+h*12)%12;
            return l-a*Math.max(-1,Math.min(k-3,Math.min(9-k,1)));
        };

        return [f(0)*255,f(8)*255,f(4)*255];
    }

    rgbToHex([r,g,b]){
        return "#" + [r,g,b].map(x=>{
            const h=Math.round(x).toString(16);
            return h.length===1?"0"+h:h;
        }).join('');
    }
}

Scratch.extensions.register(new MaterialPalettePro());