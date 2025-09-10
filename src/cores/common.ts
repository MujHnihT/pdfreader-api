import fs from 'fs';

const chatDir = '/tmp/log';
export async function create(): Promise<void> {
  if (!fs.existsSync(chatDir)) {
    fs.mkdirSync(chatDir, { recursive: true });
  }
}
