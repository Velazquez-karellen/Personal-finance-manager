(function(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(console.error);
  }
  function ensureHeadTags(){
    const H = document.head;
    if (!H) return;
    if (!document.querySelector('link[rel="manifest"]')) {
      const l = document.createElement('link'); l.rel='manifest'; l.href='./manifest.webmanifest'; H.appendChild(l);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const m = document.createElement('meta'); m.name='theme-color'; m.content='#0f1522'; H.appendChild(m);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const m = document.createElement('meta'); m.name='apple-mobile-web-app-capable'; m.content='yes'; H.appendChild(m);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const a = document.createElement('link'); a.rel='apple-touch-icon'; a.href='./icons/icon-192.png'; H.appendChild(a);
    }
  }
  ensureHeadTags();

  let deferred;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; showInstall(); });

  function showInstall(){
    if (document.getElementById('pwaInstallFab') || !deferred) return;
    const b = document.createElement('button');
    b.id='pwaInstallFab'; b.textContent='Instalar';
    Object.assign(b.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:9999,padding:'10px 14px',
      borderRadius:'9999px',border:'1px solid rgba(59,130,246,.35)',background:'rgba(59,130,246,.15)',
      color:'#e5e7eb',cursor:'pointer',backdropFilter:'blur(6px)'});
    b.addEventListener('click', async ()=>{ if(!deferred) return; deferred.prompt(); const r=await deferred.userChoice; if(r.outcome!=='dismissed') b.remove(); deferred=null; });
    document.body.appendChild(b);
  }

  window.matchMedia('(display-mode: standalone)').addEventListener('change', e=>{
    if (e.matches) document.getElementById('pwaInstallFab')?.remove();
  });
})();
