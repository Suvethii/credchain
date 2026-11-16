import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import type { Address } from 'viem';
import { useRoles } from '../hooks/useRoles';
import { useWallet } from '../hooks/useWallet';
import { targetChain } from '../lib/config';
import { MOCK_ACCOUNTS, resetMock } from '../mock/mockApi';

function MockSwitcher() {
  const w = useWallet();
  const qc = useQueryClient();
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Mock account"
        className="input w-32 py-1 sm:w-auto"
        value={w.address}
        onChange={(e) => {
          w.setMock?.(e.target.value as Address);
          qc.invalidateQueries();
        }}
      >
        {Object.entries(MOCK_ACCOUNTS).map(([k, a]) => (
          <option key={k} value={a}>{k} {a.slice(0, 6)}</option>
        ))}
      </select>
      <button className="btn-secondary py-1" title="Reset mock data" onClick={() => { resetMock(); qc.invalidateQueries(); }}>↺</button>
    </div>
  );
}

export function Layout() {
  const w = useWallet();
  const roles = useRoles();
  const [open, setOpen] = useState(false);
  const link = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`;
  const links = (
    <>
      <NavLink to="/verify" className={link} onClick={() => setOpen(false)}>Verify</NavLink>
      <NavLink to="/me" className={link} onClick={() => setOpen(false)}>My credentials</NavLink>
      {roles.isIssuer && <NavLink to="/issuer" className={link} onClick={() => setOpen(false)}>Issuer</NavLink>}
      {roles.isAdmin && <NavLink to="/admin" className={link} onClick={() => setOpen(false)}>Admin</NavLink>}
    </>
  );
  return (
    <div className="min-h-screen">
      {w.isMock && (
        <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
          MOCK MODE — fake contract and fake IPFS in your browser. Set VITE_CONTRACT_ADDRESS to use {targetChain.name}.
        </div>
      )}
      {w.wrongNetwork && (
        <div className="flex flex-wrap items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm text-white">
          Wrong network. CredChain runs on {targetChain.name}.
          <button className="rounded bg-white px-2 py-0.5 text-red-700" onClick={w.switchNetwork}>Switch</button>
        </div>
      )}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <NavLink to="/" className="text-lg font-bold text-indigo-700">CredChain</NavLink>
          <nav className="hidden items-center gap-1 md:flex">{links}</nav>
          <div className="flex items-center gap-2">
            {w.isMock ? <MockSwitcher /> : <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />}
            <button className="btn-secondary px-2 py-1 md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
          </div>
        </div>
        {open && <nav className="space-y-1 border-t border-slate-100 px-4 py-2 md:hidden">{links}</nav>}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
