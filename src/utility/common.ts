import DriveResponse from "../services/cron/cron.model";

const API_KEY = process.env.GOOGLE_API_KEY || "";
// const ROOT_FOLDER_ID = process.env.DRIVE_FOLDER_ID || "";

type GoogleDriveFilesListResponse = {
  files?: Array<{ id?: string; name?: string; modifiedTime?: string }>;
  nextPageToken?: string;
};

type DriveFile = { id: string; name: string; modifiedTime: string };

/**
 * Fetch up to `limit` folders under ROOT_FOLDER_ID (default 1000).
 * Internally paginates using nextPageToken until done.
 */
async function listFolderInDrive(folderId : String, isFile : boolean): Promise<DriveResponse> {
  const limit = 1000;
  const folderType = "application/vnd.google-apps.folder";
  const fileType = "application/pdf";
  const mimeType = isFile ? fileType : folderType;
  const q = `'${folderId}' in parents and mimeType='${mimeType}' and trashed=false`;
  const fields = "nextPageToken,files(id,name,modifiedTime)";

  const all: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const pageSize = Math.min(1000, Math.max(1, limit - all.length)); // Drive API max pageSize is 1000
    const params = new URLSearchParams({
      q,
      fields,
      orderBy: "name_natural",
      pageSize: String(pageSize),
      key: API_KEY,
      // If you use Shared Drives, uncomment both lines below:
      // includeItemsFromAllDrives: "true",
      // supportsAllDrives: "true",
    });

    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as GoogleDriveFilesListResponse;

    all.push(
      ...(json.files ?? []).map((f) => ({
        id: f.id ?? "",
        name: f.name ?? "",
        modifiedTime: f.modifiedTime ?? "",
      }))
    );

    pageToken = json.nextPageToken || undefined;
  } while (pageToken && all.length < limit);

  return {
    files: all,
    // we consumed pagination internally; you can omit this or keep the final token
    nextPageToken: pageToken,
  } as DriveResponse;
}

export { listFolderInDrive };
