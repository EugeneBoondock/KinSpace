import React from "react";
import Link from "next/link";

const features = [
  {
    name: "Groups",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBNdoWZHd8SniGWnnYiQPPkbjlil5jRcA4U2UWuFuSJLK6aZp4_HmCe6izDfxA1hKOZQtM-noIJp99aHXvwSVsGxgel8g-46JklsqRe6IA14OOWUDnHQ-KhvMd9fPb2LI-15WPrk-mLf5fJXSII-DpOIX9WJsdMeQN97OYfprOvHmI52K6Z0IiyH3vTBogwO6gxMfRSF9XthQ5cpBrKOuSLmgIZHskg_s5o_C2eNpqTO_-PToFmUR5FVFPVtf3O7yf1t8eqV2NevDVm"
  },
  {
    name: "Login",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCqw-xaHkSSBu3vlyM7epQxYN58MpVBHGUneRHJ0Es82yrmg__JwLVVwLOFwD4-4UAWKo8UC8P0IVNKGJTwOUAqrASVcGtrDkBMIRkOsc_tKzG9cD626PLYEM1OpXiM7o9d64su8Vrtdw44VwuuJ0mhpLbcz6-c-DogfiY978uCM6v8ZIoaVY6-xTdLHzKCH5e6V7YcyREFinRtcDVLIWpVAoHsITrU6G5MLDUIP8LK4hTJ71qnOyL5rxsZlSEVMt01bIqWLdtUAlM3"
  },
  {
    name: "Nearby Support",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDp_1fAw6u2X8BjaFY9JjcDRnN_Y2wICcYdypF_aZLhx3vy799FPusaeZ8DwnH9wyE6DgQuaqkZS1RNYUU9hoX79ZMQBBP3MycOClkwA7ni7xNRkD0DzLMpDxMGVsKJvsngTpdhZgAVJhbfSL3GLFy1Mn1qVQkLJT-eKrCqW2nb8rtn4G-Ng66YlCcFqQotnCpTL0Wl24uU1moqMyV3cq1lTTDP1AYMUEkPftmbaAYrsFYfpCc9GDOQTehr9UkHHUWErvqV4yxwglh_"
  },
  {
    name: "Profile",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAoL3xNX3a8XSMZPtdMILRwiDKELT4blMgItEn0sDhHq0lE0O8tqSe7ygzrImewvXUG_DzLn3b97YHCXF7yXyXJ_4I4rYboWo2ssqVwfbGLbS5mxUtDLhbUPGsoUPlCrYkkvTwTg_vlVU8SxhxOs330vns0PlitwJhuhuXx48rxD9tddmNNAciL-kbIDcoMvLUsVCYAIivibBnXA97ZWMFCwyfMLbgVqqzHgchsADGAudfs5rz-mJLDZ6_Z26EsYLerFuX5LDSuMJTp"
  },
  {
    name: "Settings",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuB-zJvwdGfudZ0YKB_ZiGf6hl5qn2tljytjUwUQ5pdMlkLXIAu0sywaZoM_mIAiiMWq3ofUsL95fOQ1_FXNHVwQn2WtlwSjZuxP_e4mVn5QhG0N_yLuO9n06YyJVgSifsLiSDk-WibF_598sbIIBd8JPU7JAR0ZDqCv_MQ_Fw-nLpxSL9f0Fd7YVmaaki1JuBVrx8gshc7SInTMMYK26zVOSjiFhbk7BMAmsC0frgGaC0AUeNJZx8PRKy1vm8_3WTIpqSZbYMpVv95T"
  },
  {
    name: "Signup",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCRcw3feRoOsparipEuEhSC-VqZ_Aro3hFt16HDSF5Uuzoejff5X5osBdokgWWhl2uGl9PbYDkDJo1j6kV1BJ5rbkKiDLU_XpcvTOw2JNaq_3LLwH_BXwACFMc4JocwE-aqjcCVR_72EwjFFOWO-xAu_4HL4BH4cIBDwexISkX-dGVsmGnsAR-V06Nh-OlgSfYAvjlJKagzpXbUf33z_-Se36aje4Dq1KAKr5OrwhR3nkGPSq8ttacWwChtFDUu7LzGDYTMCWdMDVxA"
  },
  {
    name: "Therapist Resources",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuC_hhX-AGi0AqlliZIvqJOXFek1Dk5BCjJ2Pzq4LZU0WiHotKKXGmfop-yqchg506RUE2mNzpgEfTA7hSCcFv8yDKAdaUIxa-e9YGx5GRWV1ZaOTt_SBVE6y8N2yst1CJY1dotJwx7GCHWQpTFWkQH7xpfPw2sbqjJT41u8e-985X81PYtUyuSqWinyXETL5kqKmWbEfVhJ5DYztf41-opOsk8-sccb4Vt6qMA9bUvKezFa1IghI9RfD1n6X0EZR2JT9qoax8_Y7TfW"
  },
  {
    name: "Trauma-Bonding",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCiltR9cu4fdjA0pNzU7YzeaP5I5gvLicY9dwFtIO0vtnzhEFgdz_D2a4xOW_RIkN7cA9w7KzzedMkAjvLbM89SyX0Zxr6jKu6Qtx0y9chmRumiAhEgFEHHwCDLPNB0x0sbkoAKzn_MRbIfeLBk3UHqHxFYTyfHjLTjWuCjcx-OwJJ26Q9JYnuRB-TsrRzhBRpNeU5CJHyY4QX4W83WZuDovUU3-AEHD_wRZnOiQUzY06VZwqhMXXs1TAQhvwkKAsN0yxddQX1wTeMt"
  }
];

