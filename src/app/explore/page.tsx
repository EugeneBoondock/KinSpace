export default function ExplorePage() {
  return (
    <div className="relative flex size-full min-h-screen flex-col bg-[#2A4A42] justify-between group/design-root overflow-x-hidden" style={{fontFamily: 'Manrope, "Noto Sans", sans-serif'}}>
      <div>
        <div className="flex items-center bg-[#2A4A42] p-4 pb-2 justify-between">
          <div className="text-[#eedfc9] flex size-12 shrink-0 items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
            </svg>
          </div>
          <h2 className="text-[#eedfc9] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">Search</h2>
        </div>
        <div className="px-4 py-3">
          <label className="flex flex-col min-w-40 h-12 w-full">
            <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
              <div className="text-[#eedfc9]/70 flex border-none bg-[#eedfc9]/10 items-center justify-center pl-4 rounded-l-xl border-r-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                </svg>
              </div>
              <input
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#eedfc9] focus:outline-0 focus:ring-0 border-none bg-[#eedfc9]/10 focus:border-none h-full placeholder:text-[#eedfc9]/70 px-4 rounded-r-none border-r-0 pr-2 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal"
                placeholder="Search conditions..."
                value="Hemorrhoids"
              />
              <div className="flex items-center justify-center rounded-r-xl border-l-0 border-none bg-[#eedfc9]/10 pr-4">
                <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full bg-transparent text-[#eedfc9] gap-2 text-base font-bold leading-normal tracking-[0.015em] h-auto min-w-0 px-0">
                  <div className="text-[#eedfc9]/70">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                      <path d="M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32Z" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          </label>
        </div>
        <p className="text-[#eedfc9] text-base font-normal leading-normal pb-3 pt-1 px-4">
          Welcome to KinSpace! We&apos;re here to help you find the information and support you need. Please use the search bar above to explore topics related to temporary conditions
          like hemorrhoids.
        </p>
        <h2 className="text-[#eedfc9] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Trending Conditions</h2>
        <div className="flex gap-3 p-3 flex-wrap pr-4">
          {['Common Cold', 'Flu', 'Allergies', 'Migraines', 'Back Pain'].map((condition) => (
            <div key={condition} className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full bg-[#eedfc9]/10 pl-4 pr-4">
              <p className="text-[#eedfc9] text-sm font-medium leading-normal">{condition}</p>
            </div>
          ))}
        </div>
        <h2 className="text-[#eedfc9] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Condition Categories</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(158px,1fr))] gap-3 p-4">
          {[
            { title: 'Cardiovascular', icon: 'Heart' },
            { title: 'Neurological', icon: 'Brain' },
            { title: 'Musculoskeletal', icon: 'Bone' },
            { title: 'Ophthalmological', icon: 'Eye' },
            { title: 'Gastrointestinal', icon: 'SmileyNervous' }
          ].map((category) => (
            <div key={category.title} className="flex flex-1 gap-3 rounded-lg border border-[#eedfc9]/20 bg-[#2A4A42] p-4 items-center">
              <div className="text-[#eedfc9]">
                {/* Icon would go here */}
              </div>
              <h2 className="text-[#eedfc9] text-base font-bold leading-tight">{category.title}</h2>
            </div>
          ))}
        </div>
        <h2 className="text-[#eedfc9] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Related Resources</h2>
        <div className="flex items-center gap-4 bg-[#2A4A42] px-4 min-h-14">
          <div className="text-[#eedfc9] flex items-center justify-center rounded-lg bg-[#eedfc9]/10 shrink-0 size-10">
            {/* User icon */}
          </div>
          <p className="text-[#eedfc9] text-base font-normal leading-normal flex-1 truncate">Find a Doctor</p>
        </div>
        <div className="flex items-center gap-4 bg-[#2A4A42] px-4 min-h-14">
          <div className="text-[#eedfc9] flex items-center justify-center rounded-lg bg-[#eedfc9]/10 shrink-0 size-10">
            {/* Users icon */}
          </div>
          <p className="text-[#eedfc9] text-base font-normal leading-normal flex-1 truncate">Support Groups</p>
        </div>
      </div>
      <div>
        <div className="flex gap-2 border-t border-[#eedfc9]/20 bg-[#2A4A42] px-4 pb-3 pt-2">
          {['Home', 'Explore', 'Groups', 'Notifications', 'Profile'].map((item, i) => (
            <a key={i} className={`just flex flex-1 flex-col items-center justify-end gap-1 ${item === 'Explore' ? 'text-[#eedfc9]' : 'text-[#eedfc9]/70'}`} href="#">
              <div className={`${item === 'Explore' ? 'text-[#eedfc9]' : 'text-[#eedfc9]/70'} flex h-8 items-center justify-center`}>
                {/* Icon would go here */}
              </div>
              <p className={`${item === 'Explore' ? 'text-[#eedfc9]' : 'text-[#eedfc9]/70'} text-xs font-medium leading-normal tracking-[0.015em]`}>{item}</p>
            </a>
          ))}
        </div>
        <div className="h-5 bg-[#2A4A42]"></div>
      </div>
    </div>
  );
}
