(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  let client = window.supabaseClient || null;
  let activeCourse = null;

  async function getClient(){
    if(client && typeof client.rpc === 'function') return client;
    if(window.supabase && window.DMP_SUPABASE_URL && window.DMP_SUPABASE_ANON_KEY){
      client = window.supabase.createClient(window.DMP_SUPABASE_URL, window.DMP_SUPABASE_ANON_KEY);
      return client;
    }
    return null;
  }

  function escapeHtml(v){
    return String(v ?? '').replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function levelLabel(level){
    return ({beginner:'مبتدئ', intermediate:'متوسط', advanced:'متقدم'})[level] || level || '—';
  }

  function statusLabel(status){
    return ({draft:'DRAFT', published:'PUBLISHED', archived:'ARCHIVED'})[status] || String(status || '').toUpperCase();
  }

  function renderWorkspace(course){
    activeCourse = course;
    const panel = $('courseWorkspace');
    if(!panel) return;

    panel.hidden = false;
    panel.innerHTML = `
      <div class="course-workspace-head">
        <div>
          <button id="closeCourseWorkspace" class="course-back-btn" type="button">← الكورسات</button>
          <span class="eyebrow">COURSE WORKSPACE</span>
          <div class="course-title-line">
            <h2>${escapeHtml(course.title)}</h2>
            <span class="course-status-badge status-${escapeHtml(course.status)}">${statusLabel(course.status)}</span>
            <span class="course-status-badge">${course.is_premium ? '💎 PREMIUM' : '🆓 FREE'}</span>
          </div>
          <p class="course-workspace-description">${escapeHtml(course.description || 'لا يوجد وصف لهذا الكورس بعد.')}</p>
        </div>
        <div class="course-workspace-actions">
          <button id="coursePreviewBtn" class="small-btn" type="button">👁️ معاينة</button>
          ${course.status === 'draft' ? '<button id="workspacePublishBtn" class="small-btn primary-course-btn" type="button">نشر الكورس</button>' : ''}
          ${course.status !== 'archived' ? '<button id="workspaceArchiveBtn" class="small-btn danger-course-btn" type="button">أرشفة</button>' : ''}
        </div>
      </div>

      <div class="course-meta-grid">
        <div><span>المستوى</span><strong>${levelLabel(course.level)}</strong></div>
        <div><span>الحالة</span><strong>${statusLabel(course.status)}</strong></div>
        <div><span>المصدر</span><strong>${course.content_source === 'generated' ? '🤖 Generated' : '✍️ Native'}</strong></div>
        <div><span>الدروس</span><strong id="workspaceLessonCount">—</strong></div>
      </div>

      <div class="course-workspace-body">
        <section class="workspace-lessons-card">
          <div class="workspace-section-head">
            <div><span class="eyebrow">LESSONS</span><h3>دروس الكورس</h3></div>
            <button id="addLessonToggle" class="small-btn primary-course-btn" type="button">＋ إضافة درس</button>
          </div>
          <div id="lessonCreateBox" class="lesson-create-box" hidden>
            <form id="lessonCreateForm">
              <div class="lesson-form-grid">
                <label>رقم الدرس<input name="position" type="number" min="1" required></label>
                <label>عنوان الدرس<input name="title" maxlength="160" required></label>
              </div>
              <label>محتوى الدرس<textarea name="body_html" rows="8" placeholder="اكتب محتوى الدرس هنا..."></textarea></label>
              <label>المشروع / التطبيق<textarea name="project" rows="3" placeholder="اختياري"></textarea></label>
              <div class="lesson-form-actions">
                <button class="small-btn primary-course-btn" type="submit">حفظ كمسودة</button>
                <button id="cancelLessonBtn" class="small-btn" type="button">إلغاء</button>
                <span id="lessonCreateStatus" class="muted" aria-live="polite"></span>
              </div>
            </form>
          </div>
          <div id="workspaceLessons" class="workspace-lessons"><span class="muted">جاري تحميل الدروس...</span></div>
        </section>
      </div>
    `;

    $('closeCourseWorkspace')?.addEventListener('click', closeWorkspace);
    $('addLessonToggle')?.addEventListener('click', () => {
      const box = $('lessonCreateBox');
      if(box) box.hidden = !box.hidden;
    });
    $('cancelLessonBtn')?.addEventListener('click', () => {
      $('lessonCreateBox').hidden = true;
    });
    $('lessonCreateForm')?.addEventListener('submit', createLesson);
    $('workspacePublishBtn')?.addEventListener('click', () => courseAction('admin_publish_course', course.id));
    $('workspaceArchiveBtn')?.addEventListener('click', () => courseAction('admin_archive_course', course.id));
    $('coursePreviewBtn')?.addEventListener('click', () => openCoursePreview(course));

    loadLessons(course.id);
    window.scrollTo({top: panel.offsetTop - 20, behavior:'smooth'});
  }

  function sanitizeLessonHtml(html){
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ''), 'text/html');
    const allowed = new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','H4','UL','OL','LI','BLOCKQUOTE','PRE','CODE','A','IMG','HR','TABLE','THEAD','TBODY','TR','TH','TD','DIV','SPAN']);
    doc.body.querySelectorAll('*').forEach(el => {
      if(!allowed.has(el.tagName)) { el.replaceWith(...Array.from(el.childNodes)); return; }
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value || '';
        if(name.startsWith('on') || name === 'style' || name === 'srcdoc') el.removeAttribute(attr.name);
        if(name === 'href' && /^(javascript|data):/i.test(value)) el.removeAttribute(attr.name);
        if(name === 'src' && /^(javascript|data):/i.test(value)) el.removeAttribute(attr.name);
      });
      if(el.tagName === 'A') { el.setAttribute('target','_blank'); el.setAttribute('rel','noopener noreferrer'); }
    });
    return doc.body.innerHTML;
  }

  function renderQuiz(quiz){
    if(!Array.isArray(quiz) || !quiz.length) return '';
    const items = quiz.map((q,i) => {
      if(typeof q === 'string') return '<li><strong>سؤال '+(i+1)+'</strong><div>'+escapeHtml(q)+'</div></li>';
      const question = q?.question || q?.title || q?.text || 'سؤال '+(i+1);
      const options = Array.isArray(q?.options) ? '<ul>'+q.options.map(o => '<li>'+escapeHtml(typeof o === 'string' ? o : (o?.text || o?.label || ''))+'</li>').join('')+'</ul>' : '';
      return '<li><strong>'+escapeHtml(question)+'</strong>'+options+'</li>';
    }).join('');
    return '<section class="preview-block"><span class="eyebrow">QUIZ</span><h4>اختبار الدرس</h4><ol class="preview-quiz">'+items+'</ol></section>';
  }

  async function openCoursePreview(course){
    client = await getClient();
    if(!client) return;
    const {data,error} = await client.rpc('admin_list_course_lessons', {p_course_id: course.id});
    if(error){ alert(error.message); return; }
    const lessons = Array.isArray(data) ? data : [];
    const modal = document.createElement('div');
    modal.className = 'course-preview-overlay';
    modal.innerHTML = '<div class="course-preview-modal" role="dialog" aria-modal="true" aria-label="معاينة الكورس">'+
      '<button class="course-preview-close" type="button" aria-label="إغلاق">×</button>'+
      '<div class="course-preview-hero"><span class="eyebrow">ADMIN PREVIEW · DRAFT SAFE</span>'+
      '<h2>'+escapeHtml(course.title)+'</h2><p>'+escapeHtml(course.description || 'لا يوجد وصف لهذا الكورس بعد.')+'</p>'+
      '<div class="course-preview-badges"><span>'+levelLabel(course.level)+'</span><span>'+(course.is_premium ? '💎 Premium' : '🆓 Free')+'</span><span>'+lessons.length+' درس</span></div></div>'+
      '<div class="course-preview-layout"><aside class="course-preview-nav"><div class="preview-nav-title">محتوى الكورس</div>'+
      (lessons.length ? lessons.map((lesson,i)=>'<button type="button" class="preview-lesson-tab'+(i===0?' active':'')+'" data-preview-lesson="'+lesson.id+'"><span>'+String(lesson.position).padStart(2,'0')+'</span><strong>'+escapeHtml(lesson.title)+'</strong><small>'+ (lesson.status === 'published' ? 'منشور' : lesson.status === 'archived' ? 'مؤرشف' : 'مسودة') +'</small></button>').join('') : '<div class="preview-no-lessons">مازال ما كاين حتى درس.</div>')+
      '</aside><main id="coursePreviewContent" class="course-preview-content"></main></div></div>';
    document.body.appendChild(modal);

    const close=()=>{ modal.remove(); document.removeEventListener('keydown', onKey); };
    const onKey=(e)=>{ if(e.key==='Escape') close(); };
    modal.querySelector('.course-preview-close')?.addEventListener('click',close);
    modal.addEventListener('click',e=>{ if(e.target===modal) close(); });
    document.addEventListener('keydown',onKey);

    const content=modal.querySelector('#coursePreviewContent');
    const showLesson=(lesson)=>{
      if(!content) return;
      const body=sanitizeLessonHtml(lesson?.body_html);
      const project=lesson?.project ? '<section class="preview-block"><span class="eyebrow">PRACTICAL PROJECT</span><h4>المشروع / التطبيق</h4><div class="preview-project">'+escapeHtml(lesson.project).replace(/\n/g,'<br>')+'</div></section>' : '';
      content.innerHTML = '<div class="preview-lesson-head"><span class="preview-position">LESSON '+String(lesson.position).padStart(2,'0')+'</span><span class="course-status-badge status-'+escapeHtml(lesson.status)+'">'+statusLabel(lesson.status)+'</span><h3>'+escapeHtml(lesson.title)+'</h3></div><article class="preview-lesson-body">'+(body || '<p class="preview-empty">هذا الدرس مازال بلا محتوى.</p>')+'</article>'+project+renderQuiz(lesson.quiz);
    };
    modal.querySelectorAll('[data-preview-lesson]').forEach(btn=>btn.addEventListener('click',()=>{
      modal.querySelectorAll('.preview-lesson-tab').forEach(x=>x.classList.remove('active')); btn.classList.add('active');
      const lesson=lessons.find(x=>String(x.id)===String(btn.dataset.previewLesson)); if(lesson) showLesson(lesson);
    }));
    if(lessons[0]) showLesson(lessons[0]); else if(content) content.innerHTML='<div class="preview-empty-state">أضف أول درس باش تبدا المعاينة.</div>';
  }

  async function loadLessons(courseId){
    const out = $('workspaceLessons');
    const count = $('workspaceLessonCount');
    client = await getClient();
    if(!out || !client) return;

    const {data,error} = await client.rpc('admin_list_course_lessons', {p_course_id: courseId});
    if(error){
      out.innerHTML = '<div class="workspace-empty">تعذر تحميل الدروس: ' + escapeHtml(error.message) + '</div>';
      if(count) count.textContent = '—';
      return;
    }

    if(count) count.textContent = String(data?.length || 0);
    if(!data?.length){
      out.innerHTML = '<div class="workspace-empty"><span>📖</span><strong>مازال ما كاين حتى درس</strong><small>بدا بإضافة أول درس للكورس.</small></div>';
      return;
    }

    out.innerHTML = data.map(lesson => `
      <article class="workspace-lesson-row">
        <div class="lesson-number">${String(lesson.position).padStart(2,'0')}</div>
        <div class="lesson-main">
          <strong>${escapeHtml(lesson.title)}</strong>
          <small>${lesson.status === 'published' ? '🟢 منشور' : lesson.status === 'archived' ? '⚫ مؤرشف' : '🟡 مسودة'} · ${lesson.body_html ? 'محتوى موجود' : 'فارغ'}</small>
        </div>
        <div class="lesson-actions">
          <button class="small-btn" data-edit-lesson="${lesson.id}">✏️ تعديل</button>
          ${lesson.status === 'draft' ? '<button class="small-btn" data-publish-lesson="'+lesson.id+'">نشر</button>' : ''}
        </div>
      </article>
    `).join('');

    out.querySelectorAll('[data-edit-lesson]').forEach(btn => {
      btn.addEventListener('click', () => {
        const lesson = data.find(x => String(x.id) === String(btn.dataset.editLesson));
        if (lesson) window.openNativeLessonEditor?.(lesson, courseId);
      });
    });

    out.querySelectorAll('[data-publish-lesson]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const {error: publishError} = await client.rpc('admin_publish_lesson', {p_lesson_id: btn.dataset.publishLesson});
        if(publishError){ alert(publishError.message); return; }
        loadLessons(courseId);
      });
    });
  }

  async function createLesson(e){
    e.preventDefault();
    client = await getClient();
    if(!activeCourse || !client) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const status = $('lessonCreateStatus');
    status.textContent = 'جاري الحفظ...';

    const {error} = await client.rpc('admin_add_lesson', {
      p_course_id: activeCourse.id,
      p_position: Number(fd.get('position')),
      p_title: fd.get('title'),
      p_body_html: fd.get('body_html') || '',
      p_quiz: [],
      p_project: fd.get('project') || null
    });

    if(error){
      status.textContent = 'لم يتم الحفظ: ' + error.message;
      return;
    }

    form.reset();
    $('lessonCreateBox').hidden = true;
    status.textContent = 'تم حفظ الدرس ✓';
    loadLessons(activeCourse.id);
  }

  async function courseAction(fn, id){
    client = await getClient();
    if(!client) return;
    const {error} = await client.rpc(fn, {p_course_id:id});
    if(error){ alert(error.message); return; }
    const event = new CustomEvent('native-course-workspace-changed');
    window.dispatchEvent(event);
    closeWorkspace();
  }

  function openNativeLessonEditor(lesson, courseId){
    if(!lesson) return;
    try {

    const modal = document.createElement('div');
    modal.className = 'lesson-editor-overlay';
    modal.innerHTML = `
      <div class="lesson-editor-modal" role="dialog" aria-modal="true" aria-label="تعديل الدرس">
        <div class="lesson-editor-head">
          <div>
            <span class="eyebrow">LESSON EDITOR</span>
            <h2>✏️ تعديل الدرس</h2>
            <p>التعديلات تحفظ كمسودة محتوى، ولن تغيّر حالة النشر تلقائياً.</p>
          </div>
          <button type="button" class="lesson-editor-close" aria-label="إغلاق">×</button>
        </div>

        <form id="lessonEditorForm" class="lesson-editor-form">
          <div class="lesson-editor-grid">
            <label>رقم الدرس
              <input name="position" type="number" min="1" required value="${Number(lesson.position) || 1}">
            </label>
            <label>عنوان الدرس
              <input name="title" maxlength="160" required value="${escapeHtml(lesson.title)}">
            </label>
          </div>

          <label>محتوى الدرس
            <textarea name="body_html" rows="16" placeholder="<h2>عنوان</h2><p>محتوى الدرس...</p>">${escapeHtml(lesson.body_html || '')}</textarea>
            <small>يمكنك استعمال HTML آمن مثل العناوين، الفقرات، القوائم، الروابط والجداول.</small>
          </label>

          <label>المشروع / التطبيق
            <textarea name="project" rows="5" placeholder="التطبيق العملي للدرس...">${escapeHtml(lesson.project || '')}</textarea>
          </label>

          <label>Quiz JSON
            <textarea name="quiz" rows="7" placeholder='[{"question":"...","options":["...","..."]}]'>${escapeHtml(JSON.stringify(Array.isArray(lesson.quiz) ? lesson.quiz : [], null, 2))}</textarea>
            <small>اختياري. إذا لم تكن بحاجة إلى Quiz، اتركه كما هو.</small>
          </label>

          <div class="lesson-editor-footer">
            <span id="lessonEditorStatus" class="muted" aria-live="polite"></span>
            <div>
              <button type="button" class="small-btn lesson-editor-cancel">إلغاء</button>
              <button type="submit" class="small-btn primary-course-btn">💾 حفظ التعديلات</button>
            </div>
          </div>
        </form>
      </div>`;

    document.body.appendChild(modal);

    const form = modal.querySelector('#lessonEditorForm');
    const status = modal.querySelector('#lessonEditorStatus');
    const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if(e.key === 'Escape') close(); };

    modal.querySelector('.lesson-editor-close')?.addEventListener('click', close);
    modal.querySelector('.lesson-editor-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if(e.target === modal) close(); });
    document.addEventListener('keydown', onKey);

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      let quiz = [];
      try {
        quiz = JSON.parse(fd.get('quiz') || '[]');
        if(!Array.isArray(quiz)) throw new Error('Quiz يجب أن يكون Array');
      } catch(err) {
        status.textContent = '❌ Quiz JSON غير صالح';
        return;
      }

      status.textContent = 'جاري حفظ التعديلات...';
      form.querySelector('button[type="submit"]').disabled = true;

      client = await getClient();
      if(!client){ status.textContent = '❌ Supabase غير متاح'; form.querySelector('button[type="submit"]').disabled = false; return; }

      const {error} = await client.rpc('admin_update_lesson', {
        p_lesson_id: lesson.id,
        p_position: Number(fd.get('position')),
        p_title: fd.get('title'),
        p_body_html: fd.get('body_html') || '',
        p_quiz: quiz,
        p_project: fd.get('project') || null
      });

      if(error){
        status.textContent = '❌ لم يتم الحفظ: ' + error.message;
        form.querySelector('button[type="submit"]').disabled = false;
        return;
      }

      status.textContent = '✅ تم حفظ التعديلات بنجاح';
      setTimeout(() => {
        close();
        loadLessons(courseId);
      }, 500);
    });
  }

    } catch(err) {
      console.error('Lesson editor error:', err);
      alert('تعذر فتح محرر الدرس: ' + (err?.message || err));
    }
  }

  function closeWorkspace(){
    activeCourse = null;
    const panel = $('courseWorkspace');
    if(panel){
      panel.hidden = true;
      panel.innerHTML = '';
    }
    document.getElementById('courses')?.scrollIntoView({behavior:'smooth'});
  }

  window.openNativeLessonEditor = openNativeLessonEditor;
  window.openNativeCourseWorkspace = renderWorkspace;
  window.closeNativeCourseWorkspace = closeWorkspace;
})();