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

  it('returns null for non-existent file', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(loadImage('/no/such/file.png')).toBeNull();
  });

  it('returns data URL for PNG', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fakepng'));
    const result = loadImage('/test/image.png');
    expect(result).toBe(`data:image/png;base64,${Buffer.from('fakepng').toString('base64')}`);
  });

  it('returns correct MIME for jpg', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fakejpg'));
    const result = loadImage('/test/image.jpg');
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('returns correct MIME for webp', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fakewebp'));
    const result = loadImage('/test/image.webp');
    expect(result).toMatch(/^data:image\/webp;base64,/);
  });

  it('defaults to image/png for unknown extension', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('data'));
    const result = loadImage('/test/image.bmp');
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('expands tilde paths', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('data'));
    loadImage('~/.tgrid/characters/test.png');
    expect(existsSpy).toHaveBeenCalledWith(path.join(os.homedir(), '.tgrid/characters/test.png'));
  });
});
