'use client';

import React from 'react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="card max-w-sm w-full text-center">
        {/* Envelope icon */}
        <div className="w-20 h-20 rounded-full bg-[#D19A58]/15 flex items-center justify-center mx-auto mb-6">
          <i className="ri-mail-send-line text-4xl text-[#D19A58]" />
        </div>

        <h1 className="text-2xl font-bold text-[#eedfc8] mb-3">
          Check Your Email
        </h1>

        <p className="text-sm text-[#eedfc8]/60 leading-relaxed mb-2">
          We&apos;ve sent a verification link to your email address.
          Please check your inbox and click the link to activate your account.
        </p>

        <p className="text-xs text-[#eedfc8]/40 mb-8">
          Don&apos;t see it? Check your spam folder.
        </p>

        {/* Divider */}
        <div className="border-t border-[#eedfc8]/10 mb-6" />

        <Link
          href="/login"
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 inline-flex"
        >
          <i className="ri-login-box-line" />
          Go to Login
        </Link>

        <p className="text-xs text-[#eedfc8]/40 mt-4">
          You can sign in once your email is verified.
        </p>
      </div>
    </div>
  );
}
