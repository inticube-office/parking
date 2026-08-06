import React from 'react';

interface DoneStepProps {
  summary: {
    carNo: string;
    discountLabel: string;
    company: string;
  };
  onNext: () => void;
}

export const DoneStep: React.FC<DoneStepProps> = ({ summary, onNext }) => {
  return (
    <section className="text-center pt-6.5 pb-2">
      {/* Mosaic Icon Group */}
      <div className="flex gap-1.5 justify-center mb-4.5">
        <i className="w-4 h-4 rounded-[5px] bg-[#F2B100] not-italic block" />
        <i className="w-4 h-4 rounded-[5px] bg-[#E87D18] not-italic block" />
        <i className="w-4 h-4 rounded-[5px] bg-[#D92B26] not-italic block" />
      </div>

      <h2 className="text-[20px] font-extrabold tracking-tight text-[#15171C] mb-2">
        등록이 완료되었습니다
      </h2>
      <p className="text-[14px] text-[#6B7280] mb-5.5">
        주차 시스템에 할인이 적용되었습니다.
      </p>

      {/* Summary Box */}
      <div className="bg-[#F6F7F9] rounded-xl p-3.5 px-4 mb-6 text-left text-[13.5px]">
        <div className="flex justify-between py-0.75">
          <span className="text-[#6B7280]">차량번호</span>
          <b className="font-bold text-[#15171C]">{summary.carNo}</b>
        </div>
        <div className="flex justify-between py-0.75">
          <span className="text-[#6B7280]">할인 유형</span>
          <b className="font-bold text-[#15171C]">{summary.discountLabel}</b>
        </div>
        <div className="flex justify-between py-0.75">
          <span className="text-[#6B7280]">방문업체</span>
          <b className="font-bold text-[#15171C]">{summary.company}</b>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full h-[54px] bg-[#D92B26] hover:bg-[#BE231F] text-white text-[16px] font-bold rounded-xl tracking-tight transition-colors cursor-pointer"
      >
        다음 차량 등록
      </button>
    </section>
  );
};
