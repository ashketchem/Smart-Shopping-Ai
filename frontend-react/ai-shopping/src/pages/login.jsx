import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';

export default function PremiumGlassLogin() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email layout requires completion';
    if (!formData.password) newErrors.password = 'Password cannot be empty';
    setErrors(newErrors);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0712] font-sans antialiased">
      
      {/* BACKGROUND MESH BLOB SYSTEM: Crucial for Dribbble glass contrast depth */}
      <div className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 opacity-40 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[45vw] w-[45vw] rounded-full bg-gradient-to-tl from-cyan-500 via-blue-600 to-indigo-700 opacity-30 blur-[130px]" />
      <div className="absolute top-[30%] right-[20%] h-[25vw] w-[25vw] rounded-full bg-pink-500 opacity-20 blur-[90px] animate-pulse" />

      {/* INNER AMBIENT RING LIGHT */}
      <div className="absolute h-[600px] w-[600px] rounded-full border border-white/5 opacity-40" />
      <div className="absolute h-[800px] w-[800px] rounded-full border border-white/[0.02] opacity-20" />

      {/* MAIN AUTH MATRIX GLASS CARD CONTAINER */}
      <div className="relative w-full max-w-[460px] mx-4 rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-10 text-white shadow-[0_22px_70px_4px_rgba(0,0,0,0.56)] backdrop-blur-[24px] before:absolute before:inset-0 before:-z-10 before:rounded-[28px] before:bg-gradient-to-b before:from-white/[0.07] before:to-transparent">
        
        {/* HEADER AREA */}
        <div className="mb-9 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.06] mb-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
            <div className="h-5 w-5 rounded-md bg-gradient-to-tr from-indigo-500 to-pink-500" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
            Welcome back
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-400/90">
            Access your secure workspace panel.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* CONTROLLED EMAIL COMPONENT */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                <Mail size={18} className="opacity-70" />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@domain.com"
                className={`w-full rounded-xl border bg-slate-950/40 pl-11 pr-4 py-3.5 text-sm transition-all duration-300 placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                  errors.email
                    ? 'border-red-500/50 focus:ring-red-500/20'
                    : 'border-white/[0.06] focus:border-purple-500/50 focus:bg-slate-950/60 focus:ring-purple-500/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]'
                }`}
              />
            </div>
            {errors.email && <p className="text-xs font-medium text-red-400 pl-1">{errors.email}</p>}
          </div>

          {/* CONTROLLED PASSWORD COMPONENT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <a href="#forgot" className="text-xs font-medium text-purple-400 transition hover:text-purple-300 hover:underline">
                Forgot?
              </a>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                <Lock size={18} className="opacity-70" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••••••"
                className={`w-full rounded-xl border bg-slate-950/40 pl-11 pr-12 py-3.5 text-sm transition-all duration-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 ${
                  errors.password
                    ? 'border-red-500/50 focus:ring-red-500/20'
                    : 'border-white/[0.06] focus:border-purple-500/50 focus:bg-slate-950/60 focus:ring-purple-500/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-white transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs font-medium text-red-400 pl-1">{errors.password}</p>}
          </div>

          {/* EXTRA ACTIONS CHECKS */}
          <div className="flex items-center space-x-2 pt-1 cursor-pointer group">
            <input 
              type="checkbox" 
              id="remember"
              className="h-4 w-4 rounded border-white/10 bg-slate-950/50 text-purple-600 focus:ring-0 focus:ring-offset-0 accent-purple-500" 
            />
            <label htmlFor="remember" className="text-xs font-medium text-slate-400 select-none group-hover:text-slate-300 transition">
              Keep me securely logged in
            </label>
          </div>

          {/* PRIMARY SOLID SUBMIT BUTTON WITH GLOW ELEMENT */}
          <div className="relative pt-3 group">
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 opacity-40 blur-md transition duration-300 group-hover:opacity-70" />
            <button
              type="submit"
              className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-md transition duration-200 hover:bg-slate-50 active:scale-[0.99]"
            >
              <span>Continue Workspace Access</span>
              <ArrowRight size={16} className="text-slate-950 stroke-[2.5]" />
            </button>
          </div>

        </form>

        {/* FOOTER OPTION REGISTRATION LINK */}
        <div className="mt-8 text-center text-xs font-medium text-slate-400">
          Not part of an organization yet?{' '}
          <a href="#register" className="text-white font-semibold underline underline-offset-4 decoration-purple-500/60 hover:decoration-purple-400 transition">
            Request an invite
          </a>
        </div>

      </div>
    </div>
  );
}
