// Shared by the PRD API and the browser. The whole upload (file + text) must
// stay under Vercel's 4.5 MB request limit.
export const PRD_MAX_FILE_BYTES = 3.5 * 1024 * 1024;
export const PRD_MAX_TEXT_CHARS = 200_000;
