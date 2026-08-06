export interface CarSearchResult {
  id: string;
  carNo: string;
  entryTime: string;
  parkTime: string;
  dscntCnt: number;
}

export interface ParkingLogRecord {
  date: string;
  empId: string;
  name: string;
  dept: string;
  company: string;
  carNo: string;
  type: string;
  result: string;
  memo: string;
}

export interface Employee {
  empId: string;
  name: string;
  dept: string;
}

export type DiscountTypeCode = '1' | '2' | '3' | '4';

export const DISCOUNT_TYPE_LABELS: Record<DiscountTypeCode, string> = {
  '1': '30분',
  '2': '1시간',
  '3': '2시간',
  '4': '일일권',
};
