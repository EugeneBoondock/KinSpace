import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#2A4A42] p-4" style={{ fontFamily: 'Manrope, Noto Sans, sans-serif' }}>
      <div className="bg-[#2A4A42] rounded-xl shadow-xl border border-[#eedfc9]/20 p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-[#eedfc9] mb-4">Check Your Email</h1>
        <p className="text-[#eedfc9] mb-6">
          We&apos;ve sent a verification email to your address. Please check your inbox and click the link to verify your account before logging in.
        </p>
        <Link href="/login">
          <button className="w-full py-3 px-4 rounded-full bg-[#eedfc9] text-[#2A4A42] font-bold text-sm hover:bg-[#eedfc9]/90 transition duration-200 border-2 border-[#eedfc9] hover:text-[#2A4A42] shadow-md hover:shadow-lg hover:-translate-y-0.5">
            Go to Login
          </button>
        </Link>
      </div>
    </div>
  );
} 