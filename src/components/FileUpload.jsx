import React, { useRef } from 'react';
import { Upload, FolderUp } from 'lucide-react';

export default function FileUpload({ onUpload }) {
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    const handleFiles = (files) => {
        if (!files || files.length === 0) return;
        
        // Filter out non-images
        const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (validFiles.length === 0) {
            alert("No valid images found.");
            return;
        }

        // Sort files alphabetically to ensure pages go to Gemini in the correct chronological order
        validFiles.sort((a, b) => a.name.localeCompare(b.name));

        const dataUrls = [];
        let readCount = 0;

        validFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const index = validFiles.indexOf(file);
                dataUrls[index] = event.target.result;
                readCount++;
                
                if (readCount === validFiles.length) {
                    onUpload(dataUrls);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    return (
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
                    cursor: 'pointer'
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
                <div className="icon-bump" style={{ marginBottom: '4px' }}>
                    <Upload size={32} className="text-primary" />
                </div>
                <span className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-main)' }}>Upload Image(s)</span>
                <span className="text-muted text-sm border-0 m-0">Select multiple files at once</span>
            </button>
            
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
                    cursor: 'pointer'
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
                <div className="icon-bump" style={{ marginBottom: '4px' }}>
                    <FolderUp size={32} className="text-primary" />
                </div>
                <span className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-main)' }}>Upload Folder</span>
                <span className="text-muted text-sm border-0 m-0">Drop an organized folder of pages</span>
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFiles(e.target.files)}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
            />
            <input
                type="file"
                ref={folderInputRef}
                webkitdirectory="true"
                directory="true"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                style={{ display: 'none' }}
            />
        </div>
    );
}
