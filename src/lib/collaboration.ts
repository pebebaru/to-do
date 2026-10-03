import type { Task } from "./engine";
export type TeamGroup = { id: string; name: string; members: string[] };
export type Comment = { id: string; author: string; text: string; at: string };
export type SharedTask = {
  id: string;
  owner_id: string;
  viewers: string[];
  assignee: string | null;
  assignment_status: "unassigned" | "pending" | "accepted" | "declined";
  payload: Task;
  comments: Comment[];
  handoff: string;
  due_request: { author: string; date: string; reason: string } | null;
  version: number;
  updated_at: string;
};
export function participant(
  task: Pick<SharedTask, "owner_id" | "viewers">,
  user: string,
) {
  return task.owner_id === user || task.viewers.includes(user);
}
export function canManage(
  task: Pick<SharedTask, "owner_id" | "assignee" | "assignment_status">,
  user: string,
) {
  return (
    task.owner_id === user ||
    (task.assignee === user && task.assignment_status === "accepted")
  );
}
