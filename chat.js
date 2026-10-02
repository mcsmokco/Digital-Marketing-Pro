(()=>{
  const aliases={chatInput:'messageInput',chatMessages:'messages',chatStatus:'chatNotice'};
  Object.entries(aliases).forEach(([oldId,newId])=>{const el=document.getElementById(oldId);if(el&&!document.getElementById(newId))el.id=newId;});

  const getPanel=()=>document.getElementById('chatPanel');
  const show=()=>{const panel=getPanel();if(!panel)return;panel.classList.add('open');panel.setAttribute('aria-hidden','false');document.body.classList.add('chat-open');};
  const hide=()=>{const panel=getPanel();if(!panel)return;panel.classList.remove('open');panel.setAttribute('aria-hidden','true');document.body.classList.remove('chat-open');};

  // Bind directly when the elements exist, and also delegate clicks so the UI
  // still works if another script replaces/re-renders the header.
  const bindUi=()=>{
    const open=document.getElementById('chatOpenBtn');
    const close=document.getElementById('chatCloseBtn');
    if(open&&!open.dataset.chatBound){open.dataset.chatBound='1';open.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();show();});}
    if(close&&!close.dataset.chatBound){close.dataset.chatBound='1';close.addEventListener('click',e=>{e.preventDefault();hide();});}
  };
  bindUi();
  document.addEventListener('click',e=>{
    if(e.target.closest('#chatOpenBtn')){e.preventDefault();show();}
    else if(e.target.closest('#chatCloseBtn')){e.preventDefault();hide();}
    else if(e.target===getPanel())hide();
  });

  const form=document.getElementById('chatForm');
  if(form){
    if(!document.getElementById('replyBar')){const e=document.createElement('div');e.id='replyBar';e.className='chat-context-bar';e.hidden=true;form.before(e);}
    if(!document.getElementById('editBar')){const e=document.createElement('div');e.id='editBar';e.className='chat-context-bar';e.hidden=true;e.textContent='✏️ تعديل الرسالة';form.before(e);}
    if(!document.getElementById('emojiBtn')){const b=document.createElement('button');b.id='emojiBtn';b.type='button';b.className='chat-emoji-btn chat-tool-btn';b.textContent='😀';b.title='الإيموجيات';form.insertBefore(b,form.firstChild);}
    if(!document.getElementById('emojiPicker')){const e=document.createElement('div');e.id='emojiPicker';e.className='emoji-picker';e.hidden=true;form.before(e);}
    if(!document.getElementById('mentionSuggestions')){const e=document.createElement('div');e.id='mentionSuggestions';e.className='mention-suggestions';e.hidden=true;const input=document.getElementById('messageInput')||document.getElementById('chatInput');if(input&&!input.parentElement.classList.contains('chat-input-wrap')){const wrap=document.createElement('div');wrap.className='chat-input-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);wrap.appendChild(e);}}
  }

  if(!window.__dmpChatControllerLoaded){
    window.__dmpChatControllerLoaded=true;
    const s=document.createElement('script');
    s.src='chat-interactions.js?v=20261002-3';
    s.async=false;
    s.onload=()=>window.dispatchEvent(new Event('dmp-chat-ready'));
    document.head.appendChild(s);
  }
})();