const BottomNav = () => (
  <div className="fixed bottom-0 left-0 w-full z-50 bg-[#f8fcfb] border-t border-[#cedbe8] shadow-[0_-2px_8px_0_rgba(0,0,0,0.03)]">
    <div className="flex gap-2 px-2 py-1 sm:px-4 sm:py-2 max-w-2xl mx-auto">
      <a className="flex flex-1 flex-col items-center justify-end gap-1 rounded-full text-[#0d1c18] py-2" href="#">
        <div className="text-[#0d1c18] flex h-8 items-center justify-center">
          {/* Home SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
            <path d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0,1.14,1.14,0,0,0,.11.11l80,75.48A16,16,0,0,1,224,115.55Z"></path>
          </svg>
        </div>
        <p className="text-[#0d1c18] text-xs font-medium leading-normal tracking-[0.015em]">Home</p>
      </a>
      <a className="flex flex-1 flex-col items-center justify-end gap-1 text-[#499c87] py-2" href="#">
        <div className="text-[#499c87] flex h-8 items-center justify-center">
          {/* Groups SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
            <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"></path>
          </svg>
        </div>
        <p className="text-[#499c87] text-xs font-medium leading-normal tracking-[0.015em]">Groups</p>
      </a>
      <a className="flex flex-1 flex-col items-center justify-end gap-1 text-[#499c87] py-2" href="#">
        <div className="text-[#499c87] flex h-8 items-center justify-center">
          {/* Messages SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
            <path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128ZM84,116a12,12,0,1,0,12,12A12,12,0,0,0,84,116Zm88,0a12,12,0,1,0,12,12A12,12,0,0,0,172,116Zm60,12A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z"></path>
          </svg>
        </div>
        <p className="text-[#499c87] text-xs font-medium leading-normal tracking-[0.015em]">Messages</p>
      </a>
      <a className="flex flex-1 flex-col items-center justify-end gap-1 text-[#499c87] py-2" href="#">
        <div className="text-[#499c87] flex h-8 items-center justify-center">
          {/* Notifications SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
            <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path>
          </svg>
        </div>
        <p className="text-[#499c87] text-xs font-medium leading-normal tracking-[0.015em]">Notifications</p>
      </a>
      <a className="flex flex-1 flex-col items-center justify-end gap-1 text-[#499c87] py-2" href="#">
        <div className="text-[#499c87] flex h-8 items-center justify-center">
          {/* Profile SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
            <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"></path>
          </svg>
        </div>
        <p className="text-[#499c87] text-xs font-medium leading-normal tracking-[0.015em]">Profile</p>
      </a>
    </div>
  </div>
);

const FeaturesPage = () => (
  <div className="relative flex size-full min-h-screen flex-col bg-[#f8fcfb] justify-between font-[Manrope,sans-serif] overflow-x-hidden">
    <div>
      <div className="flex items-center bg-[#f8fcfb] p-4 pb-2 justify-between">
        <h2 className="text-[#0d1c18] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pl-12">The Gathering</h2>
        <div className="flex w-12 items-center justify-end">
          <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 bg-transparent text-[#0d1c18] gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 p-0">
            <div className="text-[#0d1c18]">
              {/* Gear SVG */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
                <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z"></path>
              </svg>
            </div>
          </button>
        </div>
      </div>
      <h2 className="text-[#0d1c18] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Features</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-6 py-6 w-full max-w-6xl mx-auto">
        {features.map((feature) => {
          // Compute route path
          const route = `/${feature.name.toLowerCase().replace(/\s+/g, "-")}`;
          return (
            <Link
              key={feature.name}
              href={route}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#cee8e2] bg-white shadow-sm hover:shadow-md transition-shadow duration-200 p-6 min-h-[150px] cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#499c87]"
            >
              <div
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg w-14 h-14 mb-2 border border-[#e7f4f0] group-hover:scale-105 transition-transform"
                style={{ backgroundImage: `url('${feature.url}')` }}
              ></div>
              <h2 className="text-[#0d1c18] text-base font-semibold leading-tight text-center group-hover:text-[#499c87] transition-colors">
                {feature.name}
              </h2>
            </Link>
          );
        })}
      </div>
    </div>
    <BottomNav />
  </div>
);

export default FeaturesPage;
