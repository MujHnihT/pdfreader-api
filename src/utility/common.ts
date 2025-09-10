const API_KEY = process.env.GOOGLE_API_KEY || '';
const ROOT_FOLDER_ID = process.env.ROOT_FOLDER_ID || '';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}


async function listFolderInDrive( ): Promise<string> {
 const q= `'${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
 const fields=  "files(id,name,modifiedTime),nextPageToken";
  const params = new URLSearchParams({
    q : q,
    fields: fields,
    orderBy: "name_natural",
    pageSize: String(100),
    key: API_KEY,
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);


  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}




export { toSlug, listFolderInDrive };