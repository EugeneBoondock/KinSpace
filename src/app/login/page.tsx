"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../supabaseClient";

const LoginContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerified, setShowVerified] = useState(false);

  useEffect(() => {
    // Only show popup if coming from email confirmation
    if (searchParams.get("verified") === "1") {
      setShowVerified(true);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      // Get the authenticated user
      const user = data?.user;
      if (user) {
        // Check if profile exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();
        if (!profile) {
          // Create a minimal profile
          await supabase.from('profiles').insert([
            {
              id: user.id,
              email: user.email,
              username: user.user_metadata?.username || "",
              isanonymous: user.user_metadata?.isanonymous || false,
              // Add more fields if needed
            }
          ]);
        }
      }
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#2A4A42] p-4">
      {showVerified && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60">
          <div className="bg-[#2A4A42] rounded-xl shadow-xl p-8 max-w-sm w-full text-center border border-[#eedfc9]">
            <h2 className="text-2xl font-bold text-[#eedfc9] mb-2">You&apos;re verified!</h2>
            <p className="text-[#eedfc9] mb-4">You don&apos;t have an account? Confirmed. Please log in to continue.</p>
            <button
              className="mt-2 px-6 py-2 bg-[#eedfc9] text-[#2A4A42] rounded-lg font-semibold hover:bg-[#eedfc9]/90 transition"
              onClick={() => setShowVerified(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      <div className="w-full max-w-md">
        <form
          onSubmit={handleLogin}
          className="rounded-xl bg-[#2A4A42] shadow-xl border border-[#eedfc9]/20 p-8 space-y-6"
        >
          <h1 className="text-3xl font-bold text-center text-[#eedfc9] mb-8">
            Login to Kin Space
          </h1>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#eedfc9] mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 px-4 bg-[#cd7731] text-white font-bold rounded-md hover:bg-[#b95e1e] transition"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

// LoginPage now wraps LoginContent with Suspense
const LoginPage: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#111b22] text-white">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
};

export default LoginPage;
