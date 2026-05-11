import { createContext, useContext, useRef, useState } from 'react';

const CameraContext = createContext(null);

export function CameraProvider({ children }) {
  const videoRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  return (
    <CameraContext.Provider value={{ videoRef, isReady, setIsReady, isRunning, setIsRunning }}>
      {children}
    </CameraContext.Provider>
  );
}

export function useCamera() {
  return useContext(CameraContext);
}
