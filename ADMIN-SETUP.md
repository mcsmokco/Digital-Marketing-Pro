# Admin setup — Digital Marketing Pro

## نظام الصلاحيات الحالي

المرجع التنفيذي الوحيد لنظام RBAC وRLS هو:

`supabase/migrations/20261001_rbac_security_consolidation.sql`

الترتيب الرسمي:

- `user` → 0
- `moderateur` → 1
- `administrateur` → 2
- `co_admin` → 3
- `admin` → 4
- `owner` → 5

قاعدة الإدارة: الحساب الإداري لا يقرأ أو يدير رتبة مساوية أو أعلى منه. Owner محمي.

Premium محفوظ في `public.profiles.premium`.

## مهم قبل التنفيذ

لا تشغّل ملفات SQL القديمة بشكل عشوائي، خصوصاً:

- `supabase-auto-profile-sync.sql`
- `supabase-profile-admin.sql`
- `supabase-member-removal.sql`
- أي نسخة قديمة من RBAC خارج `supabase/migrations/`

هذه الملفات أصبحت مرجعاً تاريخياً فقط لتجنب إنشاء Functions/Triggers/RLS مكررة.

## التفعيل الآمن

طبّق migrations بالترتيب الموجود داخل `supabase/migrations/`. بعد ذلك طبّق فقط الـ migration الجديدة:

`20261001_rbac_security_consolidation.sql`

لا يحتاج الموقع إلى `service_role` key داخل المتصفح.

**ممنوع نهائياً وضع `service_role` أو أي Secret key في GitHub Pages أو JavaScript.**

## ما الذي تضمنه migration الجديدة؟

- Trigger واحد فقط لإنشاء profile بعد إنشاء Auth user.
- `role_level()` و`current_profile_role()` كمصدر موحد للـRBAC.
- قراءة المستخدم لبروفايله فقط.
- الإدارة تقرأ الرتب الأدنى فقط.
- Owner personal metadata مخفية عن الرتب الأخرى.
- المستخدم لا يستطيع رفع `role` أو `premium` لنفسه.
- تغيير الرتب وPremium عبر `admin_update_user()` فقط.
- حذف الحسابات عبر `admin_remove_user()` فقط.
- `admin_list_profiles()` لا يرجع نفس/أعلى رتبة.
- Username unique case-insensitive.
- حفظ بيانات الجهاز وآخر دخول عبر صلاحيات الحساب نفسه.

## الاختبار بعد تطبيق migration

1. Owner يرى الإدارة.
2. Admin يرى فقط الرتب الأدنى منه.
3. Co Admin يرى فقط الرتب الأدنى منه.
4. Administrateur يرى فقط الرتب الأدنى منه.
5. Moderateur يرى فقط `user`.
6. User لا يرى profiles الآخرين.
7. لا أحد يستطيع تغيير أو حذف Owner.
8. لا أحد يستطيع إعطاء رتبة مساوية أو أعلى من رتبته.
9. المستخدم لا يستطيع تعديل `role` أو `premium` لنفسه.
10. إنشاء Auth user ينشئ profile واحداً فقط.
11. Username المكرر يرفض.
12. معلومات Owner الشخصية تبقى مخفية عن الرتب الأخرى.

## Keep Alive

Workflow:

`.github/workflows/supabase-keep-alive.yml`

يعمل دورياً ويستخدم Secrets الخاصة بـGitHub Actions فقط.