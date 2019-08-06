import { AppState } from 'react-native'; //eslint-disable-line
import NetInfo from '@react-native-community/netinfo';

export default callback => {
  let wasOnline;
  const updateState = ({isConnected: isOnline}) => {
    if (wasOnline !== isOnline) {
      wasOnline = isOnline;
      callback(isOnline);
    }
  };

  NetInfo.addEventListener('connectionChange', updateState);
  NetInfo.fetch().then(updateState);
  AppState.addEventListener('change', () => {
    NetInfo.fetch().then(updateState);
  });
};
