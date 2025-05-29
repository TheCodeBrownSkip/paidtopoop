import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {},
});

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false);

  // Effect to set initial theme from localStorage or system preference
  useEffect(() => {
    let initialDarkMode = false;
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        initialDarkMode = savedTheme === 'dark';
      } else {
        initialDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch (e) {
      console.warn("Could not determine initial theme preference.");
    }
    setDarkMode(initialDarkMode);
    // The _document.js script primarily handles initial class, but this syncs state
    // document.documentElement.classList.toggle('dark', initialDarkMode); 
    // ^ We can even comment this out if _document.js handles the VERY first paint
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prevDarkMode => {
      const newDarkMode = !prevDarkMode;
      try {
        localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', newDarkMode);
      } catch (e) {
         console.warn("Could not persist theme change.");
      }
      return newDarkMode;
    });
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  return context;
} 