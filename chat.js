(()=>{
  const aliases={chatInput:'messageInput',chatMessages:'messages',chatStatus:'chatNotice'};
  Object.entries(aliases).forEach(([oldId,newId])=>{const el=document.getElementById(oldId);if(el&&!document.getElementById(newId))el.id=newId;});
  const panel=document.getElementById('chatPanel');
  const open=document.getElementById('chatOpenBtn');
  const close=document.getElementById('chatCloseBtn');
  const show=()=>{if(panel){panel.classList.add('open');panel.setAttribute('aria-hidden','false');}};
  const hide=()=>{if(panel){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');}};
  open?.addEventListener('click',show);close?.addEventListener('click',hide);
  const form=document.getElementById('chatForm');
  if(form){
    if(!document.getElementById('replyBar')){const e=document.createElement('div');e.id='replyBar';e.className='chat-context-bar';e.hidden=true;form.before(e);}
    if(!document.getElementById('editBar')){const e=document.createElement('div');e.id='editBar';e.className='chat-context-bar';e.hidden=true;e.textContent='✏️ تعديل الرسالة';form.before(e);}
    if(!document.getElementById('emojiBtn')){const b=document.createElement('button');b.id='emojiBtn';b.type='button';b.className='chat-emoji-btn';b.textContent='😀';b.title='الإيموجيات';form.insertBefore(b,form.firstChild);}
    if(!document.getElementById('emojiPicker')){const e=document.createElement('div');e.id='emojiPicker';e.className='emoji-picker';e.hidden=true;form.before(e);}
    if(!document.getElementById('mentionSuggestions')){const e=document.createElement('div');e.id='mentionSuggestions';e.className='mention-suggestions';e.hidden=true;const input=document.getElementById('messageInput');if(input){const wrap=document.createElement('div');wrap.className='chat-input-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);wrap.appendChild(e);}}
  }
  if(!window.__dmpChatControllerLoaded){window.__dmpChatControllerLoaded=true;const s=document.createElement('script');s.src='chat-interactions.js?v=20261002-2';s.async=false;document.head.appendChild(s);}
})();