// Shared by the edited-PDF API and the browser. Vercel allows 4.5 MB per
// request or response, so PDFs move in 3 MB chunks (up to 60 MB in total).
export const EDITED_PDF_CHUNK_BYTES = 3 * 1024 * 1024;
export const EDITED_PDF_MAX_CHUNKS = 20;
