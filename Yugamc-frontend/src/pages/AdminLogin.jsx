import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Zap } from 'lucide-react';
import { adminLogin } from '../services/adminApi';
import { getToken, setToken } from '../auth/authStorage';
import UWOLoginModal from '../components/UWOLoginModal';

const AdminLogin = () => {
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showUwoModal, setShowUwoModal] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = getToken();
        if (token) {
            navigate('/admin/dashboard');
        }
    }, [navigate]);

    const handleChange = (e) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const data = await adminLogin(credentials);
            setToken(data.token);
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.message || 'Could not connect to server.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="min-h-screen bg-primary flex flex-col items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-md bg-white rounded-3xl p-10 shadow-[0_30px_70px_rgba(0,0,0,0.05)] border border-secondary relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-accent" />

                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-3xl font-serif text-text font-bold mb-2 tracking-tight">Admin Login</h1>
                    <p className="text-xs font-sans text-text font-bold tracking-[0.2em] uppercase font-bold">Manage Assistant Data</p>
                </div>

                {error && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-6 p-4 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-sans font-bold text-center"
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text font-bold group-focus-within:text-accent transition-colors">
                            <User size={18} />
                        </div>
                        <input
                            type="text"
                            name="username"
                            placeholder="Username"
                            required
                            value={credentials.username}
                            onChange={handleChange}
                            className="w-full bg-primary/40 border border-secondary/50 py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-1 focus:ring-accent transition-all text-sm font-sans placeholder:text-text font-bold"
                        />
                    </div>

                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text font-bold group-focus-within:text-accent transition-colors">
                            <Lock size={18} />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            placeholder="Password"
                            required
                            value={credentials.password}
                            onChange={handleChange}
                            className="w-full bg-primary/40 border border-secondary/50 py-4 pl-12 pr-12 rounded-2xl outline-none focus:ring-1 focus:ring-accent transition-all text-sm font-sans placeholder:text-text font-bold"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-text font-bold hover:text-text transition-colors"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative w-full px-10 py-5 bg-text text-white font-sans tracking-[0.3em] uppercase text-[11px] font-bold rounded-full overflow-hidden transition-all duration-500 shadow-2xl active:scale-95 disabled:opacity-50 mt-4 cursor-pointer"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            {isLoading ? 'Wait...' : 'Login'} 
                            {!isLoading && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                        </span>
                        <div className="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.76, 0, 0.24, 1]" />
                    </button>
                </form>

                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-secondary" />
                    <span className="text-[10px] font-sans font-bold tracking-[0.2em] uppercase text-text/50">or continue with</span>
                    <div className="flex-1 h-px bg-secondary" />
                </div>

                <button
                    type="button"
                    onClick={() => setShowUwoModal(true)}
                    className="w-full py-4 px-6 bg-accent/10 border border-accent/30 hover:bg-accent/20 rounded-full font-sans font-bold text-xs uppercase tracking-[0.2em] text-accent transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                    <Zap size={15} className="fill-accent" />
                    <span>UWO SSO Sign In</span>
                </button>

                <UWOLoginModal
                    isOpen={showUwoModal}
                    onClose={() => setShowUwoModal(false)}
                    appCode="yugamc"
                    apiKey={import.meta.env.VITE_UWO_API_KEY || ''}
                    onSuccess={(data) => {
                        setToken(data.token);
                        navigate('/admin/dashboard');
                    }}
                />
            </motion.div>
        </section>
    );
};

export default AdminLogin;
