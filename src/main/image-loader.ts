import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { dialog, type BrowserWindow } from 'electron';
import { CONFIG_DIR } from './config';

export function expandTilde(p: string): string {
  if (p && p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export async function loadImage(imagePath: string): Promise<string | null> {
  const resolved = expandTilde(imagePath);
  try {
    const data = await fs.promises.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME_MAP[ext] || 'image/png';
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function pickImage(mainWindow: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Character Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const src = result.filePaths[0];
  const ext = path.extname(src);
  const destName = `${Date.now()}${ext}`;
  const charDir = path.join(CONFIG_DIR, 'characters');
  const dest = path.join(charDir, destName);

  await fs.promises.mkdir(charDir, { recursive: true });
  await fs.promises.copyFile(src, dest);

  return `~/.tgrid/characters/${destName}`;
}
