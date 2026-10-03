/* Digital Marketing Pro — native course management
 * Uses Supabase RPCs introduced by 20261003_learning_content.sql.
 * The existing hard-coded lessons remain untouched until the new store is populated.
 */
(function(){
  'use strict';
  const $ = (id) => document.getElementById(id);
  const supabaseClient = window.supabaseClient || window.supabase || null;
  let client = supabaseClient;

  async function getClient(){
    if(client && typeof client.from === 'function') return client;
    if(window.supabase && window.supabase.createClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY){
      client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      return client;
    }
    return null;
  }

  function renderShell(){
    const panel = $('courses');
    if(!panel || panel.dataset.nativeCoursesReady) return;
    panel.dataset.nativeCoursesReady='1';
    panel.innerHTML = `
      <div class="panel-head"><div><span class="eyebrow">COURSES</span><h2>إدارة الكورسات</h2><p class="section-note">المحتوى الأصلي يبقى داخل المنصة. هذه الطبقة الجديدة لا تحذف أو تستبدل الدروس الحالية.</p></div></div>
      <div class="courses-admin-grid">
        <form id="courseCreateForm" class="course-admin-card">
          <h3>➕ إنشاء كورس</h3>
          <label>العنوان<input name="title" required maxlength="120"></label>
          <label>Slug<input name="slug" required maxlength="120" pattern="[A-Za-z0-9_-]+"></label>
          <label>الوصف<textarea name="description" rows="3"></textarea></label>
          <div class="course-admin-row"><label>المستوى<select name="level"><option value="beginner">مبتدئ</option><option value="intermediate">متوسط</option><option value="advanced">متقدم</option></select></label><label>Premium<select name="premium"><option value="false">مجاني</option><option value="true">Premium</option></select></label></div>
          <button class="btn primary" type="submit">حفظ كمسودة</button>
          <div id="courseAdminStatus" class="muted" aria-live="polite"></div>
        </form>
        <div class="course-admin-card"><h3>🤖 نظام المحتوى</h3><p>الكورسات الجديدة ستكون محتوى أصلياً داخل Digital Marketing Pro، مع مسار: <b>Draft → Review → Published</b>.</p><p class="muted">التوليد الآلي نفسه سيضاف كمرحلة مستقلة حتى لا ننشر محتوى غير مُراجع أو نربط الموقع بمصدر خارجي.</p></div>
      </div>
      <div class="course-admin-card"><h3>📚 الكورسات الأصلية</h3><div id="nativeCoursesList" class="native-courses-list"><span class="muted">جاري التحميل...</span></div></div>`;
  }

  async function loadCourses(){
    const c = await getClient();
    const out = $('nativeCoursesList');
    if(!out) return;
    if(!c){ out.textContent='تعذر تهيئة Supabase.'; return; }
    const {data,error}=await c.rpc('admin_list_courses');
    if(error){ out.textContent='تعذر تحميل الكورسات: '+error.message; return; }
    if(!data.length){ out.textContent='لا توجد كورسات جديدة بعد.'; return; }
    out.innerHTML=data.map(course=>`<article class="native-course-row"><div><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.level)} · ${escapeHtml(course.status)} · ${course.is_premium?'💎 Premium':'🆓 Free'}</small></div><div><button class="small-btn" data-open-course="${course.id}">فتح الكورس</button>${course.status==='draft'?`<button class="small-btn" data-publish="${course.id}">نشر</button>`:''}${course.status!=='archived'?`<button class="small-btn" data-archive="${course.id}">أرشفة</button>`:''}</div></article>`).join('');
    out.querySelectorAll('[data-publish]').forEach(b=>b.onclick=()=>courseAction('admin_publish_course',b.dataset.publish));
    out.querySelectorAll('[data-open-course]').forEach(b=>b.onclick=()=>{ const course=data.find(x=>x.id===b.dataset.openCourse); if(course && window.openNativeCourseWorkspace) window.openNativeCourseWorkspace(course); });
    out.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>courseAction('admin_archive_course',b.dataset.publish || b.dataset.archive));
  }

  async function courseAction(fn,id){
    const c=await getClient(); if(!c) return;
    const {error}=await c.rpc(fn,{p_course_id:id});
    if(error){alert(error.message);return;}
    await loadCourses();
  }

  async function createCourse(e){
    e.preventDefault();
    const form=e.currentTarget, fd=new FormData(form), c=await getClient();
    const status=$('courseAdminStatus');
    if(!c){status.textContent='Supabase غير متاح.';return;}
    const {error}=await c.rpc('admin_create_course',{p_slug:fd.get('slug'),p_title:fd.get('title'),p_description:fd.get('description'),p_category:'digital-marketing',p_level:fd.get('level'),p_is_premium:fd.get('premium')==='true',p_content_source:'generated'});
    if(error){status.textContent='لم يتم الحفظ: '+error.message;return;}
    form.reset(); status.textContent='تم إنشاء المسودة ✓'; await loadCourses();
  }

  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  document.addEventListener('DOMContentLoaded',()=>{
    renderShell();
    $('courseCreateForm')?.addEventListener('submit',createCourse);
    loadCourses();
  });
})();
