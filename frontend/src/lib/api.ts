import type {
  ChatMessage,
  ChatResponse,
  Document,
  HealthStatus,
} from "../types";

/** Base URL of the backend, configurable via env. */
const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  "http://localhost:8000";

/** Friendly error type for API failures. Never leaks stack traces. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Map backend error payloads / network failures to friendly messages. */
function friendlyMessage(raw: unknown, fallback: string): string {
  if (typeof raw === "object" && raw !== null && "detail" in raw) {
    const detail = (raw as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | undefined;
      if (first?.msg) return String(first.msg);
    }
  }
  if (typeof raw === "string" && raw.trim().length > 0) return raw;
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("The request timed out. Please try again.", 408);
    }
    throw new ApiError(
      "Could not reach the server. Make sure the backend is running.",
      0,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let body: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  } else {
    body = await response.text().catch(() => "");
  }

  if (!response.ok) {
    const fallback =
      response.status === 404
        ? "The requested resource was not found."
        : response.status === 429
          ? "Too many requests. Please wait a moment and try again."
          : `Request failed (${response.status}).`;
    throw new ApiError(friendlyMessage(body, fallback), response.status);
  }
  return body as T;
}

/** Parse upload progress events (0–100). */
export interface UploadProgress {
  loaded: number;
  total: number;
}

function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress?: (p: UploadProgress) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    const timeout = setTimeout(() => {
      xhr.abort();
      reject(new ApiError("Upload timed out. Please try again.", 408));
    }, 300_000);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.({ loaded: event.loaded, total: event.total });
      }
    };
    xhr.onload = () => {
      clearTimeout(timeout);
      const contentType = xhr.getResponseHeader("content-type") ?? "";
      let body: unknown = null;
      try {
        body = contentType.includes("application/json")
          ? JSON.parse(xhr.responseText)
          : xhr.responseText;
      } catch {
        body = xhr.responseText;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
      } else {
        reject(new ApiError(friendlyMessage(body, `Upload failed (${xhr.status}).`), xhr.status));
      }
    };
    xhr.onerror = () => {
      clearTimeout(timeout);
      reject(
        new ApiError(
          "Could not reach the server. Make sure the backend is running.",
          0,
        ),
      );
    };
    xhr.send(formData);
  });
}

export interface UploadResult {
  id: string;
  original_filename: string;
  status: string;
  page_count: number;
}

export const api = {
  /** Upload a PDF file. Returns the new document record. */
  uploadDocument(file: File, onProgress?: (p: UploadProgress) => void) {
    const formData = new FormData();
    formData.append("file", file, file.name);
    return uploadWithProgress<UploadResult>("/api/documents/upload", formData, onProgress);
  },

  /** List all uploaded documents. Backend wraps the array as {documents, total}. */
  async listDocuments(): Promise<Document[]> {
    const data = await request<{ documents: Document[]; total: number }>(
      "/api/documents",
    );
    return data.documents;
  },

  /** Get a single document by id. */
  getDocument(id: string): Promise<Document> {
    return request<Document>(`/api/documents/${encodeURIComponent(id)}`);
  },

  /** Delete a document and its vectors/chunks. */
  deleteDocument(id: string): Promise<void> {
    return request<void>(`/api/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  /** Delete every document (used by the danger zone). */
  async deleteAllDocuments(): Promise<number> {
    const docs = await api.listDocuments();
    for (const doc of docs) {
      await api.deleteDocument(doc.id);
    }
    return docs.length;
  },

  /** Ask a question against selected documents. */
  chat(question: string, documentIds: string[]): Promise<ChatResponse> {
    return request<ChatResponse>("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, document_ids: documentIds }),
    });
  },

  /** Get chat history. Backend wraps the array as {messages, total}; we sort oldest-first. */
  async getChatHistory(limit = 50): Promise<ChatMessage[]> {
    const data = await request<{ messages: ChatMessage[]; total: number }>(
      `/api/chat/history?limit=${limit}`,
    );
    return [...data.messages].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  },

  /** Clear chat history. */
  clearChatHistory(): Promise<void> {
    return request<void>("/api/chat/history", { method: "DELETE" });
  },

  /** Backend health / model status. */
  health(): Promise<HealthStatus> {
    return request<HealthStatus>("/api/health");
  },
};

export { API_BASE };
