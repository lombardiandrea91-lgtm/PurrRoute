import { definitions, graphics, uiNames, categoryNames } from './catalog.ts';
export { brand, themes, stateLabels } from './tokens.ts';
export type { Cat, Theme, PinState } from './tokens.ts';
export { uiNames, categoryNames };

export type GraphicId = keyof typeof graphics;
export type UiIcon = typeof uiNames[number];
export type PinCategory = typeof categoryNames[number];

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character] ?? character);
}

export function renderSvg(id: GraphicId, instanceId: string, label?: string): string {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(instanceId)) {
    throw new Error('Identificatore SVG non valido');
  }
  const graphic = graphics[id];
  const markup = `<defs>${definitions}</defs>${graphic.body}`
    .replace(/id="([^"]+)"/g, `id="${instanceId}-$1"`)
    .replace(/href="#([^"]+)"/g, `href="#${instanceId}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${instanceId}-$1)`);
  const accessibility = label
    ? `role="img" aria-label="${escapeXml(label)}"`
    : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${graphic.viewBox}" ${accessibility} focusable="false">${markup}</svg>`;
}

export function createSvg(id: GraphicId, instanceId: string, label?: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(renderSvg(id, instanceId, label), 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error('SVG non valido');
  return document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
}