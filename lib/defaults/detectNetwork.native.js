'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _reactNative = require('react-native');

var _netinfo = require('@react-native-community/netinfo');

var _netinfo2 = _interopRequireDefault(_netinfo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (callback) {
  var wasOnline = void 0;
  var updateState = function updateState(_ref) {
    var isOnline = _ref.isConnected;

    if (wasOnline !== isOnline) {
      wasOnline = isOnline;
      callback(isOnline);
    }
  };

  _netinfo2.default.addEventListener('connectionChange', updateState);
  _netinfo2.default.fetch().then(updateState);
  _reactNative.AppState.addEventListener('change', function () {
    _netinfo2.default.fetch().then(updateState);
  });
}; //eslint-disable-line