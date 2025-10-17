import StatusBar from '../StatusBar';

export default function StatusBarExample() {
  return (
    <StatusBar
      botStatus="running"
      market="ETHUSDT"
      sessionTime="02:34:12"
      connectionStatus="connected"
      onPauseResume={() => console.log('Pause/Resume toggled')}
      onSettings={() => console.log('Settings opened')}
    />
  );
}
