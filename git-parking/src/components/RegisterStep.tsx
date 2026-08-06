import React, { useState } from 'react';
import { CarSearchResult, DiscountTypeCode, DISCOUNT_TYPE_LABELS } from '../types';
import { MessageStatus } from './MessageStatus';

interface RegisterStepProps {
  selectedCar: CarSearchResult;
  searchedNo: string;
  onBackToSearch: () => void;
  onSuccess: (summary: { carNo: string; discountLabel: string; company: string }) => void;
}

export const RegisterStep: React.FC<RegisterStepProps> = ({
  selectedCar,
  searchedNo,
  onBackToSearch,
  onSuccess,
}) => {
  const [empId, setEmpId] = useState('');
  const [company, setCompany] = useState('');
  const [discountType, setDiscountType] = useState<DiscountTypeCode | ''>('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'ng' | 'wait' | null; text: string }>({
    type: null,
    text: '',
  });

  const handleRegister = async () => {
    const trimmedEmpId = empId.trim();
    const trimmedCompany = company.trim();

    if (!/^\d{6}$/.test(trimmedEmpId)) {
      setMsg({ type: 'ng', text: '사번은 숫자 6자리여야 합니다.' });
      return;
    }
    if (trimmedCompany.length < 2) {
      setMsg({ type: 'ng', text: '방문업체명을 입력하세요.' });
      return;
    }
    if (trimmedCompany.length > 30) {
      setMsg({ type: 'ng', text: '방문업체명은 30자 이내로 입력하세요.' });
      return;
    }
    if (!discountType) {
      setMsg({ type: 'ng', text: '할인 유형을 선택하세요.' });
      return;
    }

    setLoading(true);
    setMsg({ type: 'wait', text: '주차 시스템에 등록하고 있습니다.' });

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carNo: searchedNo,
          carId: selectedCar.id,
          empId: trimmedEmpId,
          company: trimmedCompany,
          discountType,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setMsg({ type: 'ng', text: data.message || '등록 실패' });
        setLoading(false);
        return;
      }

      setMsg({ type: null, text: '' });
      onSuccess({
        carNo: selectedCar.carNo,
        discountLabel: DISCOUNT_TYPE_LABELS[discountType],
        company: trimmedCompany,
      });
    } catch (err) {
      setMsg({
        type: 'ng',
        text: '서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h1 className="text-[21px] font-extrabold tracking-tight text-[#15171C] mb-1">
        등록 정보를 입력하세요
      </h1>
      <p className="text-[13.5px] text-[#6B7280] mb-5.5">
        사번으로 등록자를 인증하며, 등록 이력이 함께 기록됩니다.
      </p>

      {/* Plate Card Motif */}
      <div className="border-[1.5px] border-[#E3E6EB] rounded-xl overflow-hidden mb-5.5 bg-white">
        {/* Color Swatch */}
        <div className="flex h-1.25">
          <span className="flex-1 bg-[#F2B100]"></span>
          <span className="flex-1 bg-[#E87D18]"></span>
          <span className="flex-1 bg-[#D92B26]"></span>
        </div>

        <div className="p-4">
          <div className="text-[27px] font-extrabold tracking-tight text-[#15171C] tabular-nums leading-tight">
            {selectedCar.carNo}
          </div>
          <dl className="grid grid-cols-[64px_1fr] gap-x-1 gap-y-1 mt-3 text-[13px]">
            <dt className="text-[#6B7280] font-medium">주차시간</dt>
            <dd className="font-semibold text-[#15171C] tabular-nums">{selectedCar.parkTime}</dd>
            <dt className="text-[#6B7280] font-medium">입차시간</dt>
            <dd className="font-semibold text-[#15171C] tabular-nums">{selectedCar.entryTime}</dd>
          </dl>
          {selectedCar.dscntCnt > 0 && (
            <div className="mt-2.5 text-[12.5px] font-semibold text-[#A85B00]">
              이미 할인 {selectedCar.dscntCnt}건이 등록된 차량입니다.
            </div>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4 mb-3">
        <div>
          <label htmlFor="empId" className="block text-[13px] font-bold text-[#15171C] mb-1.75">
            사번
          </label>
          <input
            type="text"
            id="empId"
            inputMode="numeric"
            maxLength={6}
            value={empId}
            onChange={(e) => setEmpId(e.target.value.replace(/\D/g, ''))}
            placeholder="숫자 6자리"
            autoComplete="off"
            className="w-full h-[52px] px-3.5 text-[16px] text-[#15171C] bg-white border-[1.5px] border-[#E3E6EB] rounded-xl focus:outline-none focus:border-[#15171C] focus-visible:outline-2 focus-visible:outline-[#E87D18] focus-visible:outline-offset-2 transition-colors placeholder:text-[#AFB4BD]"
          />
        </div>

        <div>
          <label htmlFor="company" className="block text-[13px] font-bold text-[#15171C] mb-1.75">
            방문업체명
          </label>
          <input
            type="text"
            id="company"
            maxLength={30}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="예: OO솔루션즈"
            autoComplete="off"
            className="w-full h-[52px] px-3.5 text-[16px] text-[#15171C] bg-white border-[1.5px] border-[#E3E6EB] rounded-xl focus:outline-none focus:border-[#15171C] focus-visible:outline-2 focus-visible:outline-[#E87D18] focus-visible:outline-offset-2 transition-colors placeholder:text-[#AFB4BD]"
          />
        </div>

        <div>
          <label htmlFor="discountType" className="block text-[13px] font-bold text-[#15171C] mb-1.75">
            할인 유형
          </label>
          <select
            id="discountType"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountTypeCode)}
            className="w-full h-[52px] px-3.5 text-[16px] text-[#15171C] bg-white border-[1.5px] border-[#E3E6EB] rounded-xl focus:outline-none focus:border-[#15171C] focus-visible:outline-2 focus-visible:outline-[#E87D18] focus-visible:outline-offset-2 transition-colors appearance-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] cursor-pointer"
            style={{
              backgroundImage: `linear-gradient(45deg, transparent 50%, #6B7280 50%), linear-gradient(135deg, #6B7280 50%, transparent 50%)`,
              backgroundPosition: `calc(100% - 20px) 23px, calc(100% - 15px) 23px`,
              backgroundSize: `5px 5px, 5px 5px`,
              backgroundRepeat: `no-repeat`,
            }}
          >
            <option value="">선택하세요</option>
            <option value="1">30분</option>
            <option value="2">1시간</option>
            <option value="3">2시간</option>
            <option value="4">일일권</option>
          </select>
        </div>
      </div>

      {/* Notices */}
      <div className="space-y-1 mb-5">
        <p className="text-[13px] text-[#6B7280] leading-snug">
          📢 방문객 주차 할인권은 최대 2시간만 등록할 수 있습니다.
        </p>
        <p className="text-[13px] text-[#6B7280] leading-snug">
          💠 주차 할인권 사용량은 매월 모니터링되고 있습니다.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-2 mt-2">
        <button
          type="button"
          onClick={handleRegister}
          disabled={loading}
          className="w-full h-[54px] bg-[#D92B26] hover:bg-[#BE231F] disabled:bg-[#CBD0D8] text-white text-[16px] font-bold rounded-xl tracking-tight transition-colors cursor-pointer disabled:cursor-default"
        >
          할인권 등록
        </button>

        <button
          type="button"
          onClick={onBackToSearch}
          disabled={loading}
          className="w-full h-[54px] bg-white text-[#15171C] border-[1.5px] border-[#E3E6EB] hover:bg-[#F6F7F9] text-[16px] font-bold rounded-xl tracking-tight transition-colors cursor-pointer"
        >
          다시 조회
        </button>
      </div>

      <MessageStatus type={msg.type} text={msg.text} />
    </section>
  );
};
