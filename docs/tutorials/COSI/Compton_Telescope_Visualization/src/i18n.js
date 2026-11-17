import { entries } from './translations.js';

export function installLanguageSwitch() {
  let language = 'zh';
  try { if (localStorage.getItem('compton-language') === 'en') language = 'en'; } catch {}
  const dictionary = [...entries].sort((a, b) => b[0].length - a[0].length);
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const button = document.createElement('button');
  button.id = 'language-toggle';
  button.type = 'button';
  button.className = 'ghost-button language-button';
  document.querySelector('.top-actions').prepend(button);
  const translate = (source) => {
    const exact = dictionary.find(([zh]) => zh === source.trim());
    if (exact) return source.replace(source.trim(), exact[1]);
    let result = source;
    for (const [zh, en] of dictionary) result = result.split(zh).join(en);
    return result;
  };
  function visit(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.closest('script,style,noscript,#language-toggle')) return;
      let entry = originals.get(root);
      if (!entry || root.data !== entry.rendered) entry = { source: root.data, rendered: root.data };
      const value = language === 'en' ? translate(entry.source) : entry.source;
      entry.rendered = value;
      originals.set(root, entry);
      if (root.data !== value) root.data = value;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || root.matches('script,style,noscript,#language-toggle')) return;
    for (const name of ['title', 'aria-label', 'placeholder']) {
      if (!root.hasAttribute(name)) continue;
      let map = attributes.get(root);
      if (!map) { map = {}; attributes.set(root, map); }
      const current = root.getAttribute(name);
      let entry = map[name];
      if (!entry || current !== entry.rendered) entry = { source: current };
      const value = language === 'en' ? translate(entry.source) : entry.source;
      entry.rendered = value;
      map[name] = entry;
      if (current !== value) root.setAttribute(name, value);
    }
    for (const child of root.childNodes) visit(child);
  }
  function refresh() {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    button.textContent = language === 'en' ? '中文' : 'English';
    button.setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : '切换为英文');
    visit(document.head);
    visit(document.body);
  }
  button.addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem('compton-language', language); } catch {}
    refresh();
  });
  new MutationObserver(records => {
    // Only touch changed display nodes. No physics, controls, DOM containers,
    // event handlers or WebGL objects are replaced during language changes.
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) visit(node);
      else visit(record.target);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
  refresh();
}
