import React, { useEffect, useState } from 'react';

interface MessageStatusProps {
  type: 'ok' | 'ng' | 'wait' | null;
  text: string;
}

export const MessageStatus: React.FC<MessageStatusProps> = ({ type, text }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (type !== 'wait') {
      setSeconds(0);
      return;
    }

    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [type]);

  if (!type || !text) return null;

  if (type === 'wait') {
    return (
      <div className="mt-4.5 p-3.5 px-4 rounded-xl text-[14px] font-medium leading-normal bg-[#F6F7F9] text-[#4B5563] flex items-center gap-3">
        {/* Animated mosaic dots */}
        <div className="flex gap-1.25 flex-none">
          <i className="w-2.25 h-2.25 rounded-sm bg-[#D6DAE1] animate-dots-1 not-italic" />
          <i className="w-2.25 h-2.25 rounded-sm bg-[#D6DAE1] animate-dots-2 not-italic" />
          <i className="w-2.25 h-2.25 rounded-sm bg-[#D6DAE1] animate-dots-3 not-italic" />
          <i className="w-2.25 h-2.25 rounded-sm bg-[#D6DAE1] animate-dots-4 not-italic" />
        </div>
        <span>
          {text}{' '}
          <span className="tabular-nums text-[#9AA0AA] text-[13px] ml-1">
            {seconds}초
          </span>
        </span>
      </div>
    );
  }

  if (type === 'ok') {
    return (
      <div className="mt-4.5 p-3.5 px-4 rounded-xl text-[14px] font-medium leading-normal bg-[#EAF6EE] text-[#146C3A]">
        {text}
      </div>
    );
  }

  if (type === 'ng') {
    return (
      <div className="mt-4.5 p-3.5 px-4 rounded-xl text-[14px] font-medium leading-normal bg-[#FDECEA] text-[#B3261E]">
        {text}
      </div>
    );
  }

  return null;
};
