// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const luminance = (hex: string) => {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (foreground: string, background: string) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

describe('acessibilidade estrutural e contraste', () => {
  it.each([
    ['texto principal', '#1f2937', '#f6f7f3'],
    ['texto secundário', '#64748b', '#ffffff'],
    ['botão primário', '#ffffff', '#0f766e'],
    ['texto primário suave', '#115e59', '#e7f4f1'],
  ])('%s atende WCAG AA para texto normal', (_label, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('mantém foco visível, contenção horizontal e áreas seguras no mobile', async () => {
    const [css, app, navbar] = await Promise.all([
      readFile('src/index.css', 'utf8'),
      readFile('src/App.tsx', 'utf8'),
      readFile('src/components/Navbar.tsx', 'utf8'),
    ]);
    expect(css).toContain(':focus-visible');
    expect(css).toContain('@media (pointer: coarse)');
    expect(app).toContain('overflow-x-hidden');
    expect(navbar).toContain('env(safe-area-inset-bottom');
    expect(navbar).toContain('min-h-[48px]');
  });
});
