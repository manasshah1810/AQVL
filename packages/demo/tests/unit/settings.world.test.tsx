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
  it('offers the four worlds as a dome to travel through; browsing previews, and moving in applies at once', () => {
    render(<Settings />);
    const group = screen.getByRole('radiogroup', { name: 'Choose a world to visit' });
    const orbs = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(orbs.map((r) => r.getAttribute('aria-label'))).toEqual(['Bamboo Grove', 'Aurora Ice Shelf', 'Cloud Kingdom', 'The Studio']);
    expect(orbs[3].getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: /You live in The Studio/ }).getAttribute('aria-disabled')).toBe('true');
    // Browsing only previews: the site stays where it is.
    fireEvent.click(orbs[1]);
    expect(getWorld()).toBe('studio');
    expect(orbs[1].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Move in to Aurora Ice Shelf/ }));
    expect(document.documentElement.getAttribute('data-world')).toBe('penguin');
    fireEvent.click(screen.getByRole('button', { name: 'Next world' }));
    expect(orbs[2].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Move in to Cloud Kingdom/ }));
    expect(getWorld()).toBe('rabbit');
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

describe('the panda world carries across the site', () => {
  it('shows panda-specific switches and the tab icon, and drops them again in the studio', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute('href', '/favicon.svg');
    document.head.appendChild(link);
    setWorld('panda');
    expect(link.getAttribute('href')).toMatch(/^data:image\/svg\+xml/);
    expect(document.documentElement.getAttribute('data-world')).toBe('panda');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#121C17');
    render(<Settings />);
    expect(screen.getByRole('switch', { name: /Falling leaves/ })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /Panda mascots/ })).toBeTruthy();
    setWorld('studio');
    expect(link.getAttribute('href')).toBe('/favicon.svg');
    link.remove();
  });
});
