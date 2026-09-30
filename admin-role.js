// Digital Marketing Pro — hierarchical admin roles
// Browser-side role checks control the UI only. Sensitive writes must be
// enforced server-side by Supabase RLS/RPC as well.
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
  owner: 'Owner'
});

window.DMP_NORMALIZE_ROLE = function (role) {
  // Keep the existing account working during migration.
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
  return window.DMP_ROLE_LEVEL(window.DMP_GET_ROLE(user)) >= 1;
};

window.DMP_CAN_MANAGE_ROLE = function (actorRole, targetRole) {
  const actor = window.DMP_ROLE_LEVEL(actorRole);
  const target = window.DMP_ROLE_LEVEL(targetRole);
  // Owner controls everything; everyone else can only manage strictly lower roles.
  return actor === 4 ? target < 4 : actor > target;
};

window.DMP_ASSIGNABLE_ROLES = function (actorRole) {
  const actor = window.DMP_ROLE_LEVEL(actorRole);
  return Object.keys(window.DMP_ROLES).filter(role => {
    const level = window.DMP_ROLES[role];
    return level < actor;
  });
};
