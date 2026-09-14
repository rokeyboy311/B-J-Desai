import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Lock, Mail, Eye, EyeOff, AlertCircle, Building2, CheckCircle2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  
  const { login, registerUser, signInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        await registerUser(email, password);
        navigate("/");
      } else if (mode === 'login') {
        await login(email, password);
        navigate("/");
      } else if (mode === 'forgot_password') {
        await resetPassword(email);
        setSuccess("Password reset email sent. Check your inbox.");
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError("Email is already registered");
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Invalid email or password");
      } else {
        setError(err.message || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  const toggleMode = (newMode: 'login' | 'register' | 'forgot_password') => {
    setMode(newMode);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 relative overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
        className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-indigo-900/5 p-8 sm:p-10 border border-white relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30"
          >
            <Building2 size={32} />
          </motion.div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Bina Enterprise
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-2">
            {mode === 'login' && "Secure accounting workspace"}
            {mode === 'register' && "Create your workspace account"}
            {mode === 'forgot_password' && "Recover your access"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 overflow-hidden"
            >
              <AlertCircle className="text-rose-600 w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-rose-800">{error}</p>
            </motion.div>
          )}
          
          {success && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3 overflow-hidden"
            >
              <CheckCircle2 className="text-emerald-600 w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-emerald-800">{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleAuth} className="space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm outline-none transition-all"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              {mode !== 'forgot_password' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                      Password
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => toggleMode('forgot_password')}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-11 pr-11 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm outline-none transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-11 pr-11 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Please wait...
              </span>
            ) : mode === 'login' ? (
              "Sign In to Workspace"
            ) : mode === 'register' ? (
              "Create Account"
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          {mode === 'login' ? (
            <p className="text-slate-600 font-medium">
              Don't have an account?{' '}
              <button type="button" onClick={() => toggleMode('register')} className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors">
                Sign up
              </button>
            </p>
          ) : (
            <button type="button" 
              onClick={() => toggleMode('login')} 
              className="text-indigo-600 font-bold hover:text-indigo-700 flex items-center justify-center gap-1.5 mx-auto transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Login
            </button>
          )}
        </div>

        {mode !== 'forgot_password' && (
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-400 font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-slate-200 rounded-xl shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 transition-all active:scale-[0.98]"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 mr-3" />
                Google
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
