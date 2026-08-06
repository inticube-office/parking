import React from 'react';
import { ShieldCheck, FileText, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  showAdmin: boolean;
  setShowAdmin: (show: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ showAdmin, setShowAdmin }) => {
  return (
    <header className="flex items-center justify-between px-5 py-4 border-b border-[#E3E6EB] bg-white sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {/* Logo / Watermark */}
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-widest text-[15px] text-[#D92B26] select-none">
            INTICUBE
          </span>
          <span className="w-px h-4.5 bg-[#E3E6EB]"></span>
          <span className="text-[14px] font-semibold text-[#6B7280] tracking-tight">
            주차 할인권 등록
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdmin(!showAdmin)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-[#4B5563] bg-[#F6F7F9] hover:bg-[#EAECEF] border border-[#E3E6EB] rounded-lg transition-colors cursor-pointer"
        title={showAdmin ? "등록 화면으로 돌아가기" : "관리자 로그 보기"}
      >
        {showAdmin ? (
          <>
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>등록 화면</span>
          </>
        ) : (
          <>
            <FileText className="w-3.5 h-3.5 text-[#E87D18]" />
            <span>등록 로그</span>
          </>
        )}
      </button>
    </header>
  );
};
