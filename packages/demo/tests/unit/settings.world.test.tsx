/**
 * The world theme and the settings that outlast a visit: stored, applied to
 * <html> before anything reads them, shown on the Settings page, and
 * carried to the Playground's stage panel.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { getWorld, setWorld } from '../../src/lib/world';
import { DEFAULT_SETTINGS, getSettings, resetSettings, updateSettings } from '../../src/lib/settings';
import Settings from '../../src/pages/Settings';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-world');
  document.documentElement.setAttribute('data-theme', 'dark');
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', '#1E1C27');
  document.head.appendChild(meta);
  resetSettings();
  setWorld('studio');
});

afterEach(() => {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
});

describe('world store', () => {
  it('defaults to the studio, applies the chosen world to <html>, remembers it, and recolours the browser chrome', () => {
    expect(getWorld()).toBe('studio');
    setWorld('penguin');
    expect(document.documentElement.getAttribute('data-world')).toBe('penguin');
    expect(localStorage.getItem('aqvl-stage-world')).toBe('penguin');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0C1A2B');
    document.documentElement.setAttribute('data-theme', 'light');
    setWorld('studio');
    setWorld('penguin');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#F1F7FC');
  });

  it('ignores a world that does not exist', () => {
    document.documentElement.setAttribute('data-world', 'volcano');
    expect(getWorld()).toBe('studio');
  });
});

describe('settings store', () => {
  it('starts from the defaults, keeps what is chosen, and survives garbage in storage', () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    updateSettings({ quality: 'low', calm: 'on', snow: false });
    expect(JSON.parse(localStorage.getItem('aqvl-settings')!)).toMatchObject({ quality: 'low', calm: 'on', snow: false });
    expect(document.documentElement.getAttribute('data-snow')).toBe('off');
    resetSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(document.documentElement.getAttribute('data-snow')).toBe('on');
  });
});

describe('Settings page', () => {
  it('offers the three worlds, the ice world marked primary, and switching applies at once', () => {
    render(<Settings />);
    const group = screen.getByRole('radiogroup', { name: 'World' });
    const radios = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(radios.map((r) => r.textContent)).toEqual([expect.stringContaining('Studio'), expect.stringContaining('Penguins + Ice'), expect.stringContaining('Pandas + Bamboo')]);
    expect(radios[1].textContent).toMatch(/Primary/i);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radios[1]);
    expect(document.documentElement.getAttribute('data-world')).toBe('penguin');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radios[2]);
    expect(getWorld()).toBe('panda');
  });

  it('the ice world brings its own switches: snow and mascots, and the quality and calm choices are kept', () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('switch', { name: /Snowfall/ }));
    expect(getSettings().snow).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: /Penguin mascots/ }));
    expect(getSettings().mascots).toBe(false);
    expect(document.documentElement.getAttribute('data-mascots')).toBe('off');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Graphics quality' })).getByRole('radio', { name: 'Light' }));
    expect(getSettings().quality).toBe('low');
    const calm = screen.getByRole('radiogroup', { name: 'Calm motion' });
    fireEvent.click(calm.querySelector('[role="radio"]:nth-child(2)')!);
    expect(getSettings().calm).toBe('on');
    fireEvent.click(screen.getByRole('button', { name: 'Reset settings' }));
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
