import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Mail, Lock, User, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export const UWOLoginModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialRegister = false,
  appCode = 'yugamc',
  apiKey = import.meta.env.VITE_UWO_API_KEY || '',
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(initialRegister);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  React.useEffect(() => {
    setIsRegisterMode(initialRegister);
  }, [initialRegister]);

  if (!isOpen) return null;

  const UNIFIED_API_URL = (() => {
    const envUrl = import.meta.env.VITE_UNIFIED_BACKEND_API;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.trim().replace(/\/+$/, '');
    }
    // Default to the public UWO SSO API domain
    return envUrl || 'https://uwo24.com/api';
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isRegisterMode) {
        // 1. Register new central account
        const regRes = await fetch(`${UNIFIED_API_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Application-Key': apiKey,
          },
          body: JSON.stringify({ name, email, password }),
        });

        const regData = await regRes.json();
        if (!regRes.ok) {
          let errorText = 'Registration failed';
          if (typeof regData.detail === 'string') {
            errorText = regData.detail;
          } else if (Array.isArray(regData.detail)) {
            errorText = regData.detail.map((d) => d.msg || d.detail).join(', ');
          } else if (regData.message) {
            errorText = String(regData.message);
          }

          if (errorText.toLowerCase().includes('already exists')) {
            errorText = 'An account with this email already exists. Switching to Sign In...';
            setTimeout(() => {
              setIsRegisterMode(false);
              setError('');
            }, 1800);
          }
          throw new Error(errorText);
        }

        setSuccessMsg('Account created successfully! Signing in...');
      }

      // 2. Authenticate & Obtain Central UWO Tokens
      const loginRes = await fetch(`${UNIFIED_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Application-Key': apiKey,
        },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        let loginErr = 'Authentication failed';
        if (typeof loginData.detail === 'string') {
          loginErr = loginData.detail;
        } else if (Array.isArray(loginData.detail)) {
          loginErr = loginData.detail.map((d) => d.msg || d.detail).join(', ');
        } else if (loginData.message) {
          loginErr = String(loginData.message);
        }
        throw new Error(loginErr);
      }

      // Fetch user profile from /auth/me
      let uwoUser = { email, name: name || email.split('@')[0] };
      try {
        const meRes = await fetch(`${UNIFIED_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${loginData.access_token}` },
        });
        if (meRes.ok) {
          uwoUser = await meRes.json();
        }
      } catch (meErr) {
        console.warn('Failed to fetch /auth/me:', meErr);
      }

      // Store tokens and identity in localStorage
      localStorage.setItem('adminToken', loginData.access_token);
      localStorage.setItem('uwo_access_token', loginData.access_token);
      localStorage.setItem('uwo_user', JSON.stringify(uwoUser));

      setLoading(false);
      if (onSuccess) onSuccess({ token: loginData.access_token, user: uwoUser });
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err?.message || 'Authentication error');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-md p-8 bg-white border border-secondary rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.2)] overflow-hidden text-text font-sans"
        >
          {/* Top accent border */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-accent" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-secondary relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shadow-sm">
                <Zap className="w-5 h-5 fill-accent" />
              </div>
              <div>
                <h3 className="text-sm font-serif font-bold uppercase tracking-wider text-text">
                  {isRegisterMode ? 'Create UWO Account' : 'UWO SSO Sign In'}
                </h3>
                <p className="text-[11px] font-sans font-bold tracking-widest uppercase text-text/60">
                  Unified Platform Access
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary hover:bg-secondary text-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex p-1 mt-5 bg-primary border border-secondary rounded-2xl relative z-10">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(false);
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                !isRegisterMode
                  ? 'bg-text text-white shadow-md'
                  : 'text-text/70 hover:text-text'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(true);
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                isRegisterMode
                  ? 'bg-text text-white shadow-md'
                  : 'text-text/70 hover:text-text'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4 relative z-10">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {isRegisterMode && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-text/70 mb-1.5 ml-1">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 w-4 h-4 text-text/40" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Admin User"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-primary/40 border border-secondary/50 rounded-2xl text-text placeholder:text-text/40 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-text/70 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-text/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@uwo24.com"
                  className="w-full pl-10 pr-4 py-3 text-sm bg-primary/40 border border-secondary/50 rounded-2xl text-text placeholder:text-text/40 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-text/70 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-text/40" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 text-sm bg-primary/40 border border-secondary/50 rounded-2xl text-text placeholder:text-text/40 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 bg-text text-white rounded-full font-bold text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-accent transition-all duration-300 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  {isRegisterMode ? 'Register & Sign In' : 'Sign In with UWO'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer mode toggle */}
          <div className="mt-6 pt-4 border-t border-secondary text-center text-xs text-text/70 relative z-10">
            {isRegisterMode ? (
              <span>
                Already have a UWO account?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(false)}
                  className="text-accent font-bold hover:underline ml-1"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                New to UWO Platform?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(true)}
                  className="text-accent font-bold hover:underline ml-1"
                >
                  Create an Account
                </button>
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UWOLoginModal;
