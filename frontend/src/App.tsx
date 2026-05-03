import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRoutes from './routes';

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2a5c55',
          colorSuccess: '#2f7d57',
          colorWarning: '#b77426',
          colorError: '#b44945',
          colorLink: '#2a5c55',
          colorTextBase: '#1f1b16',
          colorTextSecondary: '#6c6256',
          colorBgLayout: '#f3efe7',
          colorBgContainer: 'rgba(255,250,242,0.9)',
          borderRadius: 14,
          borderRadiusLG: 24,
          fontFamily: '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei UI", sans-serif',
          fontSize: 14,
        },
        components: {
          Button: { borderRadius: 14, controlHeight: 42, fontWeight: 600 },
          Card: { borderRadiusLG: 22, boxShadowTertiary: '0 18px 40px rgba(37, 30, 20, 0.1)' },
          Input: { borderRadius: 14, controlHeight: 46 },
          Select: { borderRadius: 14, controlHeight: 46 },
          Tabs: { itemColor: '#6c6256', itemSelectedColor: '#1f1b16', inkBarColor: '#b86a3d' },
        },
      }}
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
