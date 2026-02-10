/**
 * DSW Feature Module
 * Main entry point for the DSW (Dean of Students' Welfare) feature
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Services
export { default as dswAPI } from './services/api';

// Hooks
export * from './hooks';

// Module metadata
export const DSW_MODULE = {
  name: 'DSW',
  version: '1.0.0',
  description: "Dean of Students' Welfare - Club Management System",
};
