(function(){
const W=720,H=1040;
function rng(s){return function(){s=(s*16807)%2147483647;return (s-1)/2147483646;};}
function build(bp){
  const r=rng(7);let s='';
  s+='<rect width="'+W+'" height="'+H+'" fill="var(--map-land)"/>';
  // street blocks (rotated city grid)
  s+='<g transform="rotate(-9 360 520)">';
  for(let x=-260;x<980;x+=58){for(let y=-260;y<1300;y+=50){
    const v=r();if(v<0.07)continue;
    const w=58-9,h=50-9;
    if(v<0.22){s+='<rect x="'+(x+4)+'" y="'+(y+4)+'" width="'+(w/2-2)+'" height="'+h+'" fill="var(--map-block)"/><rect x="'+(x+4+w/2+2)+'" y="'+(y+4)+'" width="'+(w/2-2)+'" height="'+h+'" fill="var(--map-block)"/>';}
    else if(v<0.3){s+='<rect x="'+(x+4)+'" y="'+(y+4)+'" width="'+w+'" height="'+h+'" fill="var(--map-park)"/>';}
    else s+='<rect x="'+(x+4)+'" y="'+(y+4)+'" width="'+w+'" height="'+h+'" fill="var(--map-block)"/>';
  }}
  s+='</g>';
  // blueprint grid
  if(bp){for(let x=0;x<=W;x+=40)s+='<line x1="'+x+'" y1="0" x2="'+x+'" y2="'+H+'" stroke="var(--map-grid)" stroke-width="'+(x%200===0?1:.5)+'"/>';
         for(let y=0;y<=H;y+=40)s+='<line x1="0" y1="'+y+'" x2="'+W+'" y2="'+y+'" stroke="var(--map-grid)" stroke-width="'+(y%200===0?1:.5)+'"/>';}
  // water: lagoon south, creek north-west
  s+='<path d="M0 846 C120 812 220 880 360 858 S600 808 720 842 L720 1040 L0 1040Z" fill="var(--map-water)"/>';
  s+='<path d="M0 120 C60 140 90 210 70 300 S40 420 0 460Z" fill="var(--map-water)"/>';
  s+='<path d="M0 846 C120 812 220 880 360 858 S600 808 720 842" fill="none" stroke="var(--map-shore)" stroke-width="1"/>';
  // roads
  const road=(d,w)=>'<path d="'+d+'" fill="none" stroke="var(--map-road-edge)" stroke-width="'+(w+3)+'" stroke-linecap="square"/><path d="'+d+'" fill="none" stroke="var(--map-road)" stroke-width="'+w+'" stroke-linecap="square"/>';
  s+=road('M-10 790 C200 768 420 806 730 760',16);
  s+=road('M300 -10 C318 260 286 500 338 790',11);
  s+=road('M-10 330 L730 222',10);
  s+=road('M560 -10 C540 300 600 520 590 780',8);
  s+=road('M-10 610 C220 580 480 640 730 560',8);
  s+=road('M120 130 L190 790',6);
  // labels
  const t=(x,y,a,txt,sz,op)=>'<text x="'+x+'" y="'+y+'" transform="rotate('+a+' '+x+' '+y+')" font-family="Barlow Condensed, sans-serif" font-weight="600" font-size="'+sz+'" letter-spacing="'+(sz>12?3:1.2)+'" fill="var(--map-label)" opacity="'+(op||1)+'">'+txt+'</text>';
  s+=t(380,778,-2,'LEKKI–EPE EXPRESSWAY',10);
  s+=t(308,200,86,'ADMIRALTY WAY',10);
  s+=t(420,262,-8,'ADMIRALTY RD',10);
  s+=t(540,150,92,'FREEDOM WAY',9);
  s+=t(20,598,-4,'ADEBAYO DOHERTY RD',9);
  s+=t(380,140,0,'LEKKI PHASE 1',20,.55);
  s+=t(40,700,0,'OSAPA',20,.55);
  s+=t(600,430,0,'IKATE',20,.55);
  s+=t(60,30,0,'IKOYI',20,.55);
  s+=t(250,960,0,'LAGOS LAGOON',16,.7);
  return s;
}
class LzMap extends HTMLElement{
  static get observedAttributes(){return['variant'];}
  constructor(){super();this._r=this.attachShadow({mode:'open'});}
  connectedCallback(){this.draw();}
  attributeChangedCallback(){if(this.isConnected)this.draw();}
  draw(){
    const bp=this.getAttribute('variant')!=='clean';
    const k=bp?'b':'c';
    this._r.innerHTML='<style>:host{display:block;width:'+W+'px;height:'+H+'px;--map-land:var(--color-bg,#f2f2f3);--map-block:color-mix(in srgb,var(--color-text,#1d1f20) 7%,transparent);--map-park:var(--color-accent-200,#cfe3d4);--map-water:var(--color-accent-100,#e6f1ea);--map-shore:var(--color-accent-400,#7aa98a);--map-grid:color-mix(in srgb,var(--color-accent,#1d5c3a) '+(bp?'16%':'0%')+',transparent);--map-road:#ffffff;--map-road-edge:color-mix(in srgb,var(--color-text,#1d1f20) 22%,transparent);--map-label:var(--color-neutral-700,#555)}svg{display:block}</style><svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">'+build(bp)+'</svg>';
  }
}
if(!customElements.get('lz-map'))customElements.define('lz-map',LzMap);
})();
