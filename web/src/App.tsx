import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { IssuerPage } from './pages/IssuerPage';
import { MyCredentialsPage } from './pages/MyCredentialsPage';
import { VerifyPage } from './pages/VerifyPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="issuer" element={<IssuerPage />} />
        <Route path="me" element={<MyCredentialsPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="verify/:id" element={<VerifyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
