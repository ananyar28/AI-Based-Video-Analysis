import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
    name: string;
    email: string;
    avatar?: string;
}

interface AuthContextType {
    user: User | null;
    login: (userData: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    // Check local storage on mount to persist login
    useEffect(() => {
        const storedUser = sessionStorage.getItem('aegis_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse stored user", e);
            }
        }
    }, []);

    const login = (userData: User) => {
        setUser(userData);
        sessionStorage.setItem('aegis_user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        sessionStorage.removeItem('aegis_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
