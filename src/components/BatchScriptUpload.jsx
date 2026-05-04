import React, { useRef, useState } from 'react';
import { Upload, FolderUp, Loader2 } from 'lucide-react';
import { convertPdfToImages } from '../utils/pdfHelper';
import { extractIndexFromImage } from '../utils/geminiService';

export default function BatchScriptUpload({ onUploadBatch }) {
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    const [isSlicing, setIsSlicing] = useState(false);
    const [sliceProgress, setSliceProgress] = useState('');

    const processFiles = async (files) => {
        if (!files || files.length === 0) return;

        const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
        if (validFiles.length === 0) {
            alert("No valid images or PDFs found.");
            return;
        }

        setIsSlicing(true);

        try {
            const pdfFiles = validFiles.filter(f => f.type === 'application/pdf');
            const imageFiles = validFiles.filter(f => f.type.startsWith('image/'));

            let groups = {};

            // Handle Massive PDFs first
            if (pdfFiles.length > 0) {
                setSliceProgress('Unstapling Spool PDF...');
                
                for (const pdf of pdfFiles) {
                    const dataUrls = await convertPdfToImages(pdf);
                    let lastDetectedIndex = 'Unknown_Index_PDF';
                    
                    for (let i = 0; i < dataUrls.length; i++) {
                        setSliceProgress(`AI Pre-Pass: Scanning Page ${i + 1}/${dataUrls.length}...`);
                        const extractedIndex = await extractIndexFromImage(dataUrls[i]);
                        
                        if (extractedIndex !== 'NONE') {
                            lastDetectedIndex = extractedIndex;
                        }
                        
                        if (!groups[lastDetectedIndex]) {
                            groups[lastDetectedIndex] = [];
                        }
                        groups[lastDetectedIndex].push(dataUrls[i]);
                    }
                }
            }

            // Handle Standard Folders / Images
            if (imageFiles.length > 0) {
                setSliceProgress('Processing Directory Arrays...');
                const readPromises = imageFiles.map(file => {
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            resolve({
                                fileObj: file,
                                dataUrl: event.target.result
                            });
                        };
                        reader.readAsDataURL(file);
                    });
                });
                
                const results = await Promise.all(readPromises);
                results.sort((a, b) => a.fileObj.name.localeCompare(b.fileObj.name));

                results.forEach(res => {
                    const path = res.fileObj.webkitRelativePath;
                    let groupName = '';

                    if (path && path.includes('/')) {
                        const parts = path.split('/');
                        if (parts.length > 2) {
                            groupName = parts[parts.length - 2];
                        } else {
                            groupName = res.fileObj.name.replace(/\.[^/.]+$/, "");
                        }
                    } else {
                        groupName = res.fileObj.name.replace(/\.[^/.]+$/, "");
                    }

                    if (!groups[groupName]) {
                        groups[groupName] = [];
                    }
                    groups[groupName].push(res.dataUrl);
                });
            }

            setSliceProgress('Finalizing Queue Integration...');

            const scriptObjects = Object.keys(groups).map(gn => ({
                name: gn,
                dataUrls: groups[gn],
                status: 'pending',
                extractedText: null,
                gradeResult: null
            }));

            onUploadBatch(scriptObjects);
        } catch (err) {
            console.error("Failed to parse batch:", err);
            alert("Error parsing batch upload: " + err.message);
        } finally {
            setIsSlicing(false);
            setSliceProgress('');
        }
    };

    const handleFileChange = (e) => {
        processFiles(e.target.files);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (folderInputRef.current) folderInputRef.current.value = '';
    };

    return (
        <div className="file-upload w-full flex flex-col gap-4">
            <div className="flex gap-4 w-full" style={{ flexWrap: 'wrap' }}>
                <button
                    className="flex-1 flex flex-col items-center justify-center gap-3 bump-hover"
                    onClick={() => fileInputRef.current.click()}
                    style={{ 
                        minWidth: '250px',
                        border: '2px dashed var(--border-color)', 
                        padding: '20px 16px', 
                        borderRadius: '16px',
                        background: 'rgba(255,255,255,0.02)',
                        transition: 'all 0.2s ease',
                        cursor: isSlicing ? 'not-allowed' : 'pointer',
                        opacity: isSlicing ? 0.4 : 1
                    }}
                    onMouseOver={e => { if(!isSlicing) { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'; e.currentTarget.style.borderColor = 'var(--primary)'; } }}
                    onMouseOut={e => { if(!isSlicing) { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'var(--border-color)'; } }}
                    disabled={isSlicing}
                >
                    <div className="icon-bump" style={{ marginBottom: '4px' }}>
                        <Upload size={32} className="text-primary" />
                    </div>
                    <span className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-main)' }}>Upload PDFs or Images</span>
                    <span className="text-muted text-sm border-0 m-0">Single files or scanned PDFs</span>
                </button>
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                />

                <button
                    className="flex-1 flex flex-col items-center justify-center gap-3 bump-hover"
                    onClick={() => folderInputRef.current.click()}
                    style={{ 
                        minWidth: '250px',
                        border: '2px dashed var(--border-color)', 
                        padding: '20px 16px', 
                        borderRadius: '16px',
                        background: 'rgba(255,255,255,0.02)',
                        transition: 'all 0.2s ease',
                        cursor: isSlicing ? 'not-allowed' : 'pointer',
                        opacity: isSlicing ? 0.4 : 1
                    }}
                    onMouseOver={e => { if(!isSlicing) { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'; e.currentTarget.style.borderColor = 'var(--primary)'; } }}
                    onMouseOut={e => { if(!isSlicing) { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'var(--border-color)'; } }}
                    disabled={isSlicing}
                >
                    <div className="icon-bump" style={{ marginBottom: '4px' }}>
                        <FolderUp size={32} className="text-primary" />
                    </div>
                    <span className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-main)' }}>Upload Master Folder</span>
                    <span className="text-muted text-sm border-0 m-0">Select an organized folder</span>
                </button>
                <input
                    type="file"
                    webkitdirectory="true"
                    directory="true"
                    multiple
                    ref={folderInputRef}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                />
            </div>

            {isSlicing && (
                <div className="w-full p-4 rounded-lg flex items-center justify-center gap-3 text-sm font-semibold text-primary" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <Loader2 size={18} className="animate-spin" /> {sliceProgress}
                </div>
            )}
        </div>
    );
}
