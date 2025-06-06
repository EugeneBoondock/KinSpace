'use client';

import React from "react";
import Link from "next/link";

const groupImages = [
  {
    name: "Chronic Pain Support",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDIbFPgscZwXdvM8YBhKsKPrIFHurESj91w8UQRMZ0_RYExr7xJsHaaKoW-Jg2e-f0MYtQnGEPLjIpTC625pKTH_crVO-uoeQSqQ3SZBErWCvUhgCYR8B7zsBPGL-k_eRmh8xi6NXS6vVhOMDBXZVPWmT__IiPpere1u8Ckj536qM_-byYug9QVdBvRiDhGCPY8bLqkN1Kwcq1G8yFpEvMuo8vFxAHhB5W7JQvh-hKuGQ-cSDTC_x4lOLz_lYBtqxac1Z40aTmpm2yi"
  },
  {
    name: "Mental Health Warriors",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuA6A99w_l-7bwNpSt5MFbjILona0rPLyWtdAbv82fgwJSHlttAJ8ruNo1k4JBB_1ZCKwUGxPB0K5aJbBF1-zajFDKOK6asOpV8Isml9ixGCfx6iOtmW3XWTpzS_BYo23oyi8QySvluharhMCWJhv6J9c4QOnxSqZW2aTrQpR_LurtDppBBD9k6O8fmWH3_O_ycYiXGqQ4-Vasdpd-o7ttcsOwbXkwKxEc9kdUizAAhK5yghIVQLnOWIyUHE475SsjTQYdHF1pTrr242"
  },
  {
    name: "Autoimmune Allies",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuA8xFNZ069urLrfK4E5lgcdraMQ7OhfpSC09OqTQ5EijjbamB7sH4K5X7fu7FJavGyDjIbxUYFymzo30BkVNRrqKUR1TF0mmqyN0Apouo8CDPa1ftUBDcT4fB1MvKZaOoZMRITW00rR8gR28-CB3cDm_8LHY8Pzqp3kpPZc2XL5wd9nxnhcCtKWFPBQEKhvAL2vH9eb7IRIYgzccGrgXX8WpHQUEeIdg2qXUrrtuToDeJU1ngDk4yz0hjdxbrr8Skv8K8w_9nLHDtTH"
  }
];

const communityImages = [
  {
    name: "Trauma-Bonding",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCakRMc61KEme_VfOekxcLNqBssNWlqgYklIlY5pSScQJkJoOaCPosZW_4I6flTfkxq3c8irZ4re12yaWijKUE1Ir079VnepjbVMYYJNvp0o7I0gb8ymtorJTkaWR_EC0NHKzwWNgRIvuOFtTAHD8Cl7d3rnnBpBrA6WGNqii9SJBtZZVlkLLoM6NRdWWCcvvfBLvVpRGf4NTm4fwrdrXDJDKR2gpId7mbICCw4D-Qs_NgO6VAs_4jtOeWZUVUgfsBH5XwpK-YR09v_"
  },
  {
    name: "Daily Prompt Circle",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCyC7upSVp9o7fi8qqqJ6Sczue3IVPRXy7PVFitIhaprHby4sksNv6zomMMyu4BNYry5VK94xtKVIxHqWrIwEcFCTgOvV1z_NoBdLJ9NeXvLu-hYb9gsNR0vYdzqXPOTlK7Ml8axkLeSktv1Sjcy4O3IPOg48jhUNL7-SddH0ik9Mcq-YuaAXIqaaFngHN2NOP1Bfu1qrDmrU622jYQalz_PSsSEPIzJtVmxqTgnun_YlTTH4RLMfIMAZqMmGbHhQABWWSihnlQr7Kj"
  },
  {
    name: "Friendship First",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDvbob4j_Yk6fCmijC6378O-ccfLQSIF4ghHfdqyah9XsO0F_U6dQaO7jSrcPhQPHQBlGu7VnwHjsAcJtkcD9FMmOzaiTG84npyBP79d1L39Mg4PlOgo1UKZAeC6ixTcptDatQFw3uhDcwstOtonCo-JvId1MbzkynNFVNV5C02QUhF-UcWh0SACllBRw4H9-9IGRXOIRRXkQNuhwzFZGk3mKoUaRGFtbYkXW-O9ZjgB0tGgu5C8ZnUql4jju9VGlETT9_xHckWLWrh"
  }
];

const Tabs = () => (
  <div className="flex border-b border-[#cedbe8] px-4 gap-8">
    <a className="flex flex-col items-center justify-center border-b-[3px] border-b-[#0c7ff2] text-[#0d141c] pb-[13px] pt-4" href="#">
      <p className="text-[#0d141c] text-sm font-bold leading-normal tracking-[0.015em]">For you</p>
    </a>
    <a className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#49739c] pb-[13px] pt-4" href="#">
      <p className="text-[#49739c] text-sm font-bold leading-normal tracking-[0.015em]">Following</p>
    </a>
    <a className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#49739c] pb-[13px] pt-4" href="#">
      <p className="text-[#49739c] text-sm font-bold leading-normal tracking-[0.015em]">Your groups</p>
    </a>
  </div>
);

