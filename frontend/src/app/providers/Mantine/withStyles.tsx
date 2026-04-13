import { MantineProvider, createTheme, type MantineColorsTuple } from '@mantine/core';
import type { ComponentType } from 'react';

const myColor: MantineColorsTuple = [
  '#f6f4f4',
  '#e7e7e7',
  '#cccccc',
  '#b0b0b0',
  '#9a9897',
  '#8e8987',
  '#88817e',
  '#766e6b',
  '#6b615e',
  '#3b3330',
];

const theme = createTheme({
  colors: {
    myColor,
  },
  primaryColor: 'myColor',
});

export const withStyles = (WrappedComponent: ComponentType) => () => (
  <MantineProvider theme={theme}>
    <WrappedComponent />
  </MantineProvider>
);
