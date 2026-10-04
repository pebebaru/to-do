export const loginEmail = (username: string) =>
  `${username.trim().toLowerCase()}@accounts.todo.invalid`;
import type { Theme } from "./themes";
import type { Role } from "../../supabase/functions/_shared/permissions";
export { themes, resolveTheme, type Theme } from "./themes";
export {
  isAdmin,
  canManageMember,
  canAssignRole,
  type Role,
} from "../../supabase/functions/_shared/permissions";
export const roleLabel = (role: Role) =>
  role === "super_admin"
    ? "Superadmin"
    : role === "admin"
      ? "Admin"
      : "Normal User";
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  job_title: string;
  role: Role;
  theme: Theme;
  onboarded: boolean;
  enabled: boolean;
};
