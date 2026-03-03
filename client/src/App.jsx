import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Admin from './components/Admin';
import Client from './components/Client';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 font-sans text-white">
        <Routes>
          <Route path="/" element={<Client />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
