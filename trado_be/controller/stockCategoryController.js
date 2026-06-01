import stockCategoryService from '../services/StockCategoryService.js';

class StockCategoryController {
  listCategories = async (req, res) => {
    const userId = req.user.id;
    const categories = await stockCategoryService.listCategories(userId);
    res.json({ success: true, data: categories });
  };

  createCategory = async (req, res) => {
    const userId = req.user.id;
    const category = await stockCategoryService.createCategory(userId, req.body);
    res.status(201).json({ success: true, data: category });
  };

  bulkCreateCategories = async (req, res) => {
    const userId = req.user.id;
    const { items } = req.body;
    const categories = await stockCategoryService.bulkCreateCategories(userId, items);
    res.status(201).json({ success: true, data: categories });
  };

  updateCategory = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const category = await stockCategoryService.updateCategory(userId, id, req.body);
    res.json({ success: true, data: category });
  };

  deleteCategory = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await stockCategoryService.deleteCategory(userId, id);
    res.json({ success: true, data: result });
  };

  getAllocation = async (req, res) => {
    const userId = req.user.id;
    const data = await stockCategoryService.getAllocation(userId);
    res.json({ success: true, data });
  };

  listMappings = async (req, res) => {
    const userId = req.user.id;
    const mappings = await stockCategoryService.listMappings(userId);
    res.json({ success: true, data: mappings });
  };

  setSymbolCategory = async (req, res) => {
    const userId = req.user.id;
    const { symbol } = req.params;
    const { categoryId } = req.body;
    const result = await stockCategoryService.setSymbolCategory(userId, symbol, categoryId);
    res.json({ success: true, data: result });
  };

  bulkSetSymbolCategory = async (req, res) => {
    const userId = req.user.id;
    const { symbols, categoryId } = req.body;
    const result = await stockCategoryService.bulkSetSymbolCategory(userId, symbols, categoryId);
    res.json({ success: true, data: result });
  };
}

export default new StockCategoryController();
