import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const DASHBOARD_ROOT = resolve(__dirname, '../..');
const SRC_ROOT = resolve(__dirname, '..');

describe('Story 1.1: Dashboard Scaffolding', () => {
  describe('AC #1: Vite dev server configuration', () => {
    it('should have vite.config.ts with correct server port', () => {
      const configPath = resolve(DASHBOARD_ROOT, 'vite.config.ts');
      expect(existsSync(configPath)).toBe(true);

      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain('port: 5173');
    });

    it('should have dev script in package.json', () => {
      const pkgPath = resolve(DASHBOARD_ROOT, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      expect(pkg.scripts.dev).toBe('vite');
    });

    it('should have dev:dashboard script in root package.json', () => {
      const rootPkgPath = resolve(DASHBOARD_ROOT, '..', 'package.json');
      const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
      expect(pkg.scripts['dev:dashboard']).toBe('npm run dev --prefix dashboard');
    });
  });

  describe('AC #2: Tailwind CSS with Binance-inspired dark theme', () => {
    it('should have Tailwind CSS v4 import in index.css', () => {
      const cssPath = resolve(SRC_ROOT, 'index.css');
      const content = readFileSync(cssPath, 'utf-8');
      expect(content).toContain('@import "tailwindcss"');
    });

    it('should have bg-primary color set to #0B0E11', () => {
      const cssPath = resolve(SRC_ROOT, 'index.css');
      const content = readFileSync(cssPath, 'utf-8');
      expect(content).toContain('--color-bg-primary: #0B0E11');
    });

    it('should have background set to #0B0E11', () => {
      const cssPath = resolve(SRC_ROOT, 'index.css');
      const content = readFileSync(cssPath, 'utf-8');
      expect(content).toContain('--background: #0B0E11');
    });

    it('should have @tailwindcss/vite plugin in vite.config.ts', () => {
      const configPath = resolve(DASHBOARD_ROOT, 'vite.config.ts');
      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain("import tailwindcss from '@tailwindcss/vite'");
      expect(content).toContain('tailwindcss()');
    });
  });

  describe('AC #3: shadcn/ui with new-york style', () => {
    it('should have components.json with new-york style', () => {
      const configPath = resolve(DASHBOARD_ROOT, 'components.json');
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.style).toBe('new-york');
    });

    it('should have correct component aliases', () => {
      const configPath = resolve(DASHBOARD_ROOT, 'components.json');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.aliases.components).toBe('@/components');
      expect(config.aliases.ui).toBe('@/components/ui');
    });
  });

  describe('AC #4: Base shadcn components available', () => {
    it('should have Button component', () => {
      const buttonPath = resolve(SRC_ROOT, 'components/ui/button.tsx');
      expect(existsSync(buttonPath)).toBe(true);
    });

    it('should have Card component', () => {
      const cardPath = resolve(SRC_ROOT, 'components/ui/card.tsx');
      expect(existsSync(cardPath)).toBe(true);
    });

    it('should have Badge component', () => {
      const badgePath = resolve(SRC_ROOT, 'components/ui/badge.tsx');
      expect(existsSync(badgePath)).toBe(true);
    });

    it('should have Toast component (Sonner)', () => {
      const toastPath = resolve(SRC_ROOT, 'components/ui/sonner.tsx');
      expect(existsSync(toastPath)).toBe(true);
    });
  });

  describe('AC #5: Directory structure matches Architecture spec', () => {
    const requiredDirs = [
      'components',
      'components/ui',
      'components/layout',
      'components/auth',
      'components/projects',
      'components/agents',
      'stores',
      'services',
      'hooks',
      'types',
      'pages',
      'utils',
    ];

    requiredDirs.forEach((dir) => {
      it(`should have ${dir}/ directory`, () => {
        const dirPath = resolve(SRC_ROOT, dir);
        expect(existsSync(dirPath)).toBe(true);
      });
    });
  });

  describe('Dependencies installed correctly', () => {
    it('should have correct dependencies in package.json', () => {
      const pkgPath = resolve(DASHBOARD_ROOT, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      expect(pkg.dependencies).toHaveProperty('react');
      expect(pkg.dependencies).toHaveProperty('react-dom');
      expect(pkg.dependencies).toHaveProperty('zustand');
      expect(pkg.dependencies).toHaveProperty('lucide-react');
      expect(pkg.dependencies).toHaveProperty('react-router-dom');
      expect(pkg.dependencies).toHaveProperty('tailwindcss');
    });
  });

  describe('TypeScript configuration', () => {
    it('should have strict mode enabled', () => {
      const tsconfigPath = resolve(DASHBOARD_ROOT, 'tsconfig.app.json');
      const content = readFileSync(tsconfigPath, 'utf-8');
      // Check the raw content since tsconfig can have comments
      expect(content).toContain('"strict": true');
    });

    it('should have path aliases configured', () => {
      const tsconfigPath = resolve(DASHBOARD_ROOT, 'tsconfig.app.json');
      const content = readFileSync(tsconfigPath, 'utf-8');
      expect(content).toContain('"@/*": ["./src/*"]');
    });
  });
});
