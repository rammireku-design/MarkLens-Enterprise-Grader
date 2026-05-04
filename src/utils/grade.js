/**
 * A simple placeholder grading algorithm that checks for keywords
 * in the student script matching the marking scheme.
 */
export function gradeScript(markingSchemeText, studentScriptText) {
    if (!markingSchemeText || !studentScriptText) return 0;

    // Extract words from marking scheme (very basic heuristic)
    const cleanScheme = markingSchemeText.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const schemeWords = cleanScheme.split(/\s+/).filter(w => w.length > 3);

    if (schemeWords.length === 0) return 0;

    const cleanStudent = studentScriptText.toLowerCase();

    // Count how many keywords from the scheme exist in the student text
    let matches = 0;
    const uniqueWords = [...new Set(schemeWords)];

    uniqueWords.forEach(word => {
        if (cleanStudent.includes(word)) {
            matches++;
        }
    });

    const rawScore = (matches / uniqueWords.length) * 100;

    // Return grade 0-100 rounded
    return Math.min(100, Math.round(rawScore));
}
