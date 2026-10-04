export type Role = "user" | "admin" | "super_admin";
export const isRole = (role: unknown): role is Role =>
  role === "user" || role === "admin" || role === "super_admin";
export const isAdmin = (role: Role) => role === "admin" || role === "super_admin";
export const canAssignRole = (actor: Role, role: Role) =>
  actor === "super_admin" || (actor === "admin" && role === "user");
export const canManageMember = (actor: Role, target: Role) =>
  actor === "super_admin" || (actor === "admin" && target === "user");
export function bankSeconds(task: { seconds?: number; runningSince?: number | null }, now = Date.now()) {
  return Math.max(0, Number(task.seconds) || 0) + (task.runningSince ? Math.max(0, Math.floor((now - task.runningSince) / 1000)) : 0);
}
