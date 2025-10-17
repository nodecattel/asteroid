import VolumeChart, { HourlyData } from '../VolumeChart';

const mockData: HourlyData[] = [
  { hour: "10:00", volume: 3200, target: 4167 },
  { hour: "11:00", volume: 4500, target: 4167 },
  { hour: "12:00", volume: 3800, target: 4167 },
  { hour: "13:00", volume: 4200, target: 4167 },
  { hour: "14:00", volume: 2100, target: 4167 },
];

export default function VolumeChartExample() {
  return (
    <div className="p-4 bg-background">
      <VolumeChart data={mockData} />
    </div>
  );
}
