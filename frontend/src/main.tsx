import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import './index.css';

import { Router } from '@app/routing';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Router />
    </BrowserRouter>
  </StrictMode>,
);
