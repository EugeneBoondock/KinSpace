import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Updated header to use powderBlue background */}
      <header className="bg-powderBlue text-gray-900 p-4 shadow-md">
        <h1 className="text-xl font-semibold">Mito Platform</h1>
      </header>
      <main className="flex-grow p-4">
        {children}
      </main>
      {/* Updated footer to use lavenderMist background */}
      <footer className="bg-lavenderMist p-4 text-center shadow-md">
        <p>© 2023 Mito</p>
      </footer>
    </div>
  );
};

export default Layout;
