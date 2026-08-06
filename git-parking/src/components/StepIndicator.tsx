import React from 'react';

interface StepIndicatorProps {
  currentStep: number; // 1, 2, or 3
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { label: '차량 조회', activeColor: 'bg-[#F2B100]' },
    { label: '정보 입력', activeColor: 'bg-[#E87D18]' },
    { label: '등록 완료', activeColor: 'bg-[#D92B26]' },
  ];

  return (
    <div className="flex gap-0 px-5 pt-4.5 pb-1">
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const isActive = currentStep >= stepNum;

        return (
          <div key={idx} className="flex-1 flex flex-col gap-1.75">
            <div
              className={`h-1.25 rounded-sm transition-colors duration-300 ${
                idx < steps.length - 1 ? 'mr-1' : ''
              } ${isActive ? step.activeColor : 'bg-[#E3E6EB]'}`}
            />
            <div
              className={`text-[11.5px] font-semibold tracking-wide transition-colors ${
                isActive ? 'text-[#15171C]' : 'text-[#B4B9C2]'
              }`}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
