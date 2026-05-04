import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const LogoIcon = ({ size = 50, style }) => (
    <div 
        className="slide-up" 
        style={{ 
            position: 'relative', 
            width: '100%', 
            height: '38px',
            margin: '0 auto 1.25rem auto', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...style 
        }}
    >
        <div 
            className="marklens-logo-bg"
            style={{
                position: 'absolute',
                width: size, 
                height: size, 
                flexShrink: 0,
                pointerEvents: 'none'
            }}
            aria-label="MarkLens Logo"
        />
    </div>
);

export default function LoginView({ onLogin }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isResetting) {
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin
                });
                if (resetError) throw resetError;
                
                // Show success message and flip back to login
                alert("Password reset instructions have been sent to your email!");
                setIsResetting(false);
            } else if (isRegistering) {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                
                if (signUpError) throw signUpError;
                
                if (data.user) {
                    onLogin(data.user);
                } else {
                    setError("Check your email for the confirmation link to continue!");
                }
            } else {
                const { data, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                
                if (signInError) throw signInError;
                
                if (data.user) {
                    onLogin(data.user);
                }
            }
        } catch (err) {
            setError(err.message || "An error occurred during authentication.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            setError('');
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (err) {
            setError(err.message || 'Failed to initialize Google login.');
            setLoading(false);
        }
    };

    const handleAppleLoginMock = () => {
        alert("Apple login requires a paid Apple Developer Membership to configure the backend. Google is ready to go!");
    };

    return (
        <div className="hide-scrollbar" style={{ height: '100vh', width: '100vw', background: 'var(--bg-main)', overflowY: 'auto' }}>
            <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
                <div className="card slide-up" style={{ width: '90%', maxWidth: '440px', padding: '24px 32px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                <LogoIcon />
                <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', fontWeight: 800 }}>
                    {isResetting ? (
                        <span style={{ color: 'var(--text-main)' }}>Reset Password</span>
                    ) : isRegistering ? (
                        <span style={{ color: 'var(--text-main)' }}>Create an Account</span>
                    ) : (
                        <>
                            <span style={{ color: 'var(--text-main)' }}>Log in to Mark</span><span style={{ color: 'var(--primary)' }}>Lens</span>
                        </>
                    )}
                </h2>
                
                <p className="text-muted mb-4" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                    {isResetting 
                        ? 'Enter your email and we will send you a reset link.' 
                        : isRegistering 
                            ? 'Sign up to start grading your papers faster.' 
                            : 'Welcome back! Please enter your details.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '0.5rem' }}>
                    <button type="button" disabled={loading} onClick={handleGoogleLogin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '10px', background: '#ffffff', color: '#111', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', outline: 'none', opacity: loading ? 0.6 : 1 }} onMouseOver={e => { if(!loading) e.currentTarget.style.background = '#f3f4f6' }} onMouseOut={e => { if(!loading) e.currentTarget.style.background = '#ffffff' }}>
                        <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                        </svg>
                        Continue with Google
                    </button>

                    <button type="button" onClick={handleAppleLoginMock} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '10px', background: '#000000', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }} onMouseOver={e => e.currentTarget.style.background = '#1a1a1a'} onMouseOut={e => e.currentTarget.style.background = '#000000'}>
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="white" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282"/>
                        </svg>
                        Continue with Apple
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', margin: '0.75rem 0', opacity: 0.6 }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                    <span style={{ padding: '0 14px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                </div>

                {error && (
                    <div className="slide-up" style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ textAlign: 'left' }}>
                        <label className="text-muted text-xs font-semibold mb-1 block">Email</label>
                        <input
                            type="email"
                            placeholder="professor@university.edu"
                            className="w-full"
                            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none', fontSize: '14px' }}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    
                    {!isResetting && (
                        <div style={{ textAlign: 'left', position: 'relative' }}>
                            <label className="text-muted text-xs font-semibold mb-1 block">Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="w-full"
                                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none', fontSize: '14px' }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            {!isRegistering && (
                                <div style={{ textAlign: 'right', marginTop: '6px' }}>
                                    <span 
                                        className="text-primary hover:underline" 
                                        style={{ fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                                        onClick={() => { setIsResetting(true); setError(''); }}
                                    >
                                        Forgot password?
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="btn btn-primary flex justify-center items-center py-2" style={{ fontSize: '1rem', fontWeight: 600, width: '100%', marginTop: '8px', opacity: loading ? 0.7 : 1 }}>
                        {loading ? 'Processing...' : isResetting ? 'Send Reset Link' : isRegistering ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isResetting ? (
                        <span>Remember your password? <span className="text-primary font-bold hover:underline" style={{ cursor: 'pointer' }} onClick={() => setIsResetting(false)}>Log in here.</span></span>
                    ) : isRegistering ? (
                        <span>Already have an account? <span className="text-primary font-bold hover:underline" style={{ cursor: 'pointer' }} onClick={() => { setIsRegistering(false); setError(''); }}>Log in.</span></span>
                    ) : (
                        <span>Don't have an account? <span className="text-primary font-bold hover:underline" style={{ cursor: 'pointer' }} onClick={() => { setIsRegistering(true); setError(''); }}>Sign up.</span></span>
                    )}
                </div>
            </div>
        </div>
        </div>
    );
}
