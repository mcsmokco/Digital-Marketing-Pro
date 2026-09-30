# Admin setup — Digital Marketing Pro

## نظام الصلاحيات الحالي

المرجع الأساسي للصلاحيات هو `public.profiles.role` في Supabase:

- `user` → مستخدم عادي
- `moderateur` → صلاحيات إشراف
- `administrateur` → إدارة الرتب الأدنى
- `co_admin` → إدارة الرتب الأدنى
- `admin` → إدارة الرتب الأدنى
- `owner` → المؤسس، محمي ولا يمكن تغييره أو حذفه من لوحة الإدارة

وحالة Premium محفوظة في `public.profiles.premium`.

## التفعيل الآمن

نفّذ ملف `supabase/admin_users.sql` في Supabase SQL Editor مرة واحدة. الملف هو المرجع الوحيد الحالي لنظام RBAC، وينشئ:

- جدول `profiles` وRLS.
- `current_profile_role()` للتحقق من الرتبة من قاعدة البيانات.
- `admin_update_user(...)` لتغيير الرتبة وPremium مع تحقق هرمي.
- `admin_remove_user(...)` لحذف الحسابات الأدنى مع حماية Owner.
- Trigger لإنشاء `profiles` تلقائياً عند إنشاء حساب جديد.

لا يحتاج الموقع إلى `service_role` key.

**مهم جداً:** لا تضع أبداً `service_role` أو أي Secret key في GitHub Pages أو JavaScript داخل المتصفح.

## Keep Alive

Workflow الوحيد المخصص لذلك هو:

`.github/workflows/supabase-keep-alive.yml`

ويعمل تلقائياً كل 12 ساعة، مع تشغيل يدوي عبر `workflow_dispatch`. يستعمل `SUPABASE_URL` و`SUPABASE_ANON_KEY` من GitHub Repository Secrets.

## الاختبار بعد تطبيق SQL

1. سجّل الدخول بحساب Owner.
2. افتح الموقع وتأكد من ظهور **🛡️ الإدارة**.
3. افتح `/admin.html` وتأكد من ظهور المستخدمين.
4. جرّب تغيير Premium لمستخدم عادي.
5. جرّب ترقية مستخدم إلى رتبة أقل من رتبتك فقط.
6. تأكد أن Owner لا يمكن تغييره أو حذفه.
7. سجّل الدخول بحساب عادي وافتح `/admin.html` مباشرة؛ يجب أن تظهر **غير مصرح**.
8. أنشئ حساباً جديداً؛ يجب إنشاء profile له تلقائياً بدور `user`.
9. اختبر تسجيل الخروج ثم تسجيل الدخول من جديد بدون الحاجة إلى Refresh.
10. من GitHub Actions شغّل Keep Alive يدوياً وتأكد من نجاحه.
