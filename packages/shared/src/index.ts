/**
 * @file Main export entrypoint for @chatflow/shared.
 * 
 * [HINGLISH GUIDE]:
 * Yeh `@chatflow/shared` monorepo ka common package hai.
 * Frontend (`apps/mobile`) aur Backend (`apps/server`) dono is package se
 * TypeScript types, API response formats (`createSuccessResponse`, `createErrorResponse`),
 * aur socket events share karte hain.
 * Iska fayda yeh hai ki frontend aur backend ka data contract hamesha sync rehta hai!
 */

export * from './types/api';
export * from './types/user';
export * from './types/chat';
export * from './types/socket';
export * from './types/status';

