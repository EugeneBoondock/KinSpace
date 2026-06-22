'use client';

import React from 'react';
import { LinkButton, Card } from '@/components/ui';

export default function VerifyEmailPage() {
  return (
    <main className="page-shell">
      <div className="page-container max-w-md">
        <div className="mx-auto mt-6 w-full">
          <Card className="text-center">
            {/* Envelope icon */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-accent2/15">
              <i className="ri-mail-send-line text-4xl text-brand-accent2" aria-hidden="true" />
            </div>

            <h1 className="mb-3 text-2xl font-bold text-brand-background">
              Check your email
            </h1>

            <p className="mb-2 text-sm leading-relaxed text-brand-background/70">
              We&apos;ve sent a verification link to your email address. Open it and tap the
              link to activate your account - it only takes a moment.
            </p>

            <p className="mb-7 text-xs text-brand-background/45">
              Don&apos;t see it? Give it a minute, then check your spam or promotions folder.
            </p>

            <div className="mb-6 h-px bg-brand-background/10" />

            <LinkButton href="/login" fullWidth leadingIcon={<i className="ri-login-box-line" aria-hidden="true" />}>
              Go to sign in
            </LinkButton>

            <p className="mt-4 text-xs text-brand-background/45">
              You can sign in as soon as your email is verified.
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
