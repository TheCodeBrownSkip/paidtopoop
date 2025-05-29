import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {},
  mounted: false,
});

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Effect to set initial theme and mark as mounted
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
      // In case localStorage or matchMedia is not available (e.g., server-side rendering)
      console.warn("Could not determine initial theme preference.");
    }
    setDarkMode(initialDarkMode);
    // Directly apply class here too, though _document.js script should handle FOUC
    document.documentElement.classList.toggle('dark', initialDarkMode);
    setMounted(true);
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

  // Return null if not mounted to prevent hydration issues on the client
  // This is important for the ThemeToggle button to get the correct initial darkMode state
  if (!mounted) {
    // During SSR or before hydration, we can provide a non-functional context
    // or simply return null. Returning null for children ensures they wait for client mount.
    return null; 
  }

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  // No undefined check needed here if ThemeContext.Provider always renders (even if children are null)
  // or if we ensure consumers check the `mounted` flag from the context if they need to act immediately.
  return context;
} 