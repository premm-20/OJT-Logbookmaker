import { ExtractedLogbook } from "./types";

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
}

/**
 * Validate that every extracted text fragment exists in the original input.
 * This prevents AI hallucination from making it into the final output.
 *
 * The check normalizes whitespace before comparing to handle minor
 * formatting differences, but the original text is preserved as-is.
 */
export function validateExtraction(
  originalText: string,
  extracted: ExtractedLogbook
): ValidationResult {
  const warnings: string[] = [];
  const normalizedOriginal = normalizeWhitespace(originalText);

  const categories: { key: keyof ExtractedLogbook; label: string }[] = [
    { key: "mySpace", label: "My Space" },
    { key: "tasksCarriedOutToday", label: "Tasks Carried Out Today" },
    { key: "keyLearningObservations", label: "Key Learning / Observations" },
    { key: "toolsTechnologyUsed", label: "Tools / Technology Used" },
    { key: "specialAchievements", label: "Special Achievements" },
  ];

  for (const { key, label } of categories) {
    const fragments = extracted[key];
    if (!Array.isArray(fragments)) continue;

    for (const fragment of fragments) {
      if (!fragment || typeof fragment !== "string") continue;

      const normalizedFragment = normalizeWhitespace(fragment.trim());
      if (!normalizedOriginal.includes(normalizedFragment)) {
        // Check if fragment is a subset of original by trying word-level match
        if (!fuzzyContains(normalizedOriginal, normalizedFragment)) {
          warnings.push(
            `"${truncate(fragment, 80)}" in "${label}" could not be found in your original text.`
          );
        }
      }
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Normalize whitespace: collapse multiple spaces/newlines into single spaces.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * A more lenient check: break the fragment into words and verify
 * that all words appear in the original in order.
 * This handles cases where bullet point markers or punctuation differ slightly.
 */
function fuzzyContains(original: string, fragment: string): boolean {
  const fragmentWords = fragment.split(/\s+/).filter(Boolean);
  if (fragmentWords.length === 0) return true;

  let searchPos = 0;
  for (const word of fragmentWords) {
    const idx = original.indexOf(word, searchPos);
    if (idx === -1) return false;
    searchPos = idx + word.length;
  }
  return true;
}

/**
 * Truncate text for display in warning messages.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
