"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";

const LoginPage: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111b22] p-4">
      <div className="w-full max-w-md">
        <form
          onSubmit={handleLogin}
          className="rounded-xl bg-[#192734] shadow-xl p-8 space-y-6"
        >
          <h1 className="text-3xl font-bold text-center text-white mb-8">
            Login to Mito
          </h1>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-700 rounded-md shadow-sm focus:ring-blue-400 focus:border-blue-400 bg-[#111b22] text-white sm:text-sm"
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
              className="mt-1 block w-full px-4 py-2 border border-gray-700 rounded-md shadow-sm focus:ring-blue-400 focus:border-blue-400 bg-[#111b22] text-white sm:text-sm"
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

export default LoginPage;
