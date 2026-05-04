import * as pdfjsLib from 'pdfjs-dist';

// Point pdf.js to the worker script dynamically via CDN to bypass Vite bundling constraints
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Converts a PDF File object into an array of base64 JPEG images (one per page).
 */
export async function convertPdfToImages(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pageDataUrls = [];
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // Crisp enough for OCR
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Export highly compressed jpeg to save memory
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        pageDataUrls.push(dataUrl);
    }
    
    return pageDataUrls;
}
