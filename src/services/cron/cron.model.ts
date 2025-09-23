interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

interface DriveResponse {
  files: DriveFile[];
}
export default DriveResponse;