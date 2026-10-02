// Digital Marketing Pro — hierarchical authorization helpers.
// These helpers are UI convenience only. Sensitive permissions are enforced by Supabase RLS/RPC.
window.DMP_ROLES = Object.freeze({user:0,moderateur:1,administrateur:2,co_admin:3,admin:4,owner:5});
window.DMP_ROLE_LABELS = Object.freeze({user:'User',moderateur:'Modérateur',administrateur:'Administrateur',co_admin:'Co Admin',admin:'Admin',owner:'Owner / Founder'});
window.DMP_ROLE_ICONS = Object.freeze({user:'👤',moderateur:'🔧',administrateur:'🛡️',co_admin:'💎',admin:'👑',owner:'👑'});
window.DMP_NORMALIZE_ROLE=function(role){const legacy={administrator:'administrateur',moderator:'moderateur',super_admin:'owner'};const normalized=legacy[role]||role;return window.DMP_ROLES[normalized]!==undefined?normalized:'user'};
window.DMP_GET_ROLE=function(userOrProfile){return window.DMP_NORMALIZE_ROLE(userOrProfile?.role??userOrProfile?.app_metadata?.role)};
window.DMP_ROLE_LEVEL=function(role){return window.DMP_ROLES[window.DMP_NORMALIZE_ROLE(role)]??0};
window.DMP_HAS_ADMIN_ROLE=function(userOrProfile){return window.DMP_ROLE_LEVEL(window.DMP_GET_ROLE(userOrProfile))>=2};
window.DMP_HAS_MANAGEMENT_ROLE=function(userOrProfile){return window.DMP_ROLE_LEVEL(window.DMP_GET_ROLE(userOrProfile))>=2};
window.DMP_HAS_PREMIUM_ACCESS=function(userOrProfile){const role=window.DMP_GET_ROLE(userOrProfile);return window.DMP_ROLE_LEVEL(role)>=1||userOrProfile?.premium===true};
window.DMP_CAN_MANAGE_ROLE=function(actorRole,targetRole){const actor=window.DMP_ROLE_LEVEL(actorRole),target=window.DMP_ROLE_LEVEL(targetRole);return actor>=2&&target<actor};
window.DMP_ASSIGNABLE_ROLES=function(actorRole){const actor=window.DMP_ROLE_LEVEL(actorRole);if(actor<2)return [];return Object.keys(window.DMP_ROLES).filter(role=>window.DMP_ROLES[role]<actor)};
(function(){if(document.querySelector('script[data-dmp-remember]'))return;const s=document.createElement('script');s.src='remember-me.js?v=20261002-2';s.dataset.dmpRemember='1';s.defer=true;document.head.appendChild(s)})();
