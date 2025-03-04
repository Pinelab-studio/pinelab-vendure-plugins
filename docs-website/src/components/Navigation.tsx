import { useState } from 'react';
import { HamburgerIcon } from './icons/HamburgerIcon';
import { XIcon } from './icons/XIcon';

interface NavigationItem {
  title: string;
  href: string;
}

const navigationItems: NavigationItem[] = [
  { title: 'Plugins', href: '/#plugins' },
  { title: 'Pinelab.studio →', href: 'https://pinelab.studio/' },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-transparent transition-all duration-300">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8"
        aria-label="Global"
      >
        {/* Logo */}
        <div className="flex lg:flex-1">
          <a href="/" className="-m-1.5 inline-flex p-1.5">
            <span className="sr-only">Pinelab</span>
            <img className="h-8 w-auto" src="/pinelab.svg" alt="Pinelab logo" />
            <span className="ml-4 pt-2 text-sm font-semibold text-gray-900">
              Pinelab Plugins
            </span>
          </a>
        </div>

        {/* Mobile menu button */}
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
            onClick={() => setIsOpen(true)}
          >
            <span className="sr-only">Open main menu</span>
            <HamburgerIcon />
          </button>
        </div>

        {/* Desktop navigation */}
        <div className="hidden lg:flex lg:gap-x-12">
          {navigationItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-gray-900"
            >
              {item.title}
            </a>
          ))}
        </div>

        {/* Desktop contact button */}
        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          <a
            href="https://pinelab.studio/contact/"
            target="_blank"
            className="text-sm font-semibold text-gray-900"
          >
            Contact <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          isOpen ? 'block' : 'hidden'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/30 transition-opacity duration-300" />

        {/* Menu panel */}
        <div className="fixed inset-y-0 right-0 z-50 w-full transform overflow-y-auto bg-white px-6 py-6 transition-transform duration-300 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
          <div className="flex items-center justify-between">
            <a href="/" className="-m-1.5 p-1.5">
              <span className="sr-only">Pinelab</span>
              <img className="h-8 w-auto" src="/pinelab.svg" alt="Pinelab" />
            </a>
            <button
              type="button"
              className="-m-2.5 rounded-md p-2.5 text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              <span className="sr-only">Close menu</span>
              <XIcon />
            </button>
          </div>

          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-gray-500/10">
              <div className="space-y-2 py-6">
                {navigationItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold hover:bg-gray-50"
                    // Only close when it's not a new page navigation
                    onClick={() =>
                      item.href.startsWith('/#') ? setIsOpen(false) : undefined
                    }
                  >
                    {item.title}
                  </a>
                ))}
              </div>
              <div className="py-6">
                <a
                  href="/contact/"
                  className="-mx-3 block rounded-lg px-3 py-2.5 text-base/7 font-semibold hover:bg-gray-50"
                >
                  Contact
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
