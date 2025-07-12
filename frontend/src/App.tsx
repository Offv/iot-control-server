import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import HtrDeviceDetail from './pages/HtrDeviceDetail';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/htr-a" element={<HtrDeviceDetail deviceType="HTR-A" ioLinkIp="192.168.30.29" />} />
          <Route path="/htr-b" element={<HtrDeviceDetail deviceType="HTR-B" ioLinkIp="192.168.30.33" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
