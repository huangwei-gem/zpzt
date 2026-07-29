import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import request from '../utils/request';

interface ResponsiblePersonContextType {
  selectedPerson: string;
  setSelectedPerson: (person: string) => void;
  persons: string[];
  loading: boolean;
}

const ResponsiblePersonContext = createContext<ResponsiblePersonContextType>({
  selectedPerson: '',
  setSelectedPerson: () => {},
  persons: [],
  loading: false,
});

export const useResponsiblePerson = () => useContext(ResponsiblePersonContext);

export const ResponsiblePersonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedPerson, setSelectedPerson] = useState(() => {
    return sessionStorage.getItem('responsible_person') || '';
  });
  const [persons, setPersons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSetPerson = useCallback((person: string) => {
    setSelectedPerson(person);
    sessionStorage.setItem('responsible_person', person);
  }, []);

  const fetchPersons = useCallback(async () => {
    setLoading(true);
    try {
      const res: string[] = await request.get('/auth/responsible-persons');
      setPersons(res || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersons();
  }, [fetchPersons]);

  return (
    <ResponsiblePersonContext.Provider value={{ selectedPerson, setSelectedPerson: handleSetPerson, persons, loading }}>
      {children}
    </ResponsiblePersonContext.Provider>
  );
};

export default ResponsiblePersonContext;