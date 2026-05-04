import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, Check } from 'lucide-react';

export default function CameraCapture({ onCapture }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [photoDataUrl, setPhotoDataUrl] = useState(null);
    const [stream, setStream] = useState(null);

    // Attach stream to video tag after it has mounted
    useEffect(() => {
        if (isCameraActive && videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [isCameraActive, stream]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            setStream(mediaStream);
            setIsCameraActive(true);
            setPhotoDataUrl(null);
        } catch (err) {
            console.error("Error accessing camera: ", err);
            alert("Unable to access camera. Please allow permissions or use file upload.");
        }
    };

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        setIsCameraActive(false);
        setStream(null);
    }, [stream]);

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const context = canvas.getContext('2d');
            // Draw image
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Get Data URL
            const dataUrl = canvas.toDataURL('image/png');
            setPhotoDataUrl(dataUrl);
            stopCamera();
        }
    };

    const confirmPhoto = () => {
        onCapture(photoDataUrl);
    };

    const retakePhoto = () => {
        setPhotoDataUrl(null);
        startCamera();
    };

    return (
        <div className="camera-container slide-up">
            {!isCameraActive && !photoDataUrl && (
                <button onClick={startCamera} className="btn btn-primary w-full">
                    <Camera size={20} />
                    Open Camera
                </button>
            )}

            {isCameraActive && !photoDataUrl && (
                <div className="image-preview-container">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="video-preview w-full rounded-lg"
                        style={{ transform: 'scaleX(-1)', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                    />
                    <div className="flex gap-4 mt-4 absolute bottom-4">
                        <button onClick={capturePhoto} className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: '50px' }}>
                            <Camera size={24} />
                        </button>
                        <button onClick={stopCamera} className="btn" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {photoDataUrl && (
                <div className="image-preview-container">
                    <img src={photoDataUrl} alt="Captured" className="image-preview" />
                    <div className="flex gap-4 mt-4 absolute bottom-4">
                        <button onClick={confirmPhoto} className="btn btn-primary">
                            <Check size={20} /> Use Photo
                        </button>
                        <button onClick={retakePhoto} className="btn">
                            Retake
                        </button>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
}
