import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image, FileText, Check, Plus, Trash2, X, AlertCircle, Edit3, Info, Scan, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import CameraCapture from './CameraCapture';
import FileUpload from './FileUpload';
import { extractTextWithGemini } from '../utils/geminiService';
import { generateUUID } from '../utils/uuid';

export default function MarkingSchemeView({ savedSchemes, setSavedSchemes, isGeminiReady, searchQuery = '', globalCreateMode, setGlobalCreateMode }) {
    // Synchronous init intercepts layout flash natively
    const [isCreating, setIsCreating] = useState(!!globalCreateMode);
    const [schemeName, setSchemeName] = useState('');
    const [inputMethod, setInputMethod] = useState('upload');
    const [tempImgs, setTempImgs] = useState([]);
    const [tempText, setTempText] = useState('');
    const [tempConstraints, setTempConstraints] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [activeSchemePreview, setActiveSchemePreview] = useState(null);
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [missingConstraints, setMissingConstraints] = useState(false);
    const [missingName, setMissingName] = useState(false);
    const nameInputRef = useRef(null);

    useEffect(() => {
        if (globalCreateMode) {
            setIsCreating(true);
            if (setGlobalCreateMode) setGlobalCreateMode(false);
        }
    }, [globalCreateMode, setGlobalCreateMode]);

    const filteredSchemes = savedSchemes;

    const processImage = async (imageSrc) => {
        if (!isGeminiReady) {
            toast.error("AI service is currently unavailable.");
            return;
        }
        
        const urls = Array.isArray(imageSrc) ? imageSrc : [imageSrc];
        setTempImgs(urls);
        setIsExtracting(true);
        try {
            const rawText = await extractTextWithGemini(urls);
            const constraintRegex = /<CONSTRAINTS>([\s\S]*?)<\/CONSTRAINTS>/i;
            const match = rawText.match(constraintRegex);
            
            if (match) {
                setTempConstraints(match[1].trim());
            } else {
                setTempConstraints('');
            }
            
            setTempText(rawText.replace(constraintRegex, '').trim());
        } catch (err) {
            toast.error("Extraction failed: " + err.message);
            setTempImgs([]);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleSave = () => {
        let hasError = false;
        
        if (!schemeName || !schemeName.trim()) {
            setMissingName(true);
            nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => setMissingName(false), 3000);
            hasError = true;
        }
        
        if (!tempText || !tempText.trim()) {
            toast.error("No text extracted! Please upload images and ensure text is processed.");
            hasError = true;
        }

        if (!tempConstraints || !tempConstraints.trim()) {
            setMissingConstraints(true);
            setTimeout(() => setMissingConstraints(false), 3000);
            hasError = true;
        }

        if (hasError) return;

        if (savedSchemes.some(s => s.name === schemeName)) {
            toast.error("A marking scheme with this name already exists.");
            return;
        }

        const newScheme = {
            id: generateUUID(),
            name: schemeName,
            text: tempText,
            constraints: tempConstraints,
            dateCreated: new Date().toISOString(),
            images: tempImgs
        };
        setSavedSchemes(prev => [newScheme, ...prev]);
        toast.success("Master Scheme Saved Successfully!");
        setIsCreating(false);
        setSchemeName('');
        setTempText('');
        setTempConstraints('');
        setTempImgs([]);
    };

    const getExtractedTextForPage = (text, pageIndex) => {
        if (!text) return '';
        const regex = /---PAGE \d+---/gi;
        const matches = text.match(regex);
        if (!matches) return text; 
        
        const segments = text.split(regex);
        const actualPages = segments.length > matches.length ? segments.slice(1) : segments;
        return (actualPages[pageIndex] || '').trim();
    };

    const updateExtractedTextForPage = (newText, pageIndex) => {
        const regex = /---PAGE \d+---/gi;
        const matches = tempText.match(regex);
        if (!matches) {
            setTempText(newText);
            return;
        }
        
        const segments = tempText.split(regex);
        let output = segments[0] || ''; 
        for (let i = 0; i < matches.length; i++) {
            output += `\n\n${matches[i]}\n\n`;
            if (i === pageIndex) {
                output += newText;
            } else {
                output += (segments[i+1] || '').trim();
            }
        }
        setTempText(output.trim());
    };

    return (
        <div className="slide-up">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-main m-0" style={{ WebkitTextFillColor: 'unset', background: 'none' }}>Marking Schemes</h1>
                    <p className="text-muted mt-1">Manage your reference answer keys and grading logic blocks.</p>
                </div>
                {!isCreating && (
                    <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
                        <Plus size={18} /> New Scheme
                    </button>
                )}
            </div>

            {isCreating ? (
                <div className="card mb-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold m-0 text-main">Create New Scheme</h2>
                        <button 
                            className="btn flex items-center gap-2 transition-colors" 
                            style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', fontWeight: 'bold' }} 
                            onClick={() => {
                                setIsCreating(false);
                                setSchemeName('');
                                setTempText('');
                                setTempConstraints('');
                                setTempImgs([]);
                            }}
                            onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-main)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            <X size={16} strokeWidth={3} /> Cancel
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mb-8 mt-4">
                        <label className="text-muted font-bold whitespace-nowrap" style={{ fontSize: '1rem' }}>Scheme Name / Course Code</label>
                        <input
                            ref={nameInputRef}
                            type="text"
                            className="search-input flex-1 text-main font-semibold transition-all"
                            style={{ 
                                padding: '10px 16px', 
                                backgroundColor: 'var(--bg-main)', 
                                outline: 'none', 
                                color: 'var(--text-main)', 
                                border: missingName ? '2px solid var(--danger)' : '1px solid transparent',
                                boxShadow: missingName ? '0 0 15px rgba(239, 68, 68, 0.25)' : 'none'
                            }}
                            placeholder="e.g. Advanced Calculus Midterm 2024"
                            value={schemeName}
                            onChange={e => setSchemeName(e.target.value)}
                        />
                    </div>

                    {tempImgs.length === 0 && !isExtracting && (
                        <div className="mb-6">
                            <div className="flex gap-4 mb-4">
                                <button className={`btn flex-1 ${inputMethod === 'upload' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setInputMethod('upload')}>
                                    <Image size={18} /> Upload Image File
                                </button>
                                <button className={`btn flex-1 ${inputMethod === 'camera' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setInputMethod('camera')}>
                                    <Camera size={18} /> Scan with Camera
                                </button>
                            </div>
                            {inputMethod === 'upload' ? <FileUpload onUpload={processImage} /> : <CameraCapture onCapture={processImage} />}
                        </div>
                    )}

                    {isExtracting && (
                        <div className="flex items-center justify-center gap-3 mb-6 slide-up text-muted py-4">
                            <div className="loader" style={{ width: '24px', height: '24px', borderWidth: '3px', borderRightColor: 'var(--primary)' }}></div>
                            <span className="font-semibold text-md">Processing Document...</span>
                        </div>
                    )}

                    {tempText && tempImgs.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '20px', marginBottom: '24px' }}>
                            {/* IMAGE TRAY */}
                            <div className="flex gap-3 h-full" style={{ minWidth: 0, height: '100%', minHeight: 0 }}>
                                {/* PDF-Style Thumbnail Navigation Strip */}
                                <div className="custom-scrollbar" style={{ width: '85px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {tempImgs.map((url, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActivePageIndex(idx)}
                                            className="transition-all"
                                            style={{
                                                padding: 0,
                                                border: activePageIndex === idx ? '2px solid var(--primary)' : '2px solid transparent',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                background: 'rgba(255,255,255,0.05)',
                                                cursor: 'pointer',
                                                height: '110px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                opacity: activePageIndex === idx ? 1 : 0.5,
                                                flexShrink: 0
                                            }}
                                            onMouseOver={e => e.currentTarget.style.opacity = 1}
                                            onMouseOut={e => { if(activePageIndex !== idx) e.currentTarget.style.opacity = 0.5 }}
                                        >
                                            <img src={url} alt={`Thumb ${idx + 1}`} style={{ width: '100%', flex: 1, objectFit: 'cover' }} />
                                            <div style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px 0', background: 'var(--bg-main)', color: 'var(--text-main)', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                                                Page {idx + 1}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Main Expanded View */}
                                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12px', overflow: 'hidden' }}>
                                    <img 
                                        src={tempImgs[activePageIndex] || tempImgs[0]} 
                                        alt={`Active Scheme Page ${activePageIndex + 1}`} 
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }} 
                                    />
                                </div>
                            </div>

                            {/* TEXT TRAY */}
                            <div className="flex flex-col h-full items-start" style={{ minWidth: 0, height: '100%', minHeight: 0 }}>
                                <div className="text-primary font-bold mb-3 flex flex-col gap-3">
                                    <span className="uppercase tracking-wider flex items-center gap-2 text-sm">
                                        <Edit3 size={16} /> Review & Edit: Page {activePageIndex + 1}
                                    </span>
                                    <div className="text-sm text-muted flex gap-2 items-center" style={{ opacity: 0.85 }}>
                                        <AlertCircle size={16} className="text-primary flex-shrink-0" />
                                        <span>Manual edits here become the final marking scheme.</span>
                                    </div>
                                </div>
                                <textarea
                                    className="w-full flex-1 p-5 font-mono text-sm transition-all custom-scrollbar"
                                    value={getExtractedTextForPage(tempText, activePageIndex)}
                                    onChange={e => updateExtractedTextForPage(e.target.value, activePageIndex)}
                                    style={{ 
                                        padding: '24px',
                                        minHeight: '300px', 
                                        maxHeight: '450px', 
                                        overflowY: 'auto', 
                                        resize: 'none', 
                                        backgroundColor: 'var(--bg-main)', 
                                        color: 'var(--text-main)', 
                                        border: '1px solid transparent', 
                                        borderRadius: '12px',
                                        outline: 'none', 
                                        lineHeight: '1.6' 
                                    }}
                                    onFocus={e => { e.currentTarget.style.border = '1px solid var(--primary)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.15)'; }}
                                    onBlur={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.boxShadow = 'none'; }}
                                />
                                <div className="mt-4">
                                    <div className="text-primary font-bold mb-2 flex items-center gap-2 text-sm"><AlertCircle size={16} /> Exam Rules & Constraints</div>
                                    <textarea
                                        className="w-full p-5 font-mono text-sm transition-all custom-scrollbar"
                                        value={tempConstraints}
                                        onChange={e => setTempConstraints(e.target.value)}
                                        placeholder="e.g. Q1 is Compulsory. Answer any other 2 questions. Grade out of 60."
                                        style={{ 
                                            padding: '20px 24px',
                                            minHeight: '50px', 
                                            maxHeight: '90px', 
                                            overflowY: 'auto',
                                            resize: 'none',
                                            backgroundColor: 'var(--bg-main)', 
                                            color: 'var(--text-main)', 
                                            border: missingConstraints ? '2px solid var(--danger)' : '1px solid transparent', 
                                            borderRadius: '12px',
                                            outline: 'none', 
                                            boxShadow: missingConstraints ? '0 0 15px rgba(239, 68, 68, 0.25)' : 'none' 
                                        }}
                                        onFocus={e => { if (!missingConstraints) { e.currentTarget.style.border = '1px solid var(--primary)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.15)'; } }}
                                        onBlur={e => { if (!missingConstraints) { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.boxShadow = 'none'; } }}
                                    />
                                    {!tempConstraints && <div className="text-xs text-muted mt-1 italic flex items-center gap-1">No explicit constraints detected by AI. You can enter them manually.</div>}
                                </div>
                                <button className="btn mt-4 w-full" style={{ background: 'var(--success)', border: 'none', color: 'white', padding: '14px', fontSize: '1.1rem' }} onClick={handleSave}>
                                    <Check size={20} /> Save Master Scheme
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-4 custom-scrollbar" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 220px)', paddingRight: '12px', paddingBottom: '20px' }}>
                    {filteredSchemes.length === 0 ? (
                        <div className="text-center p-10 card flex flex-col items-center justify-center" style={{ minHeight: '300px', borderStyle: 'dashed' }}>
                            <FileText size={48} className="text-muted mb-4 opacity-50" />
                            <h3 className="text-xl font-semibold mb-2">No matching schemes found</h3>
                            <p className="text-muted mb-6">There are no schemes matching your query. You may need to create one first.</p>
                            <button className="btn btn-primary" onClick={() => setIsCreating(true)}><Plus size={18} /> Create Your First Scheme</button>
                        </div>
                    ) : (
                        filteredSchemes.map(scheme => (
                            <div 
                                key={scheme.id} 
                                className="card flex items-center justify-between queue-card-hover" 
                                data-interactive="true"
                                style={{ padding: '1.1rem 1.5rem', transition: 'all 0.2s', borderLeft: '4px solid var(--primary)', cursor: 'pointer' }}
                                onClick={() => { setActiveSchemePreview(scheme); setActivePageIndex(0); }}
                            >
                                <div className="flex items-center gap-5">
                                    <div style={{ background: 'rgba(16,185,129,0.1)', padding: '12px', borderRadius: '12px' }}>
                                        <FileText size={24} className="text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg m-0 text-main">{scheme.name}</h3>
                                        <div className="text-muted text-sm mt-1">Created: {new Date(scheme.dateCreated).toLocaleDateString()} &middot; {scheme.text.split(' ').length} words of logic</div>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-outline"
                                    style={{ padding: '8px 10px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)', transition: 'all 0.2s', background: 'rgba(239, 68, 68, 0.02)' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSavedSchemes(prev => prev.filter(s => s.id !== scheme.id));
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.02)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                    title="Delete Scheme"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
            
            {activeSchemePreview && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)'
                }}>
                    <div className="card slide-up" style={{ width: '90%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8)' }}>
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700" style={{ borderColor: 'var(--border-color)' }}>
                            <div style={{ flex: 1, minWidth: 0, paddingRight: '20px' }}>
                                <h2 className="text-xl font-bold m-0 text-main flex items-center gap-3"><FileText size={20} className="text-primary"/> Marking Scheme Details</h2>
                                <div className="text-muted text-sm mt-1 truncate">{activeSchemePreview.name} &middot; Created on: {new Date(activeSchemePreview.dateCreated).toLocaleString()}</div>
                            </div>
                            <button className="btn btn-outline flex items-center justify-center gap-2 text-muted" onClick={() => setActiveSchemePreview(null)}><X size={16} strokeWidth={2.5}/> Close View</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', flex: 1, overflow: 'hidden', gap: '20px' }}>
                            {/* IMAGE TRAY */}
                            <div className="flex gap-3 h-full" style={{ minWidth: 0, height: '100%', minHeight: 0 }}>
                                {/* PDF-Style Thumbnail Navigation Strip */}
                                <div className="custom-scrollbar" style={{ width: '85px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {(activeSchemePreview.images || []).map((url, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActivePageIndex(idx)}
                                            className="transition-all"
                                            style={{
                                                padding: 0,
                                                border: activePageIndex === idx ? '2px solid var(--primary)' : '2px solid transparent',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                background: 'rgba(255,255,255,0.05)',
                                                cursor: 'pointer',
                                                height: '110px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                opacity: activePageIndex === idx ? 1 : 0.5,
                                                flexShrink: 0
                                            }}
                                            onMouseOver={e => e.currentTarget.style.opacity = 1}
                                            onMouseOut={e => { if(activePageIndex !== idx) e.currentTarget.style.opacity = 0.5 }}
                                        >
                                            <img src={url} alt={`Thumb ${idx + 1}`} style={{ width: '100%', flex: 1, objectFit: 'cover' }} />
                                            <div style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px 0', background: 'var(--bg-main)', color: 'var(--text-main)', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                                                Page {idx + 1}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Main Expanded View */}
                                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12px', overflow: 'hidden' }}>
                                    {activeSchemePreview.images && activeSchemePreview.images.length > 0 ? (
                                        <img 
                                            src={activeSchemePreview.images[activePageIndex] || activeSchemePreview.images[0]} 
                                            alt={`Active Scheme Page ${activePageIndex + 1}`} 
                                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }} 
                                        />
                                    ) : (
                                        <div className="text-muted italic flex flex-col items-center gap-2 content-center opacity-50">
                                            <Camera size={32} /> No Reference Images Saved
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* TEXT TRAY */}
                            <div className="flex flex-col h-full items-start" style={{ minWidth: 0, height: '100%', minHeight: 0 }}>
                                <div className="text-primary font-bold mb-4 flex items-center gap-2"><Edit3 size={18}/> Marking Scheme Details</div>
                                <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '1rem', paddingRight: '1rem', paddingBottom: '20px' }} className="custom-scrollbar">
                                    <div className="mb-6">
                                        <div className="text-primary font-bold text-sm mb-4 flex items-center gap-2 justify-between border-b pb-3 uppercase tracking-wider" style={{ borderColor: 'var(--border-color)' }}>
                                            <span className="flex items-center gap-2"><FileText size={16} /> Extracted Rule Logic</span>
                                            <span className="badge badge-primary" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>{activeSchemePreview.text ? activeSchemePreview.text.split(' ').length : 0} Words</span>
                                        </div>
                                        <div className="text-sm font-medium text-main leading-relaxed mb-6" style={{ whiteSpace: 'pre-wrap', opacity: 0.9 }}>
                                            {activeSchemePreview.text}
                                        </div>

                                        {activeSchemePreview.constraints && (
                                            <div className="mt-6">
                                                <div className="text-primary font-bold text-sm mb-4 border-b pb-3 uppercase tracking-wider" style={{ borderColor: 'var(--border-color)' }}>
                                                    Exam Rules & Constraints
                                                </div>
                                                <div className="text-sm font-medium text-main leading-relaxed" style={{ whiteSpace: 'pre-wrap', opacity: 0.9 }}>
                                                    {activeSchemePreview.constraints}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
