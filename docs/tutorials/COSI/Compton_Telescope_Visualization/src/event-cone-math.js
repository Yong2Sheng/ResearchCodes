/**
 * Explicit-only math typesetting for the event-cone page.
 *
 * The shared `math-typesetting.js` renderer walks arbitrary text nodes, which is
 * too aggressive for this bilingual UI. Here only elements marked with
 * `data-tex` are rendered, so physics notation inside prose keeps its existing
 * translation and accessibility behaviour.
 */
import { mathHTML } from './math-typesetting.js';

export function typesetEventMath(root = document) {
  const nodes = root.querySelectorAll('[data-tex]');
  let rendered = 0;
  for (const node of nodes) {
    const tex = node.dataset.tex;
    if (!tex || node.dataset.renderedTex === tex) continue;
    const displayMode = node.dataset.display === 'true';
    try {
      node.innerHTML = mathHTML(tex, displayMode);
      node.dataset.renderedTex = tex;
      node.classList.add('math-typeset');
      rendered += 1;
    } catch (error) {
      node.classList.add('math-error');
      console.error('KaTeX render error:', tex, error);
    }
  }
  return rendered;
}
