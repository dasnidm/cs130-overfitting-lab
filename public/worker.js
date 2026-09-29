import { simulate, repeatSimulation } from './stats.js';
self.onmessage = ({ data: config }) => {
  try {
    self.postMessage({ type: 'single', result: simulate(config) });
    self.postMessage({ type: 'average', result: repeatSimulation(config) });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
