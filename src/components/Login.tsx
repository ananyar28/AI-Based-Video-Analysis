import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const navigate = useNavigate();
    const { login } = useAuth();

    const toggleMode = () => {
        setIsLogin(!isLogin);
    };

    const handleGoogleSuccess = async (tokenResponse: any) => {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    Authorization: `Bearer ${tokenResponse.access_token}`,
                },
            });
            const userData = await res.json();
            login({
                name: userData.name,
                email: userData.email,
                avatar: userData.picture
            });
            navigate('/');
        } catch (error) {
            console.error('Failed to fetch user info', error);
            alert('Login failed. Please try again.');
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: handleGoogleSuccess,
        onError: () => {
            console.log('Login Failed');
            alert("Google Login Failed");
        }
    });

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock Login for Form
        // In a real app, you would validate credentials against a backend here
        const form = e.target as HTMLFormElement;
        const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement;
        const email = emailInput.value;
        const name = isLogin ? 'Demo User' : (form.querySelector('input[type="text"]') as HTMLInputElement).value;

        login({
            name: name,
            email: email,
            avatar: name.charAt(0).toUpperCase()
        });
        navigate('/');
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="auth-subtitle">
                    {isLogin
                        ? 'Access your AegisVision dashboard'
                        : 'Join AegisVision for advanced analysis'}
                </p>

                <form className="auth-form" onSubmit={handleFormSubmit}>
                    {!isLogin && (
                        <div className="form-group">
                            <label>Full Name</label>
                            <input type="text" placeholder="John Doe" required />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email Address</label>
                        <input type="email" placeholder="name@company.com" required />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" placeholder="••••••••" required />
                    </div>

                    <button type="submit" className="auth-btn primary">
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>OR</span>
                </div>

                <button className="auth-btn google" onClick={() => googleLogin()}>
                    <svg className="google-icon" width="18" height="18" viewBox="0 0 18 18">
                        <path d="M17.64 9.2c0-.637-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"></path>
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.185l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.715H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"></path>
                        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 .238 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"></path>
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.159 6.656 3.58 9 3.58z" fill="#EA4335"></path>
                    </svg>
                    Continue with Google
                </button>

                <p className="auth-switch">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span onClick={toggleMode} className="link-text">
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </span>
                </p>
            </div>
        </div>
    );
};

export default Login;
