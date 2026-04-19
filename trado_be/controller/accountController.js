import AccountService from '../services/AccountService.js';

const accountController = {
  async getBalance(req, res) {
    const data = await AccountService.getBalance(req.user.id);
    res.json({ success: true, data });
  },

  async deposit(req, res) {
    const { amount, date, method, notes } = req.body;
    const data = await AccountService.deposit(req.user.id, { amount, date, method, notes });
    res.json({ success: true, data });
  },

  async withdraw(req, res) {
    const { amount, date, method, notes } = req.body;
    const data = await AccountService.withdraw(req.user.id, { amount, date, method, notes });
    res.json({ success: true, data });
  },

  async getBalanceHistory(req, res) {
    const { start_date, end_date, page, limit } = req.query;
    const data = await AccountService.getHistory(req.user.id, {
      startDate: start_date,
      endDate: end_date,
      page,
      limit,
    });
    res.json({ success: true, ...data });
  },

  async getTradeSettings(req, res) {
    const data = await AccountService.getTradeSettings(req.user.id);
    res.json({ success: true, data });
  },

  async updateTradeSettings(req, res) {
    const data = await AccountService.updateTradeSettings(req.user.id, req.body);
    res.json({ success: true, data });
  },

  async setCashBalance(req, res) {
    const { balance } = req.body;
    const data = await AccountService.setCashBalance(req.user.id, balance);
    res.json({ success: true, data });
  },
};

export default accountController;
