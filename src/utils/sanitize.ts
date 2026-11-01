import sanitizeHtml from 'sanitize-html';

/**
 * Sanitizes rich-text HTML notes to ensure safety against XSS attacks
 * while preserving formatting (bold, italic, lists, headings, links, paragraphs).
 */
export function sanitizeServiceNote(dirtyNote?: string | null): string | null {
    if (!dirtyNote || typeof dirtyNote !== 'string') {
        return null;
    }

    const trimmed = dirtyNote.trim();
    if (!trimmed) {
        return null;
    }

    return sanitizeHtml(trimmed, {
        allowedTags: [
            'p', 'b', 'i', 'em', 'strong', 'u', 's', 'strike',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'br', 'hr', 'blockquote',
            'a', 'span', 'div'
        ],
        allowedAttributes: {
            'a': ['href', 'target', 'rel'],
            'span': ['class', 'style'],
            'div': ['class', 'style'],
            'p': ['class', 'style'],
            'li': ['class', 'style'],
            '*': ['style']
        },
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        allowedSchemesAppliedToAttributes: ['href'],
        transformTags: {
            'a': (_tagName, attribs) => ({
                tagName: 'a',
                attribs: {
                    ...attribs,
                    target: '_blank',
                    rel: 'noopener noreferrer'
                }
            })
        }
    });
}
