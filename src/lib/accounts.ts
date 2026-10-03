export const loginEmail = (username: string) =>
  `${username.trim().toLowerCase()}@accounts.todo.invalid`;
export const themes = {
  blue: "#4d8eff",
  mint: "#4edea3",
  violet: "#b6a0ff",
  amber: "#ffb95f",
  rose: "#ff8fb8",
} as const;
export type Theme = keyof typeof themes;
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  job_title: string;
  role: "user" | "super_admin";
  theme: Theme;
  onboarded: boolean;
  enabled: boolean;
};
