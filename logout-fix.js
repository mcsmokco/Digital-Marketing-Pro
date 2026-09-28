/* Final synchronous logout patch. */
(() => {
  const FLAG = 'dmp-force-logged-out';
  let busy = false;
  const clearTokens = () => { try { for (const s of [localStorage, sessionStorage]) { const ks=[]; for(let i=0;i<s.length;i++){const k=s.key(i);if(k&&(/^sb-.*-auth-token$/i.test(k)||/supabase.*auth.*token/i.test(k)))ks.push(k)} ks.forEach(k=>s.removeItem(k)); } } catch(e){} };
  const close = () => { const m=document.getElementById('authModal'); if(!m)return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); m.hidden=true; m.style.setProperty('display','none','important'); m.style.visibility='hidden'; m.style.opacity='0'; m.style.pointerEvents='none'; document.body.classList.remove('auth-open'); };
  const reset = () => { const a=document.getElementById('accountArea'); if(!a)return; a.innerHTML='<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>'; const b=document.getElementById('accountBtn'); if(b&&typeof window.DMP_openAuth==='function') b.onclick=window.DMP_openAuth; };
  const logout = e => { const b=e?.target?.closest?.('#logoutBtn'); if(!b||busy)return; busy=true; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); try{sessionStorage.setItem(FLAG,'1')}catch(_){} clearTokens(); const status=document.getElementById('authStatus'); if(status)status.textContent=''; close(); reset(); try{window.dispatchEvent(new CustomEvent('dmp-logged-out'))}catch(_){} setTimeout(()=>busy=false,500); };
  window.DMP_closeAuthImmediately=close;
  window.DMP_logoutImmediately=()=>{try{sessionStorage.setItem(FLAG,'1')}catch(_){} clearTokens(); close(); reset();};
  document.addEventListener('pointerdown',logout,true);
  document.addEventListener('touchstart',logout,true);
  document.addEventListener('click',logout,true);
})();
