import { useSelector } from 'react-redux';

export const useUserInfo = () => {
  const user = useSelector(state => state.auth.user);
  const isAuthenticated = useSelector(state => state.auth.isAuthenticated);

  // 從 user 物件中提取需要的欄位，提供預設值
  const email = user?.email || '';
  const name = user?.name || '';
  // 支援 picture 或 avatar 欄位（Google 登入可能用 picture）
  const picture = user?.picture || user?.avatar || '';

  return {
    email,
    name,
    picture,
    user, // 完整的 user 物件
    isAuthenticated,
  };
};

export default useUserInfo;
