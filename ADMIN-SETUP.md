# Admin setup — Digital Marketing Pro

## نظام الصلاحيات الحالي

المرجع الأساسي للصلاحيات هو `public.profiles.role` في Supabase:

- `user` → مستخدم عادي
- `moderateur` → صلاحيات مراقبة أساسية
- `administrateur` → إدارة المستخدمين الأدنى
- `co_admin` → إدارة الرتب الأدنى
- `admin` → إدارة الرتب الأدنى
- `owner` → المؤسس، محمي ولا يمكن تغييره من لوحة الإدارة

و`public.profiles.premium = true` هو المرجع لحالة Premium.

## التفعيل الآمن

نفّذ ملف `supabase-profile-admin.sql` في Supabase SQL Editor مرة واحدة. هذا الملف ينشئ RLS المناسب وRPC باسم `admin_update_user`، لذلك لا يحتاج الموقع إلى `service_role` key.

**مهم:** لا تضع أبداً `service_role` key في GitHub Pages أو JavaScript داخل المتصفح.

## الاختبار

1. سجّل الدخول بحساب الـ Owner.
2. افتح الموقع؛ سيظهر رابط **🛡️ الإدارة** في القائمة.
3. افتح لوحة الإدارة وتأكد أن المستخدمين يظهرون وأن تغيير `role` و`premium` يعمل.
4. سجّل الدخول بحساب عادي وافتح `/admin.html` مباشرة؛ يجب أن تظهر رسالة **غير مصرح**.
5. اجعل حساباً عادياً `premium = true` من لوحة الإدارة؛ يجب أن تفتح الوحدات من 4 إلى 12.
6. اجعل `premium = false`؛ يجب أن تعود الوحدات المدفوعة إلى حالة القفل.
