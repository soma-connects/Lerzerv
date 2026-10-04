(function(){
class LzPhone extends HTMLElement{
  constructor(){
    super();
    const r=this.attachShadow({mode:'open'});
    r.innerHTML='<style>:host{display:inline-block;flex:none;vertical-align:top}.f{box-sizing:border-box;width:var(--pw,412px);height:var(--ph,852px);border:10px solid #1d1f20;border-radius:36px;background:var(--color-bg,#f2f2f3);overflow:hidden;position:relative;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(29,31,32,.28);color:var(--color-text,#1d1f20);font-family:inherit}.sb{height:36px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:13px;font-weight:700;position:relative;background:var(--tone,var(--color-bg,#f2f2f3));color:var(--tonefg,#1d1f20)}.hole{position:absolute;left:50%;top:9px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:#1d1f20}.c{flex:1;min-height:0;display:flex;flex-direction:column;position:relative;background-color:var(--color-bg,#f2f2f3);background-image:linear-gradient(color-mix(in srgb,var(--color-text,#1d1f20) 5%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--color-text,#1d1f20) 5%,transparent) 1px,transparent 1px);background-size:24px 24px;background-position:-1px -1px}.nv{height:22px;flex:none;display:flex;align-items:center;justify-content:center;background:var(--tone,var(--color-bg,#f2f2f3))}.nv i{width:104px;height:4px;border-radius:2px;background:var(--tonefg,#1d1f20);opacity:.5}.ic{display:flex;gap:5px;align-items:center}</style><div class="f"><div class="sb"><span>9:30</span><i class="hole"></i><span class="ic"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 13.3L.67 5.97a10.37 10.37 0 0114.66 0L8 13.3z" fill="currentColor"/></svg><svg width="14" height="14" viewBox="0 0 16 16"><path d="M14.67 14.67V1.33L1.33 14.67h13.34z" fill="currentColor"/></svg><svg width="14" height="14" viewBox="0 0 16 16"><rect x="3.75" y="2" width="8.5" height="13" fill="currentColor"/><rect x="5.5" y="0.9" width="5" height="2" fill="currentColor"/></svg></span></div><div class="c"><slot></slot></div><div class="nv"><i></i></div></div>';
  }
  static get observedAttributes(){return['w','h','tone'];}
  attributeChangedCallback(n,o,v){
    if(n==='w')this.style.setProperty('--pw',v+'px');
    if(n==='h')this.style.setProperty('--ph',v+'px');
    if(n==='tone'){
      if(v==='accent'){this.style.setProperty('--tone','var(--color-accent-900)');this.style.setProperty('--tonefg','var(--color-bg)');}
      else{this.style.removeProperty('--tone');this.style.removeProperty('--tonefg');}
    }
  }
}
if(!customElements.get('lz-phone'))customElements.define('lz-phone',LzPhone);
})();
