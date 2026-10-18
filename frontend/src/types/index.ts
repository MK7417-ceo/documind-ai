export type DocumentStatus =
  | "uploading"
  | "extracting"
  | "chunking"
  | "embedding"
  | "indexing"
  | "ready"
  | "failed"
  | "needs_ocr";

export interface Document {
  id: string;
  original_filename: string;
  file_size: number;
  page_count: number;
  status: DocumentStatus;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface Source {
  filename: string;
  page: number;
  text: string;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  document_id?: string | null;
  sources?: Source[];
  created_at: string;
}

export interface HealthStatus {
  status: string;
  version: string;
  mock_mode: boolean;
  documents: number;
  detail?: string;
}
