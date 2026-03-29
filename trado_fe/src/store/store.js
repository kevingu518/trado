import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from 'redux';
import authReducer from './authSlice'

// 持久化配置
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'], // 只持久化 auth 狀態
  blacklist: [], // 不持久化的狀態
};

// 合併所有 reducers
const rootReducer = combineReducers({
  auth: authReducer,
});

// 持久化 reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// 建立 store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// 建立持久化 store
export const persistor = persistStore(store);
