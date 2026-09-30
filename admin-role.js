// Digital Marketing Pro — hierarchical admin roles
// UI checks are convenience only. Sensitive role changes are enforced by Supabase RPC/RLS.
window.DMP_ROLES = Object.freeze({
  user: 0,
  moderator: 1,
  administrator: 2,
  co_admin: 3,
  owner: 4
});

window.DMP_ROLE_LABELS = Object.freeze({
  user: 'User',
  moderator: 'Modérateur',
  administrator: 'Administrator',
  co_admin: 'Co Admin',
  owner: 'Owner / Founder'
});

window.DMP_ROLE_ICONS = Object.freeze({
  user: '👤',
  moderator: '🔧',
  administrator: '🛡️',
  co_admin: '💎',
  owner: '👑'
});

window.DMP_NORMALIZE_ROLE = function (role) {
  // Legacy values are migrated to the new hierarchy.
  if (role === 'admin' || role === 'super_admin') return 'owner';
  return window.DMP_ROLES[role] !== undefined ? role : 'user';
};

window.DMP_GET_ROLE = function (user) {
  return window.DMP_NORMALIZE_ROLE(user?.app_metadata?.role);
};

window.DMP_ROLE_LEVEL = function (role) {
  return window.DMP_ROLES[window.DMP_NORMALIZE_ROLE(role)] ?? 0;
};

window.DMP_HAS_ADMIN_ROLE = function (user) {
  return window.DMP_ROLE_LEVEL(window.DMP_GET_ROLE(user)) >= 2;
};

window.DMP_CAN_MANAGE_ROLE = function (actorRole, targetRole) {
  const actor = window.DMP_ROLE_LEVEL(actorRole);
  const target = window.DMP_ROLE_LEVEL(targetRole);
  // Owner can manage every lower role. Other management roles can only manage strictly lower roles.
  // Moderator intentionally has no role-management power.
  return actor >= 2 && target < actor;
};

window.DMP_ASSIGNABLE_ROLES = function (actorRole) {
  const actor = window.DMP_ROLE_LEVEL(actorRole);
  if (actor < 2) return [];
  return Object.keys(window.DMP_ROLES).filter(role => window.DMP_ROLES[role] < actor);
};
