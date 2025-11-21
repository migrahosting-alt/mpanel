export type Actor = {
  userId: string;
  roles: string[];
  scopes: string[];
};

export type ToolCall = {
  name: "dns_list_records" | "user_get_summary" | "backups_list";
  input: Record<string, any>;
  actor?: Actor;
};
