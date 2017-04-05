import persist from './persist';
import detectNetwork from './detectNetwork';
import effect from './effect';
import batch from './batch';
import retry from './retry';
import discard from './discard';

export default {
  rehydrate: true,
  persist,
  persistOptions: {},
  detectNetwork,
  batch,
  effect,
  retry,
  discard
};
