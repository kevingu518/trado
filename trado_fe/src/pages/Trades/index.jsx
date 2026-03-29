import React, { useState } from 'react'
// 第三方套件
import { DatePicker, Button } from 'antd'
const { RangePicker } = DatePicker;
// 本地套件
import TradeTable from './components/TradeTable'
import AddTradeModal from './components/AddTradeModal'

const tableData = [];
for (let i = 0; i < 21; i++) {
  tableData.push({
    key: i.toString(),
    stockNum: '2498',
    type: i % 4 === 0 ? '空' : '多',
    buyTime: '09-05 09:33',
    buyPrice: 40,
    buyStockNum: 1000,
    sellTime: '09-20 10:52',
    sellPrice: 48.7,
    sellStockNum: 1000,
    cost: 40000,
    winLose: i % 3 === 0 ? '勝' : '敗',
    strategy: i % 3 === 0 ? '波段' : '乖離-2',
    stopLossPrice: 38,
    holdingTime: '3天4小時',
    outcome: Number(10000).toLocaleString(),
    outcomeRatio: '3.2%',
    description: 'test',
  },);
}

const Trades = () => {
  // -------------------------   variables   ----------------------------
  const [addTradeModalOpen, setAddTradeModalOpen] = useState(false);

  return (
    <div className='full-width full-height p-sm'>
      {/* header */}
      <div className="useBetween p-xs bg-white rounded-sm">
        <div className="left">
          <RangePicker
            placeholder={['開始時間', '結束時間']} // 自訂 placeholder
            className='rounded-xs'
          />
        </div>
        <div className="right">
          <Button 
            className="px-md py-xs fzl-12 rounded-sm"  
            type='primary' 
            onClick={() => { setAddTradeModalOpen(true) }}>
              新增交易紀錄
          </Button>
        </div>
      </div>
      {/* title */}
      <div className="my-md text-grey-700 fzl-16 font-bold font-sans">
        <span className='text-grey-700 fzl-md font-bold font-sans'>交易紀錄</span>
        <span className='text-grey-500 fzl-xs font-sans ml-md'>本日剩餘紀錄次數 43 / 50</span>
      </div>
      {/* table */}
      <div className="table-container">
        <TradeTable />
      </div>
      {/* statistic */}
      {/* Modal 新增交易紀錄 */}
      <AddTradeModal 
        show={addTradeModalOpen} 
        onClose={() => setAddTradeModalOpen(false)}
         />
    </div>
  )
}

export default Trades