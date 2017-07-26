// @flow

import type { AppState, Config, OfflineAction, ResultAction, Outbox } from './types';
import { OFFLINE_SEND, OFFLINE_SCHEDULE_RETRY } from './constants';
import { completeRetry, scheduleRetry, busy } from './actions';

const after = (timeout = 0) => {
  return new Promise(resolve => setTimeout(resolve, timeout));
};

const complete = (action: any, success: boolean, payload: {}): ResultAction => {
  if (typeof action === 'function') {
    return (dispatch, getState) => {
      // Must send an action with meta.completed = true to finish commit.
      dispatch({
        type: '@@OFFLINE_ACTION_COMPLETE',
        meta: {
          completed: true
        }
      });
      action(success, payload);
      return after();
    }
  }

  return { ...action, payload, meta: { ...(action.meta || {}), success, completed: true } };
};

const take = (state: AppState, config: Config): Outbox => {
  // batching is optional, for now
  if (config.batch) {
    return config.batch(state.offline.outbox);
  }

  return [state.offline.outbox[0]];
};

const send = (action: OfflineAction, dispatch, config: Config, retries = 0) => {
  const metadata = action.meta.offline;
  dispatch(busy(true));
  return config
    .effect(metadata.effect, action)
    .then(result => dispatch(complete(metadata.commit, true, result)))
    .catch(error => {
      // discard
      if (config.discard(error, action, retries)) {
        console.log('Discarding action', action.type);
        return dispatch(complete(metadata.rollback, false, error));
      }
      const delay = config.retry(action, retries);
      if (delay != null) {
        console.log('Retrying action', action.type, 'with delay', delay);
        if (typeof metadata.onRetryScheduled === 'function') {
          metadata.onRetryScheduled();
        }
        return dispatch(scheduleRetry(delay));
      } else {
        console.log('Discarding action', action.type, 'because retry did not return a delay');
        return dispatch(complete(metadata.rollback, false, error));
      }
    });
};

export const createOfflineMiddleware = (config: Config) => (store: any) => (next: any) => (
  action: any
) => {
  // allow other middleware to do their things
  const result = next(action);

  // find any actions to send, if any
  const state: AppState = store.getState();
  const actions = take(state, config);

  // if the are any actions in the queue that we are not
  // yet processing, send those actions
  if (
    actions.length > 0 &&
    !state.offline.busy &&
    !state.offline.retryScheduled &&
    state.offline.online
  ) {
    send(actions[0], store.dispatch, config, state.offline.retryCount);
  }

  if (action.type === OFFLINE_SCHEDULE_RETRY) {
    const retryToken = state.offline.retryToken;
    after(action.payload.delay).then(() => store.dispatch(completeRetry(retryToken)));
  }

  // if (action.type === 'Offline/COMPLETE_RETRY') {
  //   if (action.meta.retryToken === state.offline.retryToken && actions.length > 0) {
  //     send(actions[0], store.dispatch, config);
  //   }
  // }

  if (action.type === OFFLINE_SEND && actions.length > 0 && !state.offline.busy) {
    send(actions[0], store.dispatch, config, state.offline.retryCount);
  }

  // sometimes actions need to be rolled back if we are offline. This can be accomplished
  // by setting offlineRollback to true in the meta.offline property of the action.
  if (actions.length > 0 && !state.offline.online && actions[0].meta.offline.offlineRollback) {
    const action = actions[0];
    store.dispatch(complete(action.meta.offline.rollback, false, {}));
  }

  return result;
};
