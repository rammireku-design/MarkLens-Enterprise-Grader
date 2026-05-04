import { getCache, setCache } from './db';
import { supabase } from './supabaseClient';

// Memory caching hash generator to prevent API exhaustion during testing
const generateHash = (str) => {
    let hash = 5381;
    let i = str.length;
    while (i) {
        hash = (hash * 33) ^ str.charCodeAt(--i);
    }
    return Math.abs(hash >>> 0).toString(16);
};

/**
 * Rapid AI Pre-Pass: Scans a single page exclusively for a Student Index Number.
 */
export async function extractIndexFromImage(dataUrl) {
    const base64Data = dataUrl.split(',')[1];
    const mimeType = dataUrl.match(/data:(.*?);/)[1];
    const cacheKey = 'index_pass_' + generateHash(base64Data.substring(0, 2000));

    try {
        const cached = await getCache(cacheKey);
        if (cached) return cached;
    } catch(e) {}

    const prompt = `You are a highly constrained optical bounding box reader. Look at the top of the provided document. Does it contain a Student Index Number, Roll Number, or ID? 
If you find one, output ONLY that exact number/string. Nothing else.
If you DO NOT find one, output the exact word: NONE`;

    const payload = {
        contents: [{
            parts: [
                { text: prompt },
                { inlineData: { data: base64Data, mimeType: mimeType } }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 20
        }
    };

    let retries = 2;
    let lastError;
    while (retries >= 0) {
        try {
            const { data, error } = await supabase.functions.invoke('gemini-proxy', {
                body: {
                    modelPath: "gemini-2.5-flash:generateContent",
                    payload: payload
                }
            });

            if (error) throw new Error(error.message);

            const extracted = data.candidates[0].content.parts[0].text.trim();
            let finalOutput = extracted.toUpperCase().includes('NONE') ? 'NONE' : extracted;
            try { await setCache(cacheKey, finalOutput); } catch(e) {}
            return finalOutput;
            
        } catch (err) {
            lastError = err;
            retries--;
            if (retries >= 0) await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }
    
    console.warn("Index Pre-pass failed on page after retries, falling back to NONE.", lastError);
    return "NONE";
}

/**
 * Extracts text from an image securely via the Edge Proxy
 */
export async function extractTextWithGemini(imageDataUrls) {
    const urlsToProcess = Array.isArray(imageDataUrls) ? imageDataUrls : [imageDataUrls];
    const base64Parts = urlsToProcess.map(url => url.split(',')[1]);
    const cacheKey = 'ocr_cache_v2_' + generateHash(base64Parts.join('').substring(0, 5000));

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            console.log("CACHE HIT: Using zero-cost local OCR memory.");
            return cached;
        }
    } catch (e) { }

    const prompt = `You are an expert OCR and transcription AI. Your task is to transcribe the text in the provided image(s). If multiple images are provided, treat them as consecutive pages of a single test booklet.

CRITICAL INSTRUCTION REGARDING CANCELED TEXT:
You must COMPLETELY IGNORE any text that has been crossed out, scribbled over, scored through with a line, or otherwise marked as canceled.
If a word, phrase, or entire sentence has a line through it, DO NOT include it in your transcription. Pretend the canceled text does not exist and just transcribe the valid, un-canceled text surrounding it.

CRITICAL INSTRUCTION REGARDING EXAM CONSTRAINTS:
You must actively search the document for any explicit grading constraints or exam instructions (e.g., "Answer Question 1 as Compulsory and any other 3 questions", "Section A is mandatory", "Grade out of 100", "Attempt all questions").
If you find ANY such grading rules or constraint instructions, you MUST extract them and output them exactly wrapped in <CONSTRAINTS>...</CONSTRAINTS> tags at the VERY END of your response. If you do not find any instructions, do not output the tags.

CRITICAL INSTRUCTION REGARDING FORMATTING:
You MUST maintain distinct spacing to make the text extremely readable. DO NOT squash the extracted text into dense paragraphs. You must insert blank newlines (double spacing) between distinctly different questions, list items, numbers, sections, and structural paragraphs.

CRITICAL INSTRUCTION REGARDING PAGINATION:
I have injected structural markers like "---PAGE 1---" into the image array sequence. YOU MUST preserve these exact markers in your final output transcription precisely where they belong so the system knows where page boundaries start.

Please transcribe the valid text now, reading sequentially through all provided pages. Do not provide any extra commentary, just the extracted text mapped under their respective ---PAGE X--- headers.`;

    const partsArray = [{ text: prompt }];

    urlsToProcess.forEach((dataUrl, index) => {
        partsArray.push({ text: `\n\n---PAGE ${index + 1}---\n\n` });
        const mimeType = dataUrl.match(/data:(.*?);/)[1];
        const base64Data = dataUrl.split(',')[1];
        partsArray.push({
            inlineData: { data: base64Data, mimeType: mimeType }
        });
    });

    const payload = {
        contents: [{ parts: partsArray }]
    };

    let retries = 2;
    let lastError;
    while (retries >= 0) {
        try {
            const { data, error } = await supabase.functions.invoke('gemini-proxy', {
                body: {
                    modelPath: "gemini-2.5-flash:generateContent",
                    payload: payload
                }
            });

            if (error) throw new Error(error.message);

            const extractedText = data.candidates[0].content.parts[0].text;
            try { await setCache(cacheKey, extractedText); } catch (e) { }
            return extractedText;
        } catch (err) {
            lastError = err;
            retries--;
            if (retries >= 0) await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.error("Gemini Extraction Error Details:", lastError);
    throw new Error(`Edge Function failed after retries. Details: ${lastError.message}`);
}

/**
 * AI Grading logic securely via the Edge Proxy
 */
export async function gradeWithGemini(schemeText, scriptText, constraints = null, isStrictMode = false) {
    const cacheKey = 'grade_cache_' + generateHash(schemeText + scriptText + (constraints || '') + isStrictMode);

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            console.log("CACHE HIT: Using zero-cost local Grading memory.");
            return JSON.parse(cached);
        }
    } catch (e) { }

    const strictModeInstruction = isStrictMode ? `\n\nSTRICT TERMINOLOGY MODE ENABLED:\nYou must rigidly enforce technical terminology. First, analyze the marking scheme to identify the core scientific, mathematical, or domain-specific terminologies. The student MUST write those exact technical terms to receive marks. However, you MUST NOT penalize the student for using synonyms, varying grammar, or different sentence structures for non-technical English words (e.g., accepting 'shows' instead of 'verifies', or 'meaning' instead of 'meaningful'). Only award 0 marks if the critical domain-specific terminologies are utterly missing.\n` : '';

    const prompt = `You are an expert academic evaluator. Your task is to grade a student's test script against the provided marking scheme.
${constraints ? `\nCRITICAL OVERRIDE - EXAM CONSTRAINTS & RULES:\n${constraints}\nYOU MUST ABSOLUTELY OBEY THE ABOVE CONSTRAINTS. If the rule specifies compulsory questions, verify the student answered them. If a compulsory question is completely omitted, award 0 marks for it. If the rule limits the number of optional questions (e.g., "answer any 3 other questions"), you MUST grade all of them but ONLY SUM the highest-scoring allowed questions towards the final mark, completely discarding the scores of the worst redundant questions. Explicitly state discarded questions in your brief_insight.\n` : ''}${strictModeInstruction}
Grading Guidelines:
1. Compare the Student Script text to the Marking Scheme text carefully.
2. For objective tests with multiple numbered questions, score based on the exact number of correct matches.
3. For open-ended questions, let the system deeply understand what the student has written and compare it to the scheme. If their answer *means* what the marking scheme is saying, you must award them the marks, even if they use their own words.
4. If their answer is only slightly there or partially correct, deduct marks appropriately.
5. SPELLING & OCR TOLERANCE: Because the student script is extracted via OCR from raw handwriting, there may be typos, misspelled words, or structural OCR errors (e.g., 'identifions' instead of 'identifiers'). You MUST boldly tolerate minor spelling mistakes or OCR artifacts, even for core technical terminologies. As long as it is phonetically or structurally obvious what the student intended to write, accept it as completely correct and do NOT dock points for spelling.
6. EXTERNAL FACTUAL CORRECTNESS: If a student provides an answer that is technically, scientifically, or factually correct for the specific domain (e.g., providing a valid alternative limitation, framework, or example), but it is NOT explicitly listed in the marking scheme, you MUST rely on your domain knowledge to verify it and award them full marks.
7. If their answer does not align with the marking scheme and is objectively incorrect in the real world, they are totally wrong and should receive zero.
8. CAREFULLY EXAMINE THE MARKING SCHEME FOR POINTS: Look for explicitly allocated points or marks next to questions (e.g. 'Question 1a: 4 marks', '8 points').
   - IF YOU DETECT EXPLICIT MARKS in the scheme: Grade the student question-by-question based on these specific points. Calculate the total points they earned out of the total possible points in the entire scheme. Output your 'score' as a specific fraction string (e.g., "45/60" or "76/80").
   - IF NO MARKS ARE ALLOCATED in the scheme: Evaluate the overall accuracy of their answers and output your 'score' as a standard percentage string (e.g., "90%").
9. INHERENT EXAM INSTRUCTIONS: The document text itself will often contain explicit exam rules written by the lecturer, commonly headed by the word "INSTRUCTION" or "INSTRUCTIONS" (e.g., "INSTRUCTION: - Answer all questions in this section", "Section B: Answer two questions"). You MUST actively scan the text for any embedded rules, constraints, or instruction sets, and rigidly apply them to your grading logic just as you would any manual limitations.
10. Output your response in valid JSON format ONLY, no markdown formatting. It must have this exact structure:
{
  "score": "(A string representing the final grade. MUST be either a fraction like '45/60' if the scheme has points, or a percentage like '90%' if no points are defined)",
  "brief_insight": "(Provide a COMPLETE point-by-point bulleted evaluation of EVERY question. Do NOT write sentences or essays. Keep it extremely short. Example format: '- Q1: Full marks. - Q1a: Missing definition. - Q2: Completely wrong.')",
  "comprehensive_report": "(Provide an EXTREMELY SHORT, highly-summarized evaluation broken down strictly question-by-question. (Example: 'Question 1: Perfect match.\\nQuestion 2: Missing lexical scanner definition.'). MAX ONE TINY SENTENCE PER QUESTION. No long talking. No huge paragraphs. NEVER group questions together. Speed and extreme brevity are your absolute priority here.)",
  "studentIndex": "(Look closely at the transcribed Student Script text. Identify any recognizable Index Number, ID number, or Roll Number usually located at the top. Extract it here. If absolutely not found, return 'Unknown Index'.)"
}

Marking Scheme:
===
${schemeText}
===

Student Script:
===
${scriptText}
===
`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    let retries = 2;
    let lastError;
    while (retries >= 0) {
        try {
            const { data, error } = await supabase.functions.invoke('gemini-proxy', {
                body: {
                    modelPath: "gemini-2.5-pro:generateContent",
                    payload: payload
                }
            });

            if (error) throw new Error(error.message);

            const jsonStr = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            const gradeResult = JSON.parse(jsonStr);

            try { await setCache(cacheKey, JSON.stringify(gradeResult)); } catch (e) { }
            return gradeResult;
        } catch (err) {
            lastError = err;
            retries--;
            if (retries >= 0) await new Promise(resolve => setTimeout(resolve, 2500));
        }
    }

    console.error("Gemini Grading Error Details:", lastError);
    throw new Error(`Failed to grade securely after retries. Details: ${lastError.message}`);
}
