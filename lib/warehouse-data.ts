/**
 * 인도처(창고) 데이터
 *
 * 실제 인도처 정보입니다. (DB 연동 전까지 하드코딩)
 * 주소는 다음 우편번호 API 기준 도로명주소 형식입니다.
 * 좌표는 해당 시/군/구 기준으로 배치합니다.
 */

import type { Warehouse } from '@/types/warehouse'

export const mockWarehouses: Warehouse[] = [
  {
    id: '1',
    name: '파주창고',
    address: '경기도 파주시 재두루미길 546-10',
    managerName: '손지훈',
    managerPhone: '010-9000-7014',
    latitude: 37.830,
    longitude: 126.730,
  },
  {
    id: '2',
    name: '서울사무실',
    address: '서울특별시 강서구 양천로 516',
    managerName: '김영찬',
    managerPhone: '010-9016-9977',
    latitude: 37.560,
    longitude: 126.870,
  },
  {
    id: '4',
    name: '충청도창고',
    address: '대전광역시 중구 대종로 488',
    managerName: '권대혁',
    managerPhone: '010-7243-3699',
    latitude: 36.330,
    longitude: 127.430,
  },
  {
    id: '5',
    name: '전남창고',
    address: '전라남도 순천시 해룡면 평화길 185',
    managerName: '정종국',
    managerPhone: '010-9441-7448',
    latitude: 34.930,
    longitude: 127.520,
  },
  {
    id: '6',
    name: '전북창고',
    address: '광주광역시 서구 운천로154번길 39',
    managerName: '김인호',
    managerPhone: '010-7645-7753',
    latitude: 35.150,
    longitude: 126.850,
  },
  {
    id: '7',
    name: '안성창고',
    address: '경기도 평택시 포승읍 평택항로 107',
    managerName: '신창근',
    managerPhone: '010-8033-4401',
    latitude: 36.950,
    longitude: 126.900,
  },
  {
    id: '8',
    name: '강원창고',
    address: '강원특별자치도 강릉시 경강로 2539',
    managerName: '김주남',
    managerPhone: '010-2797-0598',
    latitude: 37.770,
    longitude: 128.900,
  },
  {
    id: '9',
    name: '강원창고',
    address: '강원특별자치도 원주시 지정면 간현로 5',
    managerName: '김성주',
    managerPhone: '010-9422-9709',
    latitude: 37.300,
    longitude: 127.880,
  },
  {
    id: '10',
    name: '강원창고',
    address: '강원특별자치도 춘천시 영서로 2594',
    managerName: '방종환',
    managerPhone: '010-9119-5767',
    latitude: 37.870,
    longitude: 127.730,
  },
  {
    id: '11',
    name: '강원창고',
    address: '경기도 연천군 전곡읍 양연로 888',
    managerName: '전광천',
    managerPhone: '010-3426-1119',
    latitude: 38.020,
    longitude: 127.070,
  },
  {
    id: '12',
    name: '경상도창고',
    address: '경상북도 경산시 진량읍 봉회길 66',
    managerName: '정용주',
    managerPhone: '010-7257-5151',
    latitude: 35.870,
    longitude: 128.780,
  },
  {
    id: '13',
    name: '아산창고',
    address: '충청남도 아산시 배방읍 신흥길 112-19',
    managerName: '이은창',
    managerPhone: '010-4087-2121',
    latitude: 36.780,
    longitude: 127.010,
  },
  {
    id: '14',
    name: '평택창고',
    address: '경기도 평택시 신평로 205',
    managerName: '김영찬',
    managerPhone: '010-9016-9977',
    latitude: 36.980,
    longitude: 127.090,
  },
]
