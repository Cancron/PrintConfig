import { recordModel } from '../db/recordModel.js';
export const templateTypes = ['photo_collage', 'photo_book', 'calendar', 'card', 'poster', 'canvas', 'custom'] as const;
export const orientations = ['portrait', 'landscape', 'square', 'custom'] as const;
export const units = ['inch', 'mm', 'px'] as const;
export const elementTypes = ['photo_placeholder', 'text_placeholder', 'shape', 'background', 'clipart', 'static_image'] as const;

export const LayoutTemplateModel = recordModel('layout_templates');
