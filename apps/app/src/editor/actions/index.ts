import type { Action } from './types';

/**
 * Every canvas action (019 R1, ADR 0015), in the order menus and the toolbar show them within a
 * section. A later feature adds its module here (016 clipboard / group / align, 017 reset route,
 * 020 fill / stroke); the menu, the toolbar and the keys pick it up unchanged (FR-040).
 */
export const ACTIONS: readonly Action[] = [];
