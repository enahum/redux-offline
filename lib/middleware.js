'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createOfflineMiddleware = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _constants = require('./constants');

var _actions = require('./actions');

var after = function after() {
  var timeout = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

  return new Promise(function (resolve) {
    return setTimeout(resolve, timeout);
  });
};

var complete = function complete(action, success, payload) {
  if (typeof action === 'function') {
    return function (dispatch, getState) {
      // Must send an action with meta.completed = true to finish commit.
      dispatch({
        type: '@@OFFLINE_ACTION_COMPLETE',
        meta: {
          completed: true
        }
      });
      action(success, payload);
      return after();
    };
  }

  return _extends({}, action, { payload: payload, meta: _extends({}, action.meta || {}, { success: success, completed: true }) });
};

var take = function take(state, config) {
  // batching is optional, for now
  if (config.batch) {
    return config.batch(state.offline.outbox);
  }

  return [state.offline.outbox[0]];
};

var send = function send(action, dispatch, config) {
  var retries = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

  var metadata = action.meta.offline;
  dispatch((0, _actions.busy)(true));
  return config.effect(metadata.effect, action).then(function (result) {
    return dispatch(complete(metadata.commit, true, result));
  }).catch(function (error) {
    // discard
    if (config.discard(error, action, retries)) {
      console.log('Discarding action', action.type);
      return dispatch(complete(metadata.rollback, false, error));
    }
    var delay = config.retry(action, retries);
    if (delay != null) {
      console.log('Retrying action', action.type, 'with delay', delay);
      if (typeof metadata.onRetryScheduled === 'function') {
        metadata.onRetryScheduled();
      }
      return dispatch((0, _actions.scheduleRetry)(delay));
    } else {
      console.log('Discarding action', action.type, 'because retry did not return a delay');
      return dispatch(complete(metadata.rollback, false, error));
    }
  });
};

var createOfflineMiddleware = exports.createOfflineMiddleware = function createOfflineMiddleware(config) {
  return function (store) {
    return function (next) {
      return function (action) {
        // allow other middleware to do their things
        var result = next(action);

        // find any actions to send, if any
        var state = store.getState();
        var actions = take(state, config);

        // if the are any actions in the queue that we are not
        // yet processing, send those actions
        if (actions.length > 0 && !state.offline.busy && !state.offline.retryScheduled && state.offline.online) {
          send(actions[0], store.dispatch, config, state.offline.retryCount);
        }

        if (action.type === _constants.OFFLINE_SCHEDULE_RETRY) {
          var retryToken = state.offline.retryToken;
          after(action.payload.delay).then(function () {
            return store.dispatch((0, _actions.completeRetry)(retryToken));
          });
        }

        // if (action.type === 'Offline/COMPLETE_RETRY') {
        //   if (action.meta.retryToken === state.offline.retryToken && actions.length > 0) {
        //     send(actions[0], store.dispatch, config);
        //   }
        // }

        if (action.type === _constants.OFFLINE_SEND && actions.length > 0 && !state.offline.busy) {
          send(actions[0], store.dispatch, config, state.offline.retryCount);
        }

        // sometimes actions need to be rolled back if we are offline. This can be accomplished
        // by setting offlineRollback to true in the meta.offline property of the action.
        if (actions.length > 0 && !state.offline.online && actions[0].meta.offline.offlineRollback) {
          var _action = actions[0];
          store.dispatch(complete(_action.meta.offline.rollback, false, {}));
        }

        return result;
      };
    };
  };
};