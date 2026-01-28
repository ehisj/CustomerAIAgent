/**
 * Splits text into overlapping chunks for vector storage.
 * @param {string} text - The text to chunk
 * @param {object} options - Chunking options
 * @param {number} options.chunkSize - Target size of each chunk in characters
 * @param {number} options.overlap - Number of characters to overlap between chunks
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text, { chunkSize = 500, overlap = 50 } = {}) {
  const chunks = [];

  // Normalize whitespace
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  if (normalizedText.length <= chunkSize) {
    return [normalizedText];
  }

  let start = 0;

  while (start < normalizedText.length) {
    let end = start + chunkSize;

    // Try to break at sentence or word boundary
    if (end < normalizedText.length) {
      // Look for sentence boundary within last 100 chars of chunk
      const searchStart = Math.max(start + chunkSize - 100, start);
      const searchText = normalizedText.substring(searchStart, end);

      const sentenceEnd = searchText.lastIndexOf('. ');
      if (sentenceEnd !== -1) {
        end = searchStart + sentenceEnd + 1;
      } else {
        // Fall back to word boundary
        const spaceIndex = normalizedText.lastIndexOf(' ', end);
        if (spaceIndex > start) {
          end = spaceIndex;
        }
      }
    }

    const chunk = normalizedText.substring(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= normalizedText.length) break;
  }

  return chunks;
}
