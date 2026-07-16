import React, { useState } from 'react';
import { Music } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            // send the confirmation-email link back to THIS app, not the
            // Supabase project's default Site URL (rainbro)
            options: { emailRedirectTo: window.location.origin },
          });
    if (error) {
      // GoTrue sometimes returns an error whose .message is an empty '{}'
      // (e.g. a 500 from a failing DB trigger, or a 429 rate limit) — which
      // rendered as a cryptic '{}' to the user and hid the real cause. Log the
      // full object (status/code visible in the console) and show a legible
      // message so failures are diagnosable and classmate-friendly.
      const status = (error as { status?: number }).status;
      const code = (error as { code?: string }).code;
      console.error('[auth]', mode, { status, code, name: error.name, message: error.message });
      const hasRealMessage = error.message && error.message !== '{}';
      setError(
        hasRealMessage
          ? error.message
          : `Couldn't ${mode === 'signup' ? 'create your account' : 'sign in'}${
              status ? ` (server error ${status})` : ''
            }. Please try again in a minute, or let Brother Jon know.`
      );
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setOauthLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setOauthLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50 canvas-bg">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center mb-3">
          <Music size={36} className="text-blue-600" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
          Master Copy Studio
        </h1>
        <p className="mt-2 text-slate-500 text-xs tracking-[0.3em] uppercase font-semibold">
          Kodály Song Library
        </p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="rainbow-stripe" />
        <div className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors px-4 py-2.5 font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || oauthLoading}
          >
            {loading ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 text-center">
          {mode === 'login' ? (
            <p className="text-slate-500 text-sm">
              Need an account?{' '}
              <button
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-800 transition-colors font-medium"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-slate-500 text-sm">
              Already here?{' '}
              <button
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-800 transition-colors font-medium"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-slate-400 text-xs">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading || oauthLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z"
            />
          </svg>
          {oauthLoading ? 'Connecting…' : 'Continue with Google'}
        </button>
        </div>
      </div>

      <p className="mt-8 text-slate-400 text-xs text-center">
        Free for the Kodály community · your songs are private to your account
      </p>
      <p className="mt-2 text-slate-400 text-xs text-center">
        A{' '}
        <a href="https://rainbowheart.studio" target="_blank" rel="noreferrer" className="rh-link">
          Rainbow Heart Studio
        </a>{' '}
        app · made with ♥ by Brother Jon
      </p>
    </div>
  );
}
