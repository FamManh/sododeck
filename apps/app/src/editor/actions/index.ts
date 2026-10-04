import { ALIGN_ACTIONS } from './align-actions';
import { ARRANGE_ACTIONS } from './arrange-actions';
import { CANVAS_ACTIONS } from './canvas-actions';
import { CLIPBOARD_ACTIONS } from './clipboard-actions';
import { COMMON_ACTIONS } from './common-actions';
import { CONNECTION_ACTIONS, SPREAD_ENDS_ACTION } from './connection-actions';
import { FIELD_ACTIONS } from './field-actions';
import { GROUP_ACTIONS } from './group-actions';
import { RELATIONSHIP_ACTIONS } from './relationship-actions';
import { SHAPE_ACTIONS } from './shape-actions';
import { SHAPE_FORM_ACTIONS } from './shape-form-actions';
import { STYLE_ACTIONS } from './style-actions';
import { TABLE_ACTIONS } from './table-actions';
import { TABLE_DETAIL_ACTIONS } from './table-detail-actions';
import { TITLE_ACTIONS } from './title-actions';
import type { Action } from './types';

/**
 * Every canvas action (019 R1, ADR 0015), in the order menus and the toolbar show them within a
 * section. A later feature adds its module here (016 clipboard / group / align, 017 reset route,
 * 020 fill / stroke); the menu, the toolbar and the keys pick it up unchanged (FR-040).
 */
export const ACTIONS: readonly Action[] = [
  ...TITLE_ACTIONS,
  ...CONNECTION_ACTIONS,
  ...RELATIONSHIP_ACTIONS,
  ...GROUP_ACTIONS,
  ...SHAPE_ACTIONS,
  ...SHAPE_FORM_ACTIONS,
  ...TABLE_DETAIL_ACTIONS,
  ...TABLE_ACTIONS,
  ...FIELD_ACTIONS,
  ...STYLE_ACTIONS,
  ...CANVAS_ACTIONS,
  ...CLIPBOARD_ACTIONS,
  ...COMMON_ACTIONS,
  ...ALIGN_ACTIONS,
  ...ARRANGE_ACTIONS,
  SPREAD_ENDS_ACTION,
];
