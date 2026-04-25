import { invoke } from "@tauri-apps/api/tauri";

export interface FileMetadata {
  size: number;
  is_dir: boolean;
  is_file: boolean;
  modified: number | null;
  created: number | null;
}

export async function getFileMetadata(path: string): Promise<FileMetadata> {
  return await invoke<FileMetadata>("get_file_metadata", { path });
}
