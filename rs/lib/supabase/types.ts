export interface ResearchProject {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface ResearchFile {
  id: string;
  project_id: string;
  owner_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  preview_json: { columns?: string[]; rows?: unknown[][]; sheet?: string } | null;
  import_status: "confirmed" | "processing" | "failed";
  created_at: string;
}

export interface FileDraft {
  file: File;
  kind: "pdf" | "image" | "spreadsheet";
  objectUrl?: string;
  sheet?: string;
  columns: string[];
  rows: unknown[][];
}
