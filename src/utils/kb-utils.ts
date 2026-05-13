/**
 * Knowledge Base utility functions
 * - Tiptap JSON text extraction (recursive)
 * - Reading time calculation
 * - Slug generation
 * - Lightweight Tiptap JSON → HTML renderer
 * - Category path/depth computation
 */

/**
 * Recursively extracts plain text from Tiptap JSON content.
 * Walks all nodes and concatenates text content from paragraphs,
 * headings, lists, code blocks, table cells, etc.
 */
export function extractTextFromTiptapJson(json: any): string {
  if (!json) return '';

  const texts: string[] = [];

  function walk(node: any) {
    if (!node) return;

    // Text node
    if (node.type === 'text' && node.text) {
      texts.push(node.text);
      return;
    }

    // Hard break
    if (node.type === 'hardBreak') {
      texts.push('\n');
      return;
    }

    // Block-level nodes that contain text
    const blockTypes = [
      'paragraph', 'heading', 'listItem', 'taskItem',
      'codeBlock', 'blockquote', 'tableCell', 'tableHeader'
    ];

    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
      // Add newline after block-level nodes
      if (blockTypes.includes(node.type)) {
        texts.push('\n');
      }
    }
  }

  // Handle both document-level and content-level JSON
  if (json.type === 'doc' && json.content) {
    for (const node of json.content) {
      walk(node);
    }
  } else if (Array.isArray(json)) {
    for (const node of json) {
      walk(node);
    }
  } else {
    walk(json);
  }

  return texts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Calculates estimated reading time in minutes.
 * Based on average reading speed of 200 words per minute.
 */
export function calculateReadingTime(text: string): number {
  if (!text) return 0;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Generates a URL-friendly slug from a title string.
 */
export function generateKbSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Escapes HTML special characters for safe rendering.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders inline marks (bold, italic, etc.) for a text node.
 */
function renderMarks(node: any): string {
  let text = escapeHtml(node.text || '');
  if (!node.marks) return text;

  for (const mark of node.marks) {
    switch (mark.type) {
      case 'bold':
        text = `<strong>${text}</strong>`;
        break;
      case 'italic':
        text = `<em>${text}</em>`;
        break;
      case 'underline':
        text = `<u>${text}</u>`;
        break;
      case 'strike':
        text = `<s>${text}</s>`;
        break;
      case 'code':
        text = `<code>${text}</code>`;
        break;
      case 'link':
        const href = escapeHtml(mark.attrs?.href || '#');
        const target = mark.attrs?.target || '_blank';
        text = `<a href="${href}" target="${target}" rel="noopener noreferrer">${text}</a>`;
        break;
      case 'highlight':
        text = `<mark>${text}</mark>`;
        break;
    }
  }
  return text;
}

/**
 * Lightweight Tiptap JSON → HTML renderer.
 * Handles built-in node types only (no custom extensions).
 */
export function renderTiptapToHtml(json: any): string {
  if (!json) return '';

  function renderNode(node: any): string {
    if (!node) return '';

    // Text node
    if (node.type === 'text') {
      return renderMarks(node);
    }

    // Hard break
    if (node.type === 'hardBreak') {
      return '<br />';
    }

    // Render children
    const children = (node.content || []).map(renderNode).join('');

    switch (node.type) {
      case 'doc':
        return children;

      case 'paragraph':
        const align = node.attrs?.textAlign;
        const pStyle = align ? ` style="text-align: ${align}"` : '';
        return `<p${pStyle}>${children}</p>`;

      case 'heading': {
        const level = node.attrs?.level || 1;
        const id = (children || '').replace(/<[^>]*>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return `<h${level} id="${id}">${children}</h${level}>`;
      }

      case 'bulletList':
        return `<ul>${children}</ul>`;

      case 'orderedList':
        return `<ol>${children}</ol>`;

      case 'listItem':
        return `<li>${children}</li>`;

      case 'taskList':
        return `<ul class="task-list">${children}</ul>`;

      case 'taskItem': {
        const checked = node.attrs?.checked ? ' checked' : '';
        return `<li class="task-item"><input type="checkbox"${checked} disabled />${children}</li>`;
      }

      case 'blockquote':
        return `<blockquote>${children}</blockquote>`;

      case 'codeBlock': {
        const lang = node.attrs?.language || '';
        return `<pre><code class="language-${lang}">${children}</code></pre>`;
      }

      case 'horizontalRule':
        return '<hr />';

      case 'image': {
        const src = escapeHtml(node.attrs?.src || '');
        const alt = escapeHtml(node.attrs?.alt || '');
        const title = node.attrs?.title ? ` title="${escapeHtml(node.attrs.title)}"` : '';
        return `<img src="${src}" alt="${alt}"${title} loading="lazy" />`;
      }

      case 'table':
        return `<table>${children}</table>`;

      case 'tableRow':
        return `<tr>${children}</tr>`;

      case 'tableHeader':
        return `<th>${children}</th>`;

      case 'tableCell':
        return `<td>${children}</td>`;

      case 'youtube': {
        const videoSrc = escapeHtml(node.attrs?.src || '');
        return `<div class="youtube-embed"><iframe src="${videoSrc}" frameborder="0" allowfullscreen></iframe></div>`;
      }

      default:
        return children;
    }
  }

  return renderNode(json);
}

/**
 * Computes the category path string and depth from parent chain.
 * Returns { path: "root/parent/child", depth: 2 }
 */
export async function computeCategoryPath(
  prisma: any,
  parentId: string | null,
  currentSlug: string
): Promise<{ path: string; depth: number }> {
  if (!parentId) {
    return { path: currentSlug, depth: 0 };
  }

  const pathParts: string[] = [];
  let currentParentId: string | null = parentId;
  let depth = 0;
  const maxDepth = 10; // Safety limit

  while (currentParentId && depth < maxDepth) {
    const parent: { slug: string; parentId: string | null } | null = await prisma.kbCategory.findUnique({
      where: { id: currentParentId },
      select: { slug: true, parentId: true },
    });

    if (!parent) break;

    pathParts.unshift(parent.slug);
    currentParentId = parent.parentId;
    depth++;
  }

  pathParts.push(currentSlug);
  return { path: pathParts.join('/'), depth };
}
