// ESLint (flat config) con las reglas de Next: core-web-vitals incluye react-hooks y accesibilidad básica.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', 'node_modules/**', '.cache/**', 'public/**', 'out/**'] },
  ...compat.extends('next/core-web-vitals'),
];
