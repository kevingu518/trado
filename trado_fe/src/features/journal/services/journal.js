import {
  getJournalListApi,
  getJournalContextApi,
  saveJournalApi,
  deleteJournalApi,
} from '@api/api_journal';

export const journalService = {
  async list({ from, to } = {}) {
    return getJournalListApi({ from, to });
  },

  async getContext(date) {
    return getJournalContextApi(date);
  },

  async save(date, payload) {
    return saveJournalApi(date, payload);
  },

  async remove(date) {
    return deleteJournalApi(date);
  },
};
