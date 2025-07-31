import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HtrDeviceDetail from './pages/HtrDeviceDetail';
import DualHtrControl from './pages/DualHtrControl';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DualHtrControl />} />
          <Route path="/dual-control" element={<DualHtrControl />} />
          <Route path="/htr-a" element={<HtrDeviceDetail deviceType="HTR-A" ioLinkIp={import.meta.env.VITE_HTR_A_IP || '192.168.30.29'} />} />
          <Route path="/htr-b" element={<HtrDeviceDetail deviceType="HTR-B" ioLinkIp={import.meta.env.VITE_HTR_B_IP || '192.168.30.33'} />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
