(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const client = window.supabaseClient || window.supabase || null;
  let activeCourse = null;

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
    $('coursePreviewBtn')?.addEventListener('click', () => alert('المعاينة ستُفعّل في المرحلة التالية بعد بناء صفحة عرض الدرس.'));

    loadLessons(course.id);
    window.scrollTo({top: panel.offsetTop - 20, behavior:'smooth'});
  }

  async function loadLessons(courseId){
    const out = $('workspaceLessons');
    const count = $('workspaceLessonCount');
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
          ${lesson.status === 'draft' ? '<button class="small-btn" data-publish-lesson="'+lesson.id+'">نشر</button>' : ''}
        </div>
      </article>
    `).join('');

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
    if(!client) return;
    const {error} = await client.rpc(fn, {p_course_id:id});
    if(error){ alert(error.message); return; }
    const event = new CustomEvent('native-course-workspace-changed');
    window.dispatchEvent(event);
    closeWorkspace();
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

  window.openNativeCourseWorkspace = renderWorkspace;
  window.closeNativeCourseWorkspace = closeWorkspace;
})();