export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
  created: number;
  extension: string;
}

export type FileType =
  | "folder"
  | "word"
  | "pdf"
  | "excel"
  | "ppt"
  | "image"
  | "other";

export const getFileType = (file: FileItem): FileType => {
  if (file.isDirectory) return "folder";

  const ext = file.extension.toLowerCase();
  if (["doc", "docx"].includes(ext)) return "word";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx"].includes(ext)) return "excel";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext))
    return "image";

  return "other";
};

export const getFileIcon = (file: FileItem): string => {
  const type = getFileType(file);

  const iconMap: Record<FileType, string> = {
    folder: "ri-folder-fill",
    word: "ri-file-word-fill",
    pdf: "ri-file-pdf-fill",
    excel: "ri-file-excel-fill",
    ppt: "ri-file-ppt-fill",
    image: "ri-image-fill",
    other: "ri-file-fill",
  };

  return iconMap[type];
};

export const getFileColor = (file: FileItem): string => {
  const type = getFileType(file);

  const colorMap: Record<FileType, string> = {
    folder: "text-yellow-500",
    word: "text-blue-500",
    pdf: "text-red-500",
    excel: "text-green-500",
    ppt: "text-orange-500",
    image: "text-purple-500",
    other: "text-gray-500",
  };

  return colorMap[type];
};
