import request from './request';

/** 盤後日誌列表（只含有寫的日期） */
export const getJournalListApi = (params = {}) => request.get('/journal', { params });

/** 某日的大盤數字＋既有日誌＋前一篇日誌 */
export const getJournalContextApi = (date) =>
  request.get('/journal/context', { params: { date } });

/** 同日重複呼叫為更新（upsert） */
export const saveJournalApi = (date, payload) => request.put(`/journal/${date}`, payload);

export const deleteJournalApi = (date) => request.delete(`/journal/${date}`);
