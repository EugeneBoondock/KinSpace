import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111b22] p-4" style={{ fontFamily: 'Manrope, Noto Sans, sans-serif' }}>
      <div className="bg-[#192734] rounded-xl shadow-xl p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Check Your Email</h1>
        <p className="text-gray-300 mb-6">
          We&apos;ve sent a verification email to your address. Please check your inbox and click the link to verify your account before logging in.
        </p>
        <Link href="/login">
          <button className="w-full py-3 px-4 rounded-md bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 transition">
            Go to Login
          </button>
        </Link>
      </div>
    </div>
  );
} 