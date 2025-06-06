export default function ResourcesPage() {
  return (
    <div className="relative flex size-full min-h-screen flex-col bg-[#2A4A42] justify-between group/design-root overflow-x-hidden" style={{fontFamily: 'Manrope, "Noto Sans", sans-serif'}}>
      <div>
        <div className="flex items-center bg-[#2A4A42] p-4 pb-2 justify-between">
          <div className="text-[#eedfc9] flex size-12 shrink-0 items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
            </svg>
          </div>
          <h2 className="text-[#eedfc9] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">Resources</h2>
        </div>
        <div className="pb-3">
          <div className="flex border-b border-[#eedfc9]/20 px-4 gap-8">
            <a className="flex flex-col items-center justify-center border-b-[3px] border-b-[#eedfc9] text-[#eedfc9] pb-[13px] pt-4" href="#">
              <p className="text-[#eedfc9] text-sm font-bold leading-normal tracking-[0.015em]">Articles</p>
            </a>
            <a className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#eedfc9]/70 pb-[13px] pt-4" href="#">
              <p className="text-[#eedfc9]/70 text-sm font-bold leading-normal tracking-[0.015em]">Videos</p>
            </a>
            <a className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#eedfc9]/70 pb-[13px] pt-4" href="#">
              <p className="text-[#eedfc9]/70 text-sm font-bold leading-normal tracking-[0.015em]">Guides</p>
            </a>
          </div>
        </div>
        <div className="p-4">
          {[1, 2, 3].map((_, i) => (
            <div key={i} className="flex items-stretch justify-between gap-4 rounded-xl mb-4">
              <div className="flex flex-col gap-1 flex-[2_2_0px]">
                <p className="text-[#eedfc9]/70 text-sm font-normal leading-normal">Article</p>
                <p className="text-[#eedfc9] text-base font-bold leading-tight">
                  {i === 0 ? 'Understanding Chronic Pain' : i === 1 ? 'Coping with Fatigue' : 'Building a Support Network'}
                </p>
                <p className="text-[#eedfc9]/70 text-sm font-normal leading-normal">
                  {i === 0
                    ? 'Explore the science behind chronic pain and effective management strategies.'
                    : i === 1
                    ? 'Learn practical tips for managing fatigue and improving your energy levels.'
                    : 'Discover the importance of social support and how to connect with others.'}
                </p>
              </div>
              <div className="w-full bg-center bg-no-repeat aspect-video bg-cover rounded-xl flex-1" style={{backgroundImage: `url(${i === 0 ? 'https://example.com/chronic-pain.jpg' : i === 1 ? 'https://example.com/fatigue.jpg' : 'https://example.com/support.jpg'})`}} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex gap-2 border-t border-[#eedfc9]/20 bg-[#2A4A42] px-4 pb-3 pt-2">
          {['Home', 'Connect', 'Resources', 'Profile'].map((item, i) => (
            <a key={i} className={`just flex flex-1 flex-col items-center justify-end gap-1 ${item === 'Resources' ? 'text-[#eedfc9]' : 'text-[#eedfc9]/70'}`} href="#">
              <div className={`${item === 'Resources' ? 'text-[#eedfc9]' : 'text-[#eedfc9]/70'} flex h-8 items-center justify-center`}>
                {/* Icon would go here */}
              </div>
              <p className={`${item === 'Resources' ? 'text-[#eedfc9]' : 'text-[#eedfc9]/70'} text-xs font-medium leading-normal tracking-[0.015em]`}>{item}</p>
            </a>
          ))}
        </div>
        <div className="h-5 bg-[#2A4A42]"></div>
      </div>
    </div>
  );
}
