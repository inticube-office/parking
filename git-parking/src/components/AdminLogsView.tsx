import React, { useEffect, useState } from 'react';
import { ParkingLogRecord } from '../types';
import { Search, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export const AdminLogsView: React.FC = () => {
  const [logs, setLogs] = useState<ParkingLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('전체');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error('로그 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.carNo?.includes(searchTerm) ||
      log.name?.includes(searchTerm) ||
      log.company?.includes(searchTerm) ||
      log.memo?.includes(searchTerm);

    if (statusFilter === '전체') return matchesSearch;
    return matchesSearch && log.result === statusFilter;
  });

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight text-[#15171C]">
            주차 할인 등록 로그
          </h1>
          <p className="text-[13px] text-[#6B7280]">
            실시간 할인권 등록 이력 및 처리 결과
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 text-[#4B5563] bg-[#F6F7F9] hover:bg-[#EAECEF] border border-[#E3E6EB] rounded-lg transition-colors cursor-pointer"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#9CA3AF]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="차량번호, 이름, 방문업체 검색..."
            className="w-full h-11 pl-10 pr-3.5 text-[14px] bg-white border border-[#E3E6EB] rounded-lg focus:outline-none focus:border-[#15171C]"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 text-[12.5px]">
          {['전체', '등록성공', '등록실패', '인증실패'].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === filter
                  ? 'bg-[#15171C] text-white'
                  : 'bg-white text-[#4B5563] border border-[#E3E6EB] hover:bg-[#F6F7F9]'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table / Card List */}
      {filteredLogs.length === 0 ? (
        <div className="py-12 text-center text-[14px] text-[#6B7280] bg-[#F6F7F9] rounded-xl border border-[#E3E6EB]">
          등록된 로그가 없습니다.
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {filteredLogs.map((log, idx) => {
            const isSuccess = log.result === '등록성공';
            const isCertFail = log.result === '인증실패';

            return (
              <div
                key={idx}
                className="p-3.5 bg-white border border-[#E3E6EB] rounded-xl space-y-2 text-[13px]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-[15px] text-[#15171C]">
                    <span>{log.carNo || '미상'}</span>
                    <span className="text-[12px] font-semibold text-[#E87D18] bg-[#FFF8EE] px-2 py-0.5 rounded">
                      {log.type || '할인'}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-bold ${
                      isSuccess
                        ? 'bg-[#EAF6EE] text-[#146C3A]'
                        : isCertFail
                        ? 'bg-[#FFF3E0] text-[#E65100]'
                        : 'bg-[#FDECEA] text-[#B3261E]'
                    }`}
                  >
                    {isSuccess ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : isCertFail ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {log.result}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12.5px] text-[#6B7280]">
                  <div>
                    등록자: <b className="text-[#15171C]">{log.name || '미등록'}</b>
                  </div>
                  <div>
                    방문업체: <b className="text-[#15171C]">{log.company || '-'}</b>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11.5px] text-[#9CA3AF] pt-1 border-t border-[#F3F4F6]">
                  <span>{log.date}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