const ImageCarousel = ({ images }: { images: { name: string; url: string }[] }) => (
  <div className="flex overflow-y-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <div className="flex items-stretch p-4 gap-3">
      {images.map((img) => (
        <div key={img.name} className="flex h-full flex-1 flex-col gap-4 rounded-lg min-w-40">
          <div
            className="w-full bg-center bg-no-repeat aspect-square bg-cover rounded-lg flex flex-col"
            style={{ backgroundImage: `url('${img.url}')` }}
          ></div>
          <p className="text-[#0d141c] text-base font-medium leading-normal">{img.name}</p>
        </div>
      ))}
    </div>
  </div>
);

const GroupsPage = () => (
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
      <Tabs />
      <h2 className="text-[#0d1c18] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Based on your conditions</h2>
      <div className="px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-6xl mx-auto">
          {groupImages.map((img) => (
            <div
              key={img.name}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#cee8e2] bg-white shadow-sm hover:shadow-md transition-shadow duration-200 p-6 min-h-[150px] cursor-pointer group"
            >
              <div
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg w-14 h-14 mb-2 border border-[#e7f4f0] group-hover:scale-105 transition-transform"
                style={{ backgroundImage: `url('${img.url}')` }}
              ></div>
              <h2 className="text-[#0d1c18] text-base font-semibold leading-tight text-center group-hover:text-[#499c87] transition-colors">
                {img.name}
              </h2>
            </div>
          ))}
        </div>
      </div>
      <h2 className="text-[#0d1c18] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Communities</h2>
      <div className="px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-6xl mx-auto">
          {communityImages.map((img) => (
            <div
              key={img.name}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#cee8e2] bg-white shadow-sm hover:shadow-md transition-shadow duration-200 p-6 min-h-[150px] cursor-pointer group"
            >
              <div
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg w-14 h-14 mb-2 border border-[#e7f4f0] group-hover:scale-105 transition-transform"
                style={{ backgroundImage: `url('${img.url}')` }}
              ></div>
              <h2 className="text-[#0d1c18] text-base font-semibold leading-tight text-center group-hover:text-[#499c87] transition-colors">
                {img.name}
              </h2>
            </div>
          ))}
        </div>
      </div>
    </div>
    {/* Bottom Navigation - same as FeaturesPage */}
    <div>
      <div className="flex gap-2 border-t border-[#e7f4f0] bg-[#f8fcfb] px-4 pb-3 pt-2">
        <a className="just flex flex-1 flex-col items-center justify-end gap-1 rounded-full text-[#0d1c18]" href="#">
          <div className="text-[#0d1c18] flex h-8 items-center justify-center">
            {/* Home SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0,1.14,1.14,0,0,0,.11.11l80,75.48A16,16,0,0,1,224,115.55Z"></path>
            </svg>
          </div>
          <p className="text-[#0d1c18] text-xs font-medium leading-normal tracking-[0.015em]">Home</p>
        </a>
        <a className="just flex flex-1 flex-col items-center justify-end gap-1 text-[#499c87]" href="#">
          <div className="text-[#499c87] flex h-8 items-center justify-center">
            {/* Groups SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"></path>
            </svg>
          </div>
          <p className="text-[#499c87] text-xs font-medium leading-normal tracking-[0.015em]">Groups</p>
        </a>
        <a className="just flex flex-1 flex-col items-center justify-end gap-1 text-[#499c87]" href="#">
          <div className="text-[#499c87] flex h-8 items-center justify-center">
            {/* Messages SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128ZM84,116a12,12,0,1,0,12,12A12,12,0,0,0,84,116Zm88,0a12,12,0,1,0,12,12A12,12,0,0,0,172,116Zm60,12A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z"></path>
            </svg>
          </div>
          <p className="text-[#499c87] text-xs font-medium leading-normal tracking-[0.015em]">Messages</p>
        </a>
        <a className="just flex flex-1 flex-col items-center justify-end gap-1 text-[#499c87]" href="#">
          <div className="text-[#499c87] flex h-8 items-center justify-center">
            {/* Notifications SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path>
            </svg>
          </div>
          <p className="text-[#499c87] text-xs font-medium leading-normal tracking-[0.015em]">Notifications</p>
        </a>
        <a className="just flex flex-1 flex-col items-center justify-end gap-1 text-[#499c87]" href="#">
          <div className="text-[#499c87] flex h-8 items-center justify-center">
            {/* Profile SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"></path>
            </svg>
          </div>
          <p className="text-[#499c87] text-xs font-medium leading-normal tracking-[0.015em]">Profile</p>
        </a>
      </div>
      <div className="h-5 bg-[#f8fcfb]"></div>
    </div>
  </div>
);

export default GroupsPage;
