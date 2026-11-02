/**
 * Minimal renderer for the markdown-ish markers the toolbar inserts
 * (**bold**, _italic_, <u>underline</u>, ~~strike~~, ## heading, -/1.
 * lists). Deliberately not a general markdown parser — the CRDT stores
 * plain text, and this only needs to understand what Toolbar.tsx can
 * produce. All text is HTML-escaped before any marker is recognized,
 * so arbitrary user input (including literal "<script>") can never
 * reach innerHTML as a real tag — only the exact marker patterns below do.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(escapedLine: string): string {
  let out = escapedLine;
  out = out.replace(/&lt;u&gt;(.+?)&lt;\/u&gt;/g, '<u>$1</u>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/~~(.+?)~~/g, '<del>$1</del>');
  out = out.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');
  return out;
}

export function renderMarkup(text: string): string {
  const lines = text.split('\n');
  const html: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { html.push('</ul>'); inUl = false; }
    if (inOl) { html.push('</ol>'); inOl = false; }
  };

  for (const rawLine of lines) {
    const escaped = escapeHtml(rawLine);
    const heading = escaped.match(/^##\s+(.*)$/);
    const bullet = escaped.match(/^-\s+(.*)$/);
    const numbered = escaped.match(/^\d+\.\s+(.*)$/);

    if (heading) {
      closeLists();
      html.push(`<h2>${renderInline(heading[1])}</h2>`);
    } else if (bullet) {
      if (!inUl) { closeLists(); html.push('<ul>'); inUl = true; }
      html.push(`<li>${renderInline(bullet[1])}</li>`);
    } else if (numbered) {
      if (!inOl) { closeLists(); html.push('<ol>'); inOl = true; }
      html.push(`<li>${renderInline(numbered[1])}</li>`);
    } else {
      closeLists();
      html.push(escaped.trim() === '' ? '<p>&nbsp;</p>' : `<p>${renderInline(escaped)}</p>`);
    }
  }
  closeLists();
  return html.join('\n');
}
