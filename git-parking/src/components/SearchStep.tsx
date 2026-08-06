import React, { useState } from 'react';
import { CarSearchResult } from '../types';
import { MessageStatus } from './MessageStatus';

interface SearchStepProps {
  onSelectCar: (car: CarSearchResult, searchedNo: string) => void;
}

export const SearchStep: React.FC<SearchStepProps> = ({ onSelectCar }) => {
  const [searchNo, setSearchNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'ng' | 'wait' | null; text: string }>({
    type: null,
    text: '',
  });
  const [carList, setCarList] = useState<CarSearchResult[] | null>(null);

  const handleSearch = async () => {
    const trimmed = searchNo.trim().replace(/\D/g, '');
    if (!trimmed) {
      setMsg({ type: 'ng', text: '차량번호 뒤 4자리를 입력해 주세요.' });
      return;
    }

    setCarList(null);
    setLoading(true);
    setMsg({ type: 'wait', text: '입차 기록을 찾고 있습니다.' });

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carNo: trimmed }),
      });
      const data = await res.json();

      if (!data.ok) {
        setMsg({ type: 'ng', text: data.message || '입차 기록을 찾을 수 없습니다.' });
        setLoading(false);
        return;
      }

      setMsg({ type: null, text: '' });

      if (data.cars.length === 1) {
        onSelectCar(data.cars[0], trimmed);
      } else {
        setCarList(data.cars);
      }
    } catch (err) {
      setMsg({
        type: 'ng',
        text: '서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <section>
      <h1 className="text-[21px] font-extrabold tracking-tight text-[#15171C] mb-1">
        차량을 조회하세요
      </h1>
      <p className="text-[13.5px] text-[#6B7280] mb-5.5">
        방문객 차량번호 뒤 4자리를 입력하면 입차 기록을 찾습니다.
      </p>

      <div className="mb-4">
        <label
          htmlFor="searchNo"
          className="block text-[13px] font-bold text-[#15171C] mb-1.75 tracking-tight"
        >
          차량번호 뒤 4자리
        </label>
        <input
          type="text"
          id="searchNo"
          inputMode="numeric"
          maxLength={4}
          value={searchNo}
          onChange={(e) => setSearchNo(e.target.value.replace(/\D/g, ''))}
          onKeyDown={handleKeyDown}
          placeholder="0000"
          autoComplete="off"
          className="w-full h-[52px] px-3.5 text-[22px] font-extrabold tracking-[0.12em] text-center text-[#15171C] bg-white border-[1.5px] border-[#E3E6EB] rounded-xl focus:outline-none focus:border-[#15171C] focus-visible:outline-2 focus-visible:outline-[#E87D18] focus-visible:outline-offset-2 transition-colors tabular-nums placeholder:font-normal placeholder:tracking-normal placeholder:text-[#AFB4BD]"
        />
      </div>

      <button
        type="button"
        onClick={handleSearch}
        disabled={loading}
        className="w-full h-[54px] bg-[#D92B26] hover:bg-[#BE231F] disabled:bg-[#CBD0D8] text-white text-[16px] font-bold rounded-xl tracking-tight transition-colors cursor-pointer disabled:cursor-default"
      >
        조회
      </button>

      <MessageStatus type={msg.type} text={msg.text} />

      {carList && carList.length > 0 && (
        <div className="mt-6">
          <div className="text-[13px] font-bold text-[#15171C] mb-2.5">
            {carList.length}대가 조회되었습니다. 차량을 선택하세요.
          </div>
          <div className="space-y-2.5">
            {carList.map((car) => (
              <button
                key={car.id}
                type="button"
                onClick={() => onSelectCar(car, searchNo)}
                className="w-full text-left bg-white border-[1.5px] border-[#E3E6EB] hover:border-[#E87D18] focus-visible:outline-2 focus-visible:outline-[#E87D18] focus-visible:outline-offset-2 rounded-xl p-3.5 px-4 transition-colors cursor-pointer"
              >
                <div className="text-[19px] font-extrabold tracking-tight text-[#15171C] tabular-nums">
                  {car.carNo}
                </div>
                <div className="text-[12.5px] text-[#6B7280] mt-1">
                  입차 {car.entryTime} · 주차 {car.parkTime}
                </div>
                {car.dscntCnt > 0 && (
                  <div className="text-[12.5px] font-semibold text-[#A85B00] mt-1">
                    이미 할인 {car.dscntCnt}건 등록됨
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
