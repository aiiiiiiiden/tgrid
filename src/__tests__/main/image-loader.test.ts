import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Must mock before importing the module
vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

import { expandTilde, loadImage } from '../../main/image-loader';

describe('expandTilde', () => {
  it('expands ~ to home directory', () => {
    const result = expandTilde('~/test/path');
    expect(result).toBe(path.join(os.homedir(), 'test/path'));
  });

  it('expands ~/file.png', () => {
    const result = expandTilde('~/.tgrid/characters/img.png');
    expect(result).toBe(path.join(os.homedir(), '.tgrid/characters/img.png'));
  });

  it('returns absolute paths unchanged', () => {
    expect(expandTilde('/usr/bin/test')).toBe('/usr/bin/test');
  });

  it('returns empty string unchanged', () => {
    expect(expandTilde('')).toBe('');
  });
});

describe('loadImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for non-existent file', async () => {
    vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
    expect(await loadImage('/no/such/file.png')).toBeNull();
  });

  it('returns data URL for PNG', async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('fakepng'));
    const result = await loadImage('/test/image.png');
    expect(result).toBe(`data:image/png;base64,${Buffer.from('fakepng').toString('base64')}`);
  });

  it('returns correct MIME for jpg', async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('fakejpg'));
    const result = await loadImage('/test/image.jpg');
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('returns correct MIME for webp', async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('fakewebp'));
    const result = await loadImage('/test/image.webp');
    expect(result).toMatch(/^data:image\/webp;base64,/);
  });

  it('defaults to image/png for unknown extension', async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('data'));
    const result = await loadImage('/test/image.bmp');
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('expands tilde paths', async () => {
    const readSpy = vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('data'));
    await loadImage('~/.tgrid/characters/test.png');
    expect(readSpy).toHaveBeenCalledWith(path.join(os.homedir(), '.tgrid/characters/test.png'));
  });
});
